import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sessionId = params.id;
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      tables: { include: { table: true } },
      rounds: true,
    },
  });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ session });
}
