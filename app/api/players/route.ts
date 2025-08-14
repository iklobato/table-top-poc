import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { displayName, tableId, sessionId, roleId } = body ?? {};
  const player = await prisma.player.create({
    data: {
      display_name: displayName ?? null,
      table_id: tableId ?? null,
      session_id: sessionId ?? null,
      role_id: roleId ?? null,
    },
  });
  return NextResponse.json({ player });
}
