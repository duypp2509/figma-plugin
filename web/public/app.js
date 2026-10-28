// The page of web/server.ts: flows on the left, the pictures of one flow on the right, a selection that
// is sent to Figma (or captured again) in one go.

const $ = (selector) => document.querySelector(selector);
const escape = (text) => String(text ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

const ICON = {
  caret: '<svg class="group-caret" viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevron: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  send: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h12m-4-4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  camera: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h2l1.2-2h4.6l1.2 2h2A1.5 1.5 0 0 1 17 7.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="10" cy="11" r="2.8" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  check: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10.5 3.2 3L15 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cross: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8m0-8-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  minus: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 10h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  time: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 6.5V10l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
};

/** Per-viewer conveniences only; the page works the same without them. */
const stored = {
  get(key, fallback) {
    try { const value = localStorage.getItem(`ffc.${key}`); return value === null ? fallback : JSON.parse(value); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`ffc.${key}`, JSON.stringify(value)); } catch { /* private window */ }
  },
};

const state = {
  flows: [],
  error: null,
  loaded: false,
  selected: new Set(stored.get("selected", [])),
  active: stored.get("active", null),
  filter: stored.get("filter", "all"),
  /** An app label ("SuperPlatform", "SuperShip"), or "" for every app. */
  app: stored.get("app", ""),
  search: "",
  collapsed: new Set(stored.get("collapsed", [])),
  thumb: stored.get("thumb", 300),
  server: { relay: false, plugin: false, job: null, libraryVersion: 0 },
  jobDismissed: null,
  viewer: null,
};

// ---------------------------------------------------------------------------------------------------------
// Data

async function loadFlows(refresh = false) {
  try {
    const response = await fetch(refresh ? "/api/flows?refresh=1" : "/api/flows");
    const library = await response.json();
    state.flows = library.flows;
    state.error = library.error ?? null;
  } catch (error) {
    state.error = `Không đọc được danh sách luồng: ${error.message}`;
  }
  state.loaded = true;
  const keys = new Set(state.flows.map((flow) => flow.key));
  state.selected = new Set([...state.selected].filter((key) => keys.has(key)));
  if (!keys.has(state.active)) state.active = state.flows.find((flow) => flow.steps.length > 0)?.key ?? state.flows[0]?.key ?? null;
  renderAll();
}

async function post(url, body) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? `Lỗi ${response.status}`);
  return result;
}

function listen() {
  const events = new EventSource("/api/events");
  events.onmessage = (event) => {
    const previous = state.server;
    state.server = JSON.parse(event.data);
    if (state.server.libraryVersion !== previous.libraryVersion && state.loaded) void loadFlows();
    renderStatus();
    renderJob();
    renderSelectionBar();
    renderDetailActions();
  };
  events.onerror = () => {
    state.server = { ...state.server, relay: false, plugin: false };
    renderStatus();
  };
}

// ---------------------------------------------------------------------------------------------------------
// Helpers

const byKey = (key) => state.flows.find((flow) => flow.key === key);
const flowTitle = (flow) => flow.sections.at(-1) ?? flow.name;
const busy = () => state.server.job?.running === true;

function visibleFlows() {
  const query = state.search.trim().toLocaleLowerCase("vi-VN");
  return state.flows.filter((flow) => {
    if (state.app && flow.app !== state.app) return false;
    if (state.filter === "images" && flow.steps.length === 0) return false;
    if (state.filter === "failed" && !flow.failure) return false;
    if (!query) return true;
    return [flow.key, flow.name, flow.folder, ...flow.sections].join(" ").toLocaleLowerCase("vi-VN").includes(query);
  });
}

/** Flows grouped by their folder under flows/, in the CLI's order. */
function groupsOf(flows) {
  const groups = new Map();
  for (const flow of flows) {
    if (!groups.has(flow.folder)) groups.set(flow.folder, []);
    groups.get(flow.folder).push(flow);
  }
  return [...groups].map(([folder, items]) => {
    // A folder is named after the innermost parent Section all of its flows share.
    let shared = items[0].sections.slice(0, -1);
    for (const flow of items) {
      const parents = flow.sections.slice(0, -1);
      let depth = 0;
      while (depth < shared.length && shared[depth] === parents[depth]) depth += 1;
      shared = shared.slice(0, depth);
    }
    const label = shared.at(-1) ?? (folder || "Luồng lẻ");
    return { folder, label, app: items[0].app, flows: items };
  });
}

function relativeTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const seconds = (Date.now() - date.getTime()) / 1000;
  if (seconds < 60) return "vừa xong";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  return date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const pictureUrl = (flow, file, version) => `/captures/${encodeURIComponent(flow.captureFolder)}/${encodeURIComponent(file)}${version ? `?v=${version}` : ""}`;
/** The cards load a small copy: a full screenshot costs the browser 20 MB or more once decoded. */
const thumbUrl = (flow, file, version) => `/thumbs/${encodeURIComponent(flow.captureFolder)}/${encodeURIComponent(file)}${version ? `?v=${version}` : ""}`;

let toastTimer;
function toast(message, kind = "info") {
  const element = $("#toast");
  element.textContent = message;
  element.className = `toast ${kind}`;
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.hidden = true; }, kind === "error" ? 6000 : 3000);
}

function saveSelection() {
  stored.set("selected", [...state.selected]);
}

// ---------------------------------------------------------------------------------------------------------
// Rendering

function renderAll() {
  renderFilters();
  renderList();
  renderDetail();
  renderSelectionBar();
  renderStatus();
  renderJob();
}

function renderStatus() {
  const pill = $("#plugin-status");
  const { relay, plugin } = state.server;
  pill.dataset.state = plugin ? "on" : relay ? "wait" : "off";
  pill.querySelector(".label").textContent = plugin ? "Plugin Figma đã kết nối" : relay ? "Chưa mở plugin Figma" : "Chưa có server trung chuyển";
  pill.title = plugin
    ? "Ghi đè hay tạo Section mới: chọn trong cửa sổ plugin"
    : "Figma desktop → Plugins → Development → Flow Capture";
}

function renderFilters() {
  // One chip per app the flows run in; the counts below follow the app chosen.
  const apps = [...new Set(state.flows.map((flow) => flow.app))].sort();
  if (state.app && !apps.includes(state.app)) state.app = "";
  $("#app-filters").innerHTML = ["", ...apps].map((app) => {
    const count = app ? state.flows.filter((flow) => flow.app === app).length : state.flows.length;
    return `<button type="button" role="tab" data-app="${escape(app)}" class="chip" aria-selected="${app === state.app}">${escape(app || (apps.length === 2 ? "Cả hai" : "Mọi ứng dụng"))} <span>${count}</span></button>`;
  }).join("");
  const inApp = state.flows.filter((flow) => !state.app || flow.app === state.app);
  const counts = {
    all: inApp.length,
    images: inApp.filter((flow) => flow.steps.length > 0).length,
    failed: inApp.filter((flow) => flow.failure).length,
  };
  for (const chip of document.querySelectorAll("[data-filter]")) {
    chip.setAttribute("aria-selected", String(chip.dataset.filter === state.filter));
    chip.querySelector("span").textContent = counts[chip.dataset.filter];
  }
}

function renderList() {
  const list = $("#flow-list");
  if (!state.loaded) { list.innerHTML = '<div class="empty-list">Đang đọc luồng…</div>'; return; }
  if (state.error && state.flows.length === 0) { list.innerHTML = `<div class="empty-list">${escape(state.error)}</div>`; return; }
  // The flows last loaded stay usable while a flow file being edited does not load.
  const warning = state.error ? `<div class="list-warning" title="${escape(state.error)}"><strong>Chưa đọc được luồng mới</strong>${escape(state.error)}</div>` : "";
  const groups = groupsOf(visibleFlows());
  if (groups.length === 0) { list.innerHTML = `${warning}<div class="empty-list">Không có luồng nào khớp.</div>`; return; }

  list.innerHTML = warning + groups.map((group) => {
    const chosen = group.flows.filter((flow) => state.selected.has(flow.key)).length;
    const collapsed = state.collapsed.has(group.folder) && !state.search;
    return `
      <section class="group${collapsed ? " collapsed" : ""}" data-group="${escape(group.folder)}">
        <div class="group-head" data-toggle-group="${escape(group.folder)}">
          <input type="checkbox" class="check" data-select-group="${escape(group.folder)}" aria-label="Chọn cả nhóm"
            ${chosen === group.flows.length ? "checked" : ""} ${chosen > 0 && chosen < group.flows.length ? 'data-indeterminate="1"' : ""}>
          <div class="group-name">${escape(group.label)}<small>${escape(group.app)} · ${escape(group.folder || "flows/")}</small></div>
          <span class="group-count">${chosen > 0 ? `${chosen}/` : ""}${group.flows.length}</span>
          ${ICON.caret}
        </div>
        <div class="group-body">
          ${group.flows.map(renderRow).join("")}
        </div>
      </section>`;
  }).join("");
  for (const box of list.querySelectorAll("[data-indeterminate]")) box.indeterminate = true;
}

