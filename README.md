# Table-Top POC

A real‑time, round‑based game for tables of players with a single admin dashboard and a single player page.

- Next.js 14 (App Router) for UI + HTTP APIs
- Postgres (Prisma) for durable data
- Redis for pub/sub events, countdowns, and locks
- Socket.IO gateway (Node) for live updates (rooms per table and host)

## Quick start

Requirements: Docker Desktop (or Docker Engine)

1) Copy env
```
cp .env.example .env
```

2) Build and run
```
docker compose up -d --build
```
- App: http://localhost:3000
- Admin dashboard: http://localhost:3000/admin
- Player page (join + play): http://localhost:3000/
- Socket.IO server: ws://localhost:3001

3) Seed sample tables/roles (optional)
```
curl -s -X POST http://localhost:3000/api/seed | jq .
```

4) Admin flow (via UI)
- Go to `/admin`
- Create a session
- Add one or more sample questions
- Start ticker (optional, enables live countdowns)
- Start round → players at `/` get their role’s variant
- Finalize round → leaderboard updates instantly

5) Player flow (via UI)
- Go to `/`
- Provide your name, select session, table, and role → Join
- When round starts: see question and timer, pick one option → Submit

## Run locally without Docker

### Prerequisites
- Node.js 20.x (LTS)
- npm 10+
- PostgreSQL 14+ (or 15/16)
- Redis 6+

On macOS you can install services via Homebrew:
```
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis
```

### 1) Environment
Copy and adjust `.env` for local services:
```
cp .env.example .env
```
Recommended local values:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/table_top?schema=public
REDIS_URL=redis://localhost:6379/0
# Optional
SESSION_MAX_ROUNDS=5
ROUND_SECONDS=180
```

### 2) Database
Create the database if it doesn't exist:
```
createdb table_top || true
```
Apply Prisma migrations and generate client:
```
npm ci
npx prisma generate
npx prisma migrate dev --name init
```
If migrations already exist and you want to apply exactly those, use:
```
npx prisma migrate deploy
```

### 3) Run the app (two processes)
Start Next.js dev server:
```
npm run dev
```
In another terminal, start the Socket.IO gateway:
```
node socket-server.js
```
- App: http://localhost:3000
- Admin dashboard: http://localhost:3000/admin
- Socket.IO server: http://localhost:3001

Tip (macOS/Linux) to run both temporarily in one shell:
```
(node socket-server.js &) && npm run dev
```

### 4) Seed and ticker
Optionally seed base data (tables, roles):
```
curl -s -X POST http://localhost:3000/api/seed | jq .
```
Start the in‑process ticker (idempotent):
```
curl -s -X POST http://localhost:3000/api/_ticker | jq .
```

### Production‑like local run
Build and start Next.js in production mode:
```
npm run build
npm start
```
Run the Socket.IO gateway separately:
```
node socket-server.js
```
Ensure your `.env` points to production‑grade Postgres/Redis.

## How the system works

### Game objects
- **Session**: A game instance that can contain multiple rounds. Players join a specific session.
- **Table**: Physical/virtual table grouping players. Leaderboard is per table.
- **Role**: Player role within a table (e.g., r1, r2…). Roles can have role‑specific question variants.
- **Question**: Canonical question with multiple choice options `[A..D]`.
- **QuestionVariant**: Role‑specific mapping of options to points (e.g., A:10, B:5, ...). There is also a generic variant if a role doesn’t have a dedicated one.
- **Round**: A single play window with start time, deadline, and a chosen question.
- **Answer**: A player’s single submission for a round.
- **LeaderboardCache**: Per‑table, per‑round totals (raw and normalized placeholder).

### Round lifecycle
1) Admin starts a round → server selects a question, creates a `Round`, sets `started_at` and `deadline_at`, stores `deadline_ts` in Redis, publishes `round_started`.
2) Ticker publishes `countdown_tick` every 1s via Redis pub/sub and Socket.IO.
3) Players submit once before `deadline_ts`. Server validates: unique submission per player/round, deadline not passed, valid option.
4) On deadline or on admin action, finalize acquires a Redis lock, aggregates per‑table totals into `LeaderboardCache`, publishes `round_finalized`.

### Real‑time events and rooms
- **Rooms**
  - Host room: `host:{sessionId}` (admin dashboard)
  - Table room: `table:{tableId}` (players at the same table)
- **Events** (from Redis → Socket.IO → clients)
  - `round_started` { sessionId, roundId, deadlineTs, questionId }
  - `countdown_tick` { sessionId, roundId, remainingSeconds }
  - `answer_submitted` { sessionId, roundId, tableId, playerId }
  - `round_finalized` { sessionId, roundId }

### Scoring model
- Each `QuestionVariant` contains a points map for options A..D.
- On submit, the server looks up the role‑specific variant (or generic fallback) and applies the points.
- `LeaderboardCache` stores per‑table totals per round. Normalized scoring is reserved (currently equals raw totals).

### Timers & concurrency
- **Ticker**: An in‑process 1s interval posts `countdown_tick` and checks deadlines.
- **Finalize lock**: A Redis `SET key value NX PX=30000` mutex prevents double finalization across processes.
- **Adapter**: Socket.IO uses the Redis adapter so multiple instances can broadcast consistently.

## Using the Admin dashboard (all features)
Location: `http://localhost:3000/admin`

