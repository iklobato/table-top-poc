const http = require('http');

const BASE = process.env.BASE || 'http://localhost:3000';
const TABLES = ['t1', 't2'];
const ROLES = ['r1', 'r2', 'r3'];

function post(path, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let data = ''; res.on('data', c => data += c); res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(JSON.stringify(body || {})); req.end();
  });
}
function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE}${path}`, { method: 'GET' }, (res) => {
      let data = ''; res.on('data', c => data += c); res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function waitForReady(path = '/api/meta', retries = 50) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await get(path);
      if (r.status && r.status >= 200 && r.status < 500) return true;
    } catch {}
    await new Promise(res => setTimeout(res, 300));
  }
  return false;
}

async function main() {
  const ready = await waitForReady('/api/sessions');
  if (!ready) throw new Error('Service not ready');
  // Ensure base data
  try { await post('/api/seed', {}); } catch {}
  // 1) Create session
  const s = await post('/api/sessions', { name: `Smoke ${Date.now()}` });
  let SID;
  try { SID = JSON.parse(s.data).session.id; } catch { throw new Error(`create session invalid JSON: ${s.status} ${String(s.data).slice(0,200)}`); }
  console.log('Session:', SID);

  // 2) Add one approved generic question
  await post('/api/questions', { sessionId: SID, topic: 'POC', status: 'APPROVED', variants: [
    { prompt: '2+2?', choiceA: '4', choiceB: '3', choiceC: '5', choiceD: '6', pointsA: 5, pointsB: 0, pointsC: 0, pointsD: 0 }
  ]});

  // 3) Start ticker and round
  await get('/api/_ticker');
  const r = await post(`/api/sessions/${SID}/start-round`);
  let RID; try { RID = JSON.parse(r.data).round.id; } catch { throw new Error(`start round invalid JSON: ${r.status} ${String(r.data).slice(0,200)}`); }
  console.log('Round:', RID);

  // 4) Create N players across tables/roles
  const NUM = Number(process.env.NUM_PLAYERS || 15);
  const players = [];
  for (let i = 0; i < NUM; i++) {
    const tableId = TABLES[i % TABLES.length];
    const roleId = ROLES[i % ROLES.length];
    const pres = await post('/api/players', { sessionId: SID, tableId, roleId });
    let pid; try { pid = JSON.parse(pres.data).player.id; } catch { throw new Error(`create player invalid JSON: ${pres.status} ${String(pres.data).slice(0,200)}`); }
    players.push({ pid, tableId, roleId });
  }
  console.log('Players:', players.length);

  // 5) Parallel answers with slight jitter
  await Promise.all(players.map((p, idx) => new Promise(async (resolve) => {
    const delay = Math.floor(Math.random() * 2000) + (idx % 5) * 100; // 0-2.5s
    setTimeout(async () => {
      try {
        const resp = await post('/api/answers', { roundId: RID, playerId: p.pid, tableId: p.tableId, roleId: p.roleId, choice: 'A' });
        resolve(resp.status);
      } catch(e) { resolve(0); }
    }, delay);
  })));

  // 6) Finalize and fetch leaderboard
  await post(`/api/sessions/${SID}/finalize-round`);
  const lb = await get(`/api/leaderboard?sessionId=${SID}`);
  console.log('Leaderboard:', lb.data);
}

main().catch((e) => { console.error(e); process.exit(1); });
