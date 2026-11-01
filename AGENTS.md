# figma-flow-capture: instructions for AI agents

This tool runs user flows against an app with Playwright, screenshots every step and builds them into Sections in Figma. User documentation is in [README.md](README.md); this file is what an agent must know before working in the repository.

```
CLI (capture/, Playwright)  →  relay 127.0.0.1:8765 (server/)  →  Flow Capture plugin in Figma desktop (plugin/)
```

## Common tasks

| Task | Workflow to follow |
| --- | --- |
| Capture existing flows, to Figma or to disk | [.claude/skills/chup-luong/SKILL.md](.claude/skills/chup-luong/SKILL.md) |
| Write a new flow, or fix a broken one | [.claude/skills/tao-luong/SKILL.md](.claude/skills/tao-luong/SKILL.md) |

Claude Code loads these as skills. Other agents: read the matching file before starting.

Reference: [docs/writing-flows.md](docs/writing-flows.md) (flow API, helpers, mocking) and [docs/flows.md](docs/flows.md) (flow catalog).

## Commands

Run from the repository root. In PowerShell use `.\capture`; in bash use `./capture.cmd`. Do not use `npm run capture -- <flags>` in PowerShell: the `--` is swallowed.

| Command | Purpose |
| --- | --- |
| `.\capture --doctor --json` | Readiness: Chromium, plugin, whether the apps are running, where the app sources are |
| `.\capture --list --json` | Every flow: `id`, `name`, `group`, `figmaSections`, `file`, `caution` |
| `.\capture --flow <id> --no-figma` | Capture to `captures/<id>/` only |
| `.\capture --flow <id>` | Capture and send to Figma (the plugin must be open) |
| `.\capture --flow "<prefix>*"` | Every flow whose id starts with the prefix |
| `.\capture --all` | Every flow except those with a `caution` |
| `.\web` | Local viewer at `http://127.0.0.1:4646`: browse `captures/`, send selected flows to Figma, re-capture (`--no-figma`). Holds the 8765 relay if nobody else does |
| `npm run typecheck` | Type-check after editing code |

After each run, results are in `captures/_last-run.json` (status per flow, screenshot list, `_loi.png` and `_loi.log` paths on failure). Read this file instead of parsing terminal output. The command exits non-zero when any flow did not complete.

## Mandatory rules

1. **Always select flows explicitly** with `--flow` or `--all`. A bare `.\capture` is the interactive menu; without a TTY it fails.
2. **Flows with a `caution` have real side effects** (e.g. `dang-ky-shop` creates an account and consumes an OTP). Run one only when the user asks for that exact flow and has been reminded of the consequences. Use the mocked variant (`dang-ky-shop-mock`) otherwise.
3. **Never modify the app's code.** The app and backend sources (paths in `--doctor`) are read-only: use them for labels, routes, APIs and error messages.
4. **Capture to disk and review the images first** (`--no-figma`, then open the PNG files). Send to Figma only once the images are right and the user agrees.
5. **Sending to Figma needs the user**: they must open the right file and page in Figma desktop, run the Flow Capture plugin and keep its window open. Agents cannot open the plugin; remind the user before running. The CLI waits up to 2 minutes for the plugin.
6. **`--render layers --auto-paste` takes over the keyboard** while pasting. Use it only when the user knows and agrees to leave the machine alone.
7. **Each run deletes and rewrites `captures/<id>/`** for the flows it runs.
8. **Never change the `id` or `stepId` of an existing flow**: they key the Sections and frames in Figma; changing them creates new ones instead of updating.
9. **When adding, removing or renaming flows, update [docs/flows.md](docs/flows.md).**

## Layout

| Path | Contents |
| --- | --- |
| `capture/` | CLI: `cli.ts` (flags), `runner.ts` (runs flows, `shot()`), `define.ts` (`defineFlow`), `config.ts`, `doctor.ts`, `interactive.ts` (menu) |
| `capture.config.ts` | Apps, viewports, elements hidden during capture, Figma layout |
| `flows/**/*.flow.ts` | Flows; each subfolder is a group |
| `flows/_helpers/` | Mocked backends, sessions, captcha, clock |
| `plugin/src/` | Figma plugin; after editing run `npm run build:plugin` and reopen the plugin |
| `server/`, `shared/types.ts` | Relay and message protocol |
| `web/` | Local viewer: `server.ts` (HTTP + sending existing images to Figma), `library.ts` (reads `captures/` and `_steps.json`), `public/` |
| `captures/` | Output, git-ignored |

## Language

The user and the app UI are Vietnamese: reply in Vietnamese, and write step titles (`shot()` `title`) in Vietnamese with diacritics. `id` and `stepId` are lowercase ASCII without diacritics, hyphen-separated. Code comments are in English, like the existing code. Repository documentation (README, `docs/`) is in English.
