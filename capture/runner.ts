import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { styleText } from "node:util";
import { chromium, type Browser, type Locator, type Page } from "playwright";
import type { CaptureConfig } from "./config";
import { data } from "./data";
import type { FlowContext, FlowDefinition, ShotOptions } from "./define";
import type { DiscoveredFlow } from "./discover";
import type { FlowStart, PasteStep } from "../shared/types";
import { FigmaClient } from "./figma-client";
import { captureLayers, LayersClipboard } from "./layers";
import { sliceImage } from "./tiles";

export interface RunOptions {
  root: string;
  config: CaptureConfig;
  flows: DiscoveredFlow[];
  /** Flow ids to run; all when empty. */
  only: string[];
  viewport?: string;
  actor?: string;
  sectionName?: string;
  /** Keep the flows that declare a `caution` even when they were not named by their exact id (for listing). */
  includeCautioned?: boolean;
  /** Told of every flow left out because of its `caution`. */
  onCautionSkip?: (flow: FlowDefinition) => void;
  headed: boolean;
  figma: boolean;
  /** "image": a flat picture per step. "layers": editable Figma layers, pasted by the user step by step. */
  render: "image" | "layers";
  /** With "layers": press Ctrl+V in the Figma window for the user instead of waiting for them to. */
  autoPaste: boolean;
  pauseOnStep?: string;
  /**
   * Set by runFlows for "layers": a folder of this run alone that holds what is waiting to be pasted.
   * The output folder is emptied by any other run of the same flow, which may well happen during the
   * minutes a long series of pastes takes.
   */
  pasteDir?: string;
}

export interface Variant {
  file: string;
  flow: FlowDefinition;
  viewport: string;
  actor?: string;
  /** Stable key of the Figma Section. */
  key: string;
  sectionName: string;
  /** Parent Sections shared with the other flows of the same group, outermost first. */
  groups?: Array<{ id: string; name: string }>;
  /** Folder under the output directory. */
  folder: string;
}

export interface FlowResult {
  key: string;
  status: "complete" | "incomplete";
  steps: number;
  directory: string;
  error?: string;
}

const SETTLE_TIMEOUT_MS = 5000;
const CAPTCHA_TIMEOUT_MS = 10_000;
const CAPTCHA_PAINT_MS = 1200;
/** Time for the user to click the Figma canvas before the automatic pasting starts. */
const AUTO_PASTE_LEAD_MS = 8000;
/** How long an automatic paste may take before the user is asked to press Ctrl+V themselves. */
const AUTO_PASTE_NUDGE_MS = 20_000;
const pad2 = (value: number) => String(value).padStart(2, "0");

/** One run per viewport × actor a flow declares; each becomes its own Section. */
export function expandVariants(options: Pick<RunOptions, "config" | "flows" | "only" | "viewport" | "actor" | "sectionName" | "includeCautioned" | "onCautionSkip">): Variant[] {
  const { config } = options;
  // "--flow quen-mat-khau*" selects every flow whose id starts with the text before the star.
  const selects = (pattern: string, id: string) => pattern.endsWith("*") ? id.startsWith(pattern.slice(0, -1)) : pattern === id;
  for (const pattern of options.only) {
    if (!options.flows.some((entry) => selects(pattern, entry.flow.id))) {
      throw new Error(`Không có luồng nào khớp "${pattern}". Chạy với --list để xem danh sách.`);
    }
  }

  const variants: Variant[] = [];
  for (const { file, flow } of options.flows) {
    if (options.only.length > 0 && !options.only.some((pattern) => selects(pattern, flow.id))) continue;
    // A flow with consequences outside the browser never comes along with the others.
    if (flow.caution && !options.includeCautioned && !options.only.includes(flow.id)) {
      options.onCautionSkip?.(flow);
      continue;
    }
    if (!config.apps[flow.app]) throw new Error(`Luồng "${flow.id}": app "${flow.app}" không có trong capture.config.ts.`);

    const viewports = flow.viewports ?? [config.defaultViewport];
    const actors: Array<string | undefined> = flow.actor === undefined ? [undefined] : [flow.actor].flat();
    for (const viewport of viewports) {
      if (!config.viewports[viewport]) throw new Error(`Luồng "${flow.id}": viewport "${viewport}" không có trong capture.config.ts.`);
    }
    for (const actor of actors) {
      if (actor !== undefined && !config.actors[actor]) throw new Error(`Luồng "${flow.id}": actor "${actor}" không có trong capture.config.ts.`);
    }

    for (const viewport of viewports) {
      if (options.viewport && options.viewport !== viewport) continue;
      for (const actor of actors) {
        if (options.actor && options.actor !== actor) continue;
        const suffixes = [viewports.length > 1 ? viewport : null, actors.length > 1 ? actor : null].filter((part): part is string => !!part);
        const groupPath = flow.group === undefined ? [] : [flow.group].flat();
        variants.push({
          file, flow, viewport, actor,
          key: [flow.id, viewport, actor].filter(Boolean).join("@"),
          sectionName: [options.sectionName ?? flow.sectionName ?? flow.name, ...suffixes].join(" · "),
          // Each viewport × actor gets its own outer group, so a mobile run never lands among desktop frames.
          // An inner group is known by the whole path to it: two groups may hold a group of the same name.
          ...(groupPath.length > 0 ? {
            groups: groupPath.map((name, depth) => ({
              id: [groupPath.slice(0, depth + 1).join("/"), ...suffixes].join("@"),
              name: depth === 0 ? [name, ...suffixes].join(" · ") : name,
            })),
          } : {}),
          folder: [flow.id, ...suffixes].join("-"),
        });
      }
    }
  }
  return variants;
}

