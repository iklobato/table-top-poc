import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roundId = searchParams.get("roundId");
  const roleId = searchParams.get("roleId");
  if (!roundId) return NextResponse.json({ error: "roundId required" }, { status: 400 });

  const round = await prisma.round.findUnique({ where: { id: roundId }, include: { question: { include: { variants: true } } } });
  if (!round || !round.question) return NextResponse.json({ error: "Round not initialized with question" }, { status: 404 });

  const variant = round.question.variants.find(v => v.role_id === roleId) || round.question.variants.find(v => v.role_id == null);
  if (!variant) return NextResponse.json({ error: "No variant available" }, { status: 404 });

  return NextResponse.json({
    prompt: variant.prompt,
    choices: [
      { key: "A", text: variant.choice_a },
      { key: "B", text: variant.choice_b },
      { key: "C", text: variant.choice_c },
      { key: "D", text: variant.choice_d },
    ]
  });
}
