"use client";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

export default function Home() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [tableId, setTableId] = useState<string>("");
  const [roleId, setRoleId] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");

  const [roundId, setRoundId] = useState<string | null>(null);
  const [roundIndex, setRoundIndex] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const [variant, setVariant] = useState<any | null>(null);
  const [choice, setChoice] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [s, t, r] = await Promise.all([
        fetch('/api/sessions').then(res => res.json()),
        fetch('/api/tables').then(res => res.json()),
        fetch('/api/roles').then(res => res.json()),
      ]);
      setSessions(s.sessions || []);
      setTables(t.tables || []);
      setRoles(r.roles || []);
      setSessionId((s.sessions?.[0]?.id) || "");
      setTableId((t.tables?.[0]?.id) || "");
      setRoleId((r.roles?.[0]?.id) || "");
    };
    load();
  }, []);

  useEffect(() => {
    if (!tableId) return;
    const s = io('http://localhost:3001', { transports: ["websocket"] });
    s.emit("join_table", { tableId, playerId });
    const hb = setInterval(() => s.emit('heartbeat', { tableId, playerId }), 20000);
    s.on("round_started", (p: any) => {
      setRoundIndex(p.roundIndex);
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
    return () => { clearInterval(hb); s.emit('leave_table', { tableId, playerId }); s.disconnect(); };
  }, [tableId, roundIndex, playerId]);

  const loadVariant = async (rid: string | null) => {
    if (!rid) return;
    const res = await fetch(`/api/round-variant?roundId=${rid}&roleId=${roleId}`);
    if (res.ok) setVariant(await res.json());
  };

  const join = async () => {
    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, tableId, roleId, displayName }),
    });
    const data = await res.json();
    setPlayerId(data.player.id);
  };

  const submit = async () => {
    if (!choice || !roundId || !playerId) return;
    await fetch('/api/answers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roundId, playerId, roleId, tableId, choice }) });
  };

  return (
    <main className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-semibold">Play</h2>
      {!playerId && (
        <div className="card p-6 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm text-slate-400">Your name</span>
            <input className="input" placeholder="e.g. Alex" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-slate-400">Session</span>
            <select className="select" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              {sessions.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-slate-400">Table</span>
            <select className="select" value={tableId} onChange={(e) => setTableId(e.target.value)}>
              {tables.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm text-slate-400">Role</span>
            <select className="select" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {roles.map(r => (<option key={r.id} value={r.id}>{r.name}</option>))}
            </select>
          </label>
          <button className="btn btn-primary" onClick={join} disabled={!displayName.trim() || !sessionId || !tableId || !roleId}>Join</button>
        </div>
      )}

      {!!playerId && (
        <div className="space-y-4">
          <div className="card p-4 flex items-center justify-between">
            <div className="text-sm text-slate-400">Time left</div>
            <div className="text-2xl font-mono">{remaining}s</div>
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
        </div>
      )}
    </main>
  );
}