async function waitForEnter(prompt: string) {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try { await readline.question(prompt); } finally { readline.close(); }
}

/** Fonts and eagerly loaded images must be painted before the picture is taken. */
async function settle(page: Page) {
  const inPage = page.evaluate(async () => {
    await document.fonts.ready;
    const pending = Array.from(document.images).filter((image) => !image.complete && image.loading !== "lazy");
    await Promise.all(pending.map((image) => image.decode().catch(() => undefined)));
  });
  // Timed on this side: a flow may have frozen the page's clock.
  let timer: NodeJS.Timeout | undefined;
  await Promise.race([inPage, new Promise((resolve) => { timer = setTimeout(resolve, SETTLE_TIMEOUT_MS); })]);
  clearTimeout(timer);

  // A Cloudflare Turnstile widget on the page is captured once it has finished verifying, never while it
  // is still loading or spinning. Its container (".cf-turnstile", or "#cf-turnstile" as react-turnstile
  // names it) gets a hidden field that stays empty until the token arrives.
  const captchas = () => page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll("#cf-turnstile, .cf-turnstile"));
    const solved = containers.filter((container) =>
      Boolean(container.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')?.value));
    return { total: containers.length, pending: containers.length - solved.length };
  });
  const deadline = Date.now() + CAPTCHA_TIMEOUT_MS;
  let state = await captchas();
  while (state.pending > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    state = await captchas();
  }
  // The token arrives a moment before the widget swaps its spinner for the tick.
  if (state.total > 0) await new Promise((resolve) => setTimeout(resolve, CAPTCHA_PAINT_MS));
}

/** How far the tallest scrolling pane on the page overflows, in CSS pixels. Panes inside a dialog do not count. */
const SCROLL_OVERFLOW = `Math.max(0, ...Array.from(document.querySelectorAll("body *")).map((element) => {
  if (element.closest("dialog") || element instanceof HTMLTextAreaElement) return 0;
  const overflowY = getComputedStyle(element).overflowY;
  return overflowY === "auto" || overflowY === "scroll" ? element.scrollHeight - element.clientHeight : 0;
}))`;
const MAX_EXTRA_HEIGHT = 20_000;

const HIDDEN = "data-ffc-hidden";

async function hideAll(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    await page.locator(selector).evaluateAll((elements, attribute) => {
      for (const element of elements as HTMLElement[]) {
        if (element.hasAttribute(attribute)) continue;
        element.setAttribute(attribute, element.style.getPropertyValue("visibility"));
        element.style.setProperty("visibility", "hidden", "important");
      }
    }, HIDDEN);
  }
}

/** Puts hidden elements back, so the flow can still use them (e.g. click a dev helper button). */
async function restoreHidden(page: Page) {
  await page.locator(`[${HIDDEN}]`).evaluateAll((elements, attribute) => {
    for (const element of elements as HTMLElement[]) {
      const previous = element.getAttribute(attribute);
      if (previous) element.style.setProperty("visibility", previous);
      else element.style.removeProperty("visibility");
      element.removeAttribute(attribute);
    }
  }, HIDDEN);
}

