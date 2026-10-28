import type { Page, Route } from "playwright";
import { MFA_CODE, PHONE, START, at, fill, loginFlow, openLogin, submit, type LoginContext, type LoginSetup } from "./superplatform-login";
import { OtpSessionMock, isFailure } from "./otp-session";

/*
 * The MFA asked right after a password sign-in, before the unit picker (ADR-017): /mfa/verify for an account with an
 * Authenticator, /mfa/enroll for one without. Answers on top of the sign-in stand-in of superplatform-login.ts:
 * recovery codes, the shared lock after five wrong codes, the reset with a recovery code, the passkey and the setup.
 * Messages are MfaUnitOfWork's, MfaController's and MfaVerificationPage's own.
 */

export const GROUP: [string, ...string[]] = ["SUPERPLATFORM", "ĐĂNG NHẬP", "XÁC THỰC HAI LỚP KHI ĐĂNG NHẬP"];
export const WRONG_MFA_CODE = "518060";
/** The recovery codes Trần Thu Hà saved when she set up her Authenticator (8 of 10 still unused). */
export const RECOVERY_CODES = ["K7QH-2MZP", "X4WN-6RTB", "3VJY-5LCD", "8GFA-E4SU", "N2PT-HB7K", "Q9XM-R3WE", "D6ZC-UJ4N", "T5LG-W8YA"];
export const WRONG_RECOVERY_CODE = "K7QH-2MZR";
/** The ten codes a new Authenticator comes with, shown once. */
export const NEW_RECOVERY_CODES = ["B3KD-7QWM", "H8TZ-4NXC", "R2VP-9LJE", "W6YF-3GSA", "M5CU-8KTH", "E7NB-2XQR", "P4JW-6ZDV",
  "S9LA-5HMF", "Y3GE-7RCN", "C8XT-4PUK"];
/** MFA_MAX_ATTEMPTS wrong codes within MFA_ATTEMPT_WINDOW lock every MFA path for MFA_LOCK_DURATION. */
export const MAX_ATTEMPTS = 5;
export const LOCK_SECONDS = 900;
const SECRET = "KZ7QH2MPXWNRTB3VJY5LCDGF6AE4SU2N";
const OTPAUTH = `otpauth://totp/SuperPlatform:Tr%E1%BA%A7n%20Thu%20H%C3%A0?secret=${SECRET}&issuer=SuperPlatform&algorithm=SHA1&digits=6&period=30`;
/** OTPAUTH drawn by ZXing as ZxingTotpQrCodeRenderer draws it (264 px, level M, margin 1). */
const QR_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAQgAAAEIAQAAAACLjVdSAAADcUlEQVR4Xu2YMY7jUAxDFbhImSP4JsnFAtjAv5hzk38Ely6CaPn4PVjsTjGtgN1fGInNAYYK" +
  "RVGO/OnE3ze+nX8NsUbETR8u+nY89in1fcnrK1vXp6kQomV+bu8ZRD8u+9SFXOdDD/nUKiF63G/rfH3tYrDd3nFcQIhVP+JWEOH7+dpjFrXscdmXqghdIjdJ" +
  "Ijfu+0cohkAfLfVNXDbRyBwF59NvBRVAuOdaF5dvl7PnqiB8WpcdJKyyS84IG5KcOgj+ZXVafvi/74E+Yhk+MQyuDCLzChfZgX1WZ4uYde8ddow6iPd83UQj" +
  "X1LKlcvx0EMcN0f3lUFIGol7aSKImNwLYWc89idfUXIVhKr+iWdcP2iBA8xDt/NzFEK8ufVkbD1nSwNh03Mq/T2sjyoIxtaqCzweu0Wc/BILJKl6FQQpgIl1" +
  "xyIoM1Miwo5LH9ZBnBargj/dafJe1T+cuz6uehXEYNClZBkXTcbQVTJQz0GyEKKNDDPGAhZhTTshKnwN/yiC0C4wuJAGJWz9gfaDCzROLkUQ6TxAEFwxs9aZ" +
  "tzju9NVzZRC01sSoZcBiFswuFfw55FIHQYaRz7rTbGaavGnNyCLMpQoCLhQchBP2wX00w8X6KIJwrnbPLRhDw8ekDwduNu46iDezoY0mc+M5fMXJpVVCIA+O" +
  "1y3rY3c8kD4uVnIdBBbr+4jYjrucgXb0XBnEjAw8ZWGy4GMOXzGzxBRCrGo7MhYTSw8nVmzLBU2756ogNFbRbzJqNQxgkLxt4+dgiamD0EN2aj1cOvGAFlwH" +
  "tXMrKIPQvA3GgpqMNQB3WMQFhHNXIQRN1l1wLAx9rCPBnvqogljxrCTDNFjxWmD8wcQrQfdcEYSGlZyAgk8oZUW/sGJTGPqogvDrycRiPWqDFrS32dZGz9VA" +
  "NBJ2Y91S4230HHkgKb2wg20NBJGVgo/D6pKeEixe23C6KojgFQBLIDBmF2ZmOJouhFgRRAOheCCLwC/sGMjDXKogfLzCWiQaFRtKxhjGYlgGsQY+xkPNrg87" +
  "YTLZ+CtnhDoIfPZGeP3i4qHreXumrTIICg4NjOuOPjCGkbXvg0sthMyMWtNk+NigMbbXUghdHLOpNVzYtL5sow4CfSQpIMJydoZBM2QYV70IQjLglpZtNV76" +
  "bSWR5nEOjUKIn85/xJ/nZ8QvvP6UvRZadJ4AAAAASUVORK5CYII=";