function renderRow(flow) {
  const count = flow.steps.length;
  const badges = [
    count > 0 ? `<span class="badge">${count} ảnh</span>` : '<span class="badge">Chưa chụp</span>',
    flow.failure ? '<span class="badge danger">Lỗi</span>' : "",
    flow.caution ? '<span class="badge warning" title="' + escape(flow.caution) + '">⚠</span>' : "",
  ].join("");
  return `
    <div class="flow-row${flow.key === state.active ? " active" : ""}" data-open="${escape(flow.key)}" title="${escape(flow.key)}">
      <input type="checkbox" class="check" data-select="${escape(flow.key)}" aria-label="Chọn luồng" ${state.selected.has(flow.key) ? "checked" : ""}>
      <div class="flow-main">
        <div class="flow-name">${escape(flowTitle(flow))}</div>
        <div class="flow-sub">${badges}<span>${escape(relativeTime(flow.capturedAt))}</span></div>
      </div>
    </div>`;
}

function renderDetail() {
  const detail = $("#detail");
  const flow = byKey(state.active);
  if (!state.loaded) { detail.innerHTML = ""; return; }
  if (!flow) {
    detail.innerHTML = `<div class="empty"><strong>Chưa có luồng nào</strong>${escape(state.error ?? "Thêm file *.flow.ts vào thư mục flows/.")}</div>`;
    return;
  }
  const crumbs = flow.sections.slice(0, -1).map(escape).join(ICON.chevron);
  const unnamed = flow.steps.filter((step) => !step.titleKnown).length;
  detail.innerHTML = `
    <div class="detail-head">
      <div>
        ${crumbs ? `<div class="crumbs">${crumbs}</div>` : ""}
        <h1>${escape(flowTitle(flow))}</h1>
        <div class="meta">
          <span class="mono">${escape(flow.key)}</span>
          <span>${escape(flow.app)} · ${escape(flow.viewport)}</span>
          ${flow.capturedAt ? `<span title="${escape(new Date(flow.capturedAt).toLocaleString("vi-VN"))}">${ICON.time}${escape(relativeTime(flow.capturedAt))}</span>` : ""}
          <span class="mono">${escape(flow.file)}</span>
        </div>
      </div>
      <div class="detail-actions" id="detail-actions"></div>
    </div>
    ${flow.caution ? `<div class="notice warning"><div class="notice-body"><div class="notice-title">Chỉ chụp từ terminal</div>${escape(flow.caution)}</div></div>` : ""}
    ${flow.failure ? `
      <div class="notice danger">
        <div class="notice-body">
          <div class="notice-title">Lần chụp gần nhất chưa hoàn tất</div>
          <div class="mono">${escape(flow.failure.message)}</div>
        </div>
        ${flow.failure.screenshot ? `<img class="notice-thumb" src="${thumbUrl(flow, flow.failure.screenshot, Date.parse(flow.capturedAt ?? "") || 0)}" data-full="${pictureUrl(flow, flow.failure.screenshot)}" alt="Màn hình lúc lỗi" data-open-failure>` : ""}
      </div>` : ""}
    ${unnamed > 0 ? `<div class="notice warning"><div class="notice-body"><div class="notice-title">${unnamed} ảnh chưa có tên bước</div>Chụp lại để frame trên Figma có đúng tên.</div></div>` : ""}
    ${flow.steps.length > 0 ? `
      <div class="toolbar">
        <h2>${flow.steps.length} bước</h2>
        <label class="size-control">Cỡ ảnh <input id="thumb-size" type="range" min="200" max="560" step="20" value="${state.thumb}"></label>
      </div>
      <div class="steps" style="--thumb:${state.thumb}px">
        ${flow.steps.map((step, position) => `
          <article class="step">
            <button type="button" class="step-image" data-view="${position}" aria-label="Xem ảnh bước ${position + 1}">
              <img src="${thumbUrl(flow, step.file, step.version)}" alt="" loading="lazy" decoding="async">
            </button>
            <div class="step-info">
              <span class="step-number">${String(step.index + 1).padStart(2, "0")}</span>
              <div class="step-text">
                <div class="step-title">${escape(step.title)}${step.titleKnown ? "" : ' <span class="badge warning" title="Tên tạm theo stepId">tên tạm</span>'}</div>
                <div class="step-frame" title="${escape(step.frameName)}">${escape(step.frameName)}</div>
              </div>
            </div>
          </article>`).join("")}
      </div>` : `
      <div class="empty">
        <strong>Chưa có ảnh</strong>
        Luồng này chưa được chụp, hoặc lần chụp gần nhất dừng trước bước đầu tiên.
      </div>`}
  `;
  renderDetailActions();
}

