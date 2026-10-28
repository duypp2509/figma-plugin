import type { Page, Route } from "playwright";
import type { ProfileMock } from "./superplatform-my-profile";
import { waitEnabled } from "./wait";

/*
 * "Đổi số điện thoại", "Đổi email", "Thêm …" of "Thông tin tài khoản" (IdentifierChangeFlow): the change requests
 * (IdentifierChangeController), the step-up code they ask for (StepUpGuard) and the OTP session of the new value
 * (OtpSessionService), with the rules and sentences of users-core-service. Registered after the profile stand-in, so
 * these calls are answered here first; a confirmed change is written to mock.identifiers, read back by GET /v1/me/profile.
 */

const START = Date.parse("2026-10-12T09:00:00+07:00");
const TTL_MS = 300_000;
const COOLDOWN_MS = 180_000;
const MAX_ATTEMPTS = 5;
const PASSWORD_ATTEMPTS = 5;

export const PASSWORD = "MinhAnh@2026";
export const STEP_UP_CODE = "515060";
export const OTP_CODE = "515060";
export const NEW_PHONE = "0938517264";
export const NEW_EMAIL = "minhanh.nguyen94@gmail.com";
/** Held by another account. */
export const TAKEN_PHONE = "0977215846";
export const TAKEN_EMAIL = "nguyenminhanh@gmail.com";
/** Of a permanently locked account. */
export const BLOCKED_PHONE = "0869304172";

/** Sentences of the web (use-identifier-change-flow, OtpSessionEndedNotice) and the server, verbatim. */
export const MESSAGES = {
  phoneChanged: "Số điện thoại mới đã có hiệu lực. Các thiết bị khác đã được đăng xuất.",
  emailChanged: "Email mới đã có hiệu lực. Các thiết bị khác đã được đăng xuất.",
  phoneAdded: "Số điện thoại mới đã có hiệu lực.",
  emailAdded: "Email mới đã có hiệu lực.",
  phoneHead: "Số di động phải bắt đầu bằng 03, 05, 07, 08 hoặc 09.",
  phoneLength: "Số điện thoại phải có 10 chữ số.",
  emailShape: "Email chưa đúng định dạng.",
  phoneUnchanged: "Đây là số điện thoại bạn đang dùng.",
  emailUnchanged: "Đây là email bạn đang dùng.",
  phoneInUse: "Số điện thoại này đã được sử dụng.",
  emailInUse: "Email này đã được sử dụng.",
  phoneBlocked: "Số điện thoại này không dùng được.",
  companyEmail: "Email đã có tài khoản.",
  passwordRequired: "Vui lòng nhập mật khẩu hiện tại.",
  passwordWrong: "Mật khẩu hiện tại không đúng.",
  passwordLocked: "Bạn đã nhập sai mật khẩu hiện tại quá nhiều lần. Vui lòng thử lại sau 15 phút.",
  phoneLimit: "Bạn đã yêu cầu đổi số điện thoại quá nhiều lần hôm nay. Vui lòng thử lại vào ngày mai.",
  emailTooSoon: "Bạn vừa đổi số điện thoại. Có thể đổi Email sau 16:20 12/10/2026.",
  stepUpWrong: "Mã xác thực không đúng hoặc đã được sử dụng.",
  stepUpCancelled: "Đã hủy xác nhận. Thao tác chưa được thực hiện.",
  otpWrong: "Mã OTP không đúng. Bạn còn 4 lần nhập.",
  otpExceeded: "Bạn đã nhập sai quá số lần cho phép. Hãy yêu cầu mã OTP mới.",
  attemptsTitle: "Nhập sai quá số lần cho phép",
  expiredTitle: "Mã OTP đã hết hạn",
};

