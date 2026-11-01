# Writing flows

A flow is a Playwright script that walks through one user journey and calls `shot()` at each screen to capture. The CLI discovers every `*.flow.ts` file under `flows/`, skipping files and folders whose names start with `_` or `.`. No registration is needed.

## Workflow

1. Create `flows/<group>/<name>.flow.ts`.
2. Optionally record the interactions with `npx playwright codegen http://localhost:3001`, paste them into `run`, and add `shot()` calls.
3. Before every `shot()`, wait for something specific to that screen (`locator.waitFor()`). Do not wait for network idle; the apps keep background requests open.
4. Run it with the browser visible: `.\capture --flow <id> --no-figma --headed`.
5. Review the screenshots in `captures/<id>/`, then run without `--no-figma` to send them to Figma.
6. Run `npm run typecheck` and add the flow to [flows.md](flows.md).

```ts
import { defineFlow } from "../../capture";

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

`page.goto()` takes paths relative to the app's `baseUrl`. The browser runs with locale `vi-VN` and time zone `Asia/Ho_Chi_Minh`.

A file may `export default` an array of flows, for example the same journey for each OTP channel. Flow ids must be unique across `flows/`; duplicates fail immediately.

## Conventions

- `id` and `stepId`: lowercase ASCII, digits and hyphens, no diacritics (`quen-mat-khau-sms-thanh-cong`).
- `name` and `shot()` titles: Vietnamese with diacritics, matching the app's UI.
- **Never rename an existing `id` or `stepId`.** They are the keys of Sections and frames in Figma; renaming creates new ones instead of updating.
- Copy labels, routes and error messages from the app and backend source; never modify that source.

## `defineFlow(options)`

| Field | Description |
| --- | --- |
| `id` | Unique key of the flow and its Figma Section |
| `name` | Section name |
| `app` | App key from `capture.config.ts` (`supership`, `superplatform`) |
| `run(ctx)` | The flow body. `ctx` provides `page`, `context`, `shot`, `data`, `app`, `viewport`, `log` |
| `viewports?` | For example `["desktop", "mobile"]`. Each viewport gets its own Section suffixed ` · mobile`. Defaults to `desktop` |
| `group?` | Parent Section name, or an array for nested parents (outermost first) |
| `sectionName?` | Section name when it differs from `name` |
| `caution?` | Describes a real-world side effect (e.g. "creates a real account"). Such flows run only when selected by exact id |
| `actor?` | Not implemented yet |

## `shot(stepId, title, options?)`

Steps appear in the order `shot()` is called. `stepId` must be unique within the flow; `title` becomes the frame name.

| Option | Description |
| --- | --- |
| `mode` | `"viewport"` (default: what the user sees, including modals), `"fullPage"`, or `"element"` |
| `target` | Selector or Locator to capture when `mode: "element"` |
| `code` | Screen code such as `"TK-02"`, shown in the frame name |
| `hide` | Extra selectors to hide for this step only |
| `mask` | Elements to cover with a solid box (sensitive data) |
| `delayMs` | Extra wait before capturing |

Before every capture the runner automatically:

- waits for fonts, images and captcha widgets, and disables animations and the text caret;
- hides the dev overlays listed in `hide` in `capture.config.ts`, then restores them so the flow can still use them;
- for `fullPage` shots whose content scrolls inside an inner container, temporarily enlarges the window to fit the content.

## Helpers

| Helper | Module | Purpose |
| --- | --- | --- |
| `data.phone()`, `data.email()`, `data.digits(n)`, `data.pick(list)` | `ctx.data` | Random data for flows that create records |
| `waitEnabled(locator)` | `flows/_helpers/wait.ts` | Wait until a control is enabled |
| `freezeTime(page, at?)` | `flows/_helpers/wait.ts` | Freeze the page clock so dates and countdowns are stable across runs |
| `mockTurnstile(page, mode?)` | `flows/_helpers/turnstile.ts` | Let captcha pass in mocked flows |
| `mockSignedInShop(page, shop, permissions, log)` | `flows/_helpers/supership-session.ts` | Signed-in session and mocked backend for SuperShip pages |
| `DEV_OTP`, `OtpSessionMock` | `flows/_helpers/otp-session.ts` | Mocked OTP session: resend, expiry, too many attempts |

Each flow group also has its own helper in `flows/_helpers/` (for example `supership-shop-members.ts`, `superplatform-login.ts`) exposing a wrapper such as `memberFlow` or `loginFlow` that presets the id prefix, `group` and mocked backend. When adding to an existing group, use its wrapper and follow the neighbouring `*.flow.ts` files.

## Captcha

The local apps use a real Cloudflare Turnstile sitekey, which automated browsers cannot pass. Call `mockTurnstile(page)` before the first `page.goto()`:

- `"visible"` (default) loads the real widget with Cloudflare's always-pass test sitekey, so the screenshot shows the widget in its success state. Requires network access to `challenges.cloudflare.com` and a page clock close to real time (freezing at the current time is fine; a different date is not).
- `"hidden"` replaces the widget with a stub that only returns a token. Works offline; the captcha area is empty in screenshots.

Both only work with mocked backends; a real backend rejects these tokens.

## Mocking the backend

The local backend verifies real captchas, so flows cannot sign in for real. Instead, session helpers give the tab a ready-made session and answer API calls inside the browser. Call them before the first `page.goto()`:

```ts
import { KHA_AI_SHOP, mockSignedInShop } from "../_helpers/supership-session";

const backend = await mockSignedInShop(page, KHA_AI_SHOP, ["order.view"], log);
backend.on("GET", /^\/v1\/orders$/, () => ({ data: { items: [] } }));
backend.on("POST", /^\/v1\/orders$/, () => ({ status: 409, code: "ORDER_EXISTS", message: "Đơn hàng đã tồn tại." }));
```

- `backend.on(method, pattern, handler)` adds or overrides a response; later handlers win.
- `backend.setPermissions([...])` changes the signed-in user's permissions from the next page load.
- Unmocked calls return 404 and are logged as `chưa giả lập: GET /v1/…` so you can add them.

## Debugging a failing flow

- Read `captures/_last-run.json` for each flow's status and error.
- Open `captures/<id>/_loi.png` (screen at failure) and `_loi.log`.
- Re-run with `--headed`, and use `--pause-on-step <stepId>` to stop before a step and inspect the page.
