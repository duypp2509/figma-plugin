import type { Page } from "playwright";
import { CONSENT_TEXT, fakeCamera } from "./superplatform-identity-document";
import { DEV_OTP } from "./otp-session";
import { MFA_CODE, PASSWORD, WRONG_PASSWORD, at, loginFlow, type LoginContext, type LoginSetup } from "./superplatform-login";

/*
 * A password sign-in that must set a new password before anything else (ĐỔI MẬT KHẨU BẮT BUỘC KHI ĐĂNG NHẬP), on top
 * of the sign-in stand-in of superplatform-login.ts:
 * - next_action CHANGE_PASSWORD → /change-password: the current password and a new one (flow "Đổi mật khẩu", part B),
 *   the reason worded by the server (PasswordChangeReasons);
 * - next_action PASSWORD_RESET_REQUIRED → /forced-password-reset: an administrator asked for a new password, typed
 *   first and saved once the face or an OTP proves the person (ForcedPasswordResetService).
 */

const GROUP: [string, ...string[]] = ["SUPERPLATFORM", "ĐĂNG NHẬP", "ĐỔI MẬT KHẨU BẮT BUỘC KHI ĐĂNG NHẬP"];

/** The new password typed in every flow: 12 characters, none of Trần Thu Hà's name, phone or email. */
export const NEW_PASSWORD = "TanBinh#2026";
/** Long enough for the internal minimum raised to 16 characters. */
export const LONG_PASSWORD = "BuuCuc#TanBinh2026";
/** One of the account's last five passwords (PasswordHistory). */
export const RECENT_PASSWORD = WRONG_PASSWORD;
/** Found in a known breach (Pwned Passwords). */
export const BREACHED_PASSWORD = "Password@123";
/** The verified phone 0912 468 035, as ForcedPasswordResetService.mask and VerifiedOtpChannels.mask write it. */
export const MASKED_PHONE = "09******35";
export const OTP_DESTINATION = "091****035";
export { DEV_OTP };

/** PasswordChangeReasons: the sentence of each reason; EXPIRED with a 90-day age limit, TOO_SHORT with a 16 minimum. */
export const REASONS = {
  TEMPORARY: "Bạn đang dùng mật khẩu thay thế. Hãy đặt mật khẩu mới để tiếp tục.",
  EXPIRED: "Mật khẩu đã quá 90 ngày theo chính sách. Hãy đặt mật khẩu mới để tiếp tục.",
  TOO_SHORT: "Tài khoản làm việc ở công ty cần mật khẩu từ 16 ký tự. Hãy đặt mật khẩu mới để tiếp tục.",
  BREACHED: "Mật khẩu này đã bị lộ ở nơi khác. Hãy đặt mật khẩu mới để tiếp tục.",
} as const;
export type Reason = keyof typeof REASONS;

/** Exact sentences of CurrentPasswordVerifier, ChangePasswordUseCase, PasswordHistory, PasswordPolicy, the web and ForcedPasswordResetService. */
export const MESSAGES = {
  currentWrong: "Mật khẩu hiện tại không đúng.",
  tooManyWrong: "Bạn đã nhập sai mật khẩu hiện tại quá nhiều lần. Vui lòng thử lại sau 15 phút.",
  sameAsCurrent: "Mật khẩu mới phải khác mật khẩu hiện tại.",
  recentlyUsed: "Mật khẩu này đã dùng gần đây, hãy chọn mật khẩu khác.",
  breached: "Mật khẩu này đã bị lộ ở nơi khác, hãy chọn mật khẩu khác.",
  /** ForcedPasswordChangePage, under the confirmation. */
  mismatch: "Xác nhận mật khẩu không khớp.",
  forced: "Để bảo vệ tài khoản, bạn cần đặt mật khẩu mới.",
  sameAsOld: "Mật khẩu mới phải khác mật khẩu cũ.",
  noVerification: "Tài khoản chưa có cách xác minh. Hãy liên hệ Quản trị hệ thống để được hỗ trợ.",
  facePassed: "Xác minh thành công.",
  faceMismatch: (left: number) => `Khuôn mặt không khớp, còn ${left} lần thử.`,
  faceStopped: "Không xác minh được khuôn mặt. Hãy liên hệ Quản trị hệ thống của công ty để được hỗ trợ.",
};
/** CurrentPasswordVerifier: five wrong current passwords hold the change for 15 minutes. */
const WRONG_LIMIT = 5;
/** InternalResetFaceStep: three faces that do not match stop the step. */
const FACE_TRIES = 3;

/** GET /v1/auth/password-policy for an internal account (PasswordRulesController), with the breach check on. */
const policy = (minimum: number) => ({ minimum_length: minimum, maximum_length: 72, maximum_bytes: 72, rules: [
  { code: "MIN_LENGTH", label: `Ít nhất ${minimum} ký tự` }, { code: "MAX_LENGTH", label: "Tối đa 72 ký tự" },
  { code: "UPPERCASE", label: "Có chữ in hoa" }, { code: "NUMBER", label: "Có chữ số" },
  { code: "SPECIAL_CHARACTER", label: "Có ký tự đặc biệt" },
  { code: "NO_PERSONAL_INFO", label: "Không chứa họ tên, số điện thoại, Email của bạn" },
  { code: "NOT_COMMON", label: "Không nằm trong danh sách mật khẩu đã bị lộ" },
  { code: "NOT_RECENT", label: "Khác 5 mật khẩu gần nhất" },
] });

