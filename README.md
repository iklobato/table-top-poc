# Table-Top POC

Real‑time, round‑based game for tables of players with host control, built on Next.js 14 (App Router), Postgres (Prisma), Redis (pub/sub + locks), and Socket.IO.

- Web app (Next.js) serves UI and all HTTP APIs
- Socket.IO gateway (Node) on port 3001 bridges Redis pub/sub to browser rooms
- Postgres persists sessions, rounds, questions, answers, leaderboards
- Redis stores ephemeral state (deadlines, locks) and broadcasts events

## Architecture

Services (docker compose):
- web: Next.js app + launches `socket-server.js`
  - HTTP: `http://localhost:3000`
  - WS: `ws://localhost:3001` (Socket.IO)
- db: Postgres 16
- redis: Redis 7

Core flows:
- Host starts a round ⇒ backend writes `started_at/deadline` (DB+Redis) and publishes `round_started` to session channel
- A 1s ticker publishes `countdown_tick` and triggers finalize when deadline hits (single‑instance lock via Redis)
- Players submit answers once per round; server computes points from the role’s variant mapping and persists
- Finalize computes leaderboard per table (raw + normalized placeholder) and publishes `round_finalized`

## Data model (Prisma)
- `Table(id, name, is_active, created_at, answers[], leaderboards[])`
- `Role(id, name, is_active, order_index, answers[])`
- `GameSession(id, name, status, total_rounds, tables, players, questions, rounds, leaderboard, created_at)`
- `SessionTable(id, session_id, table_id, is_locked)`
- `Player(id, display_name?, table_id?, session_id?, role_id?, joined_at, last_seen_at)`
- `Question(id, session_id?, topic, source, status, variants[], rounds[])`
- `QuestionVariant(id, question_id, role_id?, prompt, choice_a/b/c/d, points_a/b/c/d, metadata?)`
- `Round(id, session_id, question_id?, index, status, started_at?, deadline_at?, finalized_at?, answers[], leaderboards[])`
- `Answer(id, round_id, player_id, role_id?, table_id?, choice, points_awarded, response_ms, submitted_at)`
- `LeaderboardCache(id, session_id, round_id?, table_id, raw_points, normalized_points, total_response_ms, rank)`

Indexes/constraints:
- `LeaderboardCache`: unique `(session_id, round_id, table_id)`

## Redis keys & channels
- Keys
  - `session:{id}:round:{n}:status` → `LIVE`/`CLOSED`
  - `session:{id}:round:{n}:deadline_ts` → unix ms
  - `lock:round_finalize:{session_id}:{n}` → mutex
  - `presence:table:{table_id}` → set of active player ids
- Pub/Sub channels
  - `events:session:{id}` → host/admin room
  - `events:table:{table_id}` → player room

## WebSocket events
Published via Redis and bridged by `socket-server.js` to Socket.IO rooms:
- `round_started` { roundIndex, roundId, deadlineTs, questionId }
- `countdown_tick` { roundIndex, remainingMs }
- `answer_submitted` { roundId, playerId }
- `round_ended` { roundIndex }
- `round_finalized` { roundIndex }

Client rooms & presence:
- Players: `join_table({ tableId, playerId })`, periodic `heartbeat`
- Host: `join_host({ sessionId })`

## HTTP API (selected)
- POST `/api/sessions` → { session }
- GET `/api/sessions` → { sessions }
- POST `/api/sessions/{id}/start-round` → { round }
- POST `/api/sessions/{id}/stop-round` → { round }
- POST `/api/sessions/{id}/finalize-round` → { round }
- GET `/api/sessions/{id}/state` → { session }
- POST `/api/questions` → { questionId }
- POST `/api/answers` → { ok, answer }
- GET `/api/leaderboard?sessionId=...` → { roundIndex, entries }
- POST `/api/players` → { player }
- GET `/api/round-variant?roundId=...&roleId=...` → role/generic variant
- GET `/api/tables` → { tables }
- GET `/api/roles` → { roles }
- GET `/api/meta` → { roundSeconds }
- GET `/api/_ticker` → starts ticker in‑process (idempotent)

