"use client";
import { useEffect, useState } from "react";

export default function ResultsPage() {
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const sessionId = search.get('sessionId') || '';
  const [data, setData] = useState<any>({ entries: [] });

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/leaderboard?sessionId=${sessionId}`);
      if (res.ok) setData(await res.json());
    };
    if (sessionId) load();
  }, [sessionId]);

  return (
    <main className="space-y-6">
      <h2 className="text-2xl font-semibold">Leaderboard</h2>
      <div className="card p-6">
        <table className="table">
          <thead>
            <tr><th>Rank</th><th>Table</th><th>Raw</th><th>Normalized</th><th>Response (ms)</th></tr>
          </thead>
          <tbody>
            {data.entries.map((e: any) => (
              <tr key={e.table_id}>
                <td className="font-semibold">{e.rank}</td>
                <td>{e.table?.name || e.table_id}</td>
                <td>{e.raw_points}</td>
                <td>{e.normalized_points}</td>
                <td>{e.total_response_ms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
