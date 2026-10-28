import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { CaptureConfig } from "../capture/config";
import { frameNameOf, STEPS_FILE, type SavedStep } from "../capture/runner";
import type { FlowStart } from "../shared/types";
import type { VariantInfo } from "./variants";

export interface LibraryStep {
  /** 0-based, from the number the picture's file name starts with. */
  index: number;
  file: string;
  stepId: string;
  title: string;
  code?: string;
  frameName: string;
  /**
   * False for a picture taken before the tool wrote _steps.json, whose title could not be read from the
   * flow's code either: its frame is then named after the stepId.
   */
  titleKnown: boolean;
  /** Changes whenever the picture is replaced, so the browser never shows a stale copy. */
  version: number;
}

export interface LibraryFlow {
  key: string;
  id: string;
  name: string;
  app: string;
  viewport: string;
  /** Folder of flows/ the flow lives in; "" for a flow at the top level. */
  folder: string;
  /** Parent Sections on Figma, outermost first, then the flow's own Section. */
  sections: string[];
  file: string;
  caution?: string;
  /** Folder under captures/. */
  captureFolder: string;
  capturedAt: string | null;
  steps: LibraryStep[];
  /** The last run stopped early: its error and whether a picture of that moment exists. */
  failure: { message: string; screenshot: string | null } | null;
  /** What starts the flow's Section in Figma; not sent to the page. */
  flowStart: FlowStart;
}

export interface Library {
  flows: LibraryFlow[];
  /** The flow files could not be loaded; the flows shown are the ones last loaded, if any. */
  error?: string;
}

const PICTURE = /^(\d+)-([a-z0-9][a-z0-9-]*)\.png$/;

/**
 * Pictures taken before _steps.json existed only carry their stepId. Their titles are recovered from the
 * literal shot("id", "title") calls and ["id", "title"] step constants in the flow file and the helpers
 * it imports. A title built at run time (a template string) cannot be recovered this way.
 */
class SourceTitles {
  private files = new Map<string, { titles: Map<string, Set<string>>; imports: string[] }>();

  async titleOf(flowFile: string, stepId: string): Promise<string | null> {
    const seen = new Set<string>();
    let level = [flowFile];
    // The nearest file that names the step wins; within one file a step named twice is ambiguous.
    while (level.length > 0) {
      const found = new Set<string>();
      const next: string[] = [];
      for (const file of level) {
        if (seen.has(file)) continue;
        seen.add(file);
        const source = await this.read(file);
        for (const title of source.titles.get(stepId) ?? []) found.add(title);
        next.push(...source.imports);
      }
      if (found.size > 0) return found.size === 1 ? [...found][0]! : null;
      level = next;
    }
    return null;
  }

  private async read(file: string) {
    let source = this.files.get(file);
    if (source) return source;
    const text = await readFile(file, "utf8").catch(() => "");
    const titles = new Map<string, Set<string>>();
    const literal = /(?:shot\(|\[)\s*"([a-z0-9][a-z0-9-]*)"\s*,\s*"((?:[^"\\\n]|\\.)+)"/g;
    for (const match of text.matchAll(literal)) {
      const title = JSON.parse(`"${match[2]}"`) as string;
      titles.set(match[1]!, (titles.get(match[1]!) ?? new Set()).add(title));
    }
    const imports = [...text.matchAll(/from\s+"(\.{1,2}\/[^"]+)"/g)].map((match) => {
      const target = path.resolve(path.dirname(file), match[1]!);
      return target.endsWith(".ts") ? target : `${target}.ts`;
    });
    source = { titles, imports };
    this.files.set(file, source);
    return source;
  }
}

function humanize(stepId: string): string {
  return stepId.replaceAll("-", " ");
}

async function readSavedSteps(directory: string): Promise<Map<string, SavedStep>> {
  try {
    const saved = JSON.parse(await readFile(path.join(directory, STEPS_FILE), "utf8")) as { steps?: SavedStep[] };
    return new Map((saved.steps ?? []).map((step) => [step.file, step]));
  } catch {
    return new Map();
  }
}

/** The error line of a _loi.log written by the runner: the first line after the blank one. */
async function readFailure(directory: string, files: string[]): Promise<LibraryFlow["failure"]> {
  if (!files.includes("_loi.log")) return null;
  const log = await readFile(path.join(directory, "_loi.log"), "utf8").catch(() => "");
  const [, body = log] = log.split(/\r?\n\r?\n/, 2);
  const message = body.split(/\r?\n/)[0]?.replace(/^Error:\s*/, "").trim() || "Lần chụp gần nhất chưa hoàn tất.";
  return { message, screenshot: files.includes("_loi.png") ? "_loi.png" : null };
}

