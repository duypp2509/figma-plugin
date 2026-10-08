import { config as loadEnv } from "dotenv";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs, styleText } from "node:util";
import { loadConfig } from "./config";
import { discoverFlows } from "./discover";
import { printChecks, runDoctor } from "./doctor";
import { runMenu, type MenuChoice } from "./interactive";
import { expandVariants, runFlows, type FlowResult, type Variant } from "./runner";

const root = path.resolve(import.meta.dirname, "..");

const HELP = `Cách dùng: .\\capture [tùy chọn]
Không kèm tùy chọn nào: mở menu để chọn luồng và cách chạy.
(Trong PowerShell đừng dùng "npm run capture -- <cờ>": PowerShell nuốt mất dấu "--" nên cờ không tới được CLI.)

  --list                   Liệt kê các luồng tìm thấy rồi thoát
  --doctor                 Kiểm tra máy đã sẵn sàng chụp chưa rồi thoát
  --json                   Cùng --list hoặc --doctor: in JSON cho script và công cụ AI
  --all                    Chạy mọi luồng, không hỏi (trừ luồng có cảnh báo ⚠, phải gọi đúng id)
  --flow <id>              Chỉ chạy luồng này (lặp lại được; "tiền-tố*" chọn theo tiền tố)
  --viewport <tên>         Chỉ chạy viewport này
  --actor <tên>            Chỉ chạy actor này
  --section-name "<tên>"   Ghi đè tên Section trên Figma
  --headed                 Mở trình duyệt để xem
  --no-figma               Chỉ lưu ảnh ra đĩa, không gửi sang Figma
  --render <image|layers>  image (mặc định): ảnh phẳng. layers: layer chỉnh sửa được, bạn Ctrl+V từng màn trong Figma
  --auto-paste             Cùng --render layers: công cụ tự đưa cửa sổ Figma lên trước và nhấn Ctrl+V thay bạn
  --pause-on-step <stepId> Dừng trước khi chụp bước này, bấm Enter để tiếp tục
  --config <file>          File cấu hình (mặc định capture.config.ts)
`;

/** The flows by id and name, one folder of flows/ after another. */
function printList(variants: Variant[]) {
  const width = Math.max(...variants.map((variant) => variant.flow.id.length));
  let folder: string | null = null;
  for (const variant of variants) {
    const current = path.relative(path.join(root, "flows"), path.dirname(variant.file)) || "luồng lẻ";
    if (current !== folder) {
      folder = current;
      console.log(`\n${styleText("bold", folder)}`);
    }
    // A viewport or an actor is only worth a mention for a flow that runs in several.
    const extra = [(variant.flow.viewports?.length ?? 1) > 1 ? variant.viewport : null, variant.actor].filter(Boolean).join(" · ");
    console.log(`  ${styleText("cyan", variant.flow.id.padEnd(width))}  ${variant.flow.name}${extra ? styleText("dim", `  ${extra}`) : ""}`);
    if (variant.flow.caution) console.log(`  ${" ".repeat(width)}  ${styleText("yellow", `⚠ ${variant.flow.caution}`)}`);
  }
  console.log(styleText("dim", `\n${variants.length} luồng · chạy một luồng: .\\capture --flow <id>`));
}

/** What a run left behind, for whoever reads the outcome without the terminal. */
async function writeLastRun(outputDir: string, run: MenuChoice, results: FlowResult[], error?: string) {
  const flows = await Promise.all(results.map(async (result) => {
    const directory = path.join(root, result.directory);
    const files = (await readdir(directory).catch(() => [])).sort();
    const relative = (file: string) => path.join(result.directory, file).replaceAll("\\", "/");
    return {
      id: result.key, status: result.status, steps: result.steps, ...(result.error ? { error: result.error } : {}),
      directory: result.directory.replaceAll("\\", "/"),
      screenshots: files.filter((file) => file.endsWith(".png") && !file.startsWith("_")).map(relative),
      ...(files.includes("_loi.png") ? { errorScreenshot: relative("_loi.png") } : {}),
      ...(files.includes("_loi.log") ? { errorLog: relative("_loi.log") } : {}),
    };
  }));
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "_last-run.json"), `${JSON.stringify({
    finishedAt: new Date().toISOString(),
    sentToFigma: run.figma, render: run.render,
    ok: !error && results.every((result) => result.status === "complete"),
    ...(error ? { error } : {}),
    flows,
  }, null, 2)}\n`);
}

