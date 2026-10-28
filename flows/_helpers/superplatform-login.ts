import type { Page, Route } from "playwright";
import { defineFlow, type FlowContext } from "../../capture";
import { capability } from "./supership-session";
import { mockTurnstile } from "./turnstile";

/*
 * Sign-in to the SuperPlatform console at "/" (LUỒNG ĐĂNG NHẬP BẰNG MẬT KHẨU, LUỒNG PASSKEY part B), against an
 * in-browser stand-in of the backend. A password sign-in goes on to the MFA asked before the unit picker (ADR-017);
 * a passkey sign-in already proves MFA and goes straight to the picker. The browser's own passkey prompt is
 * replaced by a stand-in of navigator.credentials.get the flow answers itself.
 */

/** Trần Thu Hà, Trưởng bưu cục Tân Bình: company email, verified phone and employee code. */
export const EMAIL = "ha.tt@supership.vn";
export const PERSONAL_EMAIL = "thuha.tran@gmail.com";
export const PHONE = "0912468035";
export const EMPLOYEE_CODE = "SST00127";
export const PASSWORD = "SuperShip@2026";
export const WRONG_PASSWORD = "SuperShip@2025";
export const MFA_CODE = "515060";
export const FULL_NAME = "Trần Thu Hà";
/**
 * The page's clock stands still at the minute each flow starts (set again by loginFlow): countdowns read the same
 * on every picture, and the real captcha widget, which refuses a device clock minutes away from the real time,
 * still hands out its token.
 */
export let START = Math.floor(Date.now() / 60_000) * 60_000;
export const at = (seconds: number) => new Date(START + seconds * 1000).toISOString();

/** Exact sentences of IdentifierResolver, InvalidCredentialsException, PasskeyLoginService and LoginCard. */
export const MESSAGES = {
  invalid: "Thông tin đăng nhập không hợp lệ.",
  personalEmail: "Không đăng nhập bằng Email cá nhân. Hãy dùng Email công ty, số điện thoại hoặc mã nhân viên.",
  emptyIdentifier: "Email, số điện thoại hoặc mã nhân viên không được để trống.",
  emptyPassword: "Mật khẩu không được để trống.",
  passkeyRejected: "Không thể đăng nhập bằng passkey này.",
  passkeyExpired: "Yêu cầu đã hết hạn. Hãy thử lại.",
  passkeyRateLimited: "Có quá nhiều yêu cầu. Hãy chờ một phút rồi thử lại.",
  captcha: "Hãy hoàn tất bước xác minh bạn là người.",
  /** Said once the password is right: AccountInactivity, AccountRecovery, AccessContextEligibilityService, http-client. */
  inactivityLocked: "Tài khoản của bạn đã bị tạm khóa vì lâu không hoạt động. Vui lòng liên hệ quản trị viên để yêu cầu mở lại tài khoản.",
  recoveryRequired: "Tài khoản cần được khôi phục. Hãy dùng Quên mật khẩu để đặt lại mật khẩu trước khi đăng nhập.",
  accessHeld: "Quyền làm việc của bạn tại Bưu cục Tân Bình, Nhượng quyền Miền Nam đang bị tạm dừng. Liên hệ bộ phận nhân sự để biết thêm.",
  employmentNotStarted: "Bạn bắt đầu làm việc tại Bưu cục Tân Bình từ ngày 01/11/2026.",
  notGranted: "Tài khoản chưa được cấp quyền vào SuperPlatform. Liên hệ người quản lý đơn vị.",
  maintenance: "SuperPlatform đang bảo trì.",
  network: "Không thể kết nối tới máy chủ.",
};
/** LOGIN_LOCKOUT_MAX_ATTEMPTS: the fifth wrong password locks the internal Apps for 15 minutes. */
export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
/** LoginLockedException: said by the wrong password that sets the lock and by every attempt while it lasts. */
export const lockedMessage = (minutes = LOCK_MINUTES) =>
  `Bạn đã nhập sai thông tin đăng nhập ${MAX_ATTEMPTS} lần. Vui lòng thử lại sau ${minutes} phút.`;

export const UNITS = [
  { membership_id: "6f1c2a4e-8b3d-4c5e-9a71-2d4f6b8c0e13", org_id: "org-tan-binh", org_code: "BCT29V84HYT", org_name: "Bưu cục Tân Bình",
    org_type: "POST_OFFICE", org_type_name: "Bưu cục", title: "Trưởng bưu cục", is_default: false },
  { membership_id: "9a3e5c7d-1f2b-4d6a-8c0e-4b6d8f0a2c35", org_id: "org-mien-nam", org_code: "NQMN", org_name: "Nhượng quyền Miền Nam",
    org_type: "FRANCHISE_PARTNER", org_type_name: "Nhượng quyền", title: "Nhân viên vận hành", is_default: false },
];

