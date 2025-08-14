import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export async function GET(_req: NextRequest) {
  const tables = await prisma.table.findMany({ orderBy: { created_at: 'asc' } });
  return NextResponse.json({ tables });
}
