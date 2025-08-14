"use client";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

export default function HostPage() {
  const [sessionId, setSessionId] = useState("");
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const s = io('http://localhost:3001', { transports: ["websocket"] });
    if (sessionId) s.emit("join_host", { sessionId });
    s.on("round_started", (p: any) => setEvents((e) => [{ type: 'round_started', p }, ...e]));
    s.on("round_finalized", (p: any) => setEvents((e) => [{ type: 'round_finalized', p }, ...e]));
    s.on("countdown_tick", (p: any) => setEvents((e) => [{ type: 'tick', p }, ...e].slice(0, 50)));
    return () => { s.disconnect(); };
  }, [sessionId]);

  const startRound = async () => {
    if (!sessionId) return;
    await fetch(`/api/sessions/${sessionId}/start-round`, { method: 'POST' });
  };
  const stopRound = async () => {
    if (!sessionId) return;
    await fetch(`/api/sessions/${sessionId}/stop-round`, { method: 'POST' });
  };

  return (
    <main style={{ padding: 24 }}>
      <h2>Host Console</h2>
      <input placeholder="Session ID" value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={startRound}>Start Round</button>
        <button onClick={stopRound}>Stop Round</button>
      </div>
      <div style={{ marginTop: 16 }}>
        <h3>Events</h3>
        <pre style={{ maxHeight: 300, overflow: 'auto', background: '#111', color: '#0f0', padding: 12 }}>
          {events.map((e, i) => (<div key={i}>{JSON.stringify(e)}</div>))}
        </pre>
      </div>
    </main>
  );
}