export type AccountState = "ACTIVE" | "LOCKED" | "DISABLED" | "PENDING";
export type PasskeyAnswer = "SIGNED" | "CANCELLED" | "REJECTED" | "EXPIRED" | "RATE_LIMITED";
/** What the stand-in answers instead of its default; undefined falls through to the default. */
export type Reply = { status?: number; message?: string; data?: unknown; abort?: true } | undefined;
export interface Override { method: string; path: string | RegExp; reply: (body: any) => Reply }
export interface LoginMock {
  /** How the account stands; anything but ACTIVE is refused with the one sentence of every refusal. */
  account: AccountState;
  /**
   * Said once the password is right, instead of a session: the refusals that come after the password
   * (locked for inactivity, recovery, held, not admitted to the App).
   */
  afterPassword?: { status: number; message: string; data: Record<string, unknown> };
  /** next_action of the session a sign-in issues (CHANGE_PASSWORD…); SELECT_CONTEXT by default. */
  nextAction?: string;
  /** Extra fields of that session and of /v1/me/auth-state, e.g. password_reason and password_message. */
  sessionExtra?: Record<string, unknown>;
  /** Answers checked before the defaults, latest first; added with on(). */
  overrides: Override[];
  on(method: string, path: string | RegExp, reply: (body: any) => Reply): void;
  /** Wrong passwords in a row on the internal Apps. */
  failures: number;
  /** What the next press of "Đăng nhập bằng Passkey" ends in. */
  passkey: PasskeyAnswer;
  /** The identifier the last password sign-in was made with. */
  identifier: string | null;
}
export interface LoginContext extends FlowContext { mock: LoginMock }

export function passwordFlow(id: string, name: string, run: (ctx: LoginContext) => Promise<void>, setup: LoginSetup = {}) {
  return loginFlow(`mat-khau-${id}`, ["SUPERPLATFORM", "ĐĂNG NHẬP", "ĐĂNG NHẬP BẰNG MẬT KHẨU"], name, run, setup);
}

export function passkeyFlow(id: string, name: string, run: (ctx: LoginContext) => Promise<void>, setup: LoginSetup = {},
                            supported = true) {
  return loginFlow(`passkey-${id}`, ["SUPERPLATFORM", "ĐĂNG NHẬP", "ĐĂNG NHẬP BẰNG PASSKEY"], name, run, setup, supported);
}

export type LoginSetup = Partial<Omit<LoginMock, "on" | "overrides">>;

/** A flow of the sign-in under its own sub-Section of SUPERPLATFORM → ĐĂNG NHẬP; the id gets "superplatform-dang-nhap-". */
export function loginFlow(id: string, group: [string, ...string[]], name: string, run: (ctx: LoginContext) => Promise<void>,
                          setup: LoginSetup = {}, passkeySupported = true) {
  return defineFlow({ id: `superplatform-dang-nhap-${id}`, name, app: "superplatform", group,
    async run(ctx) {
      START = Math.floor(Date.now() / 60_000) * 60_000;
      const overrides: Override[] = [];
      const mock: LoginMock = { account: "ACTIVE", failures: 0, passkey: "SIGNED", identifier: null, ...setup, overrides,
        on: (method, path, reply) => { overrides.unshift({ method, path, reply }); } };
      await fakePasskeyPrompt(ctx.page, passkeySupported);
      await mockLogin(ctx.page, ctx.log, mock);
      await run({ ...ctx, mock });
    },
  });
}

/**
 * Stands in for the browser's passkey prompt. The prompt itself is the browser's window, never part of the page,
 * so the page only shows its "Xác nhận trên thiết bị của bạn" dialog meanwhile; the flow ends the wait with
 * answerPasskey(). Autofill offers are off: the browser draws them, not the page.
 */