/** The sign-in session asks for a new password for {@code reason}. */
export const mustChange = (reason: Reason): LoginSetup =>
  ({ nextAction: "CHANGE_PASSWORD", sessionExtra: { password_reason: reason, password_message: REASONS[reason] } });

/* ---- /change-password ---- */

export interface ChangeContext extends LoginContext {
  /** Switches the reason the next read of the session says (the page reads it once, on load). */
  setReason(reason: Reason): void;
}

/** A flow that lands on /change-password after the password sign-in, for {@code reason}. */
export function changeFlow(id: string, name: string, run: (ctx: ChangeContext) => Promise<void>, reason: Reason) {
  return loginFlow(`doi-mat-khau-${id}`, GROUP, name, async ctx => {
    const { mock } = ctx;
    let minimum = reason === "TOO_SHORT" ? 16 : 8;
    let wrong = 0;
    const refuse = (status: number, code: string, message: string, extra: object = {}) =>
      ({ status, message, data: { code, ...extra } });
    mock.on("GET", "/v1/auth/password-policy", () => ({ data: policy(minimum) }));
    // ChangePasswordUseCase: the current password (throttled), the rules (breach last), not the current one, not a recent one.
    mock.on("PUT", "/v1/me/password", body => {
      if (wrong >= WRONG_LIMIT) return refuse(429, "PASSWORD_CHANGE_RATE_LIMITED", MESSAGES.tooManyWrong, { retry_after_seconds: 900 });
      if (body.current_password !== PASSWORD) { wrong++; return refuse(400, "CURRENT_PASSWORD_INCORRECT", MESSAGES.currentWrong); }
      if (body.new_password === BREACHED_PASSWORD) return refuse(400, "PASSWORD_BREACHED", MESSAGES.breached);
      if (body.new_password === PASSWORD) return refuse(400, "NEW_PASSWORD_SAME_AS_CURRENT", MESSAGES.sameAsCurrent);
      if (body.new_password === RECENT_PASSWORD) return refuse(400, "PASSWORD_RECENTLY_USED", MESSAGES.recentlyUsed);
      // Changed: the sign-in goes on to the MFA asked before the unit picker.
      mock.nextAction = undefined;
      mock.sessionExtra = undefined;
      return { message: "Đổi mật khẩu thành công.", data: { changed_at: at(0), revoked_session_count: 1, revoked_context_count: 0,
        active_session_count: 1 } };
    });
    await run({ ...ctx, setReason: next => {
      minimum = next === "TOO_SHORT" ? 16 : 8;
      mock.sessionExtra = mustChange(next).sessionExtra;
    } });
  }, mustChange(reason));
}

export const changeButton = (page: Page) => page.getByRole("button", { name: "Đổi mật khẩu", exact: true });
/** /change-password with the server's reason under its heading. */
export async function changePage(page: Page, reason: Reason) {
  await page.getByRole("heading", { name: "Đổi mật khẩu", exact: true }).waitFor();
  await page.getByText(REASONS[reason], { exact: true }).waitFor();
}
export async function fillChange(page: Page, current: string, next: string, confirm = next) {
  await page.locator("#current-password").fill(current);
  await page.locator("#new-password").fill(next);
  await page.locator("#confirm-password").fill(confirm);
}
/** "Đổi mật khẩu", once the captcha handed out a fresh token (the button stays locked until then). */
export async function submitChange(page: Page) {
  const answered = page.waitForResponse(response => response.url().endsWith("/v1/me/password"));
  await changeButton(page).and(page.locator(":enabled")).click();
  await answered;
}
/** The "Không thể đổi mật khẩu" dialog with {@code message}, closed by the flow afterwards. */
export async function changeRefused(page: Page, message: string) {
  await page.getByRole("alertdialog").getByText(message, { exact: true }).waitFor();
}
export async function closeNotice(page: Page) {
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
}

/* ---- /forced-password-reset ---- */

type Step = "NEW_PASSWORD" | "EKYC_CONSENT" | "EKYC_CAPTURE" | "ENTER_OTP" | "UNAVAILABLE" | "STOPPED" | "DONE";
export interface ResetStandIn {
  /** The step 2 the server chose: FACE for an internal account with an approved citizen ID, else OTP; null for neither. */
  method: "FACE" | "OTP" | null;
  /** Answers of the next face photos, in order; PASSED once empty. */
  faces: ("PASSED" | "FAILED")[];
}
export interface ResetContext extends LoginContext { reset: ResetStandIn }

