// Wire protocol between the capture CLI, the local relay server and the Figma plugin.
// Control messages are JSON text frames. A `step` message is followed by one binary frame per tile,
// in the order of `tiles[]`.

export const DEFAULT_PORT = 8765;
/** figma.createImage() rejects images larger than this on either side. */
export const MAX_TILE_PX = 4096;

export type Role = "cli" | "plugin";

export interface Layout {
  /** Horizontal distance between two step frames. */
  gap: number;
  /** Section padding around its content. */
  padding: number;
  /** Vertical distance between a new Section and the content already on the page. */
  sectionGap: number;
  arrows: boolean;
  /** Extra room at the top of every Section, for its own name and the names Figma writes above frames. */
  headroom?: number;
  /** Vertical distance between the Sections stacked inside a group; the padding when left out. */
  rowGap?: number;
  /** The colour level of an outermost Section: 2 colours it "Section 2", the one inside "Section 3"… */
  colorFrom?: number;
}

export interface TileInfo {
  index: number;
  /** Position and size in device pixels inside the full screenshot. */
  x: number;
  y: number;
  width: number;
  height: number;
  byteLength: number;
}

export interface Hello {
  type: "hello";
  role: Role;
}

export interface FlowStart {
  type: "flow_start";
  /** Stable key of the Section, e.g. "dang-ky-shop@desktop". */
  flowId: string;
  /** Section name. */
  flowName: string;
  /**
   * When set, this flow's Section sits inside these parent Sections, outermost first; each is shared by
   * every flow that names it.
   */
  groups?: Array<{ id: string; name: string }>;
  viewport: { width: number; height: number };
  dpr: number;
  layout: Layout;
}

export interface StepMessage {
  type: "step";
  flowId: string;
  stepIndex: number;
  stepId: string;
  title: string;
  code?: string;
  /** The frame's name in Figma, already formatted by the CLI. */
  frameName: string;
  /** Full screenshot size in device pixels. */
  width: number;
  height: number;
  tiles: TileInfo[];
}

/**
 * "Layers" rendering: the step's editable layers are on the clipboard. The plugin waits for the user to
 * paste them (Ctrl+V on the canvas), then files the pasted frame into the Section like any other step.
 */
export interface PasteStep {
  type: "paste_step";
  flowId: string;
  stepIndex: number;
  stepId: string;
  title: string;
  frameName: string;
  /** Where this paste stands in the whole run, for the prompt: 1-based. */
  position: number;
  total: number;
}

/** Sent by the plugin once it is listening for the paste, so an automatic Ctrl+V never comes too early. */
export interface PasteReady {
  type: "paste_ready";
  flowId: string;
  stepId: string;
}

export interface FlowEnd {
  type: "flow_end";
  flowId: string;
  status: "complete" | "incomplete";
  totalSteps: number;
}

export interface Ack {
  type: "ack";
  flowId: string;
  ref: "flow_start" | "step" | "paste_step" | "flow_end";
  stepId?: string;
  ok: boolean;
  error?: string;
  /** The user chose to leave this pasted step out. */
  skipped?: boolean;
}

/** Sent by the relay to every CLI when the plugin connects or disconnects. */
export interface PeerStatus {
  type: "peer_status";
  pluginConnected: boolean;
}

export interface RelayError {
  type: "relay_error";
  message: string;
}

export type CliToPlugin = FlowStart | StepMessage | PasteStep | FlowEnd;
export type PluginToCli = Ack | PasteReady;
export type RelayToCli = PeerStatus | RelayError;
export type AnyMessage = Hello | CliToPlugin | PluginToCli | RelayToCli;

/** Messages between the plugin UI iframe (WebSocket) and the plugin sandbox (Figma API). */
export interface PluginOptions {
  mode: "overwrite" | "new";
  arrows: boolean;
  /** Fill each Section with the file's colour named "Section <level>" (the outermost takes layout.colorFrom, each one inside the next level). */
  colorSections: boolean;
}

export type UiToSandbox =
  | { type: "flow_start"; message: FlowStart; options: PluginOptions }
  | { type: "step"; message: StepMessage; tiles: Uint8Array[] }
  | { type: "paste_step"; message: PasteStep }
  | { type: "flow_end"; message: FlowEnd }
  /** The user pressed "skip" while the plugin was waiting for a paste. */
  | { type: "skip_paste" };

export type SandboxToUi =
  | { type: "ack"; ack: Ack }
  | { type: "progress"; flowName: string; built: number }
  /** Waiting for Ctrl+V on the canvas; null once the paste arrived or was skipped. */
  | { type: "paste_prompt"; step: PasteStep | null }
  /** Something optional could not be done; the flow goes on. */
  | { type: "warning"; message: string };