type Type = "PHONE" | "EMAIL";
interface Session {
  id: string; identifierId: string; type: Type; value: string; channel: string;
  sentAt: number; attempts: number; version: number; status: "PENDING" | "VERIFIED" | "BLOCKED" | "CANCELLED";
}
export interface Refusal { status: number; code: string; message: string }
export interface IdentifierChangeMock {
  /** Wrong current passwords in the last 15 minutes; the sixth try is refused while there are five. */
  wrongPasswords: number;
  /** The next start is refused with this, after the password (daily limit, 24-hour hold). */
  refusals: Partial<Record<Type, Refusal>>;
  /** Other sessions the confirmation signs out. */
  signedOut: number;
  /** identifier ids of POST …/cancel, in order. */
  cancelled: string[];
  /** Moves the page's clock, and this stand-in's, forward. */
  advance(ms: number): Promise<void>;
}

const domesticPhone = (raw: string) => {
  const compact = raw.trim().replace(/[\s.()-]/g, "");
  if (compact.startsWith("+84")) return `0${compact.slice(3)}`;
  if (compact.startsWith("84") && compact.length === 11) return `0${compact.slice(2)}`;
  return compact;
};
const mask = (value: string) => {
  const at = value.indexOf("@");
  if (at > 1) return `${value[0]}***${value.slice(at)}`;
  return value.length > 4 ? `***${value.slice(-4)}` : "***";
};
const at = (ms: number) => new Date(ms).toISOString();

