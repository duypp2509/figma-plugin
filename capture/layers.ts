import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import type { Page } from "playwright";

// "Layers" rendering: instead of a flat picture, each step becomes editable Figma layers.
//
// Figma's own html-to-design script (the one behind the app's "Figma" capture button) serialises the
// page into a payload that the Figma app turns into layers when it is pasted. No plugin API can do that
// conversion, so the payload has to go through the clipboard and a Ctrl+V in Figma; the plugin then
// files the pasted frame into the right Section.

const CAPTURE_SCRIPT_URL = "https://mcp.figma.com/mcp/html-to-design/capture.js";
const CAPTURE_TIMEOUT_MS = 30_000;
/** Elements the script leaves on the page after a capture. */
const LEFTOVERS = ["__figma_capture_toolbar_host__", "__figma_capture_cursor_style__"];

let script: Promise<string> | null = null;

function captureScript(): Promise<string> {
  script ??= fetch(CAPTURE_SCRIPT_URL).then(async (response) => {
    if (!response.ok) throw new Error(`Không tải được script chụp của Figma (${response.status}).`);
    return response.text();
  });
  // A failed download must not be remembered for the rest of the run.
  script.catch(() => { script = null; });
  return script;
}

/**
 * Runs Figma's capture on the page as it is now and returns the HTML it would have put on the clipboard.
 * The script is injected by the tool, so the app does not need its dev tools switched on, and the
 * clipboard write is intercepted in the page, so the computer's clipboard is left alone at this point.
 */
export async function captureLayers(page: Page, selector = "body"): Promise<string> {
  const loaded = await page.evaluate(`typeof window.figma?.captureForDesign === "function"`);
  if (!loaded) await page.addScriptTag({ content: await captureScript() });

  await page.evaluate(`
    (() => {
      window.__ffcLayers = { html: null, error: null };
      // The script waits for the window to be focused before it copies; a background browser never is.
      document.hasFocus = () => true;
      navigator.clipboard.write = async (items) => {
        window.__ffcLayers.html = await (await items[0].getType("text/html")).text();
      };
      // Not awaited: after copying, the script shows a toolbar and only settles once that is closed.
      window.figma.captureForDesign({ selector: ${JSON.stringify(selector)} })
        .then((result) => { if (result && result.success === false) window.__ffcLayers.error = result.error || "không rõ"; })
        .catch((error) => { window.__ffcLayers.error = String(error); });
    })();
  `);

  const deadline = Date.now() + CAPTURE_TIMEOUT_MS;
  let state = { html: null as string | null, error: null as string | null };
  while (Date.now() < deadline) {
    state = await page.evaluate(`window.__ffcLayers`) as typeof state;
    if (state.html || state.error) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await page.evaluate(`
    (() => {
      delete navigator.clipboard.write;
      delete document.hasFocus;
      for (const id of ${JSON.stringify(LEFTOVERS)}) document.getElementById(id)?.remove();
    })();
  `);

  if (state.error) throw new Error(`Script chụp của Figma báo lỗi: ${state.error}`);
  if (!state.html || !state.html.includes("figh2d")) throw new Error("Script chụp của Figma không trả dữ liệu layer sau 30 giây.");
  return state.html;
}

export type PasteOutcome =
  /** Only copied: the user presses Ctrl+V. */
  | "COPIED"
  /** Copied, and Ctrl+V was pressed in the Figma window. */
  | "SENT"
  /** Copied, but Figma is not running or its window could not be brought to the front. */
  | "NO_WINDOW" | "NOT_FOREGROUND";

const OUTCOMES: readonly string[] = ["COPIED", "SENT", "NO_WINDOW", "NOT_FOREGROUND"] satisfies PasteOutcome[];

/**
 * Puts saved captures on the Windows clipboard as HTML, ready for Ctrl+V in Figma, and can press that
 * Ctrl+V in the Figma window itself. One PowerShell process (win-clipboard.ps1) serves the whole series
 * of pastes; it is started with the first one.
 */
export class LayersClipboard {
  private child: ChildProcessWithoutNullStreams | null = null;
  private ready: Promise<void> | null = null;
  private buffer = "";
  private stderr = "";
  /** Whoever is waiting for the next line the script prints. */
  private waiting: { resolve(line: string): void; reject(error: Error): void } | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  private nextLine(): Promise<string> {
    return new Promise((resolve, reject) => { this.waiting = { resolve, reject }; });
  }

  private start(): Promise<void> {
    if (process.platform !== "win32") {
      return Promise.reject(new Error("Chế độ layers hiện chỉ đưa được dữ liệu lên clipboard trên Windows."));
    }
    const script = path.join(import.meta.dirname, "win-clipboard.ps1");
    // FFC_FIGMA_PROCESS names the window to paste into when it is not the standard app, e.g. "Figma Beta".
    const target = process.env.FFC_FIGMA_PROCESS ? ["-ProcessName", process.env.FFC_FIGMA_PROCESS] : [];
    const child = spawn("powershell.exe", ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-File", script, ...target]);
    this.child = child;
    const fail = (error: Error) => {
      this.child = null;
      this.ready = null;
      this.waiting?.reject(error);
      this.waiting = null;
    };
    child.stdout.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      for (let end = this.buffer.indexOf("\n"); end >= 0; end = this.buffer.indexOf("\n")) {
        const line = this.buffer.slice(0, end).trim();
        this.buffer = this.buffer.slice(end + 1);
        this.waiting?.resolve(line);
        this.waiting = null;
      }
    });
    child.stderr.on("data", (chunk: Buffer) => { this.stderr += chunk.toString(); });
    child.on("error", fail);
    child.on("close", (code) => fail(new Error(`PowerShell đã dừng: ${this.stderr.trim() || `mã ${code}`}`)));
    return this.nextLine().then((line) => {
      if (line !== "READY") throw new Error(`PowerShell trả lời lạ khi khởi động: ${line}`);
    });
  }

  private send(command: string): Promise<PasteOutcome> {
    const run = async (): Promise<PasteOutcome> => {
      try {
        await (this.ready ??= this.start());
        const answer = this.nextLine();
        this.child!.stdin.write(`${command}\n`);
        const line = await answer;
        if (!OUTCOMES.includes(line)) throw new Error(line.replace(/^ERROR /, ""));
        return line as PasteOutcome;
      } catch (error) {
        throw new Error(`Không đưa được dữ liệu lên clipboard: ${(error as Error).message}`);
      }
    };
    // One at a time, in the order asked: the clipboard holds a single capture.
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  /** Puts a saved capture on the clipboard. */
  copy(file: string): Promise<PasteOutcome> {
    return this.send(`COPY|${file}`);
  }

  /** Brings the Figma window to the front and presses Ctrl+V there. */
  press(): Promise<PasteOutcome> {
    return this.send("PRESS");
  }

  close(): void {
    this.child?.removeAllListeners("close");
    this.child?.stdin.end();
    this.child = null;
    this.ready = null;
  }
}