function renderDetailActions() {
  const container = $("#detail-actions");
  const flow = byKey(state.active);
  if (!container || !flow) return;
  const canSend = state.server.plugin && flow.steps.length > 0 && !busy();
  container.innerHTML = `
    <button type="button" class="btn btn-secondary" data-capture-one ${flow.caution || busy() ? "disabled" : ""}
      title="${flow.caution ? "Chỉ chụp từ terminal" : "Chụp lại luồng này, chỉ lưu ra đĩa"}">${ICON.camera}Chụp lại</button>
    <button type="button" class="btn btn-primary" data-send-one ${canSend ? "" : "disabled"}
      title="${!state.server.plugin ? "Mở plugin Flow Capture trong Figma trước" : flow.steps.length === 0 ? "Chưa có ảnh" : ""}">${ICON.send}Gửi sang Figma</button>`;
}

function renderSelectionBar() {
  const bar = $("#selection-bar");
  const flows = [...state.selected].map(byKey).filter(Boolean);
  bar.hidden = flows.length === 0;
  if (flows.length === 0) return;
  const pictures = flows.reduce((count, flow) => count + flow.steps.length, 0);
  const empty = flows.filter((flow) => flow.steps.length === 0).length;
  $("#selection-count").textContent = `Đã chọn ${flows.length} luồng`;
  $("#selection-meta").textContent = `${pictures} ảnh${empty ? ` · ${empty} luồng chưa có ảnh` : ""}`;
  const send = $("#send-selected");
  send.disabled = !state.server.plugin || pictures === 0 || busy();
  send.title = !state.server.plugin ? "Mở plugin Flow Capture trong Figma trước" : "";
  const capture = $("#capture-selected");
  const cautioned = flows.some((flow) => flow.caution);
  capture.disabled = busy() || cautioned;
  capture.title = cautioned ? "Có luồng chỉ chụp được từ terminal" : "Chụp lại các luồng đã chọn, chỉ lưu ra đĩa";
}

const JOB_ICON = { done: ICON.check, failed: ICON.cross, skipped: ICON.minus, running: "", waiting: "" };

