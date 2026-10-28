import { spawn, type ChildProcess } from "node:child_process";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { loadConfig, type CaptureConfig } from "../capture/config";
import { FigmaClient } from "../capture/figma-client";
import { sliceImage } from "../capture/tiles";
import { readLibrary, type Library, type LibraryFlow } from "./library";
import { thumbnail } from "./thumbnails";

const root = path.resolve(import.meta.dirname, "..");
const publicDir = path.join(import.meta.dirname, "public");
const PORT = Number(process.env.FFC_WEB_PORT ?? 4646);
const RECONNECT_MS = 3000;
const LOG_LINES = 400;

loadEnv({ path: path.join(root, ".env"), quiet: true });
const config: CaptureConfig = await loadConfig(path.join(root, "capture.config.ts"));
const capturesDir = path.join(root, config.outputDir);
/** Small copies of the pictures for the cards; outside every flow's folder, which a capture empties. */
const thumbsDir = path.join(capturesDir, ".web-thumbs");
/** The relay port, as server/index.ts reads it. */
const RELAY_PORT = Number(process.env.FFC_PORT ?? config.figma.port);

// ---------------------------------------------------------------------------------------------------------
// The relay link: this server talks to the plugin as one more CLI, and starts the relay itself when no
// other process runs it.

let figma: FigmaClient | null = null;

async function connectFigma(): Promise<void> {
  try {
    const client = await FigmaClient.connect(RELAY_PORT, (line) => console.log(line));
    figma = client;
    client.onPluginStatus(broadcast);
    client.onClose(() => {
      figma = null;
      broadcast();
      setTimeout(() => void connectFigma(), RECONNECT_MS);
    });
    broadcast();
  } catch (error) {
    console.log(`[figma] chưa kết nối được server trung chuyển: ${(error as Error).message}`);
    setTimeout(() => void connectFigma(), RECONNECT_MS);
  }
}

// ---------------------------------------------------------------------------------------------------------
// One job at a time: sending to Figma, or capturing again through the CLI. Both drive the same browser
// apps or the same plugin, so two at once would only get in each other's way.

type ItemStatus = "waiting" | "running" | "done" | "failed" | "skipped";

interface JobItem {
  key: string;
  name: string;
  status: ItemStatus;
  done: number;
  total: number;
  error?: string;
}

interface Job {
  kind: "send" | "capture";
  items: JobItem[];
  running: boolean;
  cancelling: boolean;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  log: string[];
}

let job: Job | null = null;
let child: ChildProcess | null = null;
/** Bumped whenever captures/ may have changed, so the page knows to fetch the flows again. */
let libraryVersion = 0;

function log(line: string) {
  if (!job) return;
  job.log.push(line);
  if (job.log.length > LOG_LINES) job.log.splice(0, job.log.length - LOG_LINES);
}

async function loadLibrary(force = false) {
  return readLibrary(root, config, force);
}

async function sendToFigma(keys: string[]) {
  const library = await loadLibrary();
  const byKey = new Map(library.flows.map((flow) => [flow.key, flow]));
  const current: Job = job = {
    kind: "send", running: true, cancelling: false, startedAt: new Date().toISOString(), log: [],
    items: keys.map((key) => {
      const flow = byKey.get(key);
      return { key, name: flow?.name ?? key, status: "waiting", done: 0, total: flow?.steps.length ?? 0 };
    }),
  };
  broadcast();

  for (const item of current.items) {
    const flow = byKey.get(item.key);
    if (current.cancelling) { item.status = "skipped"; continue; }
    if (!flow || flow.steps.length === 0) {
      item.status = "skipped";
      item.error = "Chưa có ảnh";
      continue;
    }
    const client = figma;
    if (!client?.isPluginConnected) {
      item.status = "failed";
      item.error = "Plugin Figma chưa kết nối";
      continue;
    }
    item.status = "running";
    broadcast();
    let started = false;
    try {
      await client.flowStart(flow.flowStart);
      started = true;
      for (const step of flow.steps) {
        if (current.cancelling) break;
        const png = await readFile(path.join(capturesDir, flow.captureFolder, step.file));
        await client.step({
          flowId: flow.key, stepIndex: step.index, stepId: step.stepId, title: step.title, frameName: step.frameName,
          ...(step.code ? { code: step.code } : {}),
        }, sliceImage(png));
        item.done += 1;
        broadcast();
      }
      // Only a complete set of pictures lets the plugin mark the frames of dropped steps as stale.
      const complete = !current.cancelling && !flow.failure;
      await client.flowEnd({ type: "flow_end", flowId: flow.key, status: complete ? "complete" : "incomplete", totalSteps: item.done });
      item.status = current.cancelling && item.done < item.total ? "skipped" : "done";
      log(`${flow.key}: đã gửi ${item.done}/${item.total} ảnh`);
    } catch (error) {
      item.status = "failed";
      item.error = (error as Error).message;
      log(`${flow.key}: LỖI ${item.error}`);
      if (started && client.isPluginConnected) {
        await client.flowEnd({ type: "flow_end", flowId: flow.key, status: "incomplete", totalSteps: item.done }).catch(() => undefined);
      }
    }
    broadcast();
  }
}

