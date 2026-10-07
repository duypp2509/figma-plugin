// A stand-in for the Figma plugin, to try the whole CLI → relay path without Figma:
//   terminal 1: npx tsx scripts/fake-plugin.ts     terminal 2: .\capture --flow <id>
// It acknowledges every message and prints what a real plugin would have built.
import WebSocket from "ws";
import { startRelay } from "../server/relay";
import { DEFAULT_PORT, type Ack, type AnyMessage, type StepMessage } from "../shared/types";

const port = Number(process.env.FFC_PORT ?? DEFAULT_PORT);
await startRelay(port).catch(() => console.log(`[fake-plugin] cổng ${port} đã có server, dùng server đó.`));

const socket = new WebSocket(`ws://127.0.0.1:${port}`, { origin: "null" });
let pending: { step: StepMessage; received: number; bytes: number } | null = null;
const ack = (value: Omit<Ack, "type" | "ok">) => socket.send(JSON.stringify({ type: "ack", ok: true, ...value } satisfies Ack));

socket.on("open", () => {
  socket.send(JSON.stringify({ type: "hello", role: "plugin" } satisfies AnyMessage));
  console.log(`[fake-plugin] đã kết nối ws://127.0.0.1:${port}, đang chờ luồng… (Ctrl+C để dừng)`);
});
socket.on("message", (data, isBinary) => {
  if (isBinary) {
    if (!pending) return;
    pending.received += 1;
    pending.bytes += (data as Buffer).length;
    if (pending.received === pending.step.tiles.length) {
      const { step, bytes } = pending;
      pending = null;
      console.log(`[fake-plugin]   frame "${step.frameName}"${step.width}×${step.height}px, ${step.tiles.length} lát, ${Math.round(bytes / 1024)} KB`);
      ack({ flowId: step.flowId, ref: "step", stepId: step.stepId });
    }
    return;
  }
  const message = JSON.parse(data.toString()) as AnyMessage;
  if (message.type === "flow_start") {
    console.log(`[fake-plugin] Section "${(message.groups ?? []).map((group) => `${group.name} / `).join("")}${message.flowName}" (${message.flowId}), viewport ${message.viewport.width}×${message.viewport.height} @${message.dpr}x`);
    ack({ flowId: message.flowId, ref: "flow_start" });
  } else if (message.type === "step") {
    pending = { step: message, received: 0, bytes: 0 };
  } else if (message.type === "paste_step") {
    // A real plugin waits here for the user's Ctrl+V; the stand-in just confirms.
    console.log(`[fake-plugin]   chờ dán (${message.position}/${message.total}) "${message.frameName}"`);
    socket.send(JSON.stringify({ type: "paste_ready", flowId: message.flowId, stepId: message.stepId } satisfies AnyMessage));
    setTimeout(() => ack({ flowId: message.flowId, ref: "paste_step", stepId: message.stepId }), 2500);
  } else if (message.type === "flow_end") {
    console.log(`[fake-plugin] kết thúc ${message.flowId}: ${message.status}, ${message.totalSteps} bước`);
    ack({ flowId: message.flowId, ref: "flow_end" });
  }
});