/** A flow that lands on /forced-password-reset after the password sign-in. */
export function forcedResetFlow(id: string, name: string, run: (ctx: ResetContext) => Promise<void>,
                                setup: Partial<ResetStandIn> = {}) {
  return loginFlow(`doi-mat-khau-${id}`, GROUP, name, async ctx => {
    const { mock, page } = ctx;
    const reset: ResetStandIn = { method: "FACE", faces: [], ...setup };
    await fakeCamera(page);
    let step: Step = reset.method ? "NEW_PASSWORD" : "UNAVAILABLE";
    let failures = 0;
    const base = "/v1/me/forced-password-reset";
    const state = () => ({
      next_action: step, verification_method: reset.method,
      message: step === "NEW_PASSWORD" ? MESSAGES.forced : step === "UNAVAILABLE" ? MESSAGES.noVerification
        : step === "STOPPED" ? MESSAGES.faceStopped : null,
      reason_code: step === "STOPPED" ? "EKYC_STOPPED" : null, locked_until: null,
      remaining_attempts: step === "EKYC_CONSENT" || step === "EKYC_CAPTURE" ? FACE_TRIES - failures : step === "STOPPED" ? 0 : null,
      consent: step === "EKYC_CONSENT" ? { version: "2026-10", text: CONSENT_TEXT, digest: "capture-digest" } : null,
      face_scan_available: false, masked_phone: step === "ENTER_OTP" ? MASKED_PHONE : null,
      expires_at: step === "EKYC_CONSENT" || step === "EKYC_CAPTURE" || step === "ENTER_OTP" ? at(600) : null,
    });
    const refuse = (status: number, code: string, message: string) => ({ status, message, data: { code } });
    const done = () => { step = "DONE"; mock.nextAction = undefined; };

    mock.on("GET", "/v1/auth/password-policy", () => ({ data: policy(8) }));
    mock.on("GET", "/v1/public/ekyc/face-modes", () => ({ data: { manual: true, auto: true } }));
    mock.on("GET", base, () => ({ data: state() }));
    mock.on("POST", `${base}/new-password`, body => {
      if (body.new_password !== body.confirm_password)
        return refuse(400, "PASSWORD_CONFIRMATION_MISMATCH", "Mật khẩu nhập lại không khớp.");
      if (body.new_password === PASSWORD) return refuse(400, "NEW_PASSWORD_SAME_AS_CURRENT", MESSAGES.sameAsOld);
      if (body.new_password === RECENT_PASSWORD) return refuse(400, "PASSWORD_RECENTLY_USED", MESSAGES.recentlyUsed);
      step = reset.method === "OTP" ? "ENTER_OTP" : "EKYC_CONSENT";
      return { message: "Hãy xác minh để hoàn tất.", data: state() };
    });
    mock.on("POST", `${base}/consent`, () => { step = "EKYC_CAPTURE"; return { data: state() }; });
    mock.on("POST", `${base}/ekyc-attempts`, () => {
      if ((reset.faces.shift() ?? "PASSED") === "PASSED") {
        done();
        return { message: MESSAGES.facePassed, data: { result: "PASSED", message: MESSAGES.facePassed, state: state() } };
      }
      failures++;
      if (failures >= FACE_TRIES) {
        step = "STOPPED";
        return { message: MESSAGES.faceStopped, data: { result: "STOPPED", message: MESSAGES.faceStopped, state: state() } };
      }
      const message = MESSAGES.faceMismatch(FACE_TRIES - failures);
      return { message, data: { result: "FAILED", message, state: state() } };
    });
    mock.on("POST", `${base}/otp`, () => ({ message: "Đã gửi mã OTP.", data: { otp_id: "otp-forced-reset", channel: "SMS",
      masked_destination: OTP_DESTINATION, expires_at: at(300), resend_available_at: at(180) } }));
    mock.on("POST", `${base}/complete`, body => {
      if (body.code !== DEV_OTP) return refuse(400, "MFA_INVALID_CODE", "Mã xác thực không đúng hoặc đã được sử dụng.");
      done();
      return { message: "Đã đặt mật khẩu mới.", data: state() };
    });
    await run({ ...ctx, reset });
  }, { nextAction: "PASSWORD_RESET_REQUIRED" });
}

export const continueButton = (page: Page) => page.getByRole("button", { name: "Tiếp tục", exact: true });
/** /forced-password-reset at step 1, with the server's reason under its heading. */
export async function newPasswordStep(page: Page) {
  await page.getByRole("heading", { name: "Đặt mật khẩu mới", exact: true }).waitFor();
  await page.getByText(MESSAGES.forced, { exact: true }).waitFor();
}
export async function fillNewPassword(page: Page, password = NEW_PASSWORD, confirm = password) {
  await page.locator("#forced-reset-new-password").fill(password);
  await page.locator("#forced-reset-confirm-password").fill(confirm);
}
/**
 * The face matched the approved citizen ID: the session has its MFA proof (ForcedPasswordResetService.proveMfaByFace),
 * so the unit picker asks for no Authenticator. The sign-in stand-in keeps that proof behind its own MFA endpoint.
 */
export async function proveMfaByFace(page: Page) {
  await page.evaluate(code => fetch("/api/backend/v1/me/mfa/verify", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }) }), MFA_CODE);
}
