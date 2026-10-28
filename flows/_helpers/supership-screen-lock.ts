import type { Page } from "playwright";
import { defineFlow, type FlowContext } from "../../capture";
import { KHA_AI_SHOP, mockSignedInShop } from "./supership-session";
import { OWNER_PERMISSIONS } from "./supership-shop-roles";
import { DEV_OTP, OtpSessionMock } from "./otp-session";
import { mockTurnstile } from "./turnstile";
export { fillPin, unlock, lockNow, PIN } from "./superplatform-screen-lock";

const START = Date.parse("2026-10-12T09:00:00+07:00");
export const SECURITY_URL = "/settings/security?tab=screen-lock";
export interface ShopPinMock { enabled: boolean; locked: boolean; ended: boolean; timeout: number; remaining: number; pin: string; fresh: boolean; reasons: string[] }
interface ShopPinContext extends FlowContext { mock: ShopPinMock }
export function shopPinFlow(id: string, name: string, run: (ctx: ShopPinContext) => Promise<void>, enabled = true) {
  return defineFlow({ id: `supership-pin-${id}`, name, app: "supership", group: ["SUPERSHIP WEB", "KHÓA MÀN HÌNH BẰNG MÃ PIN"],
    async run(ctx) {
      const mock = await mockShopPin(ctx.page, ctx.log, enabled);
      await run({ ...ctx, mock });
    },
  });
}
async function mockShopPin(page: Page, log: (line: string) => void, enabled: boolean): Promise<ShopPinMock> {
  await page.clock.setFixedTime(START);
  await mockTurnstile(page, "hidden");
  const backend = await mockSignedInShop(page, KHA_AI_SHOP, OWNER_PERMISSIONS, log);
  const mock: ShopPinMock = { enabled, locked: false, ended: false, timeout: 900, remaining: 5, pin: "028461", fresh: false, reasons: [] };
  let version = 1;
  const otp = new OtpSessionMock("capture-pin-otp", "090***2735", () => START);
  backend.on("GET", /^\/v1\/me\/sessions$/, () => ({ data: { sessions: [] } }));
  backend.on("GET", /^\/v1\/auth\/customer\/login-approval$/, () => ({ data: null }));
  backend.on("GET", /^\/v1\/auth\/customer\/federated\/providers$/, () => ({ data: { providers: [] } }));
  backend.on("GET", /^\/v1\/me\/devices$/, () => ({ data: { devices: [] } }));
  backend.on("GET", /^\/v1\/me\/device-trust-requests$/, () => ({ data: { current_device_id: "capture-device", current_device_trusted: true, has_trusted_device: true, requests: [] } }));
  backend.on("GET", /^\/v1\/me\/mfa$/, () => ({ data: { enrolled: false, factor_status: null, recovery_codes_remaining: 0, enrollment_channels: [{ channel: "PHONE", masked_destination: "090***2735" }] } }));
  backend.on("POST", /^\/v1\/me\/step-up\/otp$/, request => {
    const channel = request.postDataJSON().channel ?? "SMS"; otp.start(channel);
    return { data: { challenge_id: otp.id, channel, masked_destination: "090***2735", expires_at: otp.expiresAt, resend_available_at: otp.resendAvailableAt } };
  });
  backend.on("GET", /^\/v1\/otp-sessions\/[^/]+$/, () => ({ data: otp.snapshot() }));
  backend.on("POST", /^\/v1\/me\/step-up\/otp\/verify$/, request => {
    const error = otp.verify(request.postDataJSON().otp_code); if (error) return error;
    mock.fresh = true; return { data: { otp_step_up_expires_at: new Date(START + 300000).toISOString() } };
  });
  // A later, narrower route owns PIN state; all other calls keep the established shop fixture.
  await page.route("**/api/backend/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api\/backend/, "");
    const reply = (data: unknown, status = 200, message = "") => route.fulfill({ status, headers: { "X-Browser-Session-Version": "1" }, json: { error: status >= 400, message, data } });
    const failure = (status: number, code: string) => reply({ code, remaining_attempts: mock.remaining }, status, code);
    const state = () => ({ enabled: mock.enabled, enrollment_available: true, state: mock.enabled ? mock.locked ? "LOCKED" : "UNLOCKED" : "DISABLED", timeout_seconds: mock.timeout, timeout_min_seconds: 10, timeout_max_seconds: 900, remaining_attempts: mock.remaining, state_version: version, session_id: "capture-session", server_time: new Date(START).toISOString(), lock_deadline: mock.enabled && !mock.locked ? new Date(START + mock.timeout * 1000).toISOString() : null });
    if (path === "/v1/me/screen-lock") return mock.ended ? failure(401, "SESSION_REVOKED") : reply(state());
    if (path === "/v1/me/screen-lock/settings") {
      if (!mock.fresh) return failure(403, "OTP_REQUIRED");
      mock.fresh = false;
      if (request.method() === "DELETE") mock.enabled = false;
      else { const body = request.postDataJSON(); mock.enabled = true; mock.timeout = body.timeout_seconds; if (body.pin) mock.pin = body.pin; }
      version++; return reply(state());
    }
    if (path === "/v1/me/screen-lock/activity") return reply(state());
    if (path === "/v1/me/screen-lock/lock") { mock.locked = true; mock.reasons.push(request.postDataJSON().reason); version++; return reply(state()); }
    if (path === "/v1/me/screen-lock/unlock") {
      if (request.postDataJSON().pin !== mock.pin) { mock.remaining--; if (!mock.remaining) { mock.ended = true; return failure(401, "SESSION_REVOKED"); } return failure(400, "PIN_INVALID"); }
      mock.locked = false; mock.remaining = 5; version++; return reply(state());
    }
    if (path === "/v1/me/sessions/current" && request.method() === "DELETE") { mock.ended = true; return reply({ revoked_session_count: 1, revoked_context_count: 1 }); }
    if (path === "/v1/auth/customer/session" && mock.ended) return reply(null);
    if (path === "/v1/auth/customer/passkey/options/autofill") return reply({ available: false });
    return route.fallback();
  });
  return mock;
}
export async function openShopPin(page: Page) {
  await page.goto(SECURITY_URL); await page.getByRole("heading", { name: "Khóa màn hình", exact: true }).waitFor();
}
export async function requestOtp(page: Page) {
  await page.getByRole("button", { name: "Gửi mã OTP", exact: true }).waitFor();
  await page.getByRole("button", { name: "Gửi mã OTP", exact: true }).click();
  await page.getByRole("textbox", { name: "Mã OTP, gồm 6 chữ số", exact: true }).waitFor();
}
export async function confirmOtp(page: Page) {
  const input = page.getByRole("textbox", { name: "Mã OTP, gồm 6 chữ số", exact: true });
  await input.focus();
  for (let remaining = (await input.inputValue()).length; remaining > 0; remaining--) await input.press("Backspace");
  await input.pressSequentially(DEV_OTP);
  await page.locator("dialog[open]").last().getByRole("button", { name: "Xác nhận", exact: true }).click();
}
export async function verifySettings(page: Page) { await requestOtp(page); await confirmOtp(page); }
export async function loginReady(page: Page) {
  await page.waitForURL(url => url.pathname === "/login");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).waitFor();
}