async function fakePasskeyPrompt(page: Page, supported: boolean) {
  // A string, not a function: the TypeScript loader would wrap a function's inner helpers in calls the page lacks.
  await page.context().addInitScript(`
    (() => {
      if (!${supported}) { delete window.PublicKeyCredential; return; }
      if (window.PublicKeyCredential) window.PublicKeyCredential.isConditionalMediationAvailable = () => Promise.resolve(false);
      const bytes = (text) => new TextEncoder().encode(text).buffer;
      const signed = {
        id: "Y2FwdHVyZS1wYXNza2V5", rawId: bytes("capture-passkey"), type: "public-key", authenticatorAttachment: "platform",
        response: { authenticatorData: bytes("authenticator"), clientDataJSON: bytes("{}"), signature: bytes("signature"),
          userHandle: bytes("tran-thu-ha") },
        getClientExtensionResults: () => ({}),
      };
      navigator.credentials.get = (options) => new Promise((resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        window.__capturePasskey = (cancelled) => cancelled
          ? reject(new DOMException("The operation either timed out or was not allowed.", "NotAllowedError"))
          : resolve(signed);
      });
    })();
  `);
}

/** Ends the passkey prompt the page is waiting on: a fingerprint read, or the prompt closed. */
export async function answerPasskey(page: Page, cancelled = false) {
  await page.waitForFunction(() => typeof (window as unknown as { __capturePasskey?: unknown }).__capturePasskey === "function");
  await page.evaluate(cancelled => (window as unknown as { __capturePasskey: (cancelled: boolean) => void }).__capturePasskey(cancelled), cancelled);
}

