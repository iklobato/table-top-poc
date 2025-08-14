import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sessionId, topic, source = "MANUAL", status = "DRAFT", variants = [] } = body ?? {};

  if (!topic) {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }

  const question = await prisma.question.create({
    data: {
      session_id: sessionId ?? null,
      topic,
      source,
      status,
    },
  });

  if (variants?.length) {
    await prisma.questionVariant.createMany({
      data: variants.map((v: any) => ({
        question_id: question.id,
        role_id: v.roleId ?? null,
        prompt: v.prompt,
        choice_a: v.choiceA,
        choice_b: v.choiceB,
        choice_c: v.choiceC,
        choice_d: v.choiceD,
        points_a: v.pointsA,
        points_b: v.pointsB,
        points_c: v.pointsC,
        points_d: v.pointsD,
        metadata: v.metadata ?? undefined,
      })),
    });
  }

  return NextResponse.json({ questionId: question.id });
}
