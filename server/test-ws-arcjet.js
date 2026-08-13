import http from "http";
import { URL } from "url";
import { WebSocket, WebSocketServer } from "ws";

const wsArcjet = {
  protect: async (req) => {
    const url = new URL(req.url, "http://localhost");
    if (url.searchParams.has("deny")) {
      return {
        isDenied: () => true,
        reason: {
          isRateLimit: () => url.searchParams.get("deny") === "rate",
        },
      };
    }
    return { isDenied: () => false };
  },
};

const server = http.createServer();
const wss = new WebSocketServer({ noServer: true, path: "/ws" });

server.on("upgrade", async (req, socket, head) => {
  const host = req.headers.host || "localhost";
  const { pathname } = new URL(req.url || "/", `http://${host}`);
  if (pathname !== "/ws") {
    socket.destroy();
    return;
  }

  const decision = await wsArcjet.protect(req);
  if (decision.isDenied()) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});
