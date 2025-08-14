const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379/0';
// Separate Redis connections for adapter vs. app events to avoid mixed binary messages
const pubAdapter = new Redis(redisUrl);
const subAdapter = new Redis(redisUrl);
const pub = new Redis(redisUrl);
const subEvents = new Redis(redisUrl);

const server = http.createServer();
const io = new Server(server, { cors: { origin: '*' } });
io.adapter(createAdapter(pubAdapter, subAdapter));

io.on('connection', (socket) => {
  socket.on('join_table', async ({ tableId, playerId }) => {
    socket.join(`table:${tableId}`);
    if (playerId) {
      try { await pub.sadd(`presence:table:${tableId}`, playerId); await pub.expire(`presence:table:${tableId}`, 600); } catch {}
    }
  });
  socket.on('leave_table', async ({ tableId, playerId }) => {
    socket.leave(`table:${tableId}`);
    if (playerId) {
      try { await pub.srem(`presence:table:${tableId}`, playerId); } catch {}
    }
  });
  socket.on('join_host', ({ sessionId }) => socket.join(`host:${sessionId}`));
  socket.on('heartbeat', async ({ tableId, playerId }) => {
    if (tableId && playerId) {
      try { await pub.sadd(`presence:table:${tableId}`, playerId); await pub.expire(`presence:table:${tableId}`, 600); } catch {}
    }
  });
  socket.on('disconnect', () => {});
});

subEvents.psubscribe('events:*', (err) => {
  if (err) console.error('psubscribe error', err);
});
subEvents.on('pmessage', (_pattern, channel, message) => {
  try {
    const payload = JSON.parse(message);
    if (channel.startsWith('events:table:')) {
      const tableId = channel.split(':')[2];
      io.to(`table:${tableId}`).emit(payload.type, payload);
    } else if (channel.startsWith('events:session:')) {
      const sessionId = channel.split(':')[2];
      io.to(`host:${sessionId}`).emit(payload.type, payload);
      io.emit(payload.type, payload);
    }
  } catch (e) {
    console.error('pubsub message error', e);
  }
});

const port = Number(process.env.SOCKET_PORT || 3001);
server.listen(port, () => console.log(`Socket server listening on :${port}`));
