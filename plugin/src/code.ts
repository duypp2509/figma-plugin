// Plugin sandbox: the only place that touches the Figma document. The UI iframe owns the WebSocket
// and hands every message over with postMessage.
import type { Ack, FlowEnd, FlowStart, PasteStep, PluginOptions, SandboxToUi, StepMessage, UiToSandbox } from "../../shared/types";

const KEY = { flowId: "flowId", groupId: "groupId", kind: "kind", render: "render", stepId: "stepId", stepIndex: "stepIndex" } as const;
const ARROW_INSET = 24;
/** How long the page must stay quiet after a paste before its frame is filed into the Section. */
const PASTE_QUIET_MS = 250;
const STALE_PREFIX = "⚠ không còn trong luồng · ";

interface FlowState {
  start: FlowStart;
  options: PluginOptions;
  section: SectionNode;
  /** The Sections this flow's Section is nested in, outermost first; empty when the flow has no group. */
  groups: SectionNode[];
  /** Steps received in this run; an older frame that is not in here was not sent again. */
  seen: Set<string>;
}

const flows = new Map<string, FlowState>();

figma.showUI(__html__, { width: 340, height: 440, themeColors: true });

const post = (message: SandboxToUi) => figma.ui.postMessage(message);
const kindOf = (node: SceneNode) => node.getPluginData(KEY.kind);
const pad2 = (value: number) => String(value).padStart(2, "0");
const isSection = (node: SceneNode): node is SectionNode => node.type === "SECTION";

function timestamp(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

/** A step's node: a frame holding the picture, or whatever a paste of editable layers produced. */
type StepNode = SceneNode & { x: number; y: number; readonly width: number; readonly height: number };

function stepFrames(section: SectionNode): StepNode[] {
  return section.children.filter((node) => kindOf(node) === "frame") as StepNode[];
}

/** Puts a new top-level Section below everything already on the page. */
function placeBelowPageContent(section: SectionNode, sectionGap: number) {
  const others = figma.currentPage.children.filter((node) => node !== section);
  if (others.length === 0) return;
  section.x = Math.min(...others.map((node) => node.x));
  section.y = Math.max(...others.map((node) => node.y + node.height)) + sectionGap;
}

/** The distances a flow asked for, with what an older capture tool leaves out filled in. */
function spacing(start: FlowStart) {
  const { gap, padding, headroom, rowGap, colorFrom } = start.layout;
  return { gap, padding, top: padding + (headroom || 0), rowGap: rowGap === undefined ? padding : rowGap, colorFrom: colorFrom || 1 };
}

/** Finds or creates the chain of Sections a flow is nested in, each inside the one before it. */
function findOrCreateGroups(start: FlowStart): SectionNode[] {
  const groups: SectionNode[] = [];
  for (const { id, name } of start.groups || []) {
    const parent: SectionNode | undefined = groups[groups.length - 1];
    const siblings: readonly SceneNode[] = parent ? parent.children : figma.currentPage.children;
    let group = siblings.filter(isSection).find((node) => node.getPluginData(KEY.groupId) === id);
    if (!group) {
      group = figma.createSection();
      group.setPluginData(KEY.groupId, id);
      if (parent) parent.appendChild(group);
      else placeBelowPageContent(group, start.layout.sectionGap);
    }
    group.name = name;
    groups.push(group);
  }
  return groups;
}

/**
 * Stacks what each group holds (flows and inner groups) one under another and fits the group around
 * them, from the innermost group outwards so that every group is sized before the one holding it.
 */
function layoutGroups(state: FlowState) {
  const { padding, top, rowGap } = spacing(state.start);
  for (const group of [...state.groups].reverse()) {
    let y = top;
    let widest = 0;
    for (const row of group.children.filter(isSection)) {
      row.x = padding;
      row.y = y;
      y += row.height + rowGap;
      widest = Math.max(widest, row.width);
    }
    group.resizeWithoutConstraints(widest + padding * 2, Math.max(y - rowGap + padding, top + padding));
  }
}

type SectionColor = { kind: "variable"; variable: Variable } | { kind: "style"; id: string };
/** Looked up once per plugin session; null means the file has no colour for that level. */
const sectionColors = new Map<number, SectionColor | null>();

/**
 * Finds the colour the file's owner set aside for Sections of a level: a colour variable or a paint
 * style whose name (or whose collection's name) contains "Section <level>", in this file first and then
 * in the libraries enabled for it.
 */
async function findSectionColor(level: number): Promise<SectionColor | null> {
  if (sectionColors.has(level)) return sectionColors.get(level) || null;
  const wanted = new RegExp(`(^|[^a-z0-9])section[\\s_/-]*${level}($|[^0-9])`, "i");
  const seen: string[] = [];
  let found: SectionColor | null = null;

  for (const variable of await figma.variables.getLocalVariablesAsync("COLOR")) {
    const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
    const label = `${collection ? collection.name : ""}/${variable.name}`;
    seen.push(label);
    if (!found && wanted.test(label)) found = { kind: "variable", variable };
  }
  if (!found) {
    for (const style of await figma.getLocalPaintStylesAsync()) {
      seen.push(style.name);
      if (!found && wanted.test(style.name)) found = { kind: "style", id: style.id };
    }
  }
  if (!found) {
    try {
      for (const collection of await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()) {
        for (const candidate of await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key)) {
          if (candidate.resolvedType !== "COLOR") continue;
          const label = `${collection.name}/${candidate.name}`;
          seen.push(label);
          if (!found && wanted.test(label)) {
            found = { kind: "variable", variable: await figma.variables.importVariableByKeyAsync(candidate.key) };
          }
        }
      }
    } catch (error) {
      seen.push(`(không đọc được thư viện: ${error instanceof Error ? error.message : String(error)})`);
    }
  }

  sectionColors.set(level, found);
  if (!found) {
    post({
      type: "warning",
      message: `Không tìm thấy màu "Section ${level}". Các màu đọc được: ${seen.slice(0, 15).join(", ") || "không có"}.`,
    });
  }
  return found;
}

