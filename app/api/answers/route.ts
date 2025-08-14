import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis, CHANNELS, KEYS } from "@/lib/redis";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { roundId, playerId, roleId, tableId, choice } = body ?? {};

  if (!roundId || !playerId || !choice) {
    return NextResponse.json({ error: "roundId, playerId, choice required" }, { status: 400 });
  }

  const round = await prisma.round.findUnique({ where: { id: roundId }, include: { question: { include: { variants: true } } } });
  if (!round || round.status !== "LIVE" || !round.started_at) {
    return NextResponse.json({ error: "Round not live" }, { status: 400 });
  }

  const now = new Date();
  const deadlineTs = round.deadline_at?.getTime() ?? 0;
  if (deadlineTs && now.getTime() > deadlineTs) {
    return NextResponse.json({ error: "Deadline passed" }, { status: 400 });
  }

  // Enforce single submission per player per round
  const existing = await prisma.answer.findFirst({ where: { round_id: roundId, player_id: playerId } });
  if (existing) {
    return NextResponse.json({ ok: true, answerId: existing.id });
  }

  // Compute points using question variant mapping
  const responseMs = Math.max(0, now.getTime() - round.started_at.getTime());
  let points = 0;
  if (round.question) {
    const variant = round.question.variants.find(v => v.role_id === roleId) || round.question.variants.find(v => v.role_id == null);
    if (variant) {
      if (choice === "A") points = variant.points_a;
      else if (choice === "B") points = variant.points_b;
      else if (choice === "C") points = variant.points_c;
      else if (choice === "D") points = variant.points_d;
    }
  }

  const answer = await prisma.answer.create({
    data: {
      round_id: roundId,
      player_id: playerId,
      role_id: roleId ?? null,
      table_id: tableId ?? null,
      choice,
      points_awarded: points,
      response_ms: responseMs,
    },
  });

  await redis.publish(
    CHANNELS.sessionEvents(round.session_id),
    JSON.stringify({ type: "answer_submitted", roundId, playerId })
  );

  return NextResponse.json({ ok: true, answer });
}
