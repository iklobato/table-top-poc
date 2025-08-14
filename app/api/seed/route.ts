import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest) {
  // Create tables and roles if not present
  const t1 = await prisma.table.upsert({ where: { id: 't1' }, update: {}, create: { id: 't1', name: 'Alpha' } });
  const t2 = await prisma.table.upsert({ where: { id: 't2' }, update: {}, create: { id: 't2', name: 'Beta' } });
  const roles = await Promise.all([
    prisma.role.upsert({ where: { id: 'r1' }, update: {}, create: { id: 'r1', name: 'CEO' } }),
    prisma.role.upsert({ where: { id: 'r2' }, update: {}, create: { id: 'r2', name: 'CFO' } }),
    prisma.role.upsert({ where: { id: 'r3' }, update: {}, create: { id: 'r3', name: 'CISO' } }),
  ]);
  return NextResponse.json({ ok: true, tables: [t1, t2], roles });
}
