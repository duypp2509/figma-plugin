import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { DEFAULT_PORT } from "../shared/types";

const configSchema = z.object({
  /** App name → where it runs. A flow picks one with `app`. */
  apps: z.record(z.object({
    baseUrl: z.string().url(),
    /** Product name that starts every frame name, e.g. "SuperShip - NHẬP MÃ OTP". Defaults to the key. */
    label: z.string().min(1).optional(),
  })),
  /** Viewport name → logical size. */
  viewports: z.record(z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    isMobile: z.boolean().default(false),
  })),
  defaultViewport: z.string().default("desktop"),
  deviceScaleFactor: z.number().positive().default(2),
  /** Actor name → account. The password is read from the environment variable named here. */
  actors: z.record(z.object({ identifier: z.string().min(1), passwordEnv: z.string().min(1) })).default({}),
  /** Playwright selectors hidden in every shot (dev-only overlays). */
  hide: z.array(z.string()).default([]),
  /** URL globs that are never loaded. */
  blockUrls: z.array(z.string()).default([]),
  locale: z.string().default("vi-VN"),
  timezoneId: z.string().default("Asia/Ho_Chi_Minh"),
  outputDir: z.string().default("captures"),
  figma: z.object({
    port: z.number().int().positive().default(DEFAULT_PORT),
    /** How long to wait for the plugin to connect before giving up. */
    pluginTimeoutMs: z.number().int().positive().default(120_000),
  }).default({}),
  layout: z.object({
    gap: z.number().nonnegative().default(320),
    padding: z.number().nonnegative().default(240),
    sectionGap: z.number().nonnegative().default(800),
    arrows: z.boolean().default(false),
    headroom: z.number().nonnegative().default(200),
    rowGap: z.number().nonnegative().default(400),
    colorFrom: z.number().int().positive().default(2),
  }).default({}),
}).strict();

export type CaptureConfig = z.infer<typeof configSchema>;

export function defineConfig(config: z.input<typeof configSchema>): z.input<typeof configSchema> {
  return config;
}

export async function loadConfig(file: string): Promise<CaptureConfig> {
  if (!existsSync(file)) throw new Error(`Không tìm thấy file cấu hình: ${file}`);
  const module = await import(pathToFileURL(file).href) as { default?: unknown };
  const parsed = configSchema.safeParse(module.default);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join(".") || "(gốc)"}: ${issue.message}`);
    throw new Error(`Cấu hình không hợp lệ (${file}):\n${issues.join("\n")}`);
  }
  if (!parsed.data.viewports[parsed.data.defaultViewport]) {
    throw new Error(`defaultViewport "${parsed.data.defaultViewport}" không có trong viewports.`);
  }
  return parsed.data;
}
