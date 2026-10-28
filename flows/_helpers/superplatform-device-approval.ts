import type { Page } from "playwright";
import { CONSENT_TEXT } from "./superplatform-identity-document";
import {
  FULL_NAME, MFA_CODE, PHONE, UNITS, at, fill, loginFlow, openLogin, submit, type LoginContext, type LoginSetup,
} from "./superplatform-login";

/*
 * "Xác nhận đăng nhập trên thiết bị mới" (/login/device-approval): the password is right, but this device is not
 * trusted, so the server answers with DEVICE_LOGIN_APPROVAL_REQUIRED and no session yet. The page polls the request
 * until a trusted device allows it, or this device proves its owner with the Authenticator or a recovery code.
 * The flow drives the request through `approval`, the way the trusted device and the server would.
 */

export const PAGE_TITLE = { waiting: "Chờ xác nhận đăng nhập", code: "Nhập mã xác thực", recovery: "Nhập mã dự phòng",
  identity: "Xác minh danh tính" };
export const RECOVERY_CODE = "K7QX-M3PB";
export const WRONG_CODE = "204816";
/** supership.security.device-login.max-code-failures */
export const MAX_CODE_FAILURES = 5;

/** Exact sentences of DeviceLoginApprovalService. */
export const MESSAGES = {
  wrongCode: "Mã xác thực không đúng hoặc đã được sử dụng.",
  attemptsExceeded: "Bạn đã nhập sai mã quá nhiều lần. Hãy đăng nhập lại.",
  notReady: "Yêu cầu chưa được chấp nhận, đã hết hạn hoặc đã được xử lý. Hãy kiểm tra lại.",
  rateLimited: "Bạn gửi yêu cầu hơi nhanh. Hãy chờ một phút rồi thử lại.",
};

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "DISMISSED" | "EXPIRED" | "CONSUMED" | "MISMATCHED";
export interface Approval {
  status: ApprovalStatus;
  /** The number the trusted device must pick (10..99). */
  matchNumber: number;
  expiresAt: string;
  /** A trusted device of the console with a live session can approve now. */
  approverAvailable: boolean;
  authenticator: boolean;
  recoveryCodes: number;
  /** Wrong codes typed so far on this request. */
  failures: number;
}
export interface ApprovalContext extends LoginContext { approval: Approval }

export function deviceApprovalFlow(id: string, name: string, run: (ctx: ApprovalContext) => Promise<void>,
                                   initial: Partial<Approval> = {}, setup: LoginSetup = {}) {
  return loginFlow(`thiet-bi-moi-${id}`, ["SUPERPLATFORM", "ĐĂNG NHẬP", "XÁC NHẬN ĐĂNG NHẬP TRÊN THIẾT BỊ MỚI"], name,
    async ctx => {
      const approval: Approval = { status: "PENDING", matchNumber: 47, expiresAt: at(587), approverAvailable: true,
        authenticator: true, recoveryCodes: 8, failures: 0, ...initial };
      mockApproval(ctx, approval);
      await run({ ...ctx, approval });
    }, { nextAction: "DEVICE_LOGIN_APPROVAL_REQUIRED", ...setup });
}

/** The session the server issues once the request is consumed; a code or an approval by number proves MFA. */
function issued(nextAction: string, assurance: number) {
  return { session_id: "login-session", expires_at: at(86400), assurance_level: assurance, next_action: nextAction,
    identity_id: "identity-thu-ha", full_name: FULL_NAME, avatar_url: null, active_context: null, trust_offer_expires_at: null,
    available_memberships: UNITS.map(unit => ({ ...unit, membership_type: "EMPLOYEE", status: "ACTIVE",
      provisioning_status: "READY", application_code: "SUPERPLATFORM", eligible: true, selectable: true,
      next_action: assurance > 1 ? "SELECT" : "VERIFY_MFA", is_current: false })) };
}

