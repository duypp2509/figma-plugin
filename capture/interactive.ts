import path from "node:path";
import { styleText } from "node:util";
import * as prompts from "@clack/prompts";
import type { DiscoveredFlow } from "./discover";

/** What the menu settled on: the same choices the flags express. */
export interface MenuChoice {
  /** Flow ids or "prefix*" patterns; empty for every flow. */
  only: string[];
  headed: boolean;
  figma: boolean;
  render: "image" | "layers";
  autoPaste: boolean;
}

interface FlowGroup {
  /** The folder under flows/, or the flow's id for a file directly in flows/. */
  name: string;
  flows: DiscoveredFlow[];
  /** What "--flow" takes to select exactly this group. */
  patterns: string[];
}

class Cancelled extends Error {}

/** What a step answers when the user wants the one before it: the "← Quay lại" option, or Esc. */
const BACK = "__back";
/** The key pressed last. A prompt reports Esc and Ctrl+C alike as cancelled; only this tells them apart. */
let lastKey: string | undefined;

async function ask<T>(prompt: Promise<T>): Promise<Exclude<T, symbol> | typeof BACK> {
  const value = await prompt;
  if (prompts.isCancel(value)) {
    if (lastKey === "escape") return BACK;
    throw new Cancelled();
  }
  return value as Exclude<T, symbol>;
}

function groupFlows(flows: DiscoveredFlow[], flowsDir: string): FlowGroup[] {
  const byName = new Map<string, DiscoveredFlow[]>();
  for (const entry of flows) {
    const parts = path.relative(flowsDir, entry.file).split(path.sep);
    const name = parts.length > 1 ? parts[0]! : entry.flow.id;
    byName.set(name, [...(byName.get(name) ?? []), entry]);
  }
  return Array.from(byName, ([name, members]) => {
    const ids = members.map((entry) => entry.flow.id);
    let prefix = ids[0]!;
    for (const id of ids) while (!id.startsWith(prefix)) prefix = prefix.slice(0, -1);
    // One "prefix*" stands for the group only when it selects these flows and no others.
    const exact = ids.length > 1 && prefix.length > 0 && flows.filter((entry) => entry.flow.id.startsWith(prefix)).length === ids.length;
    return { name, flows: members, patterns: exact ? [`${prefix}*`] : ids };
  });
}

/** The command that does the same without the menu, for the next time or for a script. */
function equivalentCommand(choice: MenuChoice): string {
  return [
    ".\\capture",
    ...(choice.only.length === 0 ? ["--all"] : choice.only.map((pattern) => `--flow ${pattern.includes("*") ? `"${pattern}"` : pattern}`)),
    ...(choice.figma ? [] : ["--no-figma"]),
    ...(choice.render === "layers" ? ["--render layers"] : []),
    ...(choice.autoPaste ? ["--auto-paste"] : []),
    ...(choice.headed ? ["--headed"] : []),
  ].join(" ");
}

/** The menu title and keyboard shortcuts. */
function printHeader(text: string[]) {
  console.log(`\n${text.filter((line, index) => line !== "" || text[index - 1] !== "").join("\n")}\n`);
}

/** A group's size, and the warning of a flow in it that has one. */
const groupHint = (group: FlowGroup) => {
  const caution = group.flows.find((entry) => entry.flow.caution)?.flow.caution;
  return `${group.flows.length} luồng${caution ? ` · ⚠ ${caution}` : ""}`;
};

const BACK_OPTION = { value: BACK as typeof BACK, label: styleText("dim", "← Quay lại") };

/** Shows the flows a group at a time: 71 lines at once is nothing anyone reads. */
async function browseFlows(flows: DiscoveredFlow[], groups: FlowGroup[]): Promise<void> {
  let current: FlowGroup | "all" = groups[0]!;
  for (;;) {
    const picked: FlowGroup | "all" | typeof BACK = await ask(prompts.select<FlowGroup | "all" | typeof BACK>({
      message: "Xem luồng của nhóm nào?",
      options: [
        ...groups.map((group) => ({ value: group, label: group.name, hint: groupHint(group) })),
        { value: "all" as const, label: "Tất cả", hint: `${flows.length} luồng` },
        BACK_OPTION,
      ],
      initialValue: current,
      maxItems: 14,
    }));
    if (picked === BACK) return;
    current = picked;
    const shown = picked === "all" ? flows : picked.flows;
    const width = Math.max(...shown.map(({ flow }) => flow.id.length));
    prompts.log.message(shown.map(({ flow }) => `${styleText("cyan", flow.id.padEnd(width))}  ${flow.name}${flow.caution ? styleText("yellow", `\n${" ".repeat(width)}  ⚠ ${flow.caution}`) : ""}`).join("\n"));
  }
}

/**
 * The questions of a capture, one step at a time; any of them can be left for the one before it.
 * Returns BACK when the first one is left.
 */