- **Create session**: Initializes a new game session. Sessions appear in both admin and player UIs.
- **Rooms overview**: Live presence and participants per table, showing names, roles, and join times.
- **Add questions**: Create a base question and one or more role‑specific variants with points mapping.
- **Start ticker**: Enables global countdown ticks (safe to call multiple times). Required for live timers.
- **Start round**: Picks an approved question and starts a round. Broadcasts `round_started` to host and relevant table rooms.
- **Start custom round**: Send a custom question (prompt, choices, seconds) to one specific table or to all tables in the session.
- **Stop round (early)**: Optional endpoint to end the round before the deadline.
- **Finalize round**: Stops submissions, aggregates scores into the per‑table leaderboard, broadcasts `round_finalized`.
- **View leaderboard**: Fetch per‑round, per‑table totals via `GET /api/leaderboard?sessionId=...`.

Notes:
- Multiple rounds per session are supported. Final multi‑round aggregation can be added on top of `LeaderboardCache`.
- Admin auth token is reserved via `HOST_CONSOLE_TOKEN` but not enforced in this POC.

## Using the Player page (all features)
Location: `http://localhost:3000/`

- **Join**: Provide your name, pick a session, table, and role, then join.
- **Wait**: When the admin starts a round, you will receive the question (generic or role‑specific variant) and a live countdown.
- **Answer**: Pick one option A..D. Only one submission is accepted before the deadline.
- **Live updates**: Countdown ticks and round finalization appear in real time via WebSockets.
- **After finalize**: Acknowledge results and wait for the next round.

Rules applied to players:
- One submission per round per player.
- Submissions after the deadline are rejected.
- Answers must be one of A..D.

## HTTP API reference

- Sessions
  - `GET /api/sessions` → List sessions
  - `POST /api/sessions` → Create session `{ name, totalRounds?, tableIds? }`
  - `GET /api/sessions/{id}/state` → Session with rounds summary
  - `POST /api/sessions/{id}/start-round` → Start next round using approved question
  - `POST /api/sessions/{id}/stop-round` → Stop current round early
  - `POST /api/sessions/{id}/finalize-round` → Finalize current live round
  - `POST /api/sessions/{id}/start-custom` → Start a custom question round (single table or all)
    - Body: `{ prompt, choiceA..D, pointsA..D?, seconds?, tableId? }`

- Questions
  - `POST /api/questions` → Create question and variants for session
  - `GET /api/round-variant?roundId=...&roleId=...` → Get the role‑specific or generic variant for the round

- Players & Answers
  - `POST /api/players` → Create a player (join) `{ sessionId, tableId, roleId, displayName }`
  - `POST /api/answers` → Submit an answer `{ roundId, playerId, roleId, tableId, choice }`

- Leaderboard
  - `GET /api/leaderboard?sessionId=...` → Per‑round leaderboard entries for the latest round

- Catalogs
  - `GET /api/tables` → List tables
  - `GET /api/roles` → List roles

- Admin
  - `GET /api/admin/rooms?sessionId=...` → Rooms overview (participants per table + presence)

- System
  - `GET /api/meta` → Basic config (roundSeconds)
  - `POST /api/_ticker` → Start in‑process ticker (idempotent)
  - `POST /api/seed` → Seed base data (tables, roles)
  - `GET /api/socket` → Socket placeholder/health

## Folder & file guide

Top‑level
- `docker-compose.yml`: Defines services (web, db, redis). The web service runs Next.js and the Socket.IO gateway.
- `Dockerfile`: Builds the Next.js production image.
- `package.json`: App scripts, dependencies (Next.js, Prisma, ioredis, socket.io, Tailwind, etc.)
- `.env.example`: Template for environment variables (copy to `.env`).
- `README.md`: Project documentation (this file).

