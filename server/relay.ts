import { WebSocketServer, type WebSocket } from "ws";
import { DEFAULT_PORT, type AnyMessage, type PeerStatus, type RelayError, type Role } from "../shared/types";

export interface Relay {
  port: number;
  close(): Promise<void>;
}

// Figma loads the plugin UI from a sandboxed iframe, so its Origin is "null". The CLI sends none.
// Any other origin is a web page that has no business reading screenshots from this port.
const ALLOWED_ORIGINS = new Set<string | undefined>([undefined, "null", "https://www.figma.com"]);

/** Starts the relay on loopback only. Rejects when the port is taken. */
export function startRelay(port = DEFAULT_PORT, log: (line: string) => void = console.log): Promise<Relay> {
  return new Promise((resolve, reject) => {
    const clis = new Set<WebSocket>();
    let plugin: WebSocket | null = null;

    const server = new WebSocketServer({
      host: "127.0.0.1",
      port,
      maxPayload: 64 * 1024 * 1024,
      verifyClient: ({ origin }: { origin?: string }) => {
        const allowed = ALLOWED_ORIGINS.has(origin);
        if (!allowed) log(`[relay] từ chối kết nối từ origin ${origin}`);
        return allowed;
      },
    });

    const send = (socket: WebSocket, message: AnyMessage) => socket.send(JSON.stringify(message));
    const broadcastStatus = () => {
      const status: PeerStatus = { type: "peer_status", pluginConnected: plugin !== null };
      for (const cli of clis) send(cli, status);
    };

    server.on("connection", (socket) => {
      let role: Role | null = null;

      socket.on("message", (data, isBinary) => {
        if (role === null) {
          // The first frame must say who is talking.
          let hello: AnyMessage | null = null;
          try { hello = isBinary ? null : JSON.parse(data.toString()) as AnyMessage; } catch { hello = null; }
          if (hello?.type !== "hello" || (hello.role !== "cli" && hello.role !== "plugin")) {
            socket.close(1002, "expected hello");
            return;
          }
          role = hello.role;
          if (role === "plugin") {
            if (plugin && plugin !== socket) plugin.close(1000, "replaced by a newer plugin connection");
            plugin = socket;
            log("[relay] plugin Figma đã kết nối");
            broadcastStatus();
          } else {
            clis.add(socket);
            send(socket, { type: "peer_status", pluginConnected: plugin !== null });
          }
          return;
        }

        if (role === "cli") {
          if (!plugin) {
            const error: RelayError = { type: "relay_error", message: "Plugin Figma chưa kết nối." };
            send(socket, error);
            return;
          }
          plugin.send(data, { binary: isBinary });
        } else {
          for (const cli of clis) cli.send(data, { binary: isBinary });
        }
      });

      socket.on("close", () => {
        if (role === "cli") clis.delete(socket);
        if (role === "plugin" && plugin === socket) {
          plugin = null;
          log("[relay] plugin Figma đã ngắt kết nối");
          broadcastStatus();
        }
      });
      socket.on("error", (error) => log(`[relay] lỗi socket: ${error.message}`));
    });

    server.once("listening", () => {
      resolve({
        port,
        close: () => new Promise<void>((done) => {
          for (const client of server.clients) client.terminate();
          server.close(() => done());
        }),
      });
    });
    server.once("error", reject);
  });
}
