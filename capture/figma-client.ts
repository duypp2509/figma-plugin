import WebSocket from "ws";
import { startRelay, type Relay } from "../server/relay";
import type { Ack, AnyMessage, FlowEnd, FlowStart, PasteStep, StepMessage } from "../shared/types";
import type { SlicedImage } from "./tiles";

const ACK_TIMEOUT_MS = 120_000;
/** A paste waits for a person, who may have stepped away. */
const PASTE_TIMEOUT_MS = 30 * 60_000;

/** The CLI's end of the relay: sends one message at a time and waits for the plugin's ack. */
export class FigmaClient {
  private pluginConnected = false;
  private waiters: Array<{ match: (ack: Ack) => boolean; resolve: (ack: Ack) => void; reject: (error: Error) => void }> = [];
  private statusListeners = new Set<() => void>();
  private pasteReady: { flowId: string; stepId: string; run: () => void } | null = null;

  private constructor(private socket: WebSocket, private ownRelay: Relay | null) {
    socket.on("message", (data, isBinary) => {
      if (isBinary) return;
      let message: AnyMessage;
      try { message = JSON.parse(data.toString()) as AnyMessage; } catch { return; }
      if (message.type === "peer_status") {
        this.pluginConnected = message.pluginConnected;
        for (const listener of this.statusListeners) listener();
        if (!message.pluginConnected) this.failAll(new Error("Plugin Figma đã ngắt kết nối giữa chừng."));
      } else if (message.type === "relay_error") {
        this.failAll(new Error(message.message));
      } else if (message.type === "paste_ready") {
        const ready = this.pasteReady;
        if (ready && ready.flowId === message.flowId && ready.stepId === message.stepId) {
          this.pasteReady = null;
          ready.run();
        }
      } else if (message.type === "ack") {
        const index = this.waiters.findIndex((waiter) => waiter.match(message));
        if (index >= 0) this.waiters.splice(index, 1)[0]!.resolve(message);
      }
    });
    socket.on("close", () => this.failAll(new Error("Mất kết nối tới server trung chuyển.")));
  }

  /** Connects to a running relay, or starts one in this process when none is listening. */
  static async connect(port: number, log: (line: string) => void): Promise<FigmaClient> {
    let ownRelay: Relay | null = null;
    let socket: WebSocket;
    try {
      socket = await open(port);
    } catch {
      ownRelay = await startRelay(port, log);
      log(`[figma] chưa có server ở cổng ${port}, đã tự khởi động một server tạm trong tiến trình này.`);
      socket = await open(port);
    }
    socket.send(JSON.stringify({ type: "hello", role: "cli" } satisfies AnyMessage));
    return new FigmaClient(socket, ownRelay);
  }

  /** Waits for the plugin, reminding the user every few seconds. Never throws before the timeout. */
  async waitForPlugin(timeoutMs: number, log: (line: string) => void): Promise<void> {
    if (this.pluginConnected) return;
    log("[figma] đang chờ plugin: mở Figma desktop → Plugins → Development → Flow Capture.");
    const started = Date.now();
    await new Promise<void>((resolve, reject) => {
      const reminder = setInterval(() => {
        const waited = Math.round((Date.now() - started) / 1000);
        if (Date.now() - started >= timeoutMs) {
          cleanup();
          reject(new Error(`Plugin Figma không kết nối sau ${waited} giây. Chạy lại với --no-figma nếu chỉ cần lưu ảnh.`));
        } else {
          log(`[figma] vẫn đang chờ plugin… (${waited}s)`);
        }
      }, 5000);
      const listener = () => { if (this.pluginConnected) { cleanup(); resolve(); } };
      const cleanup = () => { clearInterval(reminder); this.statusListeners.delete(listener); };
      this.statusListeners.add(listener);
      // The status may have arrived between the check above and the listener being added.
      listener();
    });
    log("[figma] plugin đã kết nối.");
  }

  async flowStart(message: FlowStart): Promise<void> {
    this.socket.send(JSON.stringify(message));
    await this.ack((ack) => ack.ref === "flow_start" && ack.flowId === message.flowId);
  }

  async step(meta: Omit<StepMessage, "type" | "width" | "height" | "tiles">, image: SlicedImage): Promise<void> {
    const message: StepMessage = {
      type: "step", ...meta, width: image.width, height: image.height,
      tiles: image.tiles.map((tile, index) => ({
        index, x: tile.x, y: tile.y, width: tile.width, height: tile.height, byteLength: tile.data.length,
      })),
    };
    this.socket.send(JSON.stringify(message));
    for (const tile of image.tiles) this.socket.send(tile.data, { binary: true });
    await this.ack((ack) => ack.ref === "step" && ack.flowId === meta.flowId && ack.stepId === meta.stepId);
  }

  /**
   * Asks the plugin to take the next paste as this step. Resolves once the paste arrived, or the user
   * skipped it. `onReady` runs when the plugin has started listening, the moment to press Ctrl+V for it.
   */
  async paste(message: PasteStep, onReady?: () => void): Promise<{ skipped: boolean }> {
    this.pasteReady = onReady ? { stepId: message.stepId, flowId: message.flowId, run: onReady } : null;
    this.socket.send(JSON.stringify(message));
    const ack = await this.ack(
      (candidate) => candidate.ref === "paste_step" && candidate.flowId === message.flowId && candidate.stepId === message.stepId,
      PASTE_TIMEOUT_MS,
    );
    return { skipped: ack.skipped === true };
  }

  async flowEnd(message: FlowEnd): Promise<void> {
    this.socket.send(JSON.stringify(message));
    await this.ack((ack) => ack.ref === "flow_end" && ack.flowId === message.flowId);
  }

  async close(): Promise<void> {
    this.socket.removeAllListeners("close");
    this.socket.close();
    await this.ownRelay?.close();
  }

  private ack(match: (ack: Ack) => boolean, timeoutMs = ACK_TIMEOUT_MS): Promise<Ack> {
    return new Promise<Ack>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((waiter) => waiter !== entry);
        reject(new Error(`Plugin Figma không phản hồi sau ${Math.round(timeoutMs / 1000)} giây.`));
      }, timeoutMs);
      const entry = {
        match,
        resolve: (ack: Ack) => {
          clearTimeout(timer);
          if (ack.ok) resolve(ack);
          else reject(new Error(`Plugin Figma báo lỗi: ${ack.error ?? "không rõ"}`));
        },
        reject: (error: Error) => { clearTimeout(timer); reject(error); },
      };
      this.waiters.push(entry);
    });
  }

  private failAll(error: Error) {
    const pending = this.waiters;
    this.waiters = [];
    for (const waiter of pending) waiter.reject(error);
  }
}

function open(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    socket.once("open", () => { socket.removeAllListeners("error"); resolve(socket); });
    socket.once("error", reject);
  });
}
