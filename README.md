# Figma Flow Capture

Run user flows against a web app with Playwright, screenshot every step, and lay the results out in Figma: one Section per flow, one frame per step. Re-running a flow replaces the images in the existing frames, so the Figma file stays in sync with the app without manual rearranging.

```
CLI (Playwright)  ──ws──►  relay 127.0.0.1:8765  ──ws──►  Flow Capture plugin (Figma desktop)
 drives the app,            forwards messages               builds Sections and frames
 takes screenshots
```

The tool only opens the app in a browser. It never modifies the app's code or data.

## Features

- **Flows as code.** Each flow is a TypeScript file using the Playwright API, with a `shot()` call at every screen worth capturing.
- **Idempotent updates.** Sections and frames are matched by flow `id` and `stepId`, not by name or position. Renaming or moving a Section in Figma does not break the next update.
- **Mocked backends.** Most flows answer API calls inside the browser, so they need only the frontend, create no real data, and produce identical screenshots on every run.
- **Nested Sections.** Flows can be grouped into parent Sections, several levels deep, and coloured by level from the file's own variables or styles.
- **Editable layers.** Optionally import each step as editable Figma layers instead of a flat image.
- **Local web viewer.** Browse captured screenshots and send any selection to Figma without re-running flows.
- **Agent-friendly.** JSON output for `--list` and `--doctor`, a machine-readable run report, and ready-made instructions for AI coding agents.

## Requirements

