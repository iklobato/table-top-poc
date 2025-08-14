"use client";
import { useState, useEffect } from "react";

export default function JoinPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [tableId, setTableId] = useState<string>("");
  const [roleId, setRoleId] = useState<string>("");
  const [player, setPlayer] = useState<any>(null);

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

  const handleJoin = async () => {
    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, tableId, roleId }),
    });
    const data = await res.json();
    setPlayer(data.player);
    if (data.player) {
      window.location.href = `/game?sessionId=${sessionId}&tableId=${tableId}&roleId=${roleId}&playerId=${data.player.id}`;
    }
  };

  return (
    <main className="max-w-xl mx-auto space-y-6">
      <h2 className="text-2xl font-semibold">Join a Table</h2>
      <div className="card p-6 grid gap-4">
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
        <button className="btn btn-primary" onClick={handleJoin}>Join</button>
      </div>
    </main>
  );
}
