// Prints every flow variant as JSON, for web/server.ts. Run in a process of its own each time: Node keeps an
// imported module for the life of the process, so a long-running server that imported the flows itself
// would mix the flow files edited since with helpers it loaded before.
import path from "node:path";
import { loadConfig } from "../capture/config";
import { discoverFlows } from "../capture/discover";
import { expandVariants, flowStartOf } from "../capture/runner";
import type { FlowStart } from "../shared/types";

export interface VariantInfo {
  key: string;
  id: string;
  name: string;
  /** The app's label, e.g. "SuperShip": what starts every frame name. */
  app: string;
  viewport: string;
  /** Absolute path of the flow file. */
  file: string;
  /** Parent Sections on Figma, outermost first, then the flow's own Section. */
  sections: string[];
  caution?: string;
  /** Folder under captures/. */
  captureFolder: string;
  flowStart: FlowStart;
}

const root = path.resolve(import.meta.dirname, "..");
const config = await loadConfig(path.join(root, "capture.config.ts"));
const flows = await discoverFlows(path.join(root, "flows"));
const variants = expandVariants({ config, flows, only: [], includeCautioned: true });
const infos: VariantInfo[] = variants.map((variant) => ({
  key: variant.key, id: variant.flow.id, name: variant.flow.name,
  app: config.apps[variant.flow.app]?.label ?? variant.flow.app,
  viewport: variant.viewport, file: variant.file,
  sections: [...(variant.groups ?? []).map((group) => group.name), variant.sectionName],
  ...(variant.flow.caution ? { caution: variant.flow.caution } : {}),
  captureFolder: variant.folder,
  flowStart: flowStartOf(variant, config),
}));
process.stdout.write(JSON.stringify(infos));