/** Fills a Section with the file's colour named "Section <level>"; the outermost Section takes the level the capture tool names. */
async function colorSection(section: SectionNode, level: number) {
  const color = await findSectionColor(level);
  if (!color) return;
  if (color.kind === "style") {
    await section.setFillStyleIdAsync(color.id);
  } else {
    const base: SolidPaint = { type: "SOLID", color: { r: 1, g: 1, b: 1 } };
    section.fills = [figma.variables.setBoundVariableForPaint(base, "color", color.variable)];
  }
}

async function handleFlowStart(start: FlowStart, options: PluginOptions) {
  const groups = findOrCreateGroups(start);
  const group: SectionNode | undefined = groups[groups.length - 1];
  let section: SectionNode | undefined;
  if (options.mode === "overwrite") {
    // Looked for anywhere on the page: a flow captured before its groups changed moves to where it belongs now.
    const matches = figma.currentPage.findAllWithCriteria({ types: ["SECTION"] })
      .filter((node) => node.getPluginData(KEY.flowId) === start.flowId);
    section = matches.find((node) => node.parent === group) || matches[matches.length - 1];
  }
  if (section) {
    section.name = start.flowName;
    if (group && section.parent !== group) group.appendChild(section);
  } else {
    section = figma.createSection();
    section.name = options.mode === "new" ? `${start.flowName} · ${timestamp()}` : start.flowName;
    section.setPluginData(KEY.flowId, start.flowId);
    const { padding, top } = spacing(start);
    section.resizeWithoutConstraints(start.viewport.width + padding * 2, start.viewport.height + top + padding);
    if (group) group.appendChild(section);
    else placeBelowPageContent(section, start.layout.sectionGap);
  }
  const state: FlowState = { start, options, section, groups, seen: new Set() };
  flows.set(start.flowId, state);
  layoutGroups(state);
  if (options.colorSections) {
    const { colorFrom } = spacing(start);
    for (let depth = 0; depth < groups.length; depth++) await colorSection(groups[depth]!, colorFrom + depth);
    await colorSection(section, colorFrom + groups.length);
  }
  post({ type: "progress", flowName: start.flowName, built: 0 });
}

function fillFrame(frame: FrameNode, step: StepMessage, tiles: Uint8Array[], dpr: number) {
  for (const child of [...frame.children]) child.remove();
  frame.resizeWithoutConstraints(step.width / dpr, step.height / dpr);
  frame.clipsContent = true;
  frame.fills = [];
  step.tiles.forEach((tile, index) => {
    const bytes = tiles[index];
    if (!bytes) throw new Error(`Thiếu dữ liệu lát ảnh ${index + 1}/${step.tiles.length}.`);
    const image = figma.createImage(bytes);
    const rect = figma.createRectangle();
    rect.name = step.tiles.length > 1 ? `lát ${index + 1}` : "ảnh";
    rect.resizeWithoutConstraints(tile.width / dpr, tile.height / dpr);
    rect.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
    frame.appendChild(rect);
    rect.x = tile.x / dpr;
    rect.y = tile.y / dpr;
    rect.locked = true;
  });
}

