import { prisma } from "@/lib/prisma";

export async function computeRoundLeaderboard(sessionId: string, roundId: string) {
  const answers = await prisma.answer.findMany({ where: { round_id: roundId } });

  const tableToTotals = new Map<string, { raw: number; responseMs: number }>();
  for (const a of answers) {
    const key = a.table_id ?? "unknown";
    const prev = tableToTotals.get(key) ?? { raw: 0, responseMs: 0 };
    tableToTotals.set(key, { raw: prev.raw + a.points_awarded, responseMs: prev.responseMs + a.response_ms });
  }

  const results = [...tableToTotals.entries()].map(([tableId, totals]) => ({
    tableId,
    raw_points: totals.raw,
    normalized_points: totals.raw, // POC: same as raw for now
    total_response_ms: totals.responseMs,
  }));

  results.sort((a, b) => {
    if (b.raw_points !== a.raw_points) return b.raw_points - a.raw_points;
    if (a.total_response_ms !== b.total_response_ms) return a.total_response_ms - b.total_response_ms;
    return 0;
  });

  // write to cache
  let rank = 1;
  for (const r of results) {
    await prisma.leaderboardCache.upsert({
      where: {
        session_id_round_id_table_id: {
          session_id: sessionId,
          round_id: roundId,
          table_id: r.tableId,
        },
      } as any,
      update: {
        raw_points: r.raw_points,
        normalized_points: r.normalized_points,
        total_response_ms: r.total_response_ms,
        rank,
      },
      create: {
        session_id: sessionId,
        round_id: roundId,
        table_id: r.tableId,
        raw_points: r.raw_points,
        normalized_points: r.normalized_points,
        total_response_ms: r.total_response_ms,
        rank,
      },
    });
    rank += 1;
  }
}