export const MESSAGES = {
  invalidCode: "Mã xác thực không đúng hoặc đã được sử dụng.",
  rateLimited: "Đã vượt giới hạn thử. Vui lòng chờ rồi thử lại.",
  /** MfaVerificationPage: a wrong recovery code, in place of the server's sentence. */
  invalidRecoveryCode: "Mã dự phòng không đúng hoặc đã được sử dụng. Kiểm tra lại hoặc thử một mã khác.",
  /** use-mfa-error: a running lock, in place of the server's sentence. */
  locked: (seconds = LOCK_SECONDS) => `Bạn đã thử quá nhiều lần. Có thể thử lại sau ${seconds} giây.`,
  otpRequired: "Vui lòng xác minh mã OTP gửi tới email hoặc số điện thoại trước khi đăng ký.",
  /** MfaEnrollmentService: too many wrong OTPs while setting up ends the sign-in. */
  enrollmentOtpExceeded: "Bạn đã nhập sai mã quá số lần nên lần đăng nhập bị hủy. Bạn đăng nhập lại để thử lần nữa.",
};

export interface MfaState {
  /** An active Authenticator; false for an account that has to set one up. */
  enrolled: boolean;
  /** Recovery codes not used yet. */
  recoveryCodes: string[];
  /** Wrong codes in a row, shared by the Authenticator code, the recovery code, the reset and the setup. */
  failures: number;
  /** The setup OTP was verified: the QR code may be issued. */
  otpVerified: boolean;
  signedOut: boolean;
}
export interface MfaContext extends LoginContext { mfa: MfaState }

/** Adds the MFA stand-in to a sign-in flow of another sub-Section (e.g. the notices of the login page). */
export async function withMfa(ctx: LoginContext, enrolled: boolean): Promise<MfaState> {
  const mfa: MfaState = { enrolled, recoveryCodes: [...RECOVERY_CODES], failures: 0, otpVerified: false, signedOut: false };
  await mockMfa(ctx, mfa);
  return mfa;
}

/** A flow of this group; the id gets "superplatform-dang-nhap-mfa-". */
export function mfaFlow(id: string, name: string, run: (ctx: MfaContext) => Promise<void>,
                        { enrolled = true, ...setup }: LoginSetup & { enrolled?: boolean } = {}) {
  return loginFlow(`mfa-${id}`, GROUP, name, async ctx => {
    const mfa = await withMfa(ctx, enrolled);
    await run({ ...ctx, mfa });
  }, setup);
}

type Reply = { status?: number; message?: string; data?: unknown };
const refusal = (status: number, message: string, code: string, extra: Record<string, unknown> = {}): Reply =>
  ({ status, message, data: { code, ...extra } });