const ANSI = /\x1b\[[0-9;]*m/g;

/** Runs the CLI with --no-figma for these flows; its pictures replace the ones in captures/. */
async function captureAgain(flowIds: string[], keys: string[], names: Map<string, string>) {
  const current: Job = job = {
    kind: "capture", running: true, cancelling: false, startedAt: new Date().toISOString(), log: [],
    items: keys.map((key) => ({ key, name: names.get(key) ?? key, status: "waiting", done: 0, total: 0 })),
  };
  broadcast();
  const byKey = new Map(current.items.map((item) => [item.key, item]));
  const args = [path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), path.join(root, "capture", "cli.ts"),
    ...flowIds.flatMap((id) => ["--flow", id]), "--no-figma"];
  const exitCode = await new Promise<number | null>((resolve) => {
    child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" }, windowsHide: true });
    let pending = "";
    const onData = (chunk: Buffer) => {
      pending += chunk.toString("utf8");
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.replace(ANSI, "");
        if (!line.trim()) continue;
        log(line);
        // "[key] 03 Tiêu đề → captures/…" is one picture taken.
        const match = /^\[([^\]]+)\] (\d{2,}) /.exec(line);
        const item = match ? byKey.get(match[1]!) : undefined;
        if (item) {
          item.status = "running";
          item.done = Number(match![2]);
        }
      }
      broadcast();
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", (error) => { log(`LỖI: ${error.message}`); resolve(null); });
    child.on("close", (code) => resolve(code));
  });
  child = null;

  // The CLI's own account of the run.
  try {
    const lastRun = JSON.parse(await readFile(path.join(capturesDir, "_last-run.json"), "utf8")) as {
      error?: string; flows: Array<{ id: string; status: string; steps: number; error?: string }>;
    };
    if (lastRun.error) current.error = lastRun.error;
    for (const result of lastRun.flows) {
      const item = byKey.get(result.id);
      if (!item) continue;
      item.done = result.steps;
      item.total = result.steps;
      item.status = result.status === "complete" ? "done" : "failed";
      if (result.error) item.error = result.error;
    }
  } catch {
    current.error ??= `Lệnh chụp dừng với mã ${exitCode}`;
  }
  for (const item of current.items) {
    if (item.status === "waiting" || item.status === "running") {
      item.status = current.cancelling ? "skipped" : "failed";
      item.error ??= current.cancelling ? "Đã dừng" : "Không chạy";
    }
  }
}

async function runJob(work: () => Promise<void>) {
  try {
    await work();
  } catch (error) {
    if (job) job.error = (error as Error).message;
  } finally {
    if (job) {
      job.running = false;
      job.finishedAt = new Date().toISOString();
    }
    libraryVersion += 1;
    broadcast();
  }
}

function cancelJob() {
  if (!job?.running) return;
  job.cancelling = true;
  if (child?.pid) {
    // The CLI drives Chromium in child processes of its own: end the whole tree.
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
    else child.kill("SIGTERM");
  }
  broadcast();
}

// ---------------------------------------------------------------------------------------------------------
// HTTP

const listeners = new Set<ServerResponse>();

function state() {
  return {
    relay: figma !== null, plugin: figma?.isPluginConnected ?? false,
    job, libraryVersion,
  };
}

function broadcast() {
  const data = `data: ${JSON.stringify(state())}\n\n`;
  for (const response of listeners) response.write(data);
}

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  let text = "";
  for await (const chunk of request) text += chunk;
  return text ? JSON.parse(text) as Record<string, unknown> : {};
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml",
};

async function serveFile(response: ServerResponse, file: string, cache: string) {
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return json(response, 404, { error: "Không tìm thấy" });
  response.writeHead(200, {
    "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
    "content-length": info.size, "cache-control": cache,
  });
  createReadStream(file).pipe(response);
}

/** Stays inside the folder, so a request can never read a file outside it. */
function inside(folder: string, relative: string): string | null {
  const file = path.resolve(folder, relative);
  return file.startsWith(folder + path.sep) ? file : null;
}

