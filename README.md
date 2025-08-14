# Table-Top POC

Dockerized Next.js 14 app with Prisma/Postgres and Redis for a real-time game orchestration demo.

- Next.js (app router) + API routes
- Prisma + Postgres
- Redis for pub/sub and locks
- Socket.IO gateway (port 3001)

## Quick start

- Copy `.env.example` to `.env` and adjust as needed
- `docker compose up -d --build`
- App: http://localhost:3000
- Socket: ws://localhost:3001
