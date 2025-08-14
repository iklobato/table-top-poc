import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis, CHANNELS, KEYS } from "@/lib/redis";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessionId = params.id;

  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, include: { rounds: true, questions: { include: { variants: true } } } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  // Determine next round index
  const nextIndex = (session.rounds?.length || 0) + 1;
  const maxRounds = Number(process.env.SESSION_MAX_ROUNDS || session.total_rounds || 5);
  if (nextIndex > maxRounds) {
    return NextResponse.json({ error: "All rounds completed" }, { status: 400 });
  }

  const now = new Date();
  const seconds = Number(process.env.ROUND_SECONDS || 180);
  const deadline = new Date(now.getTime() + seconds * 1000);

  // pick a question: next unasked approved, else any
  const approved = session.questions.filter(q => q.status === "APPROVED");
  const picked = approved[nextIndex - 1] || session.questions[nextIndex - 1] || session.questions[0] || null;

  const round = await prisma.round.create({
    data: {
      session_id: sessionId,
      question_id: picked?.id ?? null,
      index: nextIndex,
      status: "LIVE",
      started_at: now,
      deadline_at: deadline,
    },
  });

  // cache in Redis
  await redis.set(KEYS.roundStatus(sessionId, nextIndex), "LIVE");
  await redis.set(KEYS.roundDeadline(sessionId, nextIndex), String(deadline.getTime()));

  // Broadcast round_started
  await redis.publish(
    CHANNELS.sessionEvents(sessionId),
    JSON.stringify({ type: "round_started", roundIndex: nextIndex, roundId: round.id, deadlineTs: deadline.getTime(), questionId: picked?.id ?? null })
  );

  return NextResponse.json({ round });
}
