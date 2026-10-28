import type { Page } from "playwright";
import { defineFlow, type FlowContext } from "../../capture";
import { CONSENT_TEXT, fakeCamera, filmSide } from "./superplatform-identity-document";
import { DEV_OTP, OtpSessionMock, isFailure } from "./otp-session";
import { mockTurnstile } from "./turnstile";

/*
 * "Quên mật khẩu" of an account linked with an internal company (LUỒNG QUÊN MẬT KHẨU PHÍA NỘI BỘ 2.1.1), against an
 * in-browser stand-in of the backend, all on /forgot-password: the identifier and citizen ID number (typed, read from
 * the card's QR code or from a photo of the card front), the identity found to confirm, the face when a linked company
 * requires it, the channel and the OTP to the verified phone, then the new password; the login page then says every
 * session was signed out.
 */

export const RESET_URL = "/forgot-password";
/** Nguyễn Minh Anh of the dev seed: company email, verified phone 0938 274 516. */
export const IDENTIFIER = "anh.nm@supership.vn";
export const FULL_NAME = "Nguyễn Minh Anh";
export const MASKED_PHONE = "093 ••• 4516";
/** The OTP destination as OtpChallengeService masks it. */
export const OTP_DESTINATION = "***4516";
export const CITIZEN_ID = "001194004827";
/** The number printed on the card the fake camera films (superplatform-identity-document.ts). */
export const CARD_NUMBER = "079194000482";
/** What the QR code of that card says: number|old number|name|birth|gender|address|issued. */
const CARD_QR = `${CARD_NUMBER}||Nguyễn Minh Anh|17081994|Nữ|45 Nguyễn Trãi, Phường Sài Gòn, Thành phố Hồ Chí Minh|12042021`;
export const PASSWORD = "SuperShip@2026";
export { DEV_OTP };
const START = Date.parse("2026-10-22T09:00:00+07:00");
const at = (seconds: number) => new Date(START + seconds * 1000).toISOString();

/** Exact sentences of InternalResetIdentification, InternalResetCardNumber, InternalResetFaceStep and OtpChallengeService. */
export const MESSAGES = {
  citizenId: "Số căn cước gồm 12 chữ số.",
  mismatch: "Thông tin không khớp.",
  noDocument: "Bạn chưa có giấy tờ định danh được duyệt. Liên hệ Quản trị hệ thống của công ty.",
  cardUnread: "Chưa đọc được số trên thẻ. Hãy chụp lại rõ hơn hoặc nhập số căn cước.",
  otpWrong: (left: number) => `Mã OTP không đúng. Bạn còn ${left} lần nhập.`,
  otpBlocked: "Bạn đã nhập sai quá số lần cho phép. Hãy yêu cầu mã OTP mới.",
  passed: "Xác minh thành công.",
  retry: "Đưa khuôn mặt vào giữa khung, ra chỗ đủ sáng rồi chụp lại.",
  faceMismatch: (left: number) => `Khuôn mặt không khớp, còn ${left} lần thử.`,
  stopped: "Không xác minh được khuôn mặt. Hãy liên hệ Quản trị hệ thống của công ty để được hỗ trợ.",
  unavailable: "Xác minh khuôn mặt chưa sẵn sàng. Hãy liên hệ Quản trị hệ thống của công ty để đặt lại mật khẩu.",
  locked: "Xác minh khuôn mặt tạm khóa tới 09:30 ngày 22/10. Hãy liên hệ Quản trị hệ thống của công ty.",
  reverify: "Bạn cần xác thực lại căn cước. Hãy liên hệ Quản trị hệ thống của công ty.",
  /** session-expired-notice.ts, reason "password-set". */
  passwordSet: "Mọi phiên đăng nhập đã được đăng xuất. Hãy đăng nhập lại bằng mật khẩu mới.",
};
/** InternalResetFaceStep.FAILURES_PER_FLOW: three wrong faces end the flow. */
const FACE_TRIES = 3;

