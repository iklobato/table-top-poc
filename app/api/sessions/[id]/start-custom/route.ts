import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis, CHANNELS, KEYS } from "@/lib/redis";

export const dynamic = 'force-dynamic';

type Body = {
  prompt: string;
  choiceA: string;
  choiceB: string;
  choiceC: string;
  choiceD: string;
  pointsA?: number;
  pointsB?: number;
  pointsC?: number;
  pointsD?: number;
  tableId?: string | null;
  seconds?: number;
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionId = params.id;
  const body = (await req.json()) as Body;
  const {
    prompt,
    choiceA,
    choiceB,
    choiceC,
    choiceD,
    pointsA = 5,
    pointsB = 0,
    pointsC = 0,
    pointsD = 0,
    tableId,
    seconds,
  } = body || ({} as Body);

  if (!prompt || !choiceA || !choiceB || !choiceC || !choiceD) {
    return NextResponse.json({ error: "prompt and all choices A..D are required" }, { status: 400 });
  }

  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, include: { rounds: true } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const nextIndex = (session.rounds?.length || 0) + 1;
  const now = new Date();
  const sec = Number(seconds || process.env.ROUND_SECONDS || 180);
  const deadline = new Date(now.getTime() + sec * 1000);

  // Create a generic question and variant for this custom round
  const question = await prisma.question.create({
    data: {
      session_id: sessionId,
      topic: 'CUSTOM',
      status: 'APPROVED',
      variants: {
        create: [{
          prompt,
          choice_a: choiceA,
          choice_b: choiceB,
          choice_c: choiceC,
          choice_d: choiceD,
          points_a: pointsA,
          points_b: pointsB,
          points_c: pointsC,
          points_d: pointsD,
        }],
      },
    },
    include: { variants: true },
  });

  const round = await prisma.round.create({
    data: {
      session_id: sessionId,
      question_id: question.id,
      index: nextIndex,
      status: 'LIVE',
      started_at: now,
      deadline_at: deadline,
    },
  });

  await redis.set(KEYS.roundStatus(sessionId, nextIndex), 'LIVE');
  await redis.set(KEYS.roundDeadline(sessionId, nextIndex), String(deadline.getTime()));

  const payload = { type: 'round_started', roundIndex: nextIndex, roundId: round.id, deadlineTs: deadline.getTime(), questionId: question.id };

  if (tableId) {
    // Target a single table only
    await redis.publish(CHANNELS.tableEvents(tableId), JSON.stringify(payload));
  } else {
    // Broadcast to the entire session (will reach all sockets)
    await redis.publish(CHANNELS.sessionEvents(sessionId), JSON.stringify(payload));
  }

  return NextResponse.json({ round, question });
}


