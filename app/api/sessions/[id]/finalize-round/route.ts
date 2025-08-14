import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis, CHANNELS, KEYS } from "@/lib/redis";
import { computeRoundLeaderboard } from "@/lib/scoring";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessionId = params.id;
  const round = await prisma.round.findFirst({ where: { session_id: sessionId, status: "LIVE" } });
  if (!round) return NextResponse.json({ error: "No live round" }, { status: 400 });

  const lockKey = KEYS.finalizeLock(sessionId, round.index);
  // Best-effort lock for POC; use atomic SET PX NX. TS types in ioredis can be strict, so cast to any.
  const lock = await (redis as any).set(lockKey, "1", "PX", 30000, "NX");
  if (!lock) {
    return NextResponse.json({ ok: false, message: "Finalize already in progress" }, { status: 202 });
  }

  // Close round
  const updated = await prisma.round.update({
    where: { id: round.id },
    data: { status: "CLOSED", finalized_at: new Date() },
  });

  await redis.set(KEYS.roundStatus(sessionId, round.index), "CLOSED");

  // TODO: Auto-submit zeros for non-responders (optional)

  await computeRoundLeaderboard(sessionId, round.id);

  await redis.publish(
    CHANNELS.sessionEvents(sessionId),
    JSON.stringify({ type: "round_finalized", roundIndex: round.index })
  );

  return NextResponse.json({ round: updated });
}