type Next = "CONFIRM_IDENTITY" | "EKYC_CONSENT" | "EKYC_CAPTURE" | "EKYC_UNAVAILABLE" | "CHOOSE_OTP_CHANNEL" | "ENTER_OTP"
  | "SET_NEW_PASSWORD" | "STOPPED" | "DONE";
type Face = "PASSED" | "RETRY" | "FAILED";
interface Refusal { status: number; code: string; message: string }
export interface ResetMock {
  /** Answer of "Tiếp tục" on the first step; the flow starts when none. */
  startRefusal: Refusal | null;
  /** Whether a linked company asks for the face. */
  faceRequired: boolean;
  consent: boolean;
  /** Overrides the face step with a closed one (unavailable, locked, card to verify again). */
  closed: { reason: string; message: string } | null;
  /** Answers of the next photos, in order; PASSED once empty. */
  faces: Face[];
  failures: number;
  /** Answers of the next card front photos, in order: false cannot be read; read once empty. */
  cardReads: boolean[];
  /** The citizen ID number sent with the identifier. */
  citizenId: string | null;
  /** The new password saved at the end. */
  password: string | null;
}
export interface ResetContext extends FlowContext { mock: ResetMock }

export function resetFlow(id: string, name: string, run: (ctx: ResetContext) => Promise<void>, setup: Partial<ResetMock> = {}) {
  return defineFlow({ id: `superplatform-quen-mat-khau-${id}`, name, app: "superplatform",
    group: ["SUPERPLATFORM", "QUÊN MẬT KHẨU NỘI BỘ"],
    async run(ctx) {
      const mock: ResetMock = { startRefusal: null, faceRequired: true, consent: false, closed: null, faces: [], failures: 0,
        cardReads: [], citizenId: null, password: null, ...setup };
      await mockReset(ctx.page, ctx.log, mock);
      await run({ ...ctx, mock });
    },
  });
}

/** The browser reads the card's QR code once `window.__ffcQr` holds its text (BarcodeDetector stand-in). */
async function fakeQrDetector(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__ffcQr = null;
    w.BarcodeDetector = class {
      static async getSupportedFormats() { return ["qr_code"]; }
      async detect() { return w.__ffcQr ? [{ rawValue: String(w.__ffcQr) }] : []; }
    };
  });
}

