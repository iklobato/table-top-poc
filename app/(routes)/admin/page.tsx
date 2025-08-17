"use client";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

export default function AdminPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [newName, setNewName] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        if (!sessionId && data.sessions?.length) setSessionId(data.sessions[0].id);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const s = io('http://localhost:3001', { transports: ["websocket"] });
    if (sessionId) s.emit("join_host", { sessionId });
    s.on("round_started", (p: any) => setEvents((e) => [{ type: 'round_started', p }, ...e]));
    s.on("round_finalized", (p: any) => setEvents((e) => [{ type: 'round_finalized', p }, ...e]));
    s.on("countdown_tick", (p: any) => setEvents((e) => [{ type: 'tick', p }, ...e].slice(0, 100)));
    return () => { s.disconnect(); };
  }, [sessionId]);

  const createSession = async () => {
    if (!newName) return;
    setLoading(true);
    const res = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName }) });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setSessions((s) => [{ id: data.session.id, name: data.session.name, status: data.session.status, created_at: data.session.created_at }, ...s]);
      setSessionId(data.session.id);
      setNewName("");
    }
  };

  const addQuestion = async () => {
    if (!sessionId) return;
    await fetch('/api/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, topic: 'POC', status: 'APPROVED', variants: [{ prompt: '2+2?', choiceA: '4', choiceB: '3', choiceC: '5', choiceD: '6', pointsA: 5, pointsB: 0, pointsC: 0, pointsD: 0 }] }) });
  };

  const startTicker = async () => { await fetch('/api/_ticker'); };
  const startRound = async () => { if (sessionId) await fetch(`/api/sessions/${sessionId}/start-round`, { method: 'POST' }); };
  const stopRound = async () => { if (sessionId) await fetch(`/api/sessions/${sessionId}/stop-round`, { method: 'POST' }); };
  const finalizeRound = async () => { if (sessionId) await fetch(`/api/sessions/${sessionId}/finalize-round`, { method: 'POST' }); };

  return (
    <main className="space-y-6">
      <h2 className="text-2xl font-semibold">Admin Dashboard</h2>
      <div className="card p-6 grid gap-4">
        <div className="flex gap-3">
          <input className="input w-full" placeholder="New session name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="btn btn-primary" onClick={createSession} disabled={loading}>Create</button>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="grid gap-2">
            <span className="text-sm text-slate-400">Select Session</span>
            <select className="select" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              {sessions.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </label>
          <div className="flex items-end gap-3">
            <button className="btn btn-secondary" onClick={addQuestion}>Add Sample Question</button>
            <button className="btn btn-secondary" onClick={startTicker}>Start Ticker</button>
            <button className="btn btn-primary" onClick={startRound}>Start Round</button>
            <button className="btn btn-secondary" onClick={stopRound}>Stop</button>
            <button className="btn btn-secondary" onClick={finalizeRound}>Finalize</button>
          </div>
        </div>
      </div>
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-2">Events</h3>
        <div className="bg-slate-950/70 rounded-lg border border-slate-900 p-3 max-h-96 overflow-auto font-mono text-sm text-green-400">
          {events.map((e, i) => (<div key={i}>{JSON.stringify(e)}</div>))}
        </div>
      </div>
    </main>
  );
}