async function mockMfa({ page, mock }: LoginContext, mfa: MfaState) {
  const otp = new OtpSessionMock("4c2e8f1a-7b3d-4e9a-a6c1-5d8b2f0e7a94", "091****035", () => START);
  const lock = () => refusal(429, MESSAGES.rateLimited, "MFA_RATE_LIMITED", { retry_after_seconds: LOCK_SECONDS });
  /** MfaUnitOfWork.wrongCode: the fifth wrong code in a row already answers with the lock. */
  const wrongCode = () => ++mfa.failures >= MAX_ATTEMPTS ? lock() : refusal(400, MESSAGES.invalidCode, "MFA_INVALID_CODE");
  const locked = () => mfa.failures >= MAX_ATTEMPTS;

  mock.on("GET", /^\/v1\/me(\/|$)/, () => mfa.signedOut ? refusal(401, "Phiên đăng nhập không tồn tại.", "SESSION_MISSING") : undefined);
  mock.on("DELETE", "/v1/me/sessions/current", () => {
    mfa.signedOut = true;
    return { message: "Đã đăng xuất.", data: { revoked_session_count: 1, revoked_context_count: 0 } };
  });
  mock.on("GET", "/v1/me/mfa", () => mfa.signedOut ? undefined : { data: { enrolled: mfa.enrolled,
    factor_status: mfa.enrolled ? "ACTIVE" : "NONE", recovery_codes_remaining: mfa.recoveryCodes.length,
    has_internal_membership: true, removal_allowed: false,
    enrollment_channels: [{ channel: "PHONE", masked_destination: "091****035" }, { channel: "EMAIL", masked_destination: "h***@supership.vn" }] } });
  // The right Authenticator code falls through to the sign-in stand-in, which marks this session verified.
  mock.on("POST", "/v1/me/mfa/verify", body => {
    if (locked()) return lock();
    if (body?.code === MFA_CODE) return undefined;
    if (mfa.recoveryCodes.includes(body?.code)) {
      mfa.recoveryCodes = mfa.recoveryCodes.filter(code => code !== body.code);
      return { message: "Xác thực hai lớp thành công.", data: { session_id: "login-session", assurance_level: 2,
        mfa_verified_at: at(0), mfa_access_expires_at: at(43200) } };
    }
    return wrongCode();
  });
  mock.on("POST", "/v1/me/mfa/reset", body => {
    if (locked()) return lock();
    if (body?.code !== MFA_CODE && !mfa.recoveryCodes.includes(body?.code)) return wrongCode();
    mfa.enrolled = false; mfa.recoveryCodes = []; mfa.otpVerified = false; mfa.failures = 0;
    return { message: "Đã đặt lại MFA và đăng xuất các thiết bị khác. Hãy thiết lập Authenticator mới ngay." };
  });
  mock.on("POST", "/v1/me/mfa/passkey/options", () => ({ message: "Tiếp tục trên thiết bị của bạn.", data: {
    challenge_id: "capture-mfa-challenge", expires_at: at(300),
    public_key: { challenge: "Y2FwdHVyZS1tZmEtY2hhbGxlbmdl", timeout: 300000, rpId: "localhost", userVerification: "required", allowCredentials: [] } } }));
  mock.on("POST", "/v1/me/mfa/passkey/verify", () => ({ message: "Đã xác thực.", data: { mfa_access_expires_at: at(43200) } }));

  /* ---- The setup: an OTP to a verified contact, the QR code, the first code, the recovery codes ---- */
  mock.on("POST", "/v1/me/mfa/enrollment/otp", body => {
    otp.start(body?.channel === "ZALO" ? "ZALO" : "SMS");
    return { message: "Đã gửi mã OTP xác minh.", data: { challenge_id: otp.id, channel: "PHONE", masked_destination: "091****035",
      expires_at: otp.expiresAt, resend_available_at: otp.resendAvailableAt } };
  });
  mock.on("GET", `/v1/otp-sessions/${otp.id}`, () => ({ data: otp.snapshot() }));
  mock.on("POST", "/v1/otp-sessions/delivery", body => {
    const result = otp.deliver(body);
    return isFailure(result) ? refusal(result.status, result.message, result.code, result.extra) : { message: "Đã gửi mã xác thực.", data: result };
  });
  mock.on("POST", "/v1/me/mfa/enrollment/otp/verify", body => {
    const failure = otp.verify(body?.otp_code);
    // MfaEnrollmentService: the last wrong code while still signing in ends that sign-in.
    if (failure?.code === "OTP_ATTEMPTS_EXCEEDED") {
      mfa.signedOut = true;
      return refusal(401, MESSAGES.enrollmentOtpExceeded, "SESSION_REVOKED", { reason: "MFA_ENROLLMENT_OTP_EXCEEDED" });
    }
    if (failure) return refusal(failure.status, failure.message, failure.code, failure.extra);
    mfa.otpVerified = true;
    return { message: "Xác minh OTP thành công.", data: { authorized_until: at(600) } };
  });
  mock.on("POST", "/v1/me/mfa/enrollment", () => {
    if (mfa.enrolled) return refusal(409, "Tài khoản đã đăng ký xác thực hai lớp.", "MFA_ALREADY_ENROLLED");
    if (!mfa.otpVerified) return refusal(403, MESSAGES.otpRequired, "MFA_ENROLLMENT_OTP_REQUIRED");
    return { message: "Đã tạo mã QR đăng ký xác thực hai lớp.", data: { enrollment_id: "8d3f6b2a-5c1e-4a7d-9b0f-2e6c4a8d1f57",
      otpauth_uri: OTPAUTH, qr_code_png_base64: QR_PNG, secret: SECRET, expires_at: at(600) } };
  });
  mock.on("POST", "/v1/me/mfa/enrollment/confirm", body => {
    if (locked()) return lock();
    if (body?.code !== MFA_CODE) return wrongCode();
    mfa.enrolled = true; mfa.recoveryCodes = [...NEW_RECOVERY_CODES]; mfa.failures = 0;
    return { message: "Đăng ký xác thực hai lớp thành công.", data: { factor_id: "f2b7c4e9-1a3d-4f6b-8c5e-7d9a0b2c4e61",
      activated_at: at(0), recovery_codes: NEW_RECOVERY_CODES } };
  });

  // A recovery code, a passkey and the first code of a new Authenticator prove MFA for this session as the
  // Authenticator code does: the sign-in stand-in learns it from its own verify call before the answer goes out.
  const proving = { "/v1/me/mfa/verify": (body: any) => mfa.recoveryCodes.includes(body?.code) && !locked(),
    "/v1/me/mfa/passkey/verify": () => true, "/v1/me/mfa/enrollment/confirm": (body: any) => body?.code === MFA_CODE && !locked() };
  for (const [path, proves] of Object.entries(proving)) {
    await page.route(url => url.pathname === `/api/backend${path}`, async (route: Route) => {
      if (inner(route) || route.request().method() !== "POST") return route.fallback();
      if (proves(route.request().postDataJSON())) await call(page, "POST", "/v1/me/mfa/verify", { code: MFA_CODE });
      return route.fallback();
    });
  }
  // Until an Authenticator is set up, the units of this account ask for one instead of its code.
  for (const [method, path] of [["POST", "/v1/sessions"], ["GET", "/v1/me/session"], ["GET", "/v1/me/memberships"]] as const) {
    await page.route(url => url.pathname === `/api/backend${path}`, async (route: Route) => {
      const request = route.request();
      if (inner(route) || request.method() !== method || mfa.enrolled || mfa.signedOut) return route.fallback();
      const response = await call(page, method, path, method === "POST" ? request.postDataJSON() : undefined).catch(() => null);
      if (!response) return route.fallback();
      const units = (list: unknown) => Array.isArray(list) ? list.map(unit => unit.next_action === "VERIFY_MFA" ? { ...unit, next_action: "ENROLL_MFA" } : unit) : list;
      const data = response.json?.data;
      const changed = Array.isArray(data) ? units(data) : data ? { ...data, available_memberships: units(data.available_memberships) } : data;
      return route.fulfill({ status: response.status, headers: { "X-Browser-Session-Version": "1" }, json: { ...response.json, data: changed } });
    });
  }
}