/** A step captured as editable layers, waiting to be pasted into Figma. */
interface LayerStep {
  stepIndex: number;
  stepId: string;
  title: string;
  frameName: string;
  /** The saved clipboard HTML. */
  file: string;
}

interface VariantRun {
  result: FlowResult;
  flowStart: FlowStart;
  layerSteps: LayerStep[];
}

async function runVariant(browser: Browser, variant: Variant, options: RunOptions, figma: FigmaClient | null): Promise<VariantRun> {
  const { config } = options;
  const { flow, key } = variant;
  const log = (line: string) => console.log(`${styleText("dim", `[${key}]`)} ${line.startsWith("LỖI") ? styleText("red", line) : line}`);
  const app = config.apps[flow.app]!;
  const viewport = config.viewports[variant.viewport]!;
  const directory = path.join(options.root, config.outputDir, variant.folder);
  const relativeDirectory = path.relative(options.root, directory);
  const stepIds = new Set<string>();
  const layerSteps: LayerStep[] = [];
  const flowStart: FlowStart = {
    type: "flow_start", flowId: key, flowName: variant.sectionName,
    ...(variant.groups ? { groups: variant.groups } : {}),
    viewport: { width: viewport.width, height: viewport.height }, dpr: config.deviceScaleFactor, layout: config.layout,
  };
  let started = false;
  let failure: Error | null = null;

  // A re-run replaces the previous pictures of this variant, so the folder never mixes two runs.
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });

  const context = await browser.newContext({
    baseURL: app.baseUrl,
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: config.deviceScaleFactor,
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    locale: config.locale,
    timezoneId: config.timezoneId,
  });
  for (const glob of config.blockUrls) await context.route(glob, (route) => route.abort());
  const page = await context.newPage();

  const shot = async (stepId: string, title: string, shotOptions: ShotOptions = {}) => {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(stepId)) throw new Error(`stepId "${stepId}" chỉ được gồm chữ thường, số và dấu gạch ngang.`);
    if (stepIds.has(stepId)) throw new Error(`stepId "${stepId}" bị gọi shot() hai lần trong luồng "${flow.id}".`);
    const stepIndex = stepIds.size;
    stepIds.add(stepId);

    if (options.pauseOnStep === stepId) {
      await waitForEnter(`[${key}] Đang dừng trước bước "${stepId}". Thao tác trong trình duyệt rồi bấm Enter để chụp… `);
    }
    if (shotOptions.delayMs) await page.waitForTimeout(shotOptions.delayMs);
    await settle(page);

    const toLocator = (target: string | Locator) => typeof target === "string" ? page.locator(target) : target;
    const common = {
      animations: "disabled", caret: "hide", scale: "device", type: "png",
      mask: shotOptions.mask?.map(toLocator),
    } as const;
    const mode = shotOptions.mode ?? "viewport";
    let png: Buffer;
    let layersHtml: string | null = null;
    // An app shell scrolls its content inside a fixed-height pane, where a full-page screenshot would
    // stop at the viewport. Make the window as tall as that content for the shot, so the layout itself
    // (sidebar included) stretches the way it would on a taller screen.
    const overflow = mode === "fullPage" ? Math.min(await page.evaluate(SCROLL_OVERFLOW) as number, MAX_EXTRA_HEIGHT) : 0;
    if (overflow > 0) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height + overflow });
      await page.waitForTimeout(250);
    }
    await hideAll(page, [...config.hide, ...(shotOptions.hide ?? [])]);
    try {
      if (mode === "element") {
        if (!shotOptions.target) throw new Error(`Bước "${stepId}": mode "element" cần có target.`);
        png = await toLocator(shotOptions.target).screenshot(common);
      } else {
        png = await page.screenshot({ ...common, fullPage: mode === "fullPage" });
      }
      // Taken while the dev overlays are still hidden, so they come out as invisible layers at most.
      if (options.render === "layers") {
        layersHtml = await captureLayers(page, mode === "element" && typeof shotOptions.target === "string" ? shotOptions.target : "body");
      }
    } finally {
      await restoreHidden(page);
      if (overflow > 0) await page.setViewportSize({ width: viewport.width, height: viewport.height });
    }

    const baseName = `${pad2(stepIndex + 1)}-${stepId}`;
    const file = path.join(directory, `${baseName}.png`);
    await writeFile(file, png);
    const image = sliceImage(png);
    log(`${pad2(stepIndex + 1)} ${title} → ${path.relative(options.root, file)} (${image.width}×${image.height}${image.tiles.length > 1 ? `, ${image.tiles.length} lát` : ""})`);
    // Frame names follow "<Product> - <STEP NAME IN CAPITALS>".
    const frameName = `${app.label ?? flow.app} - ${shotOptions.code ? `${shotOptions.code} ` : ""}${title.toLocaleUpperCase("vi-VN")}`;
    if (layersHtml) {
      // Pasted into Figma later, once every flow has been captured: see pasteLayers().
      await writeFile(path.join(directory, `${baseName}.layers.html`), layersHtml);
      const pasteFile = path.join(options.pasteDir ?? directory, `${variant.folder}--${baseName}.layers.html`);
      await writeFile(pasteFile, layersHtml);
      layerSteps.push({ stepIndex, stepId, title, frameName, file: pasteFile });
    } else if (figma) {
      await figma.step({ flowId: key, stepIndex, stepId, title, frameName, ...(shotOptions.code ? { code: shotOptions.code } : {}) }, image);
    }
  };

  try {
    if (figma) {
      await figma.flowStart(flowStart);
      started = true;
    }
    const flowContext: FlowContext = {
      page, context, shot, data, log,
      app: { name: flow.app, baseUrl: app.baseUrl },
      viewport: { name: variant.viewport, width: viewport.width, height: viewport.height },
      ...(variant.actor ? { actor: variant.actor } : {}),
    };
    await flow.run(flowContext);
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
    log(`LỖI sau ${stepIds.size} bước: ${failure.message.split("\n")[0]}`);
    await page.screenshot({ path: path.join(directory, "_loi.png"), animations: "disabled" }).catch(() => undefined);
    await writeFile(path.join(directory, "_loi.log"),
      `Luồng: ${key}\nFile: ${variant.file}\nURL lúc lỗi: ${page.url()}\n\n${failure.stack ?? failure.message}\n`);
    log(`ảnh và log lúc lỗi: ${path.join(relativeDirectory, "_loi.png")}, ${path.join(relativeDirectory, "_loi.log")}`);
  }

  if (figma && started) {
    await figma.flowEnd({ type: "flow_end", flowId: key, status: failure ? "incomplete" : "complete", totalSteps: stepIds.size })
      .catch((error: Error) => { failure ??= error; log(`LỖI khi kết thúc luồng trên Figma: ${error.message}`); });
  }
  await context.close();

  return {
    result: {
      key, steps: stepIds.size, directory: relativeDirectory,
      status: failure ? "incomplete" : "complete",
      ...(failure ? { error: failure.message.split("\n")[0] } : {}),
    },
    flowStart, layerSteps,
  };
}