function renderJob() {
  const panel = $("#job");
  const job = state.server.job;
  if (!job || state.jobDismissed === job.startedAt) { panel.hidden = true; return; }
  panel.hidden = false;
  const total = job.items.reduce((sum, item) => sum + Math.max(item.total, item.done), 0);
  const done = job.items.reduce((sum, item) => sum + item.done, 0);
  const finished = job.items.filter((item) => item.status !== "waiting" && item.status !== "running").length;
  const failed = job.items.filter((item) => item.status === "failed").length;
  const ratio = job.running
    ? (job.kind === "send" && total > 0 ? done / total : finished / job.items.length)
    : 1;
  const title = job.running
    ? (job.cancelling ? "Đang dừng…" : job.kind === "send" ? "Đang gửi sang Figma" : "Đang chụp lại")
    : failed > 0 || job.error ? (job.kind === "send" ? "Gửi xong, có lỗi" : "Chụp xong, có lỗi") : (job.kind === "send" ? "Đã gửi sang Figma" : "Đã chụp lại");
  const summary = job.kind === "send"
    ? `${done}/${total} ảnh · ${finished}/${job.items.length} luồng`
    : `${finished}/${job.items.length} luồng`;
  const logOpen = panel.querySelector("details")?.open ?? false;
  panel.innerHTML = `
    <div class="job-head">
      <div class="job-title">${title}</div>
      ${job.running ? "" : `<button type="button" class="icon-btn" data-dismiss-job aria-label="Đóng">${ICON.close}</button>`}
    </div>
    <div class="job-progress${job.running ? "" : failed > 0 || job.error ? " failed" : " done"}"><div style="width:${Math.round(ratio * 100)}%"></div></div>
    <div class="job-summary">${summary}${job.error ? ` · <span style="color:var(--danger)">${escape(job.error)}</span>` : ""}</div>
    <ul class="job-items">
      ${job.items.map((item) => `
        <li>
          <span class="job-icon ${item.status}">${JOB_ICON[item.status]}</span>
          <span class="name">${escape(byKey(item.key) ? flowTitle(byKey(item.key)) : item.name)}${item.error ? `<small>${escape(item.error)}</small>` : ""}</span>
          <span class="count">${item.total > 0 ? `${item.done}/${item.total}` : item.done > 0 ? `${item.done} ảnh` : ""}</span>
        </li>`).join("")}
    </ul>
    ${job.kind === "capture" && job.log.length > 0 ? `
      <details ${logOpen ? "open" : ""} style="padding:0 16px 8px"><summary class="link">Nhật ký</summary></details>
      ${logOpen ? `<pre class="job-log">${escape(job.log.slice(-120).join("\n"))}</pre>` : ""}` : ""}
    ${job.running ? `<div class="job-foot"><span class="muted">${job.kind === "send" ? "Giữ cửa sổ plugin mở" : ""}</span><button type="button" class="btn btn-danger btn-sm" data-cancel-job ${job.cancelling ? "disabled" : ""}>Dừng</button></div>` : ""}
  `;
  const log = panel.querySelector(".job-log");
  if (log) log.scrollTop = log.scrollHeight;
}

// ---------------------------------------------------------------------------------------------------------
// Viewer

function openViewer(position) {
  const flow = byKey(state.active);
  if (!flow || !flow.steps[position]) return;
  state.viewer = position;
  renderViewer(flow);
  const dialog = $("#viewer");
  if (!dialog.open) dialog.showModal();
}

function renderViewer(flow) {
  const step = flow.steps[state.viewer];
  const url = pictureUrl(flow, step.file, step.version);
  $("#viewer-position").textContent = `${state.viewer + 1}/${flow.steps.length}`;
  $("#viewer-name").textContent = step.title;
  $("#viewer-frame").textContent = step.frameName;
  $("#viewer-open").href = url;
  $("#viewer-image").src = url;
  $(".viewer-scroll").scrollTop = 0;
  $('[data-viewer="prev"]').disabled = state.viewer === 0;
  $('[data-viewer="next"]').disabled = state.viewer === flow.steps.length - 1;
  // The next picture is fetched while this one is looked at.
  const next = flow.steps[state.viewer + 1];
  if (next) new Image().src = pictureUrl(flow, next.file, next.version);
}

function moveViewer(delta) {
  const flow = byKey(state.active);
  if (!flow || state.viewer === null) return;
  const position = state.viewer + delta;
  if (position < 0 || position >= flow.steps.length) return;
  state.viewer = position;
  renderViewer(flow);
}

// ---------------------------------------------------------------------------------------------------------
// Actions

async function send(keys) {
  const flows = keys.map(byKey).filter((flow) => flow && flow.steps.length > 0);
  if (flows.length === 0) return toast("Các luồng đã chọn chưa có ảnh.", "error");
  try {
    await post("/api/send", { keys: flows.map((flow) => flow.key) });
    state.jobDismissed = null;
  } catch (error) {
    toast(error.message, "error");
  }
}

async function capture(keys) {
  try {
    await post("/api/capture", { keys });
    state.jobDismissed = null;
  } catch (error) {
    toast(error.message, "error");
  }
}

function setActive(key) {
  state.active = key;
  stored.set("active", key);
  for (const row of document.querySelectorAll(".flow-row")) row.classList.toggle("active", row.dataset.open === key);
  renderDetail();
  $("#detail").scrollTop = 0;
}