Next.js app (App Router)
- `app/layout.tsx`: Root layout and Tailwind global styles injection
- `app/globals.css`: Tailwind layers and a minimal dark theme
- `app/page.tsx`: Unified player page (join + play). Handles: join session/table/role, listens to Socket.IO, shows question, submits answer.
- `app/(routes)/admin/page.tsx`: Single admin dashboard (create session, add sample Qs, start ticker, start/stop/finalize round, view events, custom rounds)

HTTP APIs (all under `app/api/`)
- See HTTP API reference above

Socket gateway
- `app/api/socket/io.ts`: Server instance/adapter bootstrap (used by route placeholder)
- `app/api/socket/route.ts`: No‑op endpoint (health placeholder)
- `socket-server.js`: Separate Node Socket.IO server started by the web container; uses Redis adapter. Bridges Redis pub/sub to rooms:
  - Host room: `host:{sessionId}`
  - Table rooms: `table:{tableId}`
  - Subscribes to `events:*` channels and emits:
    - `round_started`, `countdown_tick`, `round_finalized`, `answer_submitted`

Library code
- `lib/prisma.ts`: Prisma client singleton
- `lib/redis.ts`: Redis clients, key builders, and channel helpers
- `lib/scoring.ts`: Computes per‑table totals and writes leaderboard cache
- `lib/ticker.ts`: 1s interval publisher of `countdown_tick`; triggers finalize at deadline

Database & Prisma
- `prisma/schema.prisma`: Models
  - `Table`, `Role`, `GameSession`, `SessionTable`, `Player`
  - `Question`, `QuestionVariant`, `Round`, `Answer`, `LeaderboardCache`
  - Unique: `LeaderboardCache(session_id, round_id, table_id)`
- `prisma/migrations/*`: SQL migrations (auto‑applied on container boot)

Styling
- `tailwind.config.ts`, `postcss.config.js`: Tailwind/PostCSS setup
- `app/globals.css`: Minimal design tokens and utilities

Scripts (Node)
- `scripts/load_simulator.js`: Creates a session, adds a sample question, starts ticker + round, spawns many players that answer, finalizes and prints leaderboard
- `scripts/admin_sim.js`: Seeds base data, creates a session, writes `scripts/.session.json`, adds Qs, starts ticker + round, finalizes, prints leaderboard
- `scripts/user1_sim.js`: Reads `.session.json`, joins table with role `r1`, fetches variant, answers `A`
- `scripts/user2_sim.js`: Reads `.session.json`, joins table with role `r2`, fetches variant, answers `A`

Example to run the three scripts together:
```
# in one shell
node scripts/admin_sim.js & sleep 2; node scripts/user1_sim.js & node scripts/user2_sim.js & wait
```
(If users start too early and `.session.json` is not written yet, rerun the user scripts.)

## Configuration
Environment variables (see `.env.example`):
- `DATABASE_URL` → Postgres DSN (compose defaults provided)
- `REDIS_URL` → Redis URL (default `redis://redis:6379/0` for compose)
- `HOST_CONSOLE_TOKEN` → Reserved for admin auth (not enforced in POC)
- `AI_PROVIDER_API_KEY` → Reserved for AI‑assist question generation (not implemented)
- `SESSION_MAX_ROUNDS` → default 5
- `ROUND_SECONDS` → default 180

## Redis keys & channels
- Keys:
  - `session:{id}:round:{n}:status` → LIVE/CLOSED
  - `session:{id}:round:{n}:deadline_ts` → deadline ms
  - `lock:round_finalize:{session_id}:{n}` → mutex
  - `presence:table:{table_id}` → set of active player ids
- Channels:
  - `events:session:{id}` → host admin events
  - `events:table:{table_id}` → player room events

## Development notes
- The web container runs: `npx prisma migrate deploy && npx prisma generate && (node socket-server.js &) && next dev`
- Logs: `docker compose logs -f web`
- Migrations: `docker compose exec -T web npx prisma migrate dev --name <name>`
- Prisma Studio: `docker compose exec -T web npx prisma studio`

## Known gaps (POC scope)
- Admin auth token validation is not enforced
- Normalized scoring toggle (currently normalized == raw)
- Full final leaderboard across multiple rounds (per‑round is implemented; final aggregation is easy to add)
- CSV export
- Presence visualization in host UI (basic presence done; richer UI TBD)
- AI‑assist question generation

## Troubleshooting
- If you see build‑time DB/Redis errors: routes are marked dynamic and clients use lazy connect; ensure `.env` is set and rebuild
- If Socket.IO events don’t arrive, confirm the client connects to `http://localhost:3001` and port 3001 is exposed
- If simulator user scripts fail with `.session.json` missing, run `admin_sim.js` first or rerun users after ~2 seconds