export async function mockIdentifierChange(page: Page, profile: ProfileMock): Promise<IdentifierChangeMock> {
  let now = START;
  let next = 0;
  const sessions = new Map<string, Session>();
  const mock: IdentifierChangeMock = {
    wrongPasswords: 0, refusals: {}, signedOut: 2, cancelled: [],
    async advance(ms) { now += ms; await page.clock.setFixedTime(now); },
  };

  const normalize = (type: Type, raw: string): string | null => {
    if (type === "EMAIL") {
      const email = raw.trim().toLowerCase();
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
    }
    const phone = domesticPhone(raw);
    return /^0[35789]\d{8}$/.test(phone) ? phone : null;
  };
  /** CheckRequest and the checks of start(), in the server's order after the password: the first refusal, or null. */
  const refusal = (type: Type, raw: string): Refusal | null => {
    const value = normalize(type, raw);
    if (!value) return { status: 400, code: "IDENTIFIER_INVALID", message: type === "EMAIL" ? MESSAGES.emailShape
      : "Số điện thoại không hợp lệ: cần 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09." };
    if (type === "EMAIL" && /@(supership\.vn|supertek\.vn)$/.test(value))
      return { status: 400, code: "COMPANY_EMAIL_NOT_ALLOWED", message: MESSAGES.companyEmail };
    // An email left unverified at sign-up is a reservation, not the value in use.
    if (profile.identifiers.some(item => item.type === type && item.value === value && (type === "PHONE" || item.verified)))
      return { status: 409, code: "IDENTIFIER_UNCHANGED", message: type === "PHONE" ? MESSAGES.phoneUnchanged : MESSAGES.emailUnchanged };
    if (value === BLOCKED_PHONE) return { status: 409, code: "IDENTIFIER_BLOCKED", message: MESSAGES.phoneBlocked };
    if (value === TAKEN_PHONE || value === TAKEN_EMAIL)
      return { status: 409, code: "IDENTIFIER_IN_USE", message: type === "PHONE" ? MESSAGES.phoneInUse : MESSAGES.emailInUse };
    return null;
  };
  const snapshot = (session: Session) => {
    const expired = session.status === "PENDING" && session.sentAt + TTL_MS <= now;
    const active = session.status === "PENDING" && !expired;
    return { otp_session_id: session.id, challenge_id: session.id, status: expired ? "EXPIRED" : session.status,
      channel: session.channel, masked_destination: mask(session.value), expires_at: at(session.sentAt + TTL_MS),
      resend_available_at: at(session.sentAt + COOLDOWN_MS), version: session.version,
      remaining_attempts: MAX_ATTEMPTS - session.attempts,
      // A changed phone/email may be sent again after every cooldown (OtpSessionService.left).
      resends_remaining: active ? 1 : 0, channel_changes_remaining: active ? 1 : 0,
      available_channels: (session.type === "EMAIL" ? ["EMAIL"] : ["SMS", "ZALO"]).map(channel => ({ channel, masked_destination: mask(session.value) })) };
  };
  const started = (session: Session) => ({ identifier_id: session.identifierId, type: session.type, value: session.value,
    challenge_id: session.id, otp_expires_at: at(session.sentAt + TTL_MS), pending_expires_at: at(session.sentAt + 900_000),
    next_action: "ENTER_OTP", resend_available_at: at(session.sentAt + COOLDOWN_MS) });

  await page.context().route("**/api/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/backend/, "");
    const send = (data: unknown, status = 200, message = "") => route.fulfill({ status,
      headers: { "X-Browser-Session-Version": "1" }, json: { error: status >= 400, message, data } });
    const fail = (status: number, code: string, message: string, extra: object = {}) => send({ code, ...extra }, status, message);
    let body: any = {};
    try { body = request.postDataJSON() ?? {}; } catch { /* empty */ }

    const otpSession = path.match(/^\/v1\/otp-sessions\/([^/]+)$/);
    if (otpSession && otpSession[1] !== "delivery") {
      const session = sessions.get(otpSession[1]!);
      if (!session || session.status === "CANCELLED") return fail(400, "OTP_SESSION_CLOSED", "Phiên nhận mã không còn hiệu lực. Bạn nhận mã mới nhé.");
      return send(snapshot(session));
    }
    if (path === "/v1/otp-sessions/delivery") {
      const session = sessions.get(body.otp_session_id);
      if (!session || session.status !== "PENDING" || session.sentAt + TTL_MS <= now)
        return fail(400, "OTP_SESSION_CLOSED", "Phiên nhận mã đã kết thúc. Bạn nhấn “Nhận mã mới” để tiếp tục nhé.");
      if (body.expected_version < session.version) return send(snapshot(session));
      if (session.sentAt + COOLDOWN_MS > now) return fail(429, "OTP_RESEND_TOO_SOON", body.action === "RESEND"
        ? "Bạn chờ hết thời gian đếm ngược rồi gửi lại nhé." : "Bạn chờ hết thời gian đếm ngược rồi đổi kênh nhận mã nhé.");
      if (body.action !== "RESEND") session.channel = body.channel;
      session.sentAt = now; session.version++;
      return send(snapshot(session));
    }

    const change = path.match(/^\/v1\/me\/identifiers\/(phone|email)\/change-requests(?:\/([^/]+))?(?:\/([a-z]+))?$/);
    if (!change || request.method() !== "POST") return route.fallback();
    const type: Type = change[1] === "phone" ? "PHONE" : "EMAIL";
    const label = type === "PHONE" ? "số điện thoại" : "email";

    if (change[2] === "check") {
      return send({ value_error: refusal(type, body.value ?? "")?.message ?? null }, 200, "Đã kiểm tra thông tin.");
    }
    if (!change[2]) {
      // The step-up code is checked before the controller runs (StepUpInterceptor).
      const code = request.headers()["x-step-up-code"];
      if (code && code !== STEP_UP_CODE) return fail(400, "MFA_INVALID_CODE", MESSAGES.stepUpWrong);
      if (profile.hasPassword) {
        if (!body.current_password) return fail(400, "CURRENT_PASSWORD_REQUIRED", MESSAGES.passwordRequired);
        if (mock.wrongPasswords >= PASSWORD_ATTEMPTS)
          return fail(429, "PASSWORD_CHANGE_RATE_LIMITED", MESSAGES.passwordLocked, { retry_after_seconds: 900 });
        if (body.current_password !== PASSWORD) { mock.wrongPasswords++; return fail(400, "CURRENT_PASSWORD_INCORRECT", MESSAGES.passwordWrong); }
      }
      const refused = refusal(type, body.value ?? "") ?? mock.refusals[type];
      if (refused) return fail(refused.status, refused.code, refused.message);
      const value = normalize(type, body.value)!;
      if (!code) return fail(403, "STEP_UP_REQUIRED", "Vui lòng nhập mã xác thực để xác nhận thao tác này.", {
        challenge_id: `step-up-${++next}`, action: "IDENTIFIER_CHANGE",
        summary: `${type === "PHONE" ? "Đổi số điện thoại đăng nhập sang " : "Đổi Email cá nhân sang "}${value}`,
        method: "AUTHENTICATOR", expires_at: at(now + TTL_MS) });
      // One pending value per type: a new request replaces the previous one.
      sessions.forEach(session => { if (session.type === type && session.status === "PENDING") session.status = "CANCELLED"; });
      const session: Session = { id: `otp-${++next}`, identifierId: `pending-${type.toLowerCase()}-${next}`, type, value,
        channel: type === "EMAIL" ? "EMAIL" : body.otp_channel ?? "SMS", sentAt: now, attempts: 0, version: 1, status: "PENDING" };
      sessions.set(session.id, session);
      return send(started(session), 202, "Đã gửi mã xác thực.");
    }

    const pending = [...sessions.values()].reverse().find(session => session.identifierId === change[2]);
    if (!pending || pending.status === "CANCELLED")
      return fail(404, "IDENTIFIER_CHANGE_NOT_FOUND", `Không tìm thấy yêu cầu đổi ${label} đang chờ xác minh.`);
    if (change[3] === "cancel") {
      mock.cancelled.push(pending.identifierId);
      sessions.forEach(session => { if (session.identifierId === pending.identifierId) session.status = "CANCELLED"; });
      return send(null, 200, "Đã hủy yêu cầu.");
    }
    if (change[3] === "resend") {
      if (pending.sentAt + COOLDOWN_MS > now)
        return fail(400, "OTP_RESEND_TOO_SOON", `Bạn chờ ${Math.ceil((pending.sentAt + COOLDOWN_MS - now) / 1000)} giây nữa rồi gửi lại mã nhé.`);
      // A new code; the old one dies.
      pending.status = "CANCELLED";
      const renewed: Session = { ...pending, id: `otp-${++next}`, sentAt: now, attempts: 0, version: 1, status: "PENDING" };
      sessions.set(renewed.id, renewed);
      return send(started(renewed), 202, "Đã gửi lại mã xác thực.");
    }
    if (change[3] === "confirm") {
      const session = sessions.get(body.challenge_id);
      if (!session || session.status !== "PENDING") return fail(400, "OTP_CHALLENGE_INVALID", "Mã OTP không hợp lệ hoặc đã hết hạn.");
      if (session.sentAt + TTL_MS <= now) return fail(400, "OTP_EXPIRED", "Mã OTP không hợp lệ hoặc đã hết hạn.");
      if (body.otp_code !== OTP_CODE) {
        session.attempts++;
        const remaining = MAX_ATTEMPTS - session.attempts;
        if (!remaining) session.status = "BLOCKED";
        return fail(400, remaining ? "OTP_INCORRECT" : "OTP_ATTEMPTS_EXCEEDED",
          remaining ? `Mã OTP không đúng. Bạn còn ${remaining} lần nhập.` : MESSAGES.otpExceeded,
          { remaining_attempts: remaining, max_attempts: MAX_ATTEMPTS });
      }
      session.status = "VERIFIED";
      // The value in use is revoked; an email left unverified at sign-up was only a reservation.
      const previous = profile.identifiers.some(item => item.type === type && (type === "PHONE" || item.verified));
      profile.identifiers = [...profile.identifiers.filter(item => item.type !== type),
        { id: session.identifierId, type, value: session.value, verified: true }];
      return send({ identifier_id: session.identifierId, type, value: session.value, replaced_previous: previous,
        other_sessions_signed_out: mock.signedOut }, 200, "Đã cập nhật thông tin đăng nhập.");
    }
    return route.fallback();
  });
  return mock;
}

