import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { pub, sub, CHANNELS } from "@/lib/redis";

let io: Server | null = null;

export function getIO(server: any): Server {
  if (io) return io;
  io = new Server(server, { cors: { origin: "*" } });
  io.adapter(createAdapter(pub, sub));

  io.on("connection", (socket) => {
    socket.on("join_table", ({ tableId }: { tableId: string }) => {
      socket.join(`table:${tableId}`);
    });
    socket.on("leave_table", ({ tableId }: { tableId: string }) => {
      socket.leave(`table:${tableId}`);
    });
    socket.on("join_host", ({ sessionId }: { sessionId: string }) => {
      socket.join(`host:${sessionId}`);
    });
  });

  sub.psubscribe("events:*", (err) => {
    if (err) console.error("Redis psubscribe error", err);
  });

  sub.on("pmessage", (_pattern, channel, message) => {
    try {
      const payload = JSON.parse(message);
      if (channel.startsWith("events:table:")) {
        const tableId = channel.split(":")[2];
        io?.to(`table:${tableId}`).emit(payload.type, payload);
      } else if (channel.startsWith("events:session:")) {
        const sessionId = channel.split(":")[2];
        io?.to(`host:${sessionId}`).emit(payload.type, payload);
        io?.emit(payload.type, payload);
      }
    } catch (e) {
      console.error("Failed to handle pubsub message", e);
    }
  });

  return io;
}