/**
 * The second half of "layers" rendering, after every flow has been captured: for each step, put its
 * layers on the clipboard and wait for the user's Ctrl+V in Figma, which the plugin files into place.
 * All pastes come in one uninterrupted series, so the user does not have to wait between flows.
 */
async function pasteLayers(figma: FigmaClient, clipboard: LayersClipboard, runs: VariantRun[], autoPaste: boolean): Promise<void> {
  const total = runs.reduce((count, run) => count + run.layerSteps.length, 0);
  if (total === 0) return;
  console.log(autoPaste
    ? `\n[figma] Tự dán ${total} màn hình vào Figma. Bấm vào vùng trống trên canvas của Figma NGAY BÂY GIỜ rồi để yên máy: công cụ sẽ liên tục đưa cửa sổ Figma lên trước và nhấn Ctrl+V. Bắt đầu sau ${AUTO_PASTE_LEAD_MS / 1000} giây…`
    : `\n[figma] Dán ${total} màn hình vào Figma: bấm vào canvas của Figma, rồi nhấn Ctrl+V mỗi khi plugin báo. Clipboard của máy sẽ bị thay nội dung trong lúc này.`);
  if (autoPaste) await new Promise((resolve) => setTimeout(resolve, AUTO_PASTE_LEAD_MS));

  /** Presses Ctrl+V in Figma; says so when a person has to do it. */
  const press = async (key: string) => {
    const outcome = await clipboard.press();
    if (outcome === "NO_WINDOW") console.log(`[${key}] không tìm thấy cửa sổ Figma — hãy tự nhấn Ctrl+V trên canvas.`);
    if (outcome === "NOT_FOREGROUND") console.log(`[${key}] không đưa được cửa sổ Figma lên trước — hãy tự nhấn Ctrl+V trên canvas.`);
    return outcome;
  };
  let position = 0;
  for (const run of runs) {
    if (run.layerSteps.length === 0) continue;
    const { result, flowStart } = run;
    try {
      await figma.flowStart(flowStart);
      for (const step of run.layerSteps) {
        position += 1;
        const message: PasteStep = {
          type: "paste_step", flowId: result.key, stepIndex: step.stepIndex, stepId: step.stepId,
          title: step.title, frameName: step.frameName, position, total,
        };
        // On the clipboard before the plugin starts waiting: a paste made after a failed copy would file
        // whatever the clipboard still held, the previous screen, under this step.
        try {
          await clipboard.copy(step.file);
        } catch (error) {
          result.status = "incomplete";
          result.error ??= `Chưa dán được "${step.frameName}": ${(error as Error).message}`;
          console.log(`[${result.key}] (${position}/${total}) BỎ QUA ${step.frameName}: ${(error as Error).message}`);
          continue;
        }
        let skipped: boolean;
        if (autoPaste) {
          console.log(`[${result.key}] (${position}/${total}) tự dán: ${step.frameName}`);
          // The key is pressed only once the plugin says it is listening, and never a second time: a
          // paste that was merely slow would otherwise arrive twice and be taken for the next step.
          let nudge: NodeJS.Timeout | undefined;
          const pasted = figma.paste(message, () => {
            void press(result.key).then((outcome) => {
              if (outcome !== "SENT") return;
              nudge = setTimeout(() => console.log(`[${result.key}] Figma chưa nhận được màn này — bấm vào vùng trống trên canvas rồi tự nhấn Ctrl+V.`), AUTO_PASTE_NUDGE_MS);
            }).catch((error: Error) => console.log(`[${result.key}] ${error.message} — hãy tự nhấn Ctrl+V trên canvas.`));
          });
          ({ skipped } = await pasted.finally(() => clearTimeout(nudge)));
        } else {
          console.log(`[${result.key}] (${position}/${total}) chờ Ctrl+V: ${step.frameName}`);
          ({ skipped } = await figma.paste(message));
        }
        if (skipped) console.log(`[${result.key}] đã bỏ qua: ${step.frameName}`);
      }
      await figma.flowEnd({ type: "flow_end", flowId: result.key, status: result.status, totalSteps: result.steps });
    } catch (error) {
      result.status = "incomplete";
      result.error ??= `Dán vào Figma lỗi: ${(error as Error).message}`;
      console.log(`[${result.key}] LỖI khi dán vào Figma: ${(error as Error).message}`);
    }
  }
}