function mockApproval({ mock }: LoginContext, approval: Approval) {
  // Only the waiting capability exists until the request is consumed: no session behind /v1/me.
  let session = false;
  const consume = (nextAction: string, assurance: number) => {
    approval.status = "CONSUMED"; session = true; mock.nextAction = nextAction === "SELECT_CONTEXT" ? undefined : nextAction;
    return { message: "Đăng nhập thành công.", data: issued(nextAction, assurance) };
  };
  const refuse = (status: number, code: string, message: string) => ({ status, message, data: { code } });

  mock.on("GET", /^\/v1\/me(\/|$)/, () => session ? undefined
    : refuse(401, "SESSION_MISSING", "Phiên đăng nhập không tồn tại."));
  mock.on("GET", "/v1/auth/login-approval", () => ({ message: "Trạng thái yêu cầu đăng nhập.", data: {
    request_id: "login-approval-request", status: approval.status, expires_at: approval.expiresAt,
    match_number: approval.status === "PENDING" ? approval.matchNumber : null,
    device_name: "Chrome trên Windows", device_type: "DESKTOP", approver_available: approval.approverAvailable,
    methods: { phone: false, email: false, authenticator: approval.authenticator, recovery_codes_remaining: approval.recoveryCodes },
    identity_verification_available: !approval.authenticator } }));
  mock.on("DELETE", "/v1/auth/login-approval", () => {
    if (approval.status === "PENDING" || approval.status === "APPROVED") approval.status = "DISMISSED";
    return { message: "Đã hủy yêu cầu đăng nhập.", data: null };
  });
  mock.on("POST", "/v1/auth/login-approval/complete", body => {
    const code: string | undefined = body?.mfa_code;
    if (!code) return approval.status === "APPROVED" ? consume("SELECT_CONTEXT", 2) : refuse(409, "LOGIN_APPROVAL_NOT_READY", MESSAGES.notReady);
    if (approval.status !== "PENDING") return refuse(409, "LOGIN_APPROVAL_NOT_READY", MESSAGES.notReady);
    if (code === MFA_CODE || (code === RECOVERY_CODE && approval.recoveryCodes > 0)) return consume("SELECT_CONTEXT", 2);
    // Wrong codes count on the request; the last one ends it.
    if (++approval.failures >= MAX_CODE_FAILURES) {
      approval.status = "EXPIRED";
      return refuse(429, "LOGIN_CODE_ATTEMPTS_EXCEEDED", MESSAGES.attemptsExceeded);
    }
    return refuse(400, "LOGIN_CODE_INVALID", MESSAGES.wrongCode);
  });
  mock.on("POST", "/v1/auth/login-approval/identity-verification", () => consume("IDENTITY_VERIFICATION_REQUIRED", 1));
  // Read by the identity check page for its new-password step, which this account skips.
  mock.on("GET", "/v1/auth/password-policy", () => ({ data: { minimum_length: 8, maximum_length: 72, maximum_bytes: 72,
    rules: [{ code: "MIN_LENGTH", label: "Ít nhất 8 ký tự" }, { code: "MAX_LENGTH", label: "Tối đa 72 ký tự" }] } }));
  // Part D of "Đặt lại MFA cho người dùng": the person shows their face first.
  mock.on("GET", "/v1/me/identity-verification", () => session ? { data: { next_action: "EKYC_CONSENT",
    verification_method: "FACE", face_scan_available: true, remaining_attempts: 3, channels: [], later_allowed: false,
    consent: { version: "2026-10", text: CONSENT_TEXT, digest: "capture-digest" } } } : undefined);
}

/**
 * The right password from a device the account does not trust, through to the waiting page. The stand-in only
 * proves MFA through /v1/me/mfa/verify, so the session the request opens is marked proven there first.
 */
export async function signInOnNewDevice(page: Page, untilTitle = PAGE_TITLE.waiting) {
  await openLogin(page);
  await fill(page, PHONE);
  await submitOnNewDevice(page, untilTitle);
}
/** "Đăng nhập" on the filled form, through to the waiting page. */
export async function submitOnNewDevice(page: Page, untilTitle = PAGE_TITLE.waiting) {
  await submit(page);
  await page.waitForURL("**/login/device-approval");
  await heading(page, untilTitle).waitFor();
  await page.evaluate(code => fetch("/api/backend/v1/me/mfa/verify", { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }), MFA_CODE);
}

export const heading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true });
export const matchNumber = (page: Page, number: number) => page.getByRole("status", { name: `Số cần chọn: ${number}` });
export const confirmButton = (page: Page) => page.getByRole("button", { name: "Xác nhận đăng nhập", exact: true });
export const notice = (page: Page, title: string) => page.getByRole("alertdialog", { name: title, exact: true });

/** The six cells of the Authenticator code (one real input underneath). */
export async function typeAuthenticatorCode(page: Page, code = MFA_CODE) {
  const input = page.getByRole("textbox", { name: "Mã xác thực" });
  await input.focus();
  await input.press("Control+A");
  await input.press("Backspace");
  await input.pressSequentially(code);
}
export async function typeRecoveryCode(page: Page, code = RECOVERY_CODE) {
  await page.getByRole("textbox", { name: "Mã dự phòng" }).pressSequentially(code);
}
/** The one button of an open notice ("Đã hiểu"). */
export async function closeNotice(page: Page, title: string) {
  const dialog = notice(page, title);
  await dialog.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
}
