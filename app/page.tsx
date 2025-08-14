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
    <main style={{ padding: 24, display: 'grid', gap: 16 }}>
      <h1>Table-Top</h1>
      <div style={{ display: 'flex', gap: 8 }}>
        <input placeholder="New session name" value={name} onChange={(e) => setName(e.target.value)} />
        <button onClick={create}>Create Session</button>
      </div>
      <div>
        <h3>Recent Sessions</h3>
        <ul>
          {sessions.map((s) => (
            <li key={s.id}>
              <a href={`/host?sessionId=${s.id}`}>{s.name}</a>
            </li>
          ))}
        </ul>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <a href="/join">Join</a>
        <a href="/host">Host</a>
        <a href="/results">Results</a>
      </div>
    </main>
  );
}
