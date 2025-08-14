import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis, CHANNELS, KEYS } from "@/lib/redis";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessionId = params.id;
  const round = await prisma.round.findFirst({ where: { session_id: sessionId, status: "LIVE" } });
  if (!round) return NextResponse.json({ error: "No live round" }, { status: 400 });

  const updated = await prisma.round.update({
    where: { id: round.id },
    data: { status: "CLOSED", finalized_at: new Date() },
  });

  await redis.set(KEYS.roundStatus(sessionId, round.index), "CLOSED");
  await redis.publish(
    CHANNELS.sessionEvents(sessionId),
    JSON.stringify({ type: "round_ended", roundIndex: round.index })
  );

  return NextResponse.json({ round: updated });
}
