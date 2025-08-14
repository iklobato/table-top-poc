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
    <main className="space-y-6">
      <h2 className="text-2xl font-semibold">Host Console</h2>
      <div className="card p-6 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm text-slate-400">Session ID</span>
          <input className="input" placeholder="Session ID" value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
        </label>
        <div className="flex gap-3">
          <button className="btn btn-primary" onClick={startRound}>Start Round</button>
          <button className="btn btn-secondary" onClick={stopRound}>Stop Round</button>
        </div>
      </div>
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-2">Events</h3>
        <div className="bg-slate-950/70 rounded-lg border border-slate-900 p-3 max-h-80 overflow-auto font-mono text-sm text-green-400">
          {events.map((e, i) => (<div key={i}>{JSON.stringify(e)}</div>))}
        </div>
      </div>
    </main>
  );
}