/** Runs the selected flows one after another: they share the backend, seed accounts and OTP limits. */
export async function runFlows(options: RunOptions): Promise<FlowResult[]> {
  const variants = expandVariants(options);
  if (variants.length === 0) throw new Error("Không có luồng nào khớp với các bộ lọc đã chọn.");
  const withActor = variants.find((variant) => variant.actor);
  if (withActor) {
    throw new Error(`Luồng "${withActor.flow.id}" khai báo actor "${withActor.actor}", nhưng đăng nhập theo actor chưa được hỗ trợ ở phiên bản này.`);
  }

  let figma: FigmaClient | null = null;
  if (options.figma) {
    figma = await FigmaClient.connect(options.config.figma.port, console.log);
    try {
      await figma.waitForPlugin(options.config.figma.pluginTimeoutMs, console.log);
    } catch (error) {
      await figma.close();
      throw error;
    }
  }

  const browser = await chromium.launch({ headless: !options.headed });
  const runs: VariantRun[] = [];
  const pasteDir = options.render === "layers" ? await mkdtemp(path.join(tmpdir(), "figma-flow-capture-")) : undefined;
  if (pasteDir) options = { ...options, pasteDir };
  try {
    // With "layers" nothing is sent while capturing; the pastes follow in one series afterwards.
    const live = options.render === "layers" ? null : figma;
    try {
      for (const variant of variants) runs.push(await runVariant(browser, variant, options, live));
    } finally {
      await browser.close();
    }
    if (figma && options.render === "layers") {
      const clipboard = new LayersClipboard();
      try {
        await pasteLayers(figma, clipboard, runs, options.autoPaste);
      } finally {
        clipboard.close();
      }
    }
  } finally {
    await figma?.close();
    if (pasteDir) await rm(pasteDir, { recursive: true, force: true }).catch(() => undefined);
  }
  return runs.map((run) => run.result);
}
