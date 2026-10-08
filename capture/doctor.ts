import { existsSync } from "node:fs";
import path from "node:path";
import { styleText } from "node:util";
import { chromium } from "playwright";
import WebSocket from "ws";
import type { AnyMessage } from "../shared/types";
import type { CaptureConfig } from "./config";
import type { DiscoveredFlow } from "./discover";

export interface Check {
  name: string;
  /** "fail" stops captures from working; "warn" only limits what can be done; "info" is for the reader. */
  status: "ok" | "fail" | "warn" | "info";
  detail: string;
  /** What to do about it. */
  fix?: string;
}

async function reachable(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(3000), redirect: "manual" });
    return true;
  } catch {
    return false;
  }
}

/** Whether a relay is listening on the port, and whether the plugin is connected to it. */
function relayStatus(port: number): Promise<"none" | "no-plugin" | "plugin"> {
  return new Promise((resolve) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    const finish = (status: "none" | "no-plugin" | "plugin") => { clearTimeout(timer); socket.removeAllListeners(); socket.on("error", () => undefined); socket.close(); resolve(status); };
    const timer = setTimeout(() => finish("none"), 1500);
    socket.once("error", () => finish("none"));
    socket.once("open", () => socket.send(JSON.stringify({ type: "hello", role: "cli" } satisfies AnyMessage)));
    socket.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString()) as AnyMessage;
        if (message.type === "peer_status") finish(message.pluginConnected ? "plugin" : "no-plugin");
      } catch { /* not for this check */ }
    });
  });
}

/** Looks at everything a capture needs on this computer, without changing any of it. */
export async function runDoctor(root: string, config: CaptureConfig, flows: DiscoveredFlow[]): Promise<Check[]> {
  const checks: Check[] = [];

  const major = Number(process.versions.node.split(".")[0]);
  checks.push(major >= 22
    ? { name: "Node.js", status: "ok", detail: `v${process.versions.node}` }
    : { name: "Node.js", status: "fail", detail: `v${process.versions.node}`, fix: "Cài Node.js 22 trở lên." });

  let browser = "";
  try { browser = chromium.executablePath(); } catch { /* reported below */ }
  checks.push(browser && existsSync(browser)
    ? { name: "Chromium của Playwright", status: "ok", detail: "đã tải" }
    : { name: "Chromium của Playwright", status: "fail", detail: "chưa tải", fix: "Chạy: npx playwright install chromium" });

  checks.push(existsSync(path.join(root, "plugin/dist/code.js")) && existsSync(path.join(root, "plugin/dist/ui.html"))
    ? { name: "Plugin Figma", status: "ok", detail: "đã build vào plugin/dist" }
    : { name: "Plugin Figma", status: "warn", detail: "chưa build", fix: "Chạy: npm run build:plugin (chỉ cần khi gửi sang Figma)" });

  for (const [name, app] of Object.entries(config.apps)) {
    const used = flows.filter((entry) => entry.flow.app === name).length;
    if (await reachable(app.baseUrl)) {
      checks.push({ name: `App ${name}`, status: "ok", detail: `${app.baseUrl} đang chạy · ${used} luồng` });
    } else if (used > 0) {
      checks.push({ name: `App ${name}`, status: "fail", detail: `${app.baseUrl} không trả lời · ${used} luồng cần app này`, fix: `Bật app ${app.label ?? name}, hoặc đặt địa chỉ đúng trong .env.` });
    } else {
      checks.push({ name: `App ${name}`, status: "info", detail: `${app.baseUrl} không trả lời · chưa có luồng nào dùng` });
    }
  }

  const sources: Array<[string, string | undefined, string]> = [
    ...Object.entries(config.apps).map(([name, app]): [string, string | undefined, string] => [`Mã nguồn app ${name}`, app.sourceDir, `${name.toUpperCase()}_SRC`]),
    ["Mã nguồn backend", config.backendSourceDir, "BACKEND_SRC"],
  ];
  for (const [name, directory, variable] of sources) {
    if (!directory) continue;
    const full = path.resolve(root, directory);
    checks.push(existsSync(full)
      ? { name, status: "ok", detail: full }
      : { name, status: "warn", detail: `không thấy ${full}`, fix: `Đặt ${variable}=<đường dẫn> trong .env (chỉ cần khi viết luồng mới).` });
  }

  const relay = await relayStatus(config.figma.port);
  checks.push({
    name: "Kết nối Figma", status: "info",
    detail: relay === "plugin" ? `plugin Flow Capture đang nối vào cổng ${config.figma.port}`
      : relay === "no-plugin" ? `server đang chạy ở cổng ${config.figma.port}, plugin chưa nối`
        : "chưa có server (lệnh chụp tự khởi động); plugin phải được mở trong Figma desktop trước khi gửi ảnh",
  });
  checks.push({
    name: "Plugin trong Figma", status: "info",
    detail: "không tự kiểm tra được: import một lần bằng Plugins → Development → Import plugin from manifest… → plugin/manifest.json",
  });
  return checks;
}

export function printChecks(checks: Check[]) {
  const mark = { ok: styleText("green", "✔"), fail: styleText("red", "✘"), warn: styleText("yellow", "!"), info: styleText("dim", "·") };
  for (const check of checks) {
    console.log(`${mark[check.status]} ${styleText("bold", check.name)}: ${check.detail}`);
    if (check.fix) console.log(`  ${styleText("dim", "→")} ${check.fix}`);
  }
  const failed = checks.filter((check) => check.status === "fail").length;
  console.log(failed === 0 ? styleText("green", "\nSẵn sàng chụp.") : styleText("red", `\n${failed} mục cần sửa trước khi chụp.`));
}