/* ---- Steps ---- */

const TITLES = { PHONE: { change: "Đổi số điện thoại", add: "Thêm số điện thoại" }, EMAIL: { change: "Đổi email", add: "Thêm email" } };
export const changeDialog = (page: Page, type: Type, action: "change" | "add" = "change") =>
  page.getByRole("dialog", { name: TITLES[type][action] });
export const valueInput = (page: Page) => page.locator("#identifier-change-value");
export const passwordInput = (page: Page) => page.locator("#identifier-change-password");
export const sendButton = (page: Page) => page.getByRole("button", { name: "Gửi mã OTP", exact: true });
export const stepUpDialog = (page: Page) => page.getByRole("dialog", { name: "Xác nhận thao tác" });
export const stepUpInput = (page: Page) => page.locator("#step-up-code");
export const codeInput = (page: Page) => page.locator("#identifier-change-code");

/** On the open profile, clicks "Đổi …" or "Thêm …" and waits for the dialog's empty form. */
export async function openChange(page: Page, type: Type, action: "change" | "add" = "change") {
  await page.getByRole("button", { name: TITLES[type][action], exact: true }).click();
  await changeDialog(page, type, action).waitFor();
  await valueInput(page).waitFor();
  await dialogImages(page);
  await page.mouse.move(0, 0);
}

