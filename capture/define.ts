import type { BrowserContext, Locator, Page } from "playwright";
import { z } from "zod";
import type { DataHelpers } from "./data";

export interface ShotOptions {
  /** Screen code from the naming standard, e.g. "TK-02". Shown in the frame name. */
  code?: string;
  /** "viewport" (default) keeps overlays and modals as the user sees them. */
  mode?: "viewport" | "fullPage" | "element";
  /** The element to capture when mode is "element": a Playwright selector or a Locator. */
  target?: string | Locator;
  /** Extra Playwright selectors to hide for this shot, on top of the config's `hide`. */
  hide?: string[];
  /** Elements to cover with a solid box (sensitive data). */
  mask?: Array<string | Locator>;
  /** Extra wait right before the screenshot. */
  delayMs?: number;
}

export interface FlowContext {
  page: Page;
  context: BrowserContext;
  /** Captures the current screen as the next step of the flow. Steps keep the order of the calls. */
  shot(stepId: string, title: string, options?: ShotOptions): Promise<void>;
  data: DataHelpers;
  app: { name: string; baseUrl: string };
  viewport: { name: string; width: number; height: number };
  actor?: string;
  log(line: string): void;
}

const flowSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "id chỉ gồm chữ thường, số và dấu gạch ngang"),
  name: z.string().min(1),
  /** Key of an app in capture.config.ts. */
  app: z.string().min(1),
  /** Key(s) of an actor in capture.config.ts; the tool signs in before running. */
  actor: z.union([z.string().min(1), z.array(z.string().min(1)).nonempty()]).optional(),
  /** Keys of viewports in capture.config.ts; each one is a separate Section. */
  viewports: z.array(z.string().min(1)).nonempty().optional(),
  sectionName: z.string().min(1).optional(),
  /**
   * Flows with the same group are stacked inside one parent Section carrying this name. A list nests
   * Sections, outermost first: ["MỜI THÀNH VIÊN", "MỜI THÀNH VIÊN MỚI VÀO SHOP"].
   */
  group: z.union([z.string().min(1), z.array(z.string().min(1)).nonempty()]).optional(),
  run: z.custom<(context: FlowContext) => Promise<void>>((value) => typeof value === "function", "run phải là một hàm"),
}).strict();

export type FlowDefinition = z.infer<typeof flowSchema>;

/** Declares a flow. A `flows/**\/*.flow.ts` file default-exports one flow, or an array of them. */
export function defineFlow(flow: FlowDefinition): FlowDefinition {
  return flow;
}

export function parseFlow(value: unknown): FlowDefinition {
  return flowSchema.parse(value);
}
