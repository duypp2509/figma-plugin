// Checks the relay and the tiling end to end without Figma: a stand-in plugin receives a flow,
// reassembles the tiles and compares them with what was sent.
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import WebSocket from "ws";
import { FigmaClient } from "../capture/figma-client";
import { sliceImage } from "../capture/tiles";
import { startRelay } from "../server/relay";
import { MAX_TILE_PX, type Ack, type AnyMessage, type StepMessage } from "../shared/types";
import { makeTestImage } from "./test-images";

const PORT = 8799;
const relay = await startRelay(PORT, () => {});

// A browser page must not be able to read screenshots off this port.
await new Promise<void>((resolve) => {
  const intruder = new WebSocket(`ws://127.0.0.1:${PORT}`, { origin: "https://example.com" });
  intruder.once("open", () => assert.fail("kết nối từ origin lạ phải bị từ chối"));
  intruder.once("error", () => resolve());
});

const client = await FigmaClient.connect(PORT, () => {});
const received: Array<{ step: StepMessage; tiles: Buffer[] }> = [];
const order: string[] = [];

// The plugin connects a moment after the CLI, like a user opening it late.
setTimeout(() => {
  const plugin = new WebSocket(`ws://127.0.0.1:${PORT}`, { origin: "null" });
  let pending: { step: StepMessage; tiles: Buffer[] } | null = null;
  const ack = (ack: Omit<Ack, "type">) => plugin.send(JSON.stringify({ type: "ack", ...ack } satisfies Ack));
  plugin.on("open", () => plugin.send(JSON.stringify({ type: "hello", role: "plugin" } satisfies AnyMessage)));
  plugin.on("message", (data, isBinary) => {
    if (isBinary) {
      assert.ok(pending, "lát ảnh đến trước thông tin bước");
      pending.tiles.push(data as Buffer);
      if (pending.tiles.length === pending.step.tiles.length) {
        received.push(pending);
        order.push(pending.step.stepId);
        // The second step fails on purpose, to check that the error reaches the CLI.
        const fail = pending.step.stepId === "loi";
        ack({ flowId: pending.step.flowId, ref: "step", stepId: pending.step.stepId, ok: !fail, ...(fail ? { error: "lỗi giả" } : {}) });
        pending = null;
      }
      return;
    }
    const message = JSON.parse(data.toString()) as AnyMessage;
    if (message.type === "step") pending = { step: message, tiles: [] };
    else if (message.type === "flow_start" || message.type === "flow_end") {
      order.push(message.type);
      ack({ flowId: message.flowId, ref: message.type, ok: true });
    }
  });
}, 300);

await client.waitForPlugin(5000, () => {});

const flowId = "self-test";
await client.flowStart({
  type: "flow_start", flowId, flowName: "Self test", viewport: { width: 400, height: 300 }, dpr: 2,
  layout: { gap: 120, padding: 120, sectionGap: 400, arrows: true },
});

const small = makeTestImage(800, 600, [200, 50, 50]);
const tall = makeTestImage(900, 10_000, [50, 50, 200]);
const wide = makeTestImage(5000, 300, [50, 200, 50]);

const smallSliced = sliceImage(small);
assert.equal(smallSliced.tiles.length, 1);
assert.equal(smallSliced.tiles[0]!.data, small, "ảnh vừa giới hạn phải được giữ nguyên, không mã hóa lại");
await client.step({ flowId, stepIndex: 0, stepId: "nho", title: "Nhỏ", frameName: "T - NHỎ" }, smallSliced);

await assert.rejects(client.step({ flowId, stepIndex: 1, stepId: "loi", title: "Lỗi", frameName: "T - LỖI" }, smallSliced), /lỗi giả/);

for (const [stepId, source] of [["cao", tall], ["rong", wide]] as const) {
  const sliced = sliceImage(source);
  assert.ok(sliced.tiles.length > 1);
  await client.step({ flowId, stepIndex: 2, stepId, title: stepId, frameName: stepId }, sliced);

  // Lay the tiles the stand-in plugin received back together: the result must be the original pixels.
  const got = received.find((entry) => entry.step.stepId === stepId)!;
  const original = PNG.sync.read(source);
  const rebuilt = new PNG({ width: got.step.width, height: got.step.height });
  got.step.tiles.forEach((tile, index) => {
    assert.ok(tile.width <= MAX_TILE_PX && tile.height <= MAX_TILE_PX, "lát ảnh vượt giới hạn của Figma");
    assert.equal(got.tiles[index]!.length, tile.byteLength);
    const decoded = PNG.sync.read(got.tiles[index]!);
    assert.deepEqual([decoded.width, decoded.height], [tile.width, tile.height]);
    PNG.bitblt(decoded, rebuilt, 0, 0, tile.width, tile.height, tile.x, tile.y);
  });
  assert.deepEqual([rebuilt.width, rebuilt.height], [original.width, original.height]);
  assert.ok(rebuilt.data.equals(original.data), `ghép lại các lát của ảnh "${stepId}" không khớp ảnh gốc`);
}

await client.flowEnd({ type: "flow_end", flowId, status: "complete", totalSteps: 4 });
assert.deepEqual(order, ["flow_start", "nho", "loi", "cao", "rong", "flow_end"]);

await client.close();
await relay.close();
console.log("relay-self-test: PASS (từ chối origin lạ, chờ plugin kết nối muộn, ack lỗi, cắt/ghép ảnh cao và ảnh rộng)");
