import { redis, CHANNELS, KEYS } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

export async function startTicker() {
  const timer = setInterval(async () => {
    try {
      const liveRounds = await prisma.round.findMany({ where: { status: "LIVE" } });
      const now = Date.now();
      for (const r of liveRounds) {
        const deadlineTs = r.deadline_at?.getTime() ?? 0;
        const remaining = Math.max(0, deadlineTs - now);
        await redis.publish(CHANNELS.sessionEvents(r.session_id), JSON.stringify({
          type: "countdown_tick",
          roundIndex: r.index,
          remainingMs: remaining,
        }));
        if (remaining <= 0) {
          // best-effort finalize via HTTP endpoint to reuse logic
          await fetch(`${process.env.INTERNAL_BASE_URL ?? "http://localhost:3000"}/api/sessions/${r.session_id}/finalize-round`, { method: "POST" });
        }
      }
    } catch (e) {
      // swallow in ticker; log only
      console.error("ticker error", e);
    }
  }, 1000);
  return () => clearInterval(timer);
}