## UI pages (App Router)
- `/` Home: create session, recent sessions, links to join/host/results
- `/join`: pick session, table, role → creates player and redirects to `/game`
- `/game`: listens for round events, loads per‑role variant, submits answer
- `/host`: join host room, start/stop round, watch live ticks/events
- `/results`: shows current round leaderboard

## Getting started
Requirements: Docker Desktop

1) Copy environment file
```
cp .env.example .env
```

2) Start services
```
docker compose up -d --build
```
- Web: `http://localhost:3000`
- Socket.IO: `ws://localhost:3001`

3) Seed sample tables/roles (optional)
```
curl -s -X POST http://localhost:3000/api/seed | jq .
```

4) Quick smoke test (end‑to‑end)
```
# Create session
SID=$(curl -s -X POST -H 'Content-Type: application/json' \
  http://localhost:3000/api/sessions \
  -d '{"name":"Smoke"}' | python3 -c "import sys, json; print(json.load(sys.stdin)['session']['id'])")

# Add approved generic question
curl -s -X POST -H 'Content-Type: application/json' http://localhost:3000/api/questions \
  -d '{"sessionId":"'"$SID"'","topic":"POC","status":"APPROVED","variants":[{"prompt":"2+2?","choiceA":"4","choiceB":"3","choiceC":"5","choiceD":"6","pointsA":5,"pointsB":0,"pointsC":0,"pointsD":0}]}' | jq .

# Start ticker and round
curl -s http://localhost:3000/api/_ticker | jq .
RID=$(curl -s -X POST http://localhost:3000/api/sessions/$SID/start-round | python3 -c "import sys, json; print(json.load(sys.stdin)['round']['id'])")

# Create player (table t1, role r1) and submit correct answer
PID=$(curl -s -X POST -H 'Content-Type: application/json' http://localhost:3000/api/players \
  -d '{"sessionId":"'"$SID"'","tableId":"t1","roleId":"r1"}' | python3 -c "import sys, json; print(json.load(sys.stdin)['player']['id'])")

curl -s "http://localhost:3000/api/round-variant?roundId=$RID&roleId=r1" | jq .

curl -s -X POST -H 'Content-Type: application/json' http://localhost:3000/api/answers \
  -d '{"roundId":"'"$RID"'","playerId":"'"$PID"'","tableId":"t1","roleId":"r1","choice":"A"}' | jq .

# Finalize and view leaderboard
curl -s -X POST http://localhost:3000/api/sessions/$SID/finalize-round | jq .
curl -s "http://localhost:3000/api/leaderboard?sessionId=$SID" | jq .
```

## Development
- Logs
  - Web container: `docker compose logs -f web`
- DB Migrations
  - Create/apply: `docker compose exec -T web npx prisma migrate dev --name <name>`
  - Generate client: `docker compose exec -T web npx prisma generate`
- Prisma Studio (optional)
  - `docker compose exec -T web npx prisma studio`

## Configuration
Environment variables (`.env`):
- `DATABASE_URL` Postgres DSN (default container DSN provided)
- `REDIS_URL` Redis URL (default `redis://redis:6379/0`)
- `HOST_CONSOLE_TOKEN` Placeholder for host auth (POC not enforced)
- `AI_PROVIDER_API_KEY` Reserved for AI question gen (not implemented)
- `SESSION_MAX_ROUNDS` Default 5
- `ROUND_SECONDS` Default 180

## Design notes & constraints
- POC intentionally keeps auth minimal; host token not enforced yet
- Normalized scoring is stored but shown equal to raw for now
- Ticker runs in‑process in the web container; Redis lock prevents multi‑instance finalize races
- Socket.IO uses a separate Node server for simplicity (`socket-server.js` + Redis adapter)

## Roadmap / nice‑to‑haves
- Host auth enforcement with simple token header
- AI‑assist question generation + approval UI
- Normalized vs raw leaderboard toggle
- CSV export of results
- Presence UI in host console
- Health checks endpoints + structured logs dashboard

## Troubleshooting
- Build errors about `DATABASE_URL` during export: routes are marked `force-dynamic` to avoid build‑time DB access
- Redis connection during build: Redis clients now use lazy connect and only at runtime
- If socket events aren’t received in browser, ensure the client points to `http://localhost:3001` and the container is exposing `3001`

## License
MIT (POC)