async function mockLogin(page: Page, log: (line: string) => void, mock: LoginMock) {
  await page.clock.setFixedTime(START);
  await mockTurnstile(page);
  let signedIn = false;
  let viaPasskey = false;
  let mfaDone = false;
  let active: (typeof UNITS)[number] | null = null;
  let trustOffer = true;
  const membership = (unit: (typeof UNITS)[number]) => ({ ...unit, membership_type: "EMPLOYEE", status: "ACTIVE",
    provisioning_status: "READY", application_code: "SUPERPLATFORM", eligible: true, selectable: true,
    next_action: viaPasskey || mfaDone ? "SELECT" : "VERIFY_MFA", is_current: active?.membership_id === unit.membership_id });
  const context = () => active && { context_id: `context-${active.org_code}`, active_membership_id: active.membership_id,
    org_code: active.org_code, org_name: active.org_name, application_code: "SUPERPLATFORM", org_type_name: active.org_type_name,
    title: active.title };
  const assurance = () => viaPasskey || mfaDone ? 2 : 1;
  const session = () => ({ session_id: "login-session", expires_at: at(86400), assurance_level: assurance(),
    next_action: mock.nextAction ?? "SELECT_CONTEXT", ...mock.sessionExtra, identity_id: "identity-thu-ha", full_name: FULL_NAME, avatar_url: null,
    available_memberships: UNITS.map(membership), active_context: context(),
    // A passkey sign-in confirms this device: the server offers to trust it (LoginUseCase.admitPasskey).
    trust_offer_expires_at: viaPasskey && trustOffer ? at(600) : null });
  const authState = () => ({ next_action: mock.nextAction ?? "CONTINUE", ...mock.sessionExtra, enrolled: true, assurance_level: assurance(),
    mfa_verified_at: assurance() > 1 ? at(0) : null, mfa_access_expires_at: assurance() > 1 ? at(43200) : null,
    mfa_method: viaPasskey ? "PASSKEY" : mfaDone ? "TOTP" : null, verify_methods: ["TOTP", "PASSKEY"],
    trust_offer_expires_at: viaPasskey && trustOffer ? at(600) : null, active_context: context() });
  const ceremony = () => ({ challenge_id: "capture-challenge", expires_at: at(300),
    public_key: { challenge: "Y2FwdHVyZS1jaGFsbGVuZ2U", timeout: 300000, rpId: "localhost", userVerification: "required", allowCredentials: [] } });
  const seen = new Set<string>();

  // Only this web's own API: the captcha widget also calls paths with "/api/" on Cloudflare.
  await page.context().route(url => url.pathname.startsWith("/api/"), async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/backend/, "");
    const method = request.method();
    const send = (data: unknown, status = 200, message = "") => route.fulfill({ status,
      headers: { "X-Browser-Session-Version": "1" }, json: { error: status >= 400, message, data } });
    const refuse = (status: number, message: string, code?: string) => send(code ? { code } : null, status, message);
    const missing = () => refuse(401, "Phiên đăng nhập không tồn tại.", "SESSION_MISSING");
    const locked = () => send({ code: "LOGIN_LOCKED", retry_after_seconds: LOCK_MINUTES * 60 }, 429, lockedMessage());

    let body: unknown = null;
    try { body = request.postDataJSON(); } catch { /* not JSON */ }
    for (const override of mock.overrides) {
      if (override.method !== method) continue;
      if (typeof override.path === "string" ? override.path !== path : !override.path.test(path)) continue;
      const reply = override.reply(body);
      if (!reply) continue;
      if (reply.abort) return route.abort("failed");
      return send(reply.data ?? null, reply.status ?? 200, reply.message ?? "");
    }

    /* ---- "/" ---- */
    if (path === "/v1/public/apps/current") return send({ id: "app-superplatform", code: "SUPERPLATFORM", name: "SuperPlatform",
      app_group: "INTERNAL", status: "ACTIVE" });
    if (path === "/v1/sessions" && method === "POST") {
      const body = request.postDataJSON();
      const identifier = String(body.identifier).toLowerCase();
      // Said at once from the address alone, before any account is looked up (IdentifierResolver).
      if (identifier.endsWith("@gmail.com")) return refuse(401, MESSAGES.personalEmail, "PERSONAL_EMAIL_NOT_ALLOWED");
      // The lock is checked before the password: the right one is refused too while it lasts (PasswordAuthenticator).
      if (mock.failures >= MAX_ATTEMPTS) return locked();
      if (body.password !== PASSWORD) {
        mock.failures++;
        // The wrong password that reaches the limit already answers with the lock.
        return mock.failures >= MAX_ATTEMPTS ? locked() : refuse(401, MESSAGES.invalid);
      }
      if (mock.account !== "ACTIVE") return refuse(401, MESSAGES.invalid);
      if (mock.afterPassword) return send(mock.afterPassword.data, mock.afterPassword.status, mock.afterPassword.message);
      mock.failures = 0; mock.identifier = body.identifier; signedIn = true;
      return send(session());
    }
    if (path === "/v1/auth/passkey/options/autofill") return refuse(404, "Không tìm thấy.");
    if (path === "/v1/auth/passkey/options") {
      if (mock.passkey === "RATE_LIMITED") return refuse(429, MESSAGES.passkeyRateLimited, "PASSKEY_RATE_LIMITED");
      return send(ceremony());
    }
    if (path === "/v1/auth/passkey/verify") {
      if (mock.passkey === "EXPIRED") return refuse(410, MESSAGES.passkeyExpired, "PASSKEY_CHALLENGE_EXPIRED");
      if (mock.passkey === "REJECTED") return refuse(401, MESSAGES.passkeyRejected, "PASSKEY_REJECTED");
      signedIn = true; viaPasskey = true;
      return send(session());
    }

    /* ---- After the sign-in: MFA, the unit picker, the workspace ---- */
    if (!signedIn && path.startsWith("/v1/me")) return missing();
    if (path === "/v1/me/session") return send(session());
    if (path === "/v1/me/auth-state") return send(authState());
    if (path === "/v1/me/memberships") return send(UNITS.map(membership));
    if (path === "/v1/me/mfa" && method === "GET") return send({ enrolled: true, factor_status: "ACTIVE", recovery_codes_remaining: 8 });
    if (path === "/v1/me/mfa/verify") {
      if (request.postDataJSON().code !== MFA_CODE) return refuse(400, "Mã xác thực không đúng hoặc đã được sử dụng.", "MFA_INVALID_CODE");
      mfaDone = true;
      return send({ session_id: "login-session", assurance_level: 2, mfa_verified_at: at(0), mfa_elevation_expires_at: at(900) });
    }
    if (path === "/v1/me/access-context" && method === "PUT") {
      active = UNITS.find(unit => unit.membership_id === request.postDataJSON().membership_id) ?? UNITS[0]!;
      return send({ active_context: context() });
    }
    if (path === "/v1/me/devices/current/trust") { trustOffer = false; return send({}); }
    if (path === "/v1/me/employee-invitations" || path.startsWith("/v1/me/employee-invitations")) return send([]);
    if (path === "/v1/me/capabilities") return send({
      context: { context_id: context()?.context_id ?? "none", context_type: "SUPERPLATFORM", application_name: "SUPERPLATFORM",
        membership_id: active?.membership_id ?? "", organization_id: active?.org_id ?? "" },
      assurance: { level: assurance(), mfa_verified: assurance() > 1, mfa_verified_at: assurance() > 1 ? at(0) : null }, capabilities: [capability("identity.view", active?.org_id ?? "")],
      revision: "capture", generated_at: at(0), expires_at: at(86400) });
    if (path === "/v1/me/profile") return send({ identity_id: "identity-thu-ha", person_id: "person-thu-ha", full_name: FULL_NAME,
      gender: "FEMALE", avatar_url: null, status: "ACTIVE", person_version: 1, has_password: true,
      identifiers: [{ type: "PHONE", value: PHONE, verified: true }] });
    if (path === "/v1/me/screen-lock") return send({ enabled: false, state: "DISABLED", timeout_seconds: 300, timeout_min_seconds: 10,
      timeout_max_seconds: 900, remaining_attempts: 5, state_version: 1, session_id: "login-session", enrollment_available: true,
      server_time: at(0), lock_deadline: null });
    if (path === "/v1/me/sessions/current/activity") return send({});
    if (path === "/v1/me/profile-update-request") return send(null);
    if (path === "/v1/me/reminders") return send({ items: [], banners: [], notices: [] });
    if (path === "/v1/me/login-alerts") return send([]);
    if (path === "/v1/me/device-trust-requests") return send({ current_device_id: "device-capture", current_device_trusted: !viaPasskey || !trustOffer,
      has_trusted_device: true, requests: [] });

    const call = `${method} ${path}`;
    if (!seen.has(call)) { seen.add(call); log(`chưa giả lập: ${call}`); }
    return refuse(404, call, "CAPTURE_UNMOCKED");
  });
}