async function captureWizard(flows: DiscoveredFlow[], groups: FlowGroup[]): Promise<MenuChoice | typeof BACK> {
  const layersAvailable = process.platform === "win32";
  let step = 0;
  let scope = "groups";
  let only: string[] = [];
  let output = "figma";
  let headed = "no";
  for (;;) {
    if (step === 0) {
      const answer = await ask(prompts.select({
        message: "Chụp những luồng nào?",
        options: [
          { value: "groups", label: "Chọn theo nhóm", hint: `${groups.length} nhóm` },
          { value: "flows", label: "Tìm và chọn từng luồng", hint: "gõ để lọc" },
          { value: "all", label: "Tất cả luồng", hint: `${flows.filter((entry) => !entry.flow.caution).length} luồng, trừ luồng có cảnh báo ⚠` },
          BACK_OPTION,
        ],
        initialValue: scope,
      }));
      if (answer === BACK) return BACK;
      scope = answer;
      only = [];
      step = scope === "all" ? 2 : 1;
    } else if (step === 1) {
      const answer = scope === "groups"
        ? await ask(prompts.multiselect({
          message: "Nhóm luồng (Space chọn, Enter xác nhận; chưa chọn gì mà Enter là quay lại)",
          options: groups.map((group) => ({ value: group, label: group.name, hint: groupHint(group) })),
          maxItems: 12,
          required: false,
        }))
        : await ask(prompts.autocompleteMultiselect({
          message: "Luồng (gõ để lọc, Space chọn, Enter xác nhận; chưa chọn gì mà Enter là quay lại)",
          options: flows.map(({ flow }) => ({ value: flow.id, label: flow.id, hint: flow.caution ? `⚠ ${flow.caution}` : flow.name })),
          maxItems: 12,
          required: false,
        }));
      if (answer === BACK || answer.length === 0) { step = 0; continue; }
      only = answer.flatMap((item) => typeof item === "string" ? [item] : item.patterns);
      step = 2;
    } else if (step === 2) {
      const answer = await ask(prompts.select({
        message: "Kết quả đưa đi đâu?",
        options: [
          { value: "figma", label: "Gửi sang Figma", hint: "ảnh phẳng; cần mở plugin Flow Capture" },
          { value: "disk", label: "Chỉ lưu ảnh ra đĩa", hint: "thư mục captures/, không cần Figma" },
          ...(layersAvailable ? [
            { value: "layers", label: "Figma, layer chỉnh sửa được", hint: "bạn nhấn Ctrl+V từng màn" },
            { value: "layers-auto", label: "Figma, layer chỉnh sửa được, tự dán", hint: "công cụ nhấn Ctrl+V; để yên máy" },
          ] : []),
          BACK_OPTION,
        ],
        initialValue: output,
      }));
      if (answer === BACK) { step = scope === "all" ? 0 : 1; continue; }
      output = answer;
      step = 3;
    } else if (step === 3) {
      const answer = await ask(prompts.select({
        message: "Mở cửa sổ trình duyệt để xem luồng chạy?",
        options: [{ value: "no", label: "Không", hint: "chạy ngầm, nhanh hơn" }, { value: "yes", label: "Có" }, BACK_OPTION],
        initialValue: headed,
      }));
      if (answer === BACK) { step = 2; continue; }
      headed = answer;
      step = 4;
    } else {
      const choice: MenuChoice = {
        only, headed: headed === "yes",
        figma: output !== "disk",
        render: output === "layers" || output === "layers-auto" ? "layers" : "image",
        autoPaste: output === "layers-auto",
      };
      prompts.note(equivalentCommand(choice), "Lệnh tương đương");
      const answer = await ask(prompts.select({
        message: "Chạy?",
        options: [{ value: "run", label: "Chạy" }, BACK_OPTION, { value: "menu", label: "Về menu chính" }],
      }));
      if (answer === "run") return choice;
      if (answer === "menu") return BACK;
      step = 3;
    }
  }
}

/**
 * Asks what to capture instead of taking it from flags. Returns null when the user leaves without
 * running anything.
 */
export async function runMenu(flows: DiscoveredFlow[], flowsDir: string): Promise<MenuChoice | null> {
  const groups = groupFlows(flows, flowsDir);
  printHeader([
    styleText(["bgCyan", "black", "bold"], " figma-flow-capture "),
    "",
    "Chụp từng luồng người dùng,",
    "dựng thành Section trong Figma.",
    "",
    `${styleText("cyan", String(flows.length))} luồng · ${styleText("cyan", String(groups.length))} nhóm`,
    "",
    styleText("dim", "↑ ↓ di chuyển · Space chọn · Enter xác nhận"),
    styleText("dim", "Esc quay lại · Ctrl+C thoát"),
  ]);
  prompts.intro(styleText("dim", "Menu"));
  const onKey = (_: unknown, key?: { name?: string }) => { lastKey = key?.name; };
  process.stdin.on("keypress", onKey);
  try {
    for (;;) {
      const action = await ask(prompts.select({
        message: "Bạn muốn làm gì?",
        options: [
          { value: "capture", label: "Chụp luồng" },
          { value: "list", label: "Xem danh sách luồng" },
          { value: "exit", label: "Thoát" },
        ],
      }));
      if (action === "exit" || action === BACK) { prompts.outro("Tạm biệt."); return null; }
      if (action === "list") { await browseFlows(flows, groups); continue; }
      const choice = await captureWizard(flows, groups);
      if (choice === BACK) continue;
      prompts.outro("Bắt đầu chụp.");
      return choice;
    }
  } catch (error) {
    if (!(error instanceof Cancelled)) throw error;
    prompts.cancel("Đã hủy.");
    return null;
  } finally {
    process.stdin.off("keypress", onKey);
  }
}
