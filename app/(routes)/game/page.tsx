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
    <main style={{ padding: 24 }}>
      <h2>Game</h2>
      <div>Time left: {remaining}s</div>
      {variant && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 600 }}>{variant.prompt}</div>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {variant.choices.map((c: any) => (
              <button key={c.key} onClick={() => setChoice(c.key)} style={{ background: choice === c.key ? '#def' : undefined }}>{c.key}. {c.text}</button>
            ))}
            <button onClick={submit} disabled={!choice}>Submit</button>
          </div>
        </div>
      )}
    </main>
  );
}