$("#flow-list").addEventListener("click", (event) => {
  const target = event.target;
  if (target.matches("[data-select]")) {
    const key = target.dataset.select;
    if (target.checked) state.selected.add(key); else state.selected.delete(key);
    saveSelection();
    renderList();
    renderSelectionBar();
    return;
  }
  if (target.matches("[data-select-group]")) {
    const folder = target.dataset.selectGroup;
    const flows = visibleFlows().filter((flow) => flow.folder === folder);
    const all = flows.every((flow) => state.selected.has(flow.key));
    for (const flow of flows) {
      if (all) state.selected.delete(flow.key); else state.selected.add(flow.key);
    }
    saveSelection();
    renderList();
    renderSelectionBar();
    return;
  }
  const head = target.closest("[data-toggle-group]");
  if (head) {
    const folder = head.dataset.toggleGroup;
    if (state.collapsed.has(folder)) state.collapsed.delete(folder); else state.collapsed.add(folder);
    stored.set("collapsed", [...state.collapsed]);
    head.parentElement.classList.toggle("collapsed");
    return;
  }
  const row = target.closest("[data-open]");
  if (row) setActive(row.dataset.open);
});

$("#detail").addEventListener("click", (event) => {
  const target = event.target;
  const view = target.closest("[data-view]");
  if (view) return openViewer(Number(view.dataset.view));
  if (target.closest("[data-send-one]")) return void send([state.active]);
  if (target.closest("[data-capture-one]")) return void capture([state.active]);
  if (target.matches("[data-open-failure]")) window.open(target.dataset.full, "_blank", "noopener");
});

$("#detail").addEventListener("input", (event) => {
  if (event.target.id !== "thumb-size") return;
  state.thumb = Number(event.target.value);
  stored.set("thumb", state.thumb);
  $(".steps")?.style.setProperty("--thumb", `${state.thumb}px`);
});

$("#search").addEventListener("input", (event) => {
  state.search = event.target.value;
  renderList();
});

$("#app-filters").addEventListener("click", (event) => {
  const chip = event.target.closest("[data-app]");
  if (!chip) return;
  state.app = chip.dataset.app;
  stored.set("app", state.app);
  renderFilters();
  renderList();
});

for (const chip of document.querySelectorAll("[data-filter]")) {
  chip.addEventListener("click", () => {
    state.filter = chip.dataset.filter;
    stored.set("filter", state.filter);
    renderFilters();
    renderList();
  });
}

$("#select-visible").addEventListener("click", () => {
  for (const flow of visibleFlows()) state.selected.add(flow.key);
  saveSelection();
  renderList();
  renderSelectionBar();
});

$("#collapse-all").addEventListener("click", () => {
  const folders = groupsOf(state.flows).map((group) => group.folder);
  const allCollapsed = folders.every((folder) => state.collapsed.has(folder));
  state.collapsed = new Set(allCollapsed ? [] : folders);
  stored.set("collapsed", [...state.collapsed]);
  $("#collapse-all").textContent = allCollapsed ? "Thu gọn nhóm" : "Mở mọi nhóm";
  renderList();
});

$("#clear-selection").addEventListener("click", () => {
  state.selected.clear();
  saveSelection();
  renderList();
  renderSelectionBar();
});

$("#send-selected").addEventListener("click", () => void send([...state.selected]));
$("#capture-selected").addEventListener("click", () => void capture([...state.selected]));
$("#reload").addEventListener("click", async () => {
  await loadFlows(true);
  toast("Đã đọc lại thư mục captures/");
});

$("#job").addEventListener("click", (event) => {
  if (event.target.closest("[data-cancel-job]")) void post("/api/cancel", {}).catch((error) => toast(error.message, "error"));
  if (event.target.closest("[data-dismiss-job]")) {
    state.jobDismissed = state.server.job?.startedAt ?? null;
    renderJob();
  }
});
$("#job").addEventListener("toggle", () => renderJob(), true);

$("#viewer").addEventListener("click", (event) => {
  const action = event.target.closest("[data-viewer]")?.dataset.viewer;
  if (action === "close" || event.target === event.currentTarget) $("#viewer").close();
  if (action === "prev") moveViewer(-1);
  if (action === "next") moveViewer(1);
});
$("#viewer").addEventListener("close", () => { state.viewer = null; });

document.addEventListener("keydown", (event) => {
  if ($("#viewer").open) {
    if (event.key === "ArrowLeft") { event.preventDefault(); moveViewer(-1); }
    if (event.key === "ArrowRight") { event.preventDefault(); moveViewer(1); }
    return;
  }
  if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
    event.preventDefault();
    $("#search").focus();
  }
});

$("#collapse-all").textContent = state.collapsed.size > 0 ? "Mở mọi nhóm" : "Thu gọn nhóm";
renderAll();
listen();
void loadFlows();
