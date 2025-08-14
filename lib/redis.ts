import Redis from "ioredis";

const url = process.env.REDIS_URL || "redis://localhost:6379/0";

const opts = { lazyConnect: true, maxRetriesPerRequest: null as any, enableReadyCheck: false } as const;

export const redis = new Redis(url, opts);

export const pub = new Redis(url, opts);
export const sub = new Redis(url, opts);

export const CHANNELS = {
  sessionEvents: (sessionId: string) => `events:session:${sessionId}`,
  tableEvents: (tableId: string) => `events:table:${tableId}`,
};

export const KEYS = {
  roundStatus: (sessionId: string, n: number) => `session:${sessionId}:round:${n}:status`,
  roundDeadline: (sessionId: string, n: number) => `session:${sessionId}:round:${n}:deadline_ts`,
  finalizeLock: (sessionId: string, n: number) => `lock:round_finalize:${sessionId}:${n}`,
  tablePresence: (tableId: string) => `presence:table:${tableId}`,
};
