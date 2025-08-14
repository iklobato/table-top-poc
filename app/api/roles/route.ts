import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export async function GET(_req: NextRequest) {
  const roles = await prisma.role.findMany({ orderBy: { order_index: 'asc' } });
  return NextResponse.json({ roles });
}