const INNER = "x-capture-inner";
const inner = (route: Route) => Boolean(route.request().headers()[INNER]);
/** The same call made again from the page, past the routes of this file, to the sign-in stand-in. */
async function call(page: Page, method: string, path: string, body: unknown) {
  return page.evaluate(async ({ method, path, body, header }) => {
    const response = await fetch(`/api/backend${path}`, { method, headers: { "Content-Type": "application/json", [header]: "1" },
      body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, json: await response.json() };
  }, { method, path, body, header: INNER });
}

/* ---- Steps ---- */

/** The sign-in page filled with the phone number, then "Đăng nhập" through to the MFA asked before the unit picker. */
export async function signInToMfa(page: Page, shot: LoginContext["shot"]) {
  await openLogin(page);
  await fill(page, PHONE);
  await shot("man-dang-nhap", "Nhập số điện thoại và mật khẩu");
  await submit(page);
  await page.getByRole("heading", { name: "Xác thực hai lớp", exact: true }).waitFor();
  await shot("mfa", "Nhập mã Authenticator trước khi chọn đơn vị");
}
export const codeInput = (page: Page) => page.getByRole("textbox", { name: "Mã xác thực" });
export const recoveryInput = (page: Page) => page.getByLabel("Mã dự phòng", { exact: true });
export async function typeCode(page: Page, code: string) {
  // The six boxes sit on one hidden input: emptied key by key, as a person does.
  await codeInput(page).focus();
  for (let i = 0; i < 6; i++) await codeInput(page).press("Backspace");
  await codeInput(page).pressSequentially(code);
}
export const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
/** Clicks a button, then moves the pointer away so no hover colour stays in the picture. */
export async function press(page: Page, name: string) {
  await button(page, name).click();
  await page.mouse.move(0, 0);
}
/** The error dialog of the MFA page, with its title and sentence. */
export async function failure(page: Page, title: string, message: string) {
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("heading", { name: title, exact: true }).waitFor();
  await dialog.getByText(message, { exact: true }).waitFor();
}
export async function closeFailure(page: Page) {
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
}
