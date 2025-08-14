import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const round = await prisma.round.findFirst({ where: { session_id: sessionId }, orderBy: { index: "desc" } });
  const entries = await prisma.leaderboardCache.findMany({
    where: { session_id: sessionId, round_id: round?.id ?? null },
    orderBy: [{ rank: "asc" }],
    include: { table: true },
  });

  return NextResponse.json({ roundIndex: round?.index ?? null, entries });
}