async function drawArrow(section: SectionNode, x: number, y: number, length: number): Promise<void> {
  const arrow = figma.createVector();
  arrow.name = "→";
  arrow.setPluginData(KEY.kind, "arrow");
  section.appendChild(arrow);
  await arrow.setVectorNetworkAsync({
    vertices: [{ x: 0, y: 0, strokeCap: "NONE" }, { x: length, y: 0, strokeCap: "ARROW_LINES" }],
    segments: [{ start: 0, end: 1 }],
    regions: [],
  });
  arrow.strokes = [{ type: "SOLID", color: { r: 0.39, g: 0.45, b: 0.55 } }];
  arrow.strokeWeight = 4;
  arrow.x = x;
  arrow.y = y;
}

/**
 * Places every step frame left to right, then fits the Section and its groups. The arrows are only drawn
 * when `final`: redrawing all of them after every step is what made a long flow slow to build.
 */
async function relayout(state: FlowState, final: boolean) {
  const { section, seen } = state;
  const { gap, padding, top } = spacing(state.start);
  for (const node of [...section.children]) {
    // "label" nodes were drawn by an earlier version of this plugin; Figma already shows frame names.
    if (kindOf(node) === "label" || kindOf(node) === "arrow") node.remove();
  }

  // A frame from this run wins a tie: the older frame holding the same index has yet to be sent again.
  const frames = stepFrames(section).sort((a, b) =>
    Number(a.getPluginData(KEY.stepIndex)) - Number(b.getPluginData(KEY.stepIndex))
    || Number(!seen.has(a.getPluginData(KEY.stepId))) - Number(!seen.has(b.getPluginData(KEY.stepId))));

  let x = padding;
  let tallest = state.start.viewport.height;
  let previous: StepNode | null = null;
  for (const frame of frames) {
    frame.x = x;
    frame.y = top;
    if (final && previous && state.start.layout.arrows && state.options.arrows && gap > ARROW_INSET * 2) {
      const middle = Math.min(previous.height, frame.height, state.start.viewport.height) / 2;
      await drawArrow(section, previous.x + previous.width + ARROW_INSET, top + middle, gap - ARROW_INSET * 2);
    }
    tallest = Math.max(tallest, frame.height);
    x += frame.width + gap;
    previous = frame;
  }

  const contentWidth = frames.length > 0 ? x - gap - padding : state.start.viewport.width;
  section.resizeWithoutConstraints(contentWidth + padding * 2, tallest + top + padding);
  layoutGroups(state);
}

async function handleStep(step: StepMessage, tiles: Uint8Array[]) {
  const state = flows.get(step.flowId);
  if (!state) throw new Error(`Chưa nhận flow_start của luồng "${step.flowId}".`);

  const existing = stepFrames(state.section).find((node) => node.getPluginData(KEY.stepId) === step.stepId);
  // A step last pasted as layers is replaced outright; only a picture frame is refilled in place.
  let frame: FrameNode | null = existing && existing.type === "FRAME" && existing.getPluginData(KEY.render) !== "layers" ? existing as unknown as FrameNode : null;
  if (existing && !frame) existing.remove();
  if (!frame) {
    frame = figma.createFrame();
    frame.setPluginData(KEY.kind, "frame");
    frame.setPluginData(KEY.stepId, step.stepId);
    state.section.appendChild(frame);
  }
  frame.name = step.frameName;
  frame.setPluginData(KEY.stepIndex, String(step.stepIndex));
  fillFrame(frame, step, tiles, state.start.dpr);
  state.seen.add(step.stepId);

  await relayout(state, false);
  post({ type: "progress", flowName: state.start.flowName, built: state.seen.size });
}

interface PendingPaste {
  /** Ends the wait: with the pasted nodes' ids, or null when the user skips the step. */
  finish(created: string[] | null): void;
}
let pendingPaste: PendingPaste | null = null;

function insideFiledStep(node: SceneNode): boolean {
  for (let parent = node.parent; parent && parent.type !== "PAGE" && parent.type !== "DOCUMENT"; parent = parent.parent) {
    if (kindOf(parent as SceneNode) === "frame") return true;
  }
  return false;
}

/**
 * "Layers" rendering. The step's layers are on the clipboard; only the Figma app can turn them into
 * nodes, when the user pastes. So wait for nodes to appear on the page, take the pasted frame and file
 * it into the Section as this step, replacing whatever stood for the step before.
 */
