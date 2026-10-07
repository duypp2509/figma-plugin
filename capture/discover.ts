import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseFlow, type FlowDefinition } from "./define";

export interface DiscoveredFlow {
  file: string;
  flow: FlowDefinition;
}

async function flowFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    // Folders such as _helpers hold shared code, not flows.
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await flowFiles(full));
    else if (entry.name.endsWith(".flow.ts")) files.push(full);
  }
  return files;
}

/** Loads every `*.flow.ts` under the flows directory. Adding a flow never needs a registration step. */
export async function discoverFlows(flowsDir: string): Promise<DiscoveredFlow[]> {
  const found: DiscoveredFlow[] = [];
  const byId = new Map<string, string>();
  for (const file of await flowFiles(flowsDir)) {
    const relative = path.relative(flowsDir, file);
    const module = await import(pathToFileURL(file).href) as { default?: unknown };
    // One file may declare several flows, e.g. the same journey once per OTP channel.
    let flows: FlowDefinition[];
    try {
      flows = (Array.isArray(module.default) ? module.default : [module.default]).map(parseFlow);
    } catch (error) {
      const detail = error instanceof Error && "issues" in error
        ? (error as { issues: Array<{ path: Array<string | number>; message: string }> }).issues
          .map((issue) => `${issue.path.join(".") || "export default"}: ${issue.message}`).join("; ")
        : String(error);
      throw new Error(`File luồng không hợp lệ (${relative}): ${detail}`);
    }
    for (const flow of flows) {
      const duplicate = byId.get(flow.id);
      if (duplicate) throw new Error(`id luồng "${flow.id}" bị trùng giữa ${duplicate} và ${relative}.`);
      byId.set(flow.id, relative);
      found.push({ file, flow });
    }
  }
  return found;
}