/** The flows for the page, without what only the server needs. */
async function libraryResponse(force: boolean): Promise<Library> {
  const library = await loadLibrary(force);
  return { ...library, flows: library.flows.map(({ flowStart: _, ...flow }) => flow as LibraryFlow) };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  try {
    if (request.method === "POST") {
      // Only this page may start a job: a JSON body forces any other site through a CORS preflight.
      const origin = request.headers.origin;
      if ((origin && origin !== `http://${request.headers.host}`) || !request.headers["content-type"]?.startsWith("application/json")) {
        return json(response, 403, { error: "Không được phép" });
      }
      const input = await body(request);
      if (url.pathname === "/api/cancel") {
        cancelJob();
        return json(response, 200, { ok: true });
      }
      if (url.pathname === "/api/send" || url.pathname === "/api/capture") {
        if (job?.running) return json(response, 409, { error: "Đang có việc chạy, chờ xong hoặc bấm Dừng." });
        const keys = Array.isArray(input.keys) ? input.keys.filter((key): key is string => typeof key === "string") : [];
        if (keys.length === 0) return json(response, 400, { error: "Chưa chọn luồng nào." });
        const library = await loadLibrary();
        const flows = keys.map((key) => library.flows.find((flow) => flow.key === key)).filter((flow): flow is LibraryFlow => !!flow);
        if (url.pathname === "/api/send") {
          if (!figma?.isPluginConnected) return json(response, 409, { error: "Plugin Figma chưa kết nối." });
          void runJob(() => sendToFigma(flows.map((flow) => flow.key)));
        } else {
          // A flow with consequences outside the browser is only captured from the terminal.
          const cautioned = flows.find((flow) => flow.caution);
          if (cautioned) return json(response, 400, { error: `"${cautioned.name}" chỉ chụp được từ terminal: ${cautioned.caution}` });
          // The CLI selects by flow id and runs every viewport of it.
          const ids = [...new Set(flows.map((flow) => flow.id))];
          const runs = library.flows.filter((flow) => ids.includes(flow.id));
          void runJob(() => captureAgain(ids, runs.map((flow) => flow.key), new Map(runs.map((flow) => [flow.key, flow.name]))));
        }
        return json(response, 202, { ok: true });
      }
      return json(response, 404, { error: "Không tìm thấy" });
    }

    if (url.pathname === "/api/flows") return json(response, 200, await libraryResponse(url.searchParams.has("refresh")));
    if (url.pathname === "/api/events") {
      response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      response.write(`data: ${JSON.stringify(state())}\n\n`);
      listeners.add(response);
      request.on("close", () => listeners.delete(response));
      return;
    }
    if (url.pathname.startsWith("/captures/")) {
      const file = inside(capturesDir, decodeURIComponent(url.pathname.slice("/captures/".length)));
      if (!file || path.extname(file) !== ".png") return json(response, 404, { error: "Không tìm thấy" });
      // Picture URLs carry the file's version, so a cached copy is never out of date.
      return serveFile(response, file, url.searchParams.has("v") ? "max-age=31536000, immutable" : "no-cache");
    }
    if (url.pathname.startsWith("/thumbs/")) {
      const relative = decodeURIComponent(url.pathname.slice("/thumbs/".length));
      const source = inside(capturesDir, relative);
      if (!source || path.extname(source) !== ".png" || source.startsWith(thumbsDir + path.sep)) return json(response, 404, { error: "Không tìm thấy" });
      const info = await stat(source).catch(() => null);
      if (!info?.isFile()) return json(response, 404, { error: "Không tìm thấy" });
      const version = String(Math.round(info.mtimeMs));
      return serveFile(response, await thumbnail(source, thumbsDir, path.dirname(relative), version), "max-age=31536000, immutable");
    }
    const file = inside(publicDir, url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1)));
    if (!file) return json(response, 404, { error: "Không tìm thấy" });
    return serveFile(response, file, "no-cache");
  } catch (error) {
    if (!response.headersSent) json(response, 500, { error: (error as Error).message });
    else response.end();
  }
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(error.code === "EADDRINUSE"
    ? `Cổng ${PORT} đang được dùng: có thể giao diện đã chạy ở cửa sổ khác (http://127.0.0.1:${PORT}).`
    : `Không khởi động được: ${error.message}`);
  process.exit(1);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Giao diện Flow Capture: http://127.0.0.1:${PORT}  (Ctrl+C để dừng)`);
  void connectFigma();
  if (process.argv.includes("--open")) {
    const target = `http://127.0.0.1:${PORT}`;
    if (process.platform === "win32") spawn("cmd", ["/c", "start", "", target], { windowsHide: true, detached: true }).unref();
    else spawn(process.platform === "darwin" ? "open" : "xdg-open", [target], { detached: true }).unref();
  }
});