async function mockReset(page: Page, log: (line: string) => void, mock: ResetMock) {
  await page.clock.setFixedTime(START);
  await mockTurnstile(page, "hidden");
  await fakeCamera(page);
  await fakeQrDetector(page);
  const otp = new OtpSessionMock("otp-reset", OTP_DESTINATION, () => START);
  let next: Next = "CONFIRM_IDENTITY";
  const otpView = () => {
    const snapshot = otp.snapshot();
    return { otp_session_id: snapshot.otp_session_id, channel: snapshot.channel, masked_destination: snapshot.masked_destination,
      expires_at: snapshot.expires_at };
  };
  const afterIdentity = (): Next =>
    !mock.faceRequired ? "CHOOSE_OTP_CHANNEL" : mock.closed ? "EKYC_UNAVAILABLE" : mock.consent ? "EKYC_CAPTURE" : "EKYC_CONSENT";
  const state = () => {
    const face = next === "EKYC_CONSENT" || next === "EKYC_CAPTURE";
    return {
      next_action: next,
      reason_code: next === "EKYC_UNAVAILABLE" ? mock.closed?.reason ?? null : next === "STOPPED" ? "EKYC_STOPPED" : null,
      message: next === "EKYC_UNAVAILABLE" ? mock.closed?.message ?? null : next === "STOPPED" ? MESSAGES.stopped : null,
      remaining_attempts: face ? FACE_TRIES - mock.failures : null,
      consent: next === "EKYC_CONSENT" ? { version: "2026-10", text: CONSENT_TEXT, digest: "capture-digest" } : null,
      face_scan_available: false,
      otp_channels: next === "CHOOSE_OTP_CHANNEL" ? ["SMS", "ZALO"] : [],
      otp: next === "ENTER_OTP" ? otpView() : null,
      masked_phone: next === "CHOOSE_OTP_CHANNEL" ? MASKED_PHONE : null,
      person: next === "CONFIRM_IDENTITY"
        ? { full_name: FULL_NAME, masked_phone: MASKED_PHONE, masked_citizen_id: `••••••••${(mock.citizenId ?? CITIZEN_ID).slice(-4)}` }
        : null,
      face_step: next === "CONFIRM_IDENTITY" && mock.faceRequired,
      minimum_length: next === "SET_NEW_PASSWORD" ? 8 : null,
      maximum_bytes: next === "SET_NEW_PASSWORD" ? 72 : null,
      expires_at: at(600),
    };
  };
  const seen = new Set<string>();
  await page.context().route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/backend/, "");
    const method = request.method();
    const send = (data: unknown, status = 200, message = "") => route.fulfill({ status,
      headers: { "X-Browser-Session-Version": "1" }, json: { error: status >= 400, message, data } });
    const refuse = (status: number, code: string, message: string, extra: object = {}) => send({ code, ...extra }, status, message);
    const reset = "/v1/auth/internal-password-reset";

    if (path === "/v1/public/apps/current") return send({ id: "app-superplatform", code: "SUPERPLATFORM", name: "SuperPlatform",
      status: "ACTIVE" });
    if (path === "/v1/public/ekyc/face-modes") return send({ manual: true, auto: true });
    if (path === "/v1/auth/password-policy") return send({ minimum_length: 8, maximum_bytes: 72, rules: [
      { code: "MIN_LENGTH", label: "Ít nhất 8 ký tự" }, { code: "UPPERCASE", label: "Có chữ in hoa" },
      { code: "NUMBER", label: "Có chữ số" }, { code: "SPECIAL_CHARACTER", label: "Có ký tự đặc biệt" },
      { code: "NO_PERSONAL_INFO", label: "Không chứa họ tên, số điện thoại, Email của bạn" },
      { code: "NOT_COMMON", label: "Không phải mật khẩu quá phổ biến" }, { code: "NOT_RECENT", label: "Khác 5 mật khẩu gần nhất" },
    ] });

    /* ---- /forgot-password ---- */
    if (path === `${reset}/card-number`) {
      if (mock.cardReads.shift() === false) return refuse(422, "INTERNAL_RESET_CARD_UNREADABLE", MESSAGES.cardUnread);
      return send({ citizen_id: CARD_NUMBER });
    }
    if (path === `${reset}/start`) {
      if (mock.startRefusal) return refuse(mock.startRefusal.status, mock.startRefusal.code, mock.startRefusal.message);
      mock.citizenId = request.postDataJSON().citizen_id;
      next = "CONFIRM_IDENTITY";
      return send({ flow_token: "capture-flow-token", state: state() });
    }
    if (path === `${reset}/state`) return send(state());
    if (path === `${reset}/confirm-identity`) { next = afterIdentity(); return send(state()); }
    if (path === `${reset}/consent`) { next = "EKYC_CAPTURE"; return send(state()); }
    if (path === `${reset}/ekyc-attempts`) {
      const face = mock.faces.shift() ?? "PASSED";
      if (face === "PASSED") { next = "CHOOSE_OTP_CHANNEL"; return send({ result: "PASSED", message: MESSAGES.passed, state: state() }); }
      if (face === "RETRY") return send({ result: "RETRY", message: MESSAGES.retry, state: state() });
      mock.failures++;
      if (mock.failures >= FACE_TRIES) { next = "STOPPED"; return send({ result: "STOPPED", message: MESSAGES.stopped, state: state() }); }
      return send({ result: "FAILED", message: MESSAGES.faceMismatch(FACE_TRIES - mock.failures), state: state() });
    }
    if (path === `${reset}/otp`) { otp.start(request.postDataJSON().otp_channel ?? "SMS"); next = "ENTER_OTP"; return send(state()); }
    if (path === `${reset}/verify`) {
      const failure = otp.verify(request.postDataJSON().otp_code);
      if (failure) return refuse(failure.status, failure.code, failure.message, failure.extra);
      next = "SET_NEW_PASSWORD";
      return send(state());
    }
    if (path === `${reset}/new-password`) {
      mock.password = request.postDataJSON().new_password;
      next = "DONE";
      return send({ signed_out_sessions: 3 });
    }
    if (path === `/v1/otp-sessions/${otp.id}`) return send(otp.snapshot());
    if (path === "/v1/otp-sessions/delivery") {
      const delivered = otp.deliver(request.postDataJSON());
      return isFailure(delivered) ? refuse(delivered.status, delivered.code, delivered.message) : send(delivered);
    }

    /* ---- Login page, after the new password ---- */
    if (path === "/v1/auth/passkey/options/autofill") return send({ available: false });
    if (path === "/v1/auth/qr-login/settings") return send({ enabled: true, phone_approval: true, poll_interval_ms: 2000 });
    if (path.startsWith("/v1/me")) return refuse(401, "SESSION_MISSING", "Phiên đăng nhập không tồn tại.");
    const call = `${method} ${path}`;
    if (!seen.has(call)) { seen.add(call); log(`chưa giả lập: ${call}`); }
    return refuse(404, "CAPTURE_UNMOCKED", call);
  });
}

