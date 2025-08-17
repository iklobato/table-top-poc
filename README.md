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
- Select session, table, and role → Join
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

### 5) Simulate locally
Run an admin script plus two users:
```
node scripts/admin_sim.js & sleep 2; node scripts/user1_sim.js & node scripts/user2_sim.js & wait
```
If users start too early and `.session.json` isn't ready, rerun the user scripts.

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

## How it works (high‑level)

- Admin starts a round. Server picks the next approved question, stamps `started_at` and `deadline_at`, stores to DB and Redis, and publishes `round_started`.
- A 1s ticker (
Redis pub/sub + in‑process interval) publishes `countdown_tick` and calls finalize at deadline (with a Redis lock to avoid races).
- Players submit once per round. Server enforces deadline and computes points from the role’s question variant mapping.
- Finalize computes per‑table leaderboard (raw points, normalized placeholder), stores cache, and publishes `round_finalized`.

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
- `app/(routes)/admin/page.tsx`: Single admin dashboard (create session, add sample Qs, start ticker, start/stop/finalize round, view events)

HTTP APIs (all under `app/api/`)
- `app/api/sessions/route.ts`: GET list sessions; POST create session
- `app/api/sessions/[id]/start-round/route.ts`: POST start next round
- `app/api/sessions/[id]/stop-round/route.ts`: POST stop round early
- `app/api/sessions/[id]/finalize-round/route.ts`: POST finalize current round
- `app/api/sessions/[id]/state/route.ts`: GET session + rounds
- `app/api/questions/route.ts`: POST create question + role variants
- `app/api/players/route.ts`: POST create a player (join)
- `app/api/answers/route.ts`: POST submit answer (single‑submission enforced)
- `app/api/leaderboard/route.ts`: GET current round leaderboard
- `app/api/round-variant/route.ts`: GET role/generic variant for a round
- `app/api/tables/route.ts`: GET tables
- `app/api/roles/route.ts`: GET roles
- `app/api/meta/route.ts`: GET basic config (round seconds)
- `app/api/_ticker/route.ts`: Starts the in‑process 1s ticker (idempotent)

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

## APIs (selected)
- Sessions: `POST /api/sessions`, `GET /api/sessions`, `GET /api/sessions/{id}/state`
- Rounds: `POST /api/sessions/{id}/start-round`, `POST /api/sessions/{id}/stop-round`, `POST /api/sessions/{id}/finalize-round`
- Questions: `POST /api/questions` (with variants)
- Players/Answers: `POST /api/players`, `POST /api/answers`
- Leaderboard: `GET /api/leaderboard?sessionId=...`
- Variants: `GET /api/round-variant?roundId=...&roleId=...`

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
- Presence visualization in host UI
- AI‑assist question generation

## Troubleshooting
- If you see build‑time DB/Redis errors: routes are marked dynamic and clients use lazy connect; ensure `.env` is set and rebuild
- If Socket.IO events don’t arrive, confirm the client connects to `http://localhost:3001` and port 3001 is exposed
- If simulator user scripts fail with `.session.json` missing, run `admin_sim.js` first or rerun users after ~2 seconds