async function readVariant(variant: VariantInfo, root: string, config: CaptureConfig, titles: SourceTitles): Promise<LibraryFlow> {
  const directory = path.join(root, config.outputDir, variant.captureFolder);
  const files = await readdir(directory).catch(() => [] as string[]);
  const saved = await readSavedSteps(directory);

  let newest = 0;
  const steps: LibraryStep[] = [];
  for (const file of files) {
    const match = PICTURE.exec(file);
    if (!match) continue;
    const info = await stat(path.join(directory, file));
    newest = Math.max(newest, info.mtimeMs);
    const stepId = match[2]!;
    const record = saved.get(file);
    const title = record?.title ?? await titles.titleOf(variant.file, stepId);
    steps.push({
      index: Number(match[1]) - 1, file, stepId,
      title: title ?? humanize(stepId),
      ...(record?.code ? { code: record.code } : {}),
      frameName: record?.frameName ?? frameNameOf(variant.app, title ?? stepId),
      titleKnown: title !== null,
      version: Math.round(info.mtimeMs),
    });
  }
  steps.sort((a, b) => a.index - b.index);

  const failure = await readFailure(directory, files);
  if (failure && newest === 0) {
    const info = await stat(path.join(directory, "_loi.log")).catch(() => null);
    newest = info?.mtimeMs ?? 0;
  }
  return {
    key: variant.key, id: variant.id, name: variant.name, app: variant.app, viewport: variant.viewport,
    folder: path.relative(path.join(root, "flows"), path.dirname(variant.file)).replaceAll("\\", "/"),
    sections: variant.sections,
    file: path.relative(root, variant.file).replaceAll("\\", "/"),
    ...(variant.caution ? { caution: variant.caution } : {}),
    captureFolder: variant.captureFolder,
    capturedAt: newest > 0 ? new Date(newest).toISOString() : null,
    steps, failure, flowStart: variant.flowStart,
  };
}

/** The newest change to any file under flows/, helpers included. */
async function flowsChangedAt(directory: string): Promise<number> {
  let newest = 0;
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) newest = Math.max(newest, await flowsChangedAt(full));
    else if (entry.name.endsWith(".ts")) newest = Math.max(newest, (await stat(full).catch(() => null))?.mtimeMs ?? 0);
  }
  return newest;
}

function listVariants(root: string): Promise<VariantInfo[]> {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), path.join(root, "web", "variants.ts")],
      { cwd: root, env: process.env, maxBuffer: 64 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        if (!error) return resolve(JSON.parse(stdout) as VariantInfo[]);
        // The CLI's own wording, e.g. "File luồng không hợp lệ (…)", rather than the process's exit status.
        const reason = stderr.split("\n").map((line) => line.trim()).find((line) => /Error|Lỗi/.test(line))?.replace(/^.*?Error:\s*/, "").trim();
        reject(new Error(reason || error.message));
      });
  });
}

let known: { variants: VariantInfo[]; loadedAt: number; error?: string } | null = null;
let loading: Promise<void> | null = null;

/** Lists the flows again when a file under flows/ changed since the last listing, or when asked to. */
async function currentVariants(root: string, force: boolean) {
  const changedAt = await flowsChangedAt(path.join(root, "flows"));
  if (!known || force || changedAt > known.loadedAt) {
    loading ??= (async () => {
      const startedAt = Date.now();
      try {
        known = { variants: await listVariants(root), loadedAt: startedAt };
      } catch (error) {
        // Keep showing what was last loaded: a flow file saved halfway should not empty the page.
        known = { variants: known?.variants ?? [], loadedAt: startedAt, error: (error as Error).message };
      }
    })().finally(() => { loading = null; });
    await loading;
  }
  return known!;
}

/** Every flow the CLI knows, in the order of --list, with the pictures its last run left in captures/. */
export async function readLibrary(root: string, config: CaptureConfig, force = false): Promise<Library> {
  const { variants, error } = await currentVariants(root, force);
  const titles = new SourceTitles();
  const flows = await Promise.all(variants.map((variant) => readVariant(variant, root, config, titles)));
  return { flows, ...(error ? { error } : {}) };
}