/* ---- Nhập thông tin ---- */

export const continueButton = (page: Page) => page.getByRole("button", { name: "Tiếp tục", exact: true });
export const heading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true }).waitFor();
/** The open dialog: a form in a "dialog", a notice in an "alertdialog". */
export const dialog = (page: Page) => page.getByRole("dialog").or(page.getByRole("alertdialog")).last();
/** The sign-in page, where "Quên mật khẩu?" starts every flow of this group. */
export async function openSignIn(page: Page) {
  await page.goto("/");
  await heading(page, "Đăng nhập");
  await forgotLink(page).waitFor();
}
export const forgotLink = (page: Page) => page.getByRole("link", { name: "Quên mật khẩu?", exact: true });
/** "Quên mật khẩu?" on the sign-in page, up to the empty first step. */
export async function clickForgot(page: Page) {
  await forgotLink(page).click();
  await page.waitForURL(url => url.pathname === RESET_URL);
  await heading(page, "Quên mật khẩu");
  await page.locator("#citizen-id").waitFor();
}
/** From the sign-in page through "Quên mật khẩu?", without pictures. */
export async function openReset(page: Page) {
  await openSignIn(page);
  await clickForgot(page);
}
export async function fillIdentity(page: Page, citizenId = CITIZEN_ID) {
  await page.locator("#identifier").fill(IDENTIFIER);
  await page.locator("#citizen-id").fill(citizenId);
}
/** "Quét mã QR trên căn cước": the back camera films the card back. */
export async function openQrScanner(page: Page) {
  await page.getByRole("button", { name: "Quét mã QR trên căn cước", exact: true }).click();
  await filmSide(page, "BACK");
  await dialog(page).getByText("Đưa mã QR vào khung").waitFor();
}
/** The scanner reads the code: the dialog closes with the number in the field. */
export async function readQr(page: Page) {
  await page.evaluate((text) => { (window as unknown as Record<string, unknown>).__ffcQr = text; }, CARD_QR);
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.evaluate(() => { (window as unknown as Record<string, unknown>).__ffcQr = null; });
}
/** "Chụp mặt trước thẻ" with the card front under the back camera, up to the photo taken. */
export async function photographCardFront(page: Page, open = true) {
  if (open) await page.getByRole("button", { name: "Chụp mặt trước thẻ", exact: true }).and(page.locator(":enabled")).click();
  await filmSide(page, "FRONT");
  await dialog(page).getByRole("button", { name: "Chụp mặt trước", exact: true }).click();
  await dialog(page).getByRole("img", { name: "Ảnh mặt trước căn cước" }).waitFor();
}
export const useCardPhoto = (page: Page) => dialog(page).getByRole("button", { name: "Dùng ảnh này", exact: true }).click();