| Requirement | Notes |
| --- | --- |
| Windows | `.\capture`, `.\web` and the editable-layers mode are Windows only. On macOS/Linux use `npm run capture -- <flags>` for image capture |
| Node.js 22+ | |
| Figma desktop | The plugin does not run in the browser version. Not needed with `--no-figma` |
| Edit access to the Figma file | The plugin creates Sections and frames in the open file |
| The target app running locally | SuperShip Web on `http://localhost:3001`, SuperPlatform on `http://localhost:3000` (see [Configuration](#configuration)) |

## Installation

From the repository root in PowerShell:

```powershell
.\setup
```

This installs dependencies, downloads Chromium for Playwright, builds the Figma plugin and runs a readiness check. Run `.\capture --doctor` at any time to re-check.

Then import the plugin into Figma once:

1. Open any file in Figma desktop.
2. **Plugins → Development → Import plugin from manifest…**
3. Select `plugin/manifest.json`.

The plugin appears as **Flow Capture** under **Plugins → Development**.

`plugin/dist` is not committed. Rebuild with `npm run build:plugin` whenever `plugin/src` changes (for example after a pull), then reopen the plugin.

## Quick start

`dang-ky-shop-mock` is a safe flow to start with: four screens, fully mocked.

1. **Start the app** and confirm `http://localhost:3001/register` loads.
2. **Capture to disk:**

   ```powershell
   .\capture --flow dang-ky-shop-mock --no-figma
   ```

   Screenshots are written to `captures/dang-ky-shop-mock/`.
3. **Send to Figma:** open the target file and page in Figma desktop, run **Plugins → Development → Flow Capture**, keep the plugin window open, then:

   ```powershell
   .\capture --flow dang-ky-shop-mock
   ```

   The plugin's connection indicator turns green and a Section with four frames appears on the canvas.

The CLI starts the relay automatically and waits up to 2 minutes for the plugin to connect.

## Usage

### Interactive menu

Run `.\capture` with no arguments to pick flows, the output (Figma, disk only, or editable layers) and whether to show the browser. Before running, the menu prints the equivalent command for reuse in scripts.

### Command line

In PowerShell always use `.\capture`. `npm run capture -- <flags>` does not work there because PowerShell strips the `--`.

```powershell
.\capture --list                                   # list all flows
.\capture --flow dang-ky-shop-mock --no-figma      # capture to disk only
.\capture --flow dang-ky-shop-mock                 # capture and send to Figma
.\capture --flow "quen-mat-khau*"                  # every flow whose id starts with the prefix
.\capture --flow a --flow b                        # several flows
.\capture --all                                    # every flow except those marked with a caution
```

| Flag | Description |
| --- | --- |
| `--list` | List flows by group and exit |
| `--doctor` | Check Node, Chromium, plugin build, app availability, source paths and Figma connection. Exits non-zero if a required check fails |
| `--json` | With `--list` or `--doctor`: print JSON |
| `--flow <id>` | Run this flow. Repeatable. A trailing `*` selects by prefix (quote it) |
| `--all` | Run every flow. Flows with a `caution` are skipped and must be selected by exact id |
| `--viewport <name>` | Run only this viewport (`desktop`, `mobile`) for flows that declare several |
| `--no-figma` | Save screenshots to disk only |
| `--headed` | Show the browser window |
| `--pause-on-step <stepId>` | Pause before capturing this step so you can interact manually; press Enter to continue. Use with `--headed` |
| `--section-name "<name>"` | Override the Section name for this run |
| `--render <image\|layers>` | `image` (default) or `layers` for editable Figma layers. See [Editable layers](#editable-layers) |
| `--auto-paste` | With `--render layers`: send Ctrl+V to Figma automatically |
| `--config <file>` | Use a config file other than `capture.config.ts` |

Run behaviour:

- Flows run sequentially. Each run deletes and rewrites `captures/<flow-id>/`.
- Screenshots are saved as `captures/<flow-id>/<NN>-<stepId>.png`.
- A failing flow leaves `_loi.png` (screenshot at failure) and `_loi.log` in its folder; the remaining flows still run and the command exits non-zero.
- `captures/_last-run.json` records the status, screenshots and error files of every flow in the last run.
- Without a TTY (scripts, CI, AI agents) a flow selection via `--flow` or `--all` is required.

### Web viewer

```powershell
.\web
```

Opens `http://127.0.0.1:4646`, a local page that reads `captures/` directly:

- Browse every flow and its screenshots in step order, with the frame name each step will get in Figma.
- Select flows or whole groups and click **Gửi sang Figma** to send existing screenshots without re-running anything (the plugin must be open).
- Re-capture selected flows to disk (`--no-figma`). Flows with a `caution` cannot be run from the page.

The viewer shares the relay on port 8765 with the CLI and starts it if needed, so do not close it while another `.\capture` run is sending to Figma. Change the page's port with `FFC_WEB_PORT`.

### Figma plugin

Keep the plugin window open for the whole run; closing it aborts the flow being sent.

| Option | Behaviour |
| --- | --- |
| **Ghi đè luồng cũ** (default) | Update the existing Section: replace frames with the same `stepId`, insert new steps in place, and handle removed steps as below |
| **Xóa bước không còn trong luồng** (default on) | After a complete run, delete frames for steps no longer in the flow. When off, keep them at the end prefixed `⚠ không còn trong luồng`. A failed run never deletes anything |
| **Tạo section mới kèm thời gian** | Always create a new Section named `<flow name> · <timestamp>` below existing content, to keep the old version for comparison |
| **Tô màu Section theo cấp** | Colour Sections by nesting level (see below) |
| **Vẽ mũi tên giữa các bước** | Draw arrows between frames; requires `layout.arrows: true` in the config |

### Output in Figma

- New Sections are placed on the **current page**, below existing content.
- Frames are named `<app label> - <STEP TITLE>`, for example `SuperShip - NHẬP MÃ OTP`, and sized to the viewport (1440 × 900 for `desktop`) with 2× images.
- Images taller than Figma's 4096 px limit are split into slices inside the same frame.
- A flow's `group` places its Section inside parent Sections; an array nests several levels.
- With level colouring on, the outermost Section uses the colour named `Section 2`, the next `Section 3`, and so on (start level set by `layout.colorFrom`). The plugin looks for a variable or paint style containing that name in the file, then in enabled libraries.

### Editable layers

`--render layers` turns each step into editable Figma layers (text, frames, auto layout) using Figma's html-to-design capture script. Only the Figma app can convert pasted HTML into layers, so each screen needs one paste.

```powershell
.\capture --flow quen-mat-khau-sms-thanh-cong --render layers               # paste manually
.\capture --flow "loi-moi-shop*" --render layers --auto-paste               # paste automatically
```

- **Manual:** after capture, the plugin shows which screen is on the clipboard; click an empty area of the canvas and press Ctrl+V for each one.
- **Automatic:** after an 8-second countdown the tool brings Figma to the front and pastes each screen, waiting for the plugin to confirm before the next. It takes over the keyboard and clipboard, so leave the machine alone. Set `FFC_FIGMA_PROCESS` if the Figma process is not named `Figma` (e.g. `Figma Beta`).

Requires Windows, network access to `mcp.figma.com`, and the Open Sans font in Figma. Captcha widgets render empty in this mode.

## Writing flows

Add a `*.flow.ts` file anywhere under `flows/`; it is discovered automatically.

```ts
import { defineFlow } from "../capture";

export default defineFlow({
  id: "quen-mat-khau",
  name: "Quên mật khẩu",
  app: "supership",
  async run({ page, shot }) {
    await page.goto("/forgot-password");
    await page.getByLabel("Số điện thoại", { exact: true }).waitFor();
    await shot("nhap-sdt", "Nhập số điện thoại");
  },
});
```

See [docs/writing-flows.md](docs/writing-flows.md) for the full API, built-in helpers, captcha handling and backend mocking. The list of existing flows is in [docs/flows.md](docs/flows.md).

## Configuration

General settings live in [capture.config.ts](capture.config.ts):

| Key | Default | Description |
| --- | --- | --- |
| `apps` | `supership`, `superplatform` | Per app: `baseUrl`, `label` (frame name prefix) and `sourceDir` (read-only, used when writing flows) |
| `backendSourceDir` | `../Server` | Backend source, used to copy error messages into mocks |
| `viewports` | `desktop` 1440 × 900, `mobile` 390 × 844 | Named viewport sizes |
| `defaultViewport` | `desktop` | Viewport for flows that declare none |
| `deviceScaleFactor` | `2` | Screenshot pixel density |
| `hide` | Dev overlays | Selectors hidden during every capture |
| `blockUrls` | `**://mcp.figma.com/**` | URLs never loaded by the page |
| `locale`, `timezoneId` | `vi-VN`, `Asia/Ho_Chi_Minh` | Browser locale and time zone |
| `outputDir` | `captures` | Screenshot output folder |
| `figma.pluginTimeoutMs` | `120000` | How long to wait for the plugin |
| `layout` | see file | Canvas spacing (`gap`, `padding`, `headroom`, `rowGap`, `sectionGap`), `arrows`, `colorFrom` |

The relay port (`figma.port`, 8765) is also hard-coded in the plugin source and `plugin/manifest.json`. Change all three together and rebuild the plugin.

Environment variables go in `.env` (copy [.env.example](.env.example)). All are optional:

| Variable | Description |
| --- | --- |
| `SUPERSHIP_URL`, `SUPERPLATFORM_URL` | App URLs when not on the default ports |
| `SUPERSHIP_SRC`, `SUPERPLATFORM_SRC`, `BACKEND_SRC` | Source folders when not next to this repository |
| `FFC_WEB_PORT` | Port of the web viewer (default `4646`) |
| `FFC_FIGMA_PROCESS` | Figma process name for `--auto-paste` |

## Development

| Command | Description |
| --- | --- |
| `npm run typecheck` | Type-check the CLI and the plugin |
| `npm run build:plugin` | Build the plugin into `plugin/dist` |
| `npm run server` | Run the relay on its own (optional; the CLI starts it) |
| `npm run test:relay` | Self-test the relay and image slicing; no Figma needed |
| `npm run test:send` | Send three fixed images to Figma; the quickest plugin check |
| `npx tsx scripts/fake-plugin.ts` | Fake plugin for testing the CLI without Figma |

### Project structure

```
capture/            CLI: config, flow discovery, Playwright runner, Figma client, layers mode
capture.config.ts   Apps, viewports, hidden elements, Figma layout
flows/              Flows (*.flow.ts), one folder per group
flows/_helpers/     Shared mocks, sessions, captcha and clock helpers
plugin/             Figma plugin: src/, dist/ (build output), manifest.json
server/             WebSocket relay between CLI and plugin
shared/types.ts     Message protocol shared by CLI, relay and plugin
web/                Local web viewer
scripts/            Plugin build and self-tests
captures/           Output (git-ignored)
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| The menu opens even though `--flow` was passed | You used `npm run capture -- …` in PowerShell. Use `.\capture …` |
| `Không có luồng nào khớp "…"` | Wrong id, or missing `*` for a prefix. Check `.\capture --list` |
| `net::ERR_CONNECTION_REFUSED` on the first step | The app is not running, or runs on another port. Set `SUPERSHIP_URL` / `SUPERPLATFORM_URL` |
| `Executable doesn't exist` | Run `npx playwright install chromium` |
| Plugin does not connect within 120 seconds | Open the plugin in Figma **desktop** and click **Kết nối lại** |
| Figma fails to import or open the plugin | `plugin/dist` is missing. Run `npm run build:plugin` |
| A flow times out on a step | The app's UI changed. Inspect `_loi.png` and `_loi.log`, fix the locator, re-run with `--headed` |
| Button stays disabled before `Nhận mã OTP` | Captcha did not pass. See [Captcha](docs/writing-flows.md#captcha) |
| Terminal prints `chưa giả lập: GET /v1/…` | The page called an API the flow does not mock. Add a handler |
| Plugin warns that `Section N` colour is missing | Add that variable or style, enable its library, or turn off level colouring |
| Garbled Vietnamese in the terminal | Use a font with full Vietnamese coverage, such as Cascadia Mono |

## Using with AI agents

The repository ships instructions for AI coding agents, so you can ask in plain language, for example "capture the forgot-password flows to disk" or "write a flow for the change-password screen".

| File | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Commands and mandatory rules. Claude Code reads it via `CLAUDE.md` |
| [.claude/skills/chup-luong/SKILL.md](.claude/skills/chup-luong/SKILL.md) | Workflow for capturing existing flows (`/chup-luong`) |
| [.claude/skills/tao-luong/SKILL.md](.claude/skills/tao-luong/SKILL.md) | Workflow for writing or fixing flows (`/tao-luong`) |

You still need to start the app and open the Flow Capture plugin yourself.

## Limitations

- The plugin runs only in Figma desktop.
- `.\capture`, `.\web` and editable layers are Windows only.
- Signing in per `actor` is not implemented; flows that declare one are rejected. Signed-in pages use mocked sessions instead.
- No flows target the `mobile` viewport yet.