async function main(): Promise<number> {
  const bare = process.argv.length <= 2;
  // With nothing asked for, a person at a terminal gets the menu.
  const interactive = bare && process.stdin.isTTY === true && process.stdout.isTTY === true;
  const { values } = parseArgs({
    options: {
      list: { type: "boolean", default: false },
      doctor: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      all: { type: "boolean", default: false },
      flow: { type: "string", multiple: true, default: [] },
      viewport: { type: "string" },
      actor: { type: "string" },
      "section-name": { type: "string" },
      headed: { type: "boolean", default: false },
      "no-figma": { type: "boolean", default: false },
      render: { type: "string", default: "image" },
      "auto-paste": { type: "boolean", default: false },
      "pause-on-step": { type: "string" },
      config: { type: "string", default: "capture.config.ts" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) { console.log(HELP); return 0; }

  loadEnv({ path: path.join(root, ".env"), quiet: true });
  const config = await loadConfig(path.resolve(root, values.config));
  const flows = await discoverFlows(path.join(root, "flows"));
  if (flows.length === 0) throw new Error("Chưa có luồng nào: thêm file *.flow.ts vào thư mục flows/.");

  const selection = {
    config, flows, only: values.flow,
    ...(values.viewport ? { viewport: values.viewport } : {}),
    ...(values.actor ? { actor: values.actor } : {}),
    ...(values["section-name"] ? { sectionName: values["section-name"] } : {}),
  };

  if (values.doctor) {
    const checks = await runDoctor(root, config, flows);
    if (values.json) console.log(JSON.stringify({ ok: checks.every((check) => check.status !== "fail"), checks }, null, 2));
    else printChecks(checks);
    return checks.some((check) => check.status === "fail") ? 1 : 0;
  }

  if (values.all && values.flow.length > 0) throw new Error("--all không dùng cùng --flow.");
  if (values.list) {
    // A plain list shows everything there is; with --all or --flow it shows what that would run.
    const variants = expandVariants({ ...selection, includeCautioned: !values.all && values.flow.length === 0 });
    if (values.json) {
      console.log(JSON.stringify(variants.map((variant) => {
        const file = path.relative(root, variant.file).replaceAll("\\", "/");
        return {
          id: variant.flow.id, name: variant.flow.name,
          group: path.relative(path.join(root, "flows"), path.dirname(variant.file)).replaceAll("\\", "/") || null,
          figmaSections: variant.flow.group === undefined ? [] : [variant.flow.group].flat(),
          app: variant.flow.app, viewport: variant.viewport, file,
          ...(variant.flow.caution ? { caution: variant.flow.caution } : {}),
        };
      }), null, 2));
    } else {
      printList(variants);
    }
    return 0;
  }

  // Without a terminal there is nobody to ask, and "everything" is too much to mean by saying nothing.
  if (!interactive && !values.all && values.flow.length === 0) {
    console.error(HELP);
    throw new Error("Chưa chọn luồng: dùng --flow <id> (xem --list) hoặc --all.");
  }
  if (values["auto-paste"] && values.render !== "layers") throw new Error("--auto-paste chỉ dùng cùng --render layers.");
  if (values.render !== "image" && values.render !== "layers") throw new Error(`--render phải là "image" hoặc "layers", không phải "${values.render}".`);
  let run: MenuChoice = { only: values.flow, headed: values.headed, figma: !values["no-figma"], render: values.render, autoPaste: values["auto-paste"] };
  if (interactive) {
    const choice = await runMenu(flows, path.join(root, "flows"));
    if (!choice) return 0;
    run = choice;
  }

  const started = Date.now();
  const outputDir = path.join(root, config.outputDir);
  let results: FlowResult[];
  try {
    results = await runFlows({
      ...selection, ...run, root,
      onCautionSkip: (flow) => console.log(styleText("yellow", `⚠ Bỏ qua "${flow.id}": ${flow.caution}. Muốn chạy thì gọi đúng id: --flow ${flow.id}`)),
      ...(values["pause-on-step"] ? { pauseOnStep: values["pause-on-step"] } : {}),
    });
  } catch (error) {
    await writeLastRun(outputDir, run, [], error instanceof Error ? error.message : String(error));
    throw error;
  }
  await writeLastRun(outputDir, run, results);

  console.log(styleText("bold", "\nKết quả:"));
  for (const result of results) {
    console.log(result.status === "complete"
      ? `  ${styleText("green", "✔")} ${result.key}: ${result.steps} bước ${styleText("dim", `→ ${result.directory}`)}`
      : `  ${styleText("red", "✘")} ${result.key}: chưa hoàn tất sau ${result.steps} bước — ${styleText("red", result.error ?? "")}`);
  }
  const complete = results.filter((result) => result.status === "complete").length;
  const screens = results.reduce((count, result) => count + result.steps, 0);
  console.log(styleText(complete === results.length ? "green" : "yellow",
    `\n${complete}/${results.length} luồng hoàn tất · ${screens} màn · ${Math.round((Date.now() - started) / 1000)} giây`));
  return complete === results.length ? 0 : 1;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`${styleText("red", "Lỗi:")} ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
