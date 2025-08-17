import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis, KEYS } from "@/lib/redis";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  // Fetch tables linked to the session; fallback to all tables if none linked
  const sessionTables = await prisma.sessionTable.findMany({
    where: { session_id: sessionId },
    include: { table: true },
  });
  let tables = sessionTables.map(st => st.table);
  if (tables.length === 0) {
    tables = await prisma.table.findMany({ orderBy: { created_at: 'asc' } });
  }
  const tableIds = tables.map(t => t.id);

  // Fetch players in this session grouped by table
  const players = await prisma.player.findMany({
    where: { session_id: sessionId, table_id: { in: tableIds } },
    include: { role: true },
    orderBy: { joined_at: 'desc' },
  });

  // Presence per table from Redis
  const presenceByTable: Record<string, Set<string>> = {};
  for (const t of tableIds) {
    try {
      const members = await redis.smembers(KEYS.tablePresence(t));
      presenceByTable[t] = new Set(members || []);
    } catch {
      presenceByTable[t] = new Set();
    }
  }

  const grouped = tables.map(t => {
    const p = players.filter(pl => pl.table_id === t.id).map(pl => ({
      id: pl.id,
      display_name: pl.display_name,
      role: pl.role ? { id: pl.role.id, name: pl.role.name } : null,
      joined_at: pl.joined_at,
      present: presenceByTable[t.id]?.has(pl.id) || false,
    }));
    const presentCount = p.reduce((acc, it) => acc + (it.present ? 1 : 0), 0);
    return { tableId: t.id, tableName: t.name, players: p, presentCount };
  });

  return NextResponse.json({ tables: grouped });
}


