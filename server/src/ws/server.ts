import type { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

export interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean;
  subscriptions?: Set<number>;
}

const matchSubscribers = new Map<number, Set<ExtendedWebSocket>>();
const isProd = process.env.NODE_ENV === "production";

function ts(): string {
  return new Date().toISOString();
}

function subscribe(matchId: number, socket: ExtendedWebSocket): void {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }
  matchSubscribers.get(matchId)!.add(socket);
}

function unsubscribe(matchId: number, socket: ExtendedWebSocket): void {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers) return;

  subscribers.delete(socket);
  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  }
}

function cleanupSubscriptions(socket: ExtendedWebSocket): void {
  if (!socket.subscriptions) return;
  for (const matchId of socket.subscriptions) {
    unsubscribe(matchId, socket);
  }
}

function sendJson(socket: WebSocket, payload: unknown): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss: WebSocketServer, payload: unknown): void {
  const message = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function broadcastToMatch(matchId: number, payload: unknown): void {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers || subscribers.size === 0) return;

  const message = JSON.stringify(payload);
  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function handleMessage(socket: ExtendedWebSocket, data: RawData): void {
  let message: any;

  try {
    message = JSON.parse(data.toString());
  } catch {
    sendJson(socket, { type: "error", message: "Invalid JSON" });
    return;
  }

  const matchIdNum = Number(message?.matchId);

  if (message?.type === "subscribe" && Number.isInteger(matchIdNum)) {
    subscribe(matchIdNum, socket);
    socket.subscriptions?.add(matchIdNum);
    sendJson(socket, { type: "subscribed", matchId: matchIdNum });
    return;
  }

  if (message?.type === "unsubscribe" && Number.isInteger(matchIdNum)) {
    unsubscribe(matchIdNum, socket);
    socket.subscriptions?.delete(matchIdNum);
    sendJson(socket, { type: "unsubscribed", matchId: matchIdNum });
  }
}

type RawData = Buffer | ArrayBuffer | Buffer[];

export function attachWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({
    noServer: true,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  server.on("upgrade", async (req: IncomingMessage, socket, head) => {
    const host = req.headers.host || "localhost";
    const { pathname } = new URL(req.url || "/", `http://${host}`);

    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }

    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);

        if (decision.isDenied()) {
          if (decision.reason.isRateLimit()) {
            socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
          } else {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
          }
          console.warn("[ws] upgrade denied", {
            url: req.url,
            ip: req.socket.remoteAddress,
            rateLimit: decision.reason?.isRateLimit?.() ?? false,
          });
          socket.destroy();
          return;
        }
      } catch (e) {
        console.error("WS upgrade protection error", e);
        socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on(
    "connection",
    async (socket: ExtendedWebSocket, req: IncomingMessage) => {
      console.log(ts(), "[ws] connected", {
        url: req.url,
        ip: req.socket.remoteAddress,
        ua: req.headers["user-agent"],
      });

      socket.isAlive = true;
      socket.on("pong", () => {
        socket.isAlive = true;
      });
      socket.subscriptions = new Set<number>();

      sendJson(socket, { type: "welcome" });

      socket.on("message", (data: RawData) => {
        handleMessage(socket, data);
      });

      socket.on("close", (code: number, reason: Buffer) => {
        console.warn(ts(), "[ws] closed", {
          code,
          reason: reason?.toString?.() ?? "",
          ip: req.socket.remoteAddress,
        });
        cleanupSubscriptions(socket);
      });

      socket.on("error", console.error);
    },
  );

  let interval: NodeJS.Timeout | null = null;
  if (isProd) {
    interval = setInterval(() => {
      wss.clients.forEach((client) => {
        const ws = client as ExtendedWebSocket;
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    wss.on("close", () => {
      if (interval) clearInterval(interval);
    });
  }

  function broadcastMatchCreated(match: unknown) {
    broadcastToAll(wss, { type: "match_created", data: match });
  }

  function broadcastCommentary(matchId: number, comment: unknown) {
    broadcastToMatch(matchId, { type: "commentary", data: comment });
  }

  function broadcastScoreUpdate(
    matchId: number,
    scoreData: { homeScore: number; awayScore: number },
  ) {
    broadcastToAll(wss, { type: "score_update", matchId, data: scoreData });
  }

  return { broadcastMatchCreated, broadcastCommentary, broadcastScoreUpdate };
}
