// Plugin UI iframe: owns the WebSocket to the local relay and forwards every message to the sandbox.
import { DEFAULT_PORT } from "../../shared/types";
import type { AnyMessage, PluginOptions, SandboxToUi, StepMessage, UiToSandbox } from "../../shared/types";

const RETRY_MS = 2000;
const url = `ws://localhost:${DEFAULT_PORT}`;

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const dot = element("dot");
const connection = element("connection");
const flowLabel = element("flow");
const builtLabel = element("built");
const errorLabel = element("error");

let socket: WebSocket | null = null;
let retryTimer: number | undefined;
/** A step whose tiles are still arriving as binary frames. */
let pendingStep: { message: StepMessage; tiles: Uint8Array[] } | null = null;

function options(): PluginOptions {
  const mode = document.querySelector<HTMLInputElement>('input[name="mode"]:checked')?.value === "new" ? "new" : "overwrite";
  return { mode, arrows: element<HTMLInputElement>("arrows").checked, colorSections: element<HTMLInputElement>("colors").checked };
}

function toSandbox(message: UiToSandbox) {
  parent.postMessage({ pluginMessage: message }, "*");
}

function setConnection(state: "on" | "off" | "wait", text: string) {
  dot.className = `dot ${state === "wait" ? "" : state}`;
  connection.textContent = text;
}

function connect() {
  window.clearTimeout(retryTimer);
  if (socket) { socket.onclose = null; socket.close(); }
  pendingStep = null;
  setConnection("wait", "Đang kết nối…");

  const next = new WebSocket(url);
  next.binaryType = "arraybuffer";
  socket = next;

  next.onopen = () => {
    next.send(JSON.stringify({ type: "hello", role: "plugin" } satisfies AnyMessage));
    setConnection("on", `Đã kết nối ${url}`);
  };
  next.onclose = () => {
    if (socket !== next) return;
    setConnection("off", "Chưa kết nối — đang thử lại. Hãy chạy npm run capture hoặc npm run server.");
    retryTimer = window.setTimeout(connect, RETRY_MS);
  };
  next.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
    if (typeof event.data !== "string") {
      if (!pendingStep) return;
      pendingStep.tiles.push(new Uint8Array(event.data));
      if (pendingStep.tiles.length === pendingStep.message.tiles.length) {
        toSandbox({ type: "step", message: pendingStep.message, tiles: pendingStep.tiles });
        pendingStep = null;
      }
      return;
    }
    const message = JSON.parse(event.data) as AnyMessage;
    if (message.type === "flow_start") {
      errorLabel.textContent = "—";
      toSandbox({ type: "flow_start", message, options: options() });
    } else if (message.type === "step") {
      pendingStep = { message, tiles: [] };
    } else if (message.type === "paste_step") {
      toSandbox({ type: "paste_step", message });
    } else if (message.type === "flow_end") {
      toSandbox({ type: "flow_end", message });
    }
  };
}

window.onmessage = (event: MessageEvent<{ pluginMessage?: SandboxToUi }>) => {
  const message = event.data.pluginMessage;
  if (!message) return;
  if (message.type === "progress") {
    flowLabel.textContent = message.flowName;
    builtLabel.textContent = `${message.built} bước`;
    return;
  }
  if (message.type === "paste_prompt") {
    element("paste").hidden = message.step === null;
    if (message.step) {
      // The sandbox is listening for the paste now; tell the CLI, which may press Ctrl+V itself.
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "paste_ready", flowId: message.step.flowId, stepId: message.step.stepId } satisfies AnyMessage));
      }
      element("paste-count").textContent = `Màn ${message.step.position}/${message.step.total}`;
      element("paste-name").textContent = message.step.frameName;
    }
    return;
  }
  if (message.type === "warning") {
    errorLabel.textContent = message.message;
    return;
  }
  if (!message.ack.ok) errorLabel.textContent = message.ack.error ?? "Lỗi không rõ";
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message.ack));
};

element("paste-skip").onclick = () => toSandbox({ type: "skip_paste" });
element("reconnect").onclick = connect;
connect();
