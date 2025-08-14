"use client";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

export default function GamePage() {
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const sessionId = search.get('sessionId') || '';
  const tableId = search.get('tableId') || '';
  const roleId = search.get('roleId') || '';
  const playerId = search.get('playerId') || '';

  const [roundId, setRoundId] = useState<string | null>(null);
  const [roundIndex, setRoundIndex] = useState<number | null>(null);
  const [deadlineTs, setDeadlineTs] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const [variant, setVariant] = useState<any | null>(null);
  const [choice, setChoice] = useState<string | null>(null);

  useEffect(() => {
    const s = io('http://localhost:3001', { transports: ["websocket"] });
    s.emit("join_table", { tableId, playerId });
    const hb = setInterval(() => s.emit('heartbeat', { tableId, playerId }), 20000);
    s.on("round_started", (p: any) => {
      setRoundIndex(p.roundIndex);
      setDeadlineTs(p.deadlineTs);
      setRoundId(p.roundId || null);
      loadVariant(p.roundId);
    });
    s.on("countdown_tick", (p: any) => {
      if (p.roundIndex === roundIndex) setRemaining(Math.max(0, Math.floor((p.remainingMs || 0) / 1000)));
    });
    s.on("round_finalized", () => {
      setChoice(null);
      setVariant(null);
    });
    return () => {
      clearInterval(hb);
      s.emit('leave_table', { tableId, playerId });
      s.disconnect();
    };
  }, [tableId, roundIndex]);

  const loadVariant = async (rid: string | null) => {
    if (!rid) return;
    const res = await fetch(`/api/round-variant?roundId=${rid}&roleId=${roleId}`);
    if (res.ok) {
      const data = await res.json();
      setVariant(data);
    }
  };

  const submit = async () => {
    if (!choice || !roundId) return;
    await fetch('/api/answers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roundId, playerId, roleId, tableId, choice }) });
  };

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Game</h2>
        <div className="text-lg">Time left: <span className="font-mono">{remaining}s</span></div>
      </div>
      {variant && (
        <div className="card p-6 space-y-4">
          <div className="text-lg font-medium">{variant.prompt}</div>
          <div className="grid gap-3">
            {variant.choices.map((c: any) => (
              <button key={c.key} onClick={() => setChoice(c.key)} className={`btn ${choice === c.key ? 'btn-primary' : 'btn-secondary'} justify-start`}>
                <span className="w-6 inline-block">{c.key}.</span> {c.text}
              </button>
            ))}
            <div>
              <button className="btn btn-primary" onClick={submit} disabled={!choice}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