/** The pictures of the open dialogs (the SMS and Zalo marks) have arrived. */
export async function dialogImages(page: Page) {
  await page.waitForFunction(() => Array.from(document.querySelectorAll("dialog img"))
    .every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0));
}

/** Types the new value and waits for the server's check: its refusal under the field, or none. */
export async function typeValue(page: Page, value: string, problem?: string) {
  await valueInput(page).fill(value);
  if (problem) await page.locator("#identifier-change-value-problem").getByText(problem, { exact: true }).waitFor();
}

/** Fills the form (value, password when asked) and waits until "Gửi mã OTP" can be pressed. */
export async function fillForm(page: Page, value: string, password: string | null = PASSWORD) {
  await typeValue(page, value);
  if (password !== null) await passwordInput(page).fill(password);
  await waitEnabled(sendButton(page));
  await page.mouse.move(0, 0);
}

/** Presses "Gửi mã OTP" and waits for the step-up dialog. */
export async function sendForCode(page: Page) {
  await sendButton(page).click();
  await stepUpInput(page).waitFor();
  await page.mouse.move(0, 0);
}

export async function typeStepUp(page: Page, code = STEP_UP_CODE) {
  await stepUpInput(page).pressSequentially(code);
}

/** Confirms the step-up code and waits for the code step of the new value, its session loaded. */
export async function confirmStepUp(page: Page) {
  await stepUpDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
  await waitCodeStep(page);
}

export async function waitCodeStep(page: Page) {
  await codeInput(page).waitFor();
  await page.getByRole("timer").or(page.getByText("Chưa nhận được mã?")).first().waitFor();
  await dialogImages(page);
  await page.mouse.move(0, 0);
}

export async function submitCode(page: Page, code = OTP_CODE) {
  await codeInput(page).pressSequentially(code);
  await page.getByRole("button", { name: "Xác thực", exact: true }).click();
}

/** The success modal of a confirmed change. */
export const successModal = (page: Page) => page.getByRole("alertdialog", { name: "Thành công" });
export async function success(page: Page, message: string) {
  await successModal(page).getByText(message, { exact: true }).waitFor();
  await page.mouse.move(0, 0);
}

/** Acknowledges the success modal and waits for the profile to show `value`. */
export async function backToProfile(page: Page, value: string) {
  await successModal(page).getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await successModal(page).waitFor({ state: "hidden" });
  await page.locator(`input[readonly][value="${value}"]`).waitFor();
  await page.mouse.move(0, 0);
}
