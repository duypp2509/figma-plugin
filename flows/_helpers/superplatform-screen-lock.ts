import type { Page, Route } from "playwright";
import { defineFlow, type FlowContext } from "../../capture";
import { capability } from "./supership-session";
import { mockTurnstile } from "./turnstile";

export const SECURITY_URL = "/workspace/account/security?tab=screen-lock";
export const PIN = "028461";
const START = Date.parse("2026-10-12T09:00:00+07:00");
const expiry = new Date(START + 86400000).toISOString();
const active = { context_id: "pin-context", active_membership_id: "pin-member", org_code: "SUPERTEK", org_name: "SuperTek", application_code: "SUPERPLATFORM" };
const membership = { membership_id: "pin-member", org_id: "pin-org", org_code: "SUPERTEK", org_name: "SuperTek", org_type: "COMPANY", membership_type: "EMPLOYEE", title: "Nhân viên vận hành", status: "ACTIVE", provisioning_status: "READY", application_code: "SUPERPLATFORM", eligible: true, is_default: true };
export interface PinMock {
  enabled: boolean; available: boolean; locked: boolean; ended: boolean; timeout: number; remaining: number;
  pin: string; fresh: boolean; enrolled: boolean; requireMfa: boolean;
  unlockError: string; settingsError: string; offline: string; logoutFail: boolean; nextAction: string;
  unlockDelay: boolean; lockDelay: boolean; attempts: string[]; reasons: string[];
  release: () => void;
}
export interface PinContext extends FlowContext { mock: PinMock }
export function pinFlow(id: string, name: string, run: (ctx: PinContext) => Promise<void>, enabled = true) {
  return defineFlow({ id: `superplatform-pin-${id}`, name, app: "superplatform", group: ["SUPERPLATFORM", "KHÓA MÀN HÌNH BẰNG MÃ PIN"],
    async run(ctx) {
      const mock = await mockPin(ctx.page, ctx.log, enabled);
      await run({ ...ctx, mock });
    },
  });
}
export async function mockPin(page: Page, log: (line: string) => void, enabled: boolean): Promise<PinMock> {
  await page.clock.setFixedTime(START);
  await mockTurnstile(page, "hidden");
  const mock: PinMock = { enabled, available: true, locked: false, ended: false, timeout: 300, remaining: 5,
    pin: PIN, fresh: false, enrolled: true, requireMfa: true, unlockError: "", settingsError: "", offline: "", logoutFail: false,
    nextAction: "NONE", unlockDelay: false, lockDelay: false, attempts: [], reasons: [], release: () => {} };
  let version = 1;
  const snapshot = () => ({ enabled: mock.enabled, state: mock.enabled ? mock.locked ? "LOCKED" : "UNLOCKED" : "DISABLED",
    timeout_seconds: mock.timeout, timeout_min_seconds: 10, timeout_max_seconds: 900, remaining_attempts: mock.remaining,
    state_version: version, session_id: "pin-session", enrollment_available: mock.available,
    server_time: new Date(START).toISOString(), lock_deadline: mock.enabled && !mock.locked ? new Date(START + mock.timeout * 1000).toISOString() : null });
  const session = { session_id: "pin-session", expires_at: expiry, assurance_level: 2, next_action: mock.nextAction, identity_id: "pin-identity", full_name: "Nguyễn Minh Anh", avatar_url: null, available_memberships: [membership], active_context: active };
  const cached = { sessionId: session.session_id, expiresAt: expiry, assuranceLevel: 2, nextAction: "NONE", identityId: session.identity_id,
    fullName: session.full_name, avatarUrl: null, availableMemberships: [{ membershipId: membership.membership_id, orgId: membership.org_id, orgCode: membership.org_code, orgName: membership.org_name, membershipType: membership.membership_type, applicationCode: "SUPERPLATFORM", eligible: true }],
    activeContext: { contextId: active.context_id, activeMembershipId: active.active_membership_id, orgCode: active.org_code, orgName: active.org_name, applicationName: "SUPERPLATFORM" }, mfaVerifiedAt: new Date(START).toISOString(), mfaElevationExpiresAt: expiry };
  await page.context().addInitScript((value) => { if (location.pathname.startsWith("/workspace") && !sessionStorage.getItem("supership.admin.session.v1")) sessionStorage.setItem("supership.admin.session.v1", JSON.stringify(value)); }, cached);
  const seen = new Set<string>();
  await page.context().route("**/api/**", async (route: Route) => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api\/backend/, ""), method = request.method();
    const send = (data: unknown = {}, status = 200, code?: string, message?: string) => route.fulfill({ status, headers: { "X-Browser-Session-Version": "1", ...(status === 429 ? { "Retry-After": "30" } : {}) }, json: { error: status >= 400, message: message ?? "", data: code ? { code, ...data as object } : data } });
    if (mock.offline && path.includes(mock.offline)) { if (path.endsWith("/unlock")) mock.attempts.push(request.postDataJSON().attempt_id); return route.abort("internetdisconnected"); }
    if (path === "/v1/me/screen-lock") return mock.ended ? send({}, 401, "SESSION_EXPIRED") : send(snapshot());
    if (path === "/v1/me/screen-lock/lock") {
      mock.reasons.push(request.postDataJSON().reason);
      if (mock.lockDelay) await new Promise<void>(resolve => { mock.release = resolve; });
      mock.locked = true; version++; return send(snapshot());
    }
    if (path === "/v1/me/screen-lock/activity") return send(snapshot());
    if (path === "/v1/me/screen-lock/unlock") {
      const body = request.postDataJSON(); mock.attempts.push(body.attempt_id);
      if (mock.unlockDelay) await new Promise<void>(resolve => { mock.release = resolve; });
      if (mock.unlockError) return send({ remaining_attempts: mock.remaining, retry_after_seconds: 30 }, mock.unlockError === "PIN_RATE_LIMITED" ? 429 : mock.unlockError === "LOCK_STATE_CHANGED" ? 409 : 503, mock.unlockError);
      if (body.pin !== mock.pin) { mock.remaining--; if (!mock.remaining) { mock.ended = true; return send({}, 401, "SESSION_REVOKED"); } return send({ remaining_attempts: mock.remaining }, 400, "PIN_INVALID"); }
      mock.locked = false; mock.remaining = 5; version++; return send(snapshot());
    }
    if (path === "/v1/me/screen-lock/settings") {
      if (mock.settingsError) return send({}, mock.settingsError === "DEVICE_REAUTHENTICATION_REQUIRED" ? 409 : mock.settingsError === "SCREEN_LOCK_UNAVAILABLE" ? 503 : 400, mock.settingsError, mock.settingsError);
      if (mock.requireMfa && !mock.fresh) return send({}, 403, "MFA_REQUIRED");
      mock.fresh = false;
      if (method === "DELETE") { mock.enabled = false; mock.locked = false; }
      else { const body = request.postDataJSON(); mock.enabled = true; mock.timeout = body.timeout_seconds; if (body.pin) mock.pin = body.pin; }
      version++; return send(snapshot());
    }
    if (path === "/v1/me/mfa") return send({ enrolled: mock.enrolled, factor_status: mock.enrolled ? "ACTIVE" : null, recovery_codes_remaining: 8 });
    if (path === "/v1/me/mfa/verify") {
      const code = request.postDataJSON().code;
      if (code !== "515060" && code !== "ABCD-EFGH") return send({}, 400, "MFA_INVALID_CODE", "Mã xác thực không đúng hoặc đã được sử dụng.");
      mock.fresh = true; return send({ session_id: "pin-session", assurance_level: 2, mfa_verified_at: new Date(START).toISOString(), mfa_elevation_expires_at: expiry });
    }
    if (path === "/v1/me/session") return send(mock.ended ? null : { ...session, next_action: mock.nextAction });
    if (path === "/v1/me/auth-state") return send({ next_action: mock.nextAction, enrolled: true, assurance_level: 2, mfa_verified_at: new Date(START).toISOString(), mfa_elevation_expires_at: expiry, mfa_access_expires_at: expiry, active_context: active });
    if (path === "/v1/me/sessions/current" && method === "DELETE") { if (mock.logoutFail) return route.abort(); mock.ended = true; return send({ revoked_session_count: 1, revoked_context_count: 1 }); }
    if (path === "/v1/me/memberships") return send([membership]);
    if (path === "/v1/me/capabilities") return send({ context: { context_id: "pin-context", context_type: "SUPERPLATFORM", application_name: "SUPERPLATFORM", membership_id: "pin-member", organization_id: "pin-org" }, assurance: { level: 2, mfa_verified: true }, capabilities: [capability("identity.view", "pin-org")], revision: "capture", generated_at: new Date(START).toISOString(), expires_at: expiry });
    if (path === "/v1/me/profile") return send({ identity_id: "pin-identity", person_id: "pin-person", full_name: "Nguyễn Minh Anh", gender: "FEMALE", avatar_url: null, status: "ACTIVE", person_version: 1, has_password: true, identifiers: [{ type: "EMAIL", value: "minhanh@supertek.vn", verified: true }, { type: "PHONE", value: "0906842735", verified: true }] });
    if (path === "/v1/me/sessions") return send({ sessions: [] });
    if (path === "/v1/me/devices") return send({ devices: [] });
    if (path === "/v1/me/device-trust-requests") return send({ current_device_id: "pin-device", current_device_trusted: true, has_trusted_device: true, requests: [] });
    if (path === "/v1/me/login-protection") return send({ enabled: true });
    if (path === "/v1/me/sessions/current/activity") return send({});
    if (path === "/v1/auth/passkey/options/autofill") return send({ available: false });
    const call = `${method} ${path}`;
    if (!seen.has(call)) { seen.add(call); log(`chưa giả lập: ${call}`); }
    return send({}, 404, "CAPTURE_UNMOCKED", call);
  });
  return mock;
}
export async function openSettings(page: Page) {
  try { await page.goto(SECURITY_URL); }
  catch (error) { if (!String(error).includes("ERR_NETWORK_CHANGED")) throw error; await page.goto(SECURITY_URL); }
  // The tab's panel title and the settings card both read "Khóa màn hình": wait for the card, drawn last.
  await page.getByRole("heading", { name: "Khóa màn hình", exact: true }).last().waitFor();
}
export async function fillPin(page: Page, value = PIN, confirm = value) { await page.getByLabel("Mã PIN mới", { exact: true }).fill(value); await page.getByLabel("Nhập lại PIN", { exact: true }).fill(confirm); }
export async function mfa(page: Page) { const input = page.getByRole("textbox", { name: "Mã xác thực" }); await input.waitFor(); await input.pressSequentially("515060"); await page.getByRole("button", { name: "Xác thực MFA và tiếp tục" }).click(); }
export async function lockNow(page: Page) { await page.getByRole("button", { name: "Khóa ngay", exact: true }).click(); await page.getByRole("heading", { name: "Màn hình đã khóa" }).waitFor(); }
export async function unlock(page: Page, value = PIN) { await page.getByLabel("Mã PIN", { exact: true }).fill(value); await page.getByRole("button", { name: "Mở khóa", exact: true }).click(); }
