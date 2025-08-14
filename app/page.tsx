"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    };
    load();
  }, []);

  const create = async () => {
    if (!name) return;
    const res = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (res.ok) {
      setName("");
      const data = await res.json();
      window.location.href = `/host?sessionId=${data.session.id}`;
    }
  };

  return (
    <main className="space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Table‑Top</h1>
        <nav className="flex gap-3">
          <a className="btn btn-secondary" href="/join">Join</a>
          <a className="btn btn-secondary" href="/host">Host</a>
          <a className="btn btn-secondary" href="/results">Results</a>
        </nav>
      </header>

      <section className="card p-6 space-y-4">
        <h2 className="text-xl font-semibold">Create a Session</h2>
        <div className="flex gap-3">
          <input className="input w-full" placeholder="New session name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary" onClick={create}>Create</button>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Sessions</h2>
        <ul className="grid gap-3">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between bg-slate-900/30 rounded-lg px-4 py-3">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-slate-400">{s.status} · {new Date(s.created_at).toLocaleString()}</div>
              </div>
              <a href={`/host?sessionId=${s.id}`} className="btn btn-secondary">Open Host</a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