async function handlePasteStep(step: PasteStep): Promise<{ skipped: boolean }> {
  const state = flows.get(step.flowId);
  if (!state) throw new Error(`Chưa nhận flow_start của luồng "${step.flowId}".`);
  if (pendingPaste) throw new Error("Đang chờ một lần dán khác.");

  const page = figma.currentPage;
  const created = await new Promise<string[] | null>((resolve) => {
    const ids = new Set<string>();
    let timer: number | undefined;
    const onChange = (event: NodeChangeEvent) => {
      for (const change of event.nodeChanges) {
        // The tail of the previous paste may still be arriving; it belongs to a step already filed.
        if (change.type === "CREATE" && !change.node.removed && !insideFiledStep(change.node as SceneNode)) ids.add(change.node.id);
      }
      if (ids.size === 0) return;
      // One paste arrives as a burst of changes; act once it has gone quiet. Whatever comes after the
      // wait is inside the pasted frame, which is already known by then.
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => pendingPaste && pendingPaste.finish(Array.from(ids)), PASTE_QUIET_MS);
    };
    pendingPaste = {
      finish: (result) => {
        if (timer !== undefined) clearTimeout(timer);
        page.off("nodechange", onChange);
        pendingPaste = null;
        resolve(result);
      },
    };
    page.on("nodechange", onChange);
    post({ type: "paste_prompt", step });
  });
  post({ type: "paste_prompt", step: null });
  if (!created) return { skipped: true };

  // The pasted tree's top nodes are the ones whose parent was already there.
  const createdIds = new Set(created);
  const roots: SceneNode[] = [];
  for (const id of created) {
    const node = await figma.getNodeByIdAsync(id);
    if (!node || node.removed || node.type === "PAGE" || node.type === "DOCUMENT") continue;
    if (node.parent && !createdIds.has(node.parent.id)) roots.push(node as SceneNode);
  }
  const root = roots.sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!root) throw new Error("Không tìm thấy frame vừa dán.");

  for (const old of stepFrames(state.section)) {
    if (old.getPluginData(KEY.stepId) === step.stepId && old.id !== root.id) old.remove();
  }
  state.section.appendChild(root);
  root.name = step.frameName;
  root.setPluginData(KEY.kind, "frame");
  root.setPluginData(KEY.render, "layers");
  root.setPluginData(KEY.stepId, step.stepId);
  root.setPluginData(KEY.stepIndex, String(step.stepIndex));
  state.seen.add(step.stepId);
  // Leave nothing selected, so the next paste does not land inside this frame.
  figma.currentPage.selection = [];

  await relayout(state, false);
  post({ type: "progress", flowName: state.start.flowName, built: state.seen.size });
  return { skipped: false };
}

async function handleFlowEnd(end: FlowEnd) {
  const state = flows.get(end.flowId);
  if (!state) throw new Error(`Chưa nhận flow_start của luồng "${end.flowId}".`);

  // Only a run that reached its end proves a step is gone; a failed run simply stopped sending.
  if (end.status === "complete") {
    let position = end.totalSteps;
    for (const frame of stepFrames(state.section)) {
      if (state.seen.has(frame.getPluginData(KEY.stepId))) continue;
      if (!frame.name.startsWith(STALE_PREFIX)) frame.name = STALE_PREFIX + frame.name;
      frame.setPluginData(KEY.stepIndex, String(position++));
    }
  }
  await relayout(state, true);
  figma.viewport.scrollAndZoomIntoView([state.section]);
  figma.notify(end.status === "complete"
    ? `Đã dựng ${state.seen.size} bước của "${state.start.flowName}".`
    : `"${state.start.flowName}" chưa hoàn tất: mới dựng ${state.seen.size} bước.`);
  flows.delete(end.flowId);
}

figma.ui.onmessage = async (message: UiToSandbox) => {
  if (message.type === "skip_paste") {
    if (pendingPaste) pendingPaste.finish(null);
    return;
  }
  const ack: Ack = {
    type: "ack", flowId: message.message.flowId, ref: message.type, ok: true,
    ...(message.type === "step" || message.type === "paste_step" ? { stepId: message.message.stepId } : {}),
  };
  try {
    if (message.type === "flow_start") await handleFlowStart(message.message, message.options);
    else if (message.type === "step") await handleStep(message.message, message.tiles);
    else if (message.type === "paste_step") ack.skipped = (await handlePasteStep(message.message)).skipped;
    else await handleFlowEnd(message.message);
  } catch (error) {
    ack.ok = false;
    ack.error = error instanceof Error ? error.message : String(error);
  }
  post({ type: "ack", ack });
};