/* ---- "/" ---- */

export const identifierField = (page: Page) => page.locator("#identifier");
export const passwordField = (page: Page) => page.locator("#password");
export const loginButton = (page: Page) => page.getByRole("button", { name: "Đăng nhập", exact: true });
export const passkeyButton = (page: Page) => page.getByRole("button", { name: "Đăng nhập bằng Passkey", exact: true });

/** The empty form, once the captcha has handed out its token (every button waits for it). */
export async function openLogin(page: Page) {
  await page.goto("/");
  await page.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor();
  await page.locator('input[name="cf-turnstile-response"]').and(page.locator(":not([value=''])")).waitFor({ state: "attached" });
  await loginButton(page).and(page.locator(":enabled")).waitFor();
}
/** "Đăng nhập bằng Passkey", once the captcha handed out its token (the button stays locked until then). */
export async function startPasskey(page: Page) {
  await passkeyButton(page).and(page.locator(":enabled")).click();
}
export async function fill(page: Page, identifier: string, password = PASSWORD) {
  await identifierField(page).fill(identifier);
  await passwordField(page).fill(password);
}
/** "Đăng nhập", once the captcha handed out a fresh token (every attempt uses one). */
export async function submit(page: Page) {
  await page.locator('input[name="cf-turnstile-response"]').and(page.locator(":not([value=''])")).waitFor({ state: "attached" });
  // The real widget fills its field a moment before it hands the token to the page; a click in between only asks to
  // finish the captcha. Pressed again until the sign-in request leaves.
  for (let attempt = 1; ; attempt++) {
    const sent = page.waitForRequest(request => request.method() === "POST"
      && new URL(request.url()).pathname === "/api/backend/v1/sessions", { timeout: 2_000 }).then(() => true, () => false);
    await loginButton(page).and(page.locator(":enabled")).click();
    if (await sent || attempt === 5) return;
  }
}
/** The refusal dialog of the sign-in page, closed with its button. */
export async function refusal(page: Page, message: string) {
  await page.getByRole("alertdialog").getByText(message, { exact: true }).waitFor();
  await scrollToTop(page);
}
/** Opening a dialog low on the page scrolls what is behind it; the dialog is fixed, so the page goes back to the top. */
export async function scrollToTop(page: Page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    for (const element of Array.from(document.querySelectorAll("*"))) { if (element.scrollTop) element.scrollTop = 0; if (element.scrollLeft) element.scrollLeft = 0; }
  });
}
export async function closeDialog(page: Page) {
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button").last().click();
  await dialog.waitFor({ state: "hidden" });
}

/* ---- After the sign-in ---- */

export async function verifyMfa(page: Page, code = MFA_CODE) {
  const input = page.getByRole("textbox", { name: "Mã xác thực" });
  await input.waitFor();
  await input.pressSequentially(code);
}
export async function confirmMfa(page: Page) {
  await page.getByRole("button", { name: "Xác thực", exact: true }).click();
}
export const pickerHeading = (page: Page) => page.getByText(`Xin chào, ${FULL_NAME}. Bạn muốn làm việc`, { exact: false });
export const workspaceHome = (page: Page) => page.getByRole("heading", { name: "Trang chủ", exact: true });
export async function chooseUnit(page: Page, name = UNITS[0]!.org_name) {
  await page.getByText(name, { exact: true }).first().click();
}
export async function enterUnit(page: Page) {
  await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
  await workspaceHome(page).waitFor();
}
