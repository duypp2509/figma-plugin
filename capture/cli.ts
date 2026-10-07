import { config as loadEnv } from "dotenv";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadConfig } from "./config";
import { discoverFlows } from "./discover";
import { expandVariants, runFlows } from "./runner";

const root = path.resolve(import.meta.dirname, "..");

const HELP = `Cách dùng: .\\capture [tùy chọn]
(Trong PowerShell đừng dùng "npm run capture -- <cờ>": PowerShell nuốt mất dấu "--" nên cờ không tới được CLI.)

  --list                   Liệt kê các luồng tìm thấy rồi thoát
  --flow <id>              Chỉ chạy luồng này (lặp lại được)
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

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      list: { type: "boolean", default: false },
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

  if (values.list) {
    for (const variant of expandVariants(selection)) {
      console.log([
        variant.flow.id.padEnd(28), `app=${variant.flow.app}`.padEnd(20), `viewport=${variant.viewport}`.padEnd(18),
        `actor=${variant.actor ?? "—"}`.padEnd(22), path.relative(root, variant.file),
      ].join(" "));
    }
    return 0;
  }

  if (values["auto-paste"] && values.render !== "layers") throw new Error("--auto-paste chỉ dùng cùng --render layers.");
  if (values.render !== "image" && values.render !== "layers") throw new Error(`--render phải là "image" hoặc "layers", không phải "${values.render}".`);
  const results = await runFlows({
    ...selection, root, headed: values.headed, figma: !values["no-figma"], render: values.render, autoPaste: values["auto-paste"],
    ...(values["pause-on-step"] ? { pauseOnStep: values["pause-on-step"] } : {}),
  });

  console.log("\nKết quả:");
  for (const result of results) {
    console.log(result.status === "complete"
      ? `  ✔ ${result.key}: ${result.steps} bước → ${result.directory}`
      : `  ✘ ${result.key}: chưa hoàn tất sau ${result.steps} bước — ${result.error}`);
  }
  return results.every((result) => result.status === "complete") ? 0 : 1;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`Lỗi: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