/* ---- Xác nhận thông tin ---- */

/** The identifier and citizen ID number, then "Tiếp tục", up to "Xác nhận thông tin". */
export async function submitIdentity(page: Page) {
  await fillIdentity(page);
  await continueButton(page).click();
  await heading(page, "Xác nhận thông tin");
}
export const confirmButton = (page: Page) => page.getByRole("button", { name: "Đúng thông tin, tiếp tục", exact: true });
/** From the empty page through "Đúng thông tin, tiếp tục". */
export async function identify(page: Page) {
  await openReset(page); await submitIdentity(page);
  await confirmButton(page).click();
}

/* ---- Xác thực khuôn mặt ---- */

export const consentBox = (page: Page) => page.getByRole("checkbox", { name: "Tôi đồng ý xác thực khuôn mặt" });
export const startFaceButton = (page: Page) => page.getByRole("button", { name: "Bắt đầu xác thực", exact: true });
export async function startFace(page: Page) {
  if (await consentBox(page).isVisible()) await consentBox(page).check();
  await startFaceButton(page).click();
  await waitCamera(page);
}
export async function waitCamera(page: Page) {
  await page.getByRole("button", { name: "Chụp", exact: true }).and(page.locator(":enabled")).waitFor();
}
export async function takeFace(page: Page) {
  await waitCamera(page);
  await page.getByRole("button", { name: "Chụp", exact: true }).click();
  await page.getByRole("img", { name: "Ảnh vừa chụp" }).waitFor();
}
export async function sendFace(page: Page) {
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
}
/** From the empty page through the identity and the consent, to the camera. */
export async function reachFace(page: Page) {
  await identify(page);
  await heading(page, "Xác thực khuôn mặt");
  await startFace(page);
}

/* ---- Nhập mã OTP ---- */

export const sendCodeButton = (page: Page) => page.getByRole("button", { name: "Gửi mã", exact: true });
/** "Nhận mã OTP": picks the channel and sends the code to the verified phone. */
export async function sendOtp(page: Page, channel: "Tin nhắn SMS" | "Zalo" = "Tin nhắn SMS") {
  await heading(page, "Nhận mã OTP");
  await page.getByRole("radio", { name: new RegExp(channel) }).check();
  await sendCodeButton(page).click();
  await heading(page, "Nhập mã OTP");
}
/** Types the code in the six boxes (one hidden input under them). */
export async function typeOtp(page: Page, code = DEV_OTP) {
  await page.locator("#reset-otp").fill(code);
}
/** Closes the "Không thể tiếp tục" notice. */
export const closeNotice = (page: Page) => dialog(page).getByRole("button", { name: "Đã hiểu", exact: true }).click();
export async function confirmOtp(page: Page, code = DEV_OTP) {
  await typeOtp(page, code);
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
}
/** No face step: identity, channel, OTP, up to "Đặt mật khẩu mới". */
export async function reachNewPassword(page: Page) {
  await identify(page); await sendOtp(page); await confirmOtp(page);
  await heading(page, "Đặt mật khẩu mới");
}

/* ---- Đặt mật khẩu mới ---- */

export const setPasswordButton = (page: Page) => page.getByRole("button", { name: "Đặt mật khẩu mới", exact: true });
export async function fillPasswords(page: Page, password = PASSWORD, confirm = password) {
  await page.locator("#new-password").fill(password);
  await page.locator("#confirm-password").fill(confirm);
}
