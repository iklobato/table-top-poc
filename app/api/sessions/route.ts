import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const sessions = await prisma.gameSession.findMany({
    orderBy: { created_at: "desc" },
    select: { id: true, name: true, status: true, total_rounds: true, created_at: true },
  });
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, tableIds = [], roleIds = [], totalRounds = 5 } = body ?? {};

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const session = await prisma.gameSession.create({
    data: {
      name,
      status: "DRAFT",
      total_rounds: totalRounds,
    },
  });

  if (tableIds.length) {
    await prisma.sessionTable.createMany({
      data: tableIds.map((tableId: string) => ({ session_id: session.id, table_id: tableId })),
    });
  }

  return NextResponse.json({ session });
}
