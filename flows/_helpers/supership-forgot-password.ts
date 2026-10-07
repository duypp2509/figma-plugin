// Shared steps and a stand-in backend for the forgot-password screen (SuperShip Web, /forgot-password).
// Labels come from features/auth/components/ForgotPasswordForm.tsx and shared/components/OtpSessionActions.tsx.
// Error codes and messages are copied from the backend (PasswordResetUseCase, OtpChallengeService,
// OtpSessionService, OtpDeliveryPolicy in users-core-service), so the pictures show the real wording.
import type { Page, Route } from "playwright";
import { mockTurnstile } from "./turnstile";
import { waitEnabled } from "./wait";

/** The OTP the backend's dev profile always accepts; the stand-in backend accepts it too. */
export const DEV_OTP = "515060";
export const SAMPLE_PHONE = "0912345347";
export const SAMPLE_PASSWORD = "MatKhau@2026";

const OTP_TTL_SECONDS = 300;
const RESEND_COOLDOWN_SECONDS = 180;
const MAX_ATTEMPTS = 5;

export type Channel = "SMS" | "ZALO";
export const CHANNELS: readonly Channel[] = ["SMS", "ZALO"];
/** How each channel is called in titles, and the label of its radio in the channel dialog. */
export const CHANNEL_NAME: Record<Channel, string> = { SMS: "SMS", ZALO: "Zalo" };
const CHANNEL_RADIO: Record<Channel, string> = { SMS: "Tin nhắn SMS", ZALO: "Ứng dụng Zalo" };
export const otherChannel = (channel: Channel): Channel => channel === "SMS" ? "ZALO" : "SMS";
/** The parent Section that holds every forgot-password flow of one channel. */
export const groupName = (channel: Channel) => `QUÊN MẬT KHẨU - ĐẶT LẠI MẬT KHẨU DÙNG OTP QUA ${CHANNEL_NAME[channel].toUpperCase()}`;

type Endpoint = "check" | "validate-password" | "request" | "verify" | "confirm";

interface Failure {
  status: number;
  code: string;
  message: string;
}

/** Failures a flow can ask the stand-in backend for, with the backend's own wording. */
export const FAILURES = {
  accountNotFound: { status: 400, code: "PASSWORD_RESET_ACCOUNT_NOT_FOUND", message: "Số điện thoại này không tồn tại trong hệ thống." },
  sameAsCurrentPassword: { status: 400, code: "NEW_PASSWORD_SAME_AS_CURRENT", message: "Mật khẩu mới phải khác mật khẩu hiện tại." },
  dailyOtpLimit: { status: 429, code: "OTP_DAILY_LIMIT_EXCEEDED", message: "Bạn đã nhận nhiều mã trong hôm nay. Vui lòng thử lại sau." },
} as const satisfies Record<string, Failure>;

export interface PasswordResetMock {
  /** Makes the next call to this endpoint fail once. */
  failNext(endpoint: Endpoint, failure: Failure): void;
  /** Moves the page's clock and the stand-in backend forward together. */
  travel(seconds: number): Promise<void>;
}

/**
 * Freezes the page's clock and answers every password-reset and OTP-session endpoint in the browser,
 * keeping the session state the real backend keeps: one resend, one channel change, five attempts.
 * No account is touched and no OTP is sent. Captcha is replaced too.
 */
export async function mockPasswordReset(page: Page, phone = SAMPLE_PHONE): Promise<PasswordResetMock> {
  let now = Date.now();
  await page.clock.setFixedTime(now);
  await mockTurnstile(page);

  const sessionId = "capture-password-reset";
  const masked = `${phone.slice(0, 3)}${"*".repeat(4)}${phone.slice(-3)}`;
  const pending = new Map<Endpoint, Failure>();
  const session = {
    status: "PENDING", channel: "SMS" as Channel, version: 1, sentAt: now,
    attempts: 0, resends: 0, channelChanges: 0,
  };

  const iso = (millis: number) => new Date(millis).toISOString();
  const ok = (route: Route, data: unknown) => route.fulfill({ status: 200, json: { error: false, message: null, data } });
  const fail = (route: Route, failure: Failure, extra: Record<string, unknown> = {}) =>
    route.fulfill({ status: failure.status, json: { error: true, message: failure.message, data: { code: failure.code, ...extra } } });
  const expiresAt = () => session.sentAt + OTP_TTL_SECONDS * 1000;
  const snapshot = () => ({
    otp_session_id: sessionId, challenge_id: sessionId, status: session.status, channel: session.channel,
    masked_destination: masked, expires_at: iso(expiresAt()),
    resend_available_at: iso(session.sentAt + RESEND_COOLDOWN_SECONDS * 1000),
    version: session.version, remaining_attempts: MAX_ATTEMPTS - session.attempts,
    resends_remaining: 1 - session.resends, channel_changes_remaining: 1 - session.channelChanges,
    available_channels: [{ channel: "SMS", masked_destination: masked }, { channel: "ZALO", masked_destination: masked }],
  });
  const closed = { status: 400, code: "OTP_SESSION_CLOSED", message: "Phiên nhận mã đã kết thúc. Bạn nhận mã mới để tiếp tục nhé." };

  await page.route(/\/v1\/(auth\/password\/reset|otp-sessions)\//, async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;

    if (pathname.endsWith(`/v1/otp-sessions/${sessionId}`)) return ok(route, snapshot());

    if (pathname.endsWith("/v1/otp-sessions/delivery")) {
      if (session.status !== "PENDING" || expiresAt() <= now) return fail(route, closed);
      if (body.action === "RESEND") session.resends += 1;
      else { session.channelChanges += 1; session.channel = body.channel === "ZALO" ? "ZALO" : "SMS"; }
      session.version += 1;
      session.sentAt = now;
      return ok(route, snapshot());
    }

    const endpoint = pathname.split("/v1/auth/password/reset/")[1] as Endpoint | undefined;
    const failure = endpoint && pending.get(endpoint);
    if (endpoint && failure) {
      pending.delete(endpoint);
      return fail(route, failure);
    }

    switch (endpoint) {
      case "check":
        return ok(route, { minimum_length: 6, maximum_bytes: 72 });
      case "validate-password":
        return ok(route, {});
      case "request":
        Object.assign(session, {
          status: "PENDING", channel: body.otp_channel === "ZALO" ? "ZALO" : "SMS", version: 1, sentAt: now,
          attempts: 0, resends: 0, channelChanges: 0,
        });
        return ok(route, {
          challenge_id: sessionId, expires_at: iso(expiresAt()),
          resend_available_at: iso(session.sentAt + RESEND_COOLDOWN_SECONDS * 1000), next_action: "ENTER_OTP",
        });
      case "verify": {
        if (session.status !== "PENDING") return fail(route, closed);
        if (expiresAt() <= now) return fail(route, { status: 400, code: "OTP_EXPIRED", message: "Mã OTP không hợp lệ hoặc đã hết hạn." });
        if (body.otp_code === DEV_OTP) {
          session.status = "VERIFIED";
          return ok(route, { reset_token: "capture-reset-token", expires_at: iso(now + 600_000), next_action: "SET_PASSWORD" });
        }
        session.attempts += 1;
        const remaining = MAX_ATTEMPTS - session.attempts;
        if (remaining === 0) session.status = "BLOCKED";
        return fail(route, remaining === 0
          ? { status: 400, code: "OTP_ATTEMPTS_EXCEEDED", message: "Bạn đã nhập sai quá số lần cho phép. Hãy yêu cầu mã OTP mới." }
          : { status: 400, code: "OTP_INCORRECT", message: `Mã OTP không đúng. Bạn còn ${remaining} lần nhập.` },
        { remaining_attempts: remaining, max_attempts: MAX_ATTEMPTS });
      }
      case "confirm":
        return ok(route, { password_changed_at: iso(now), revoked_session_count: 1, revoked_context_count: 1 });
      default:
        // An endpoint this stand-in does not know must fail loudly instead of reaching the backend.
        return route.fulfill({ status: 501, json: { error: true, message: `Chưa mock: ${pathname}`, data: null } });
    }
  });

  return {
    failNext: (endpoint, failure) => { pending.set(endpoint, failure); },
    travel: async (seconds) => {
      now += seconds * 1000;
      await page.clock.setFixedTime(now);
      // The countdowns re-read the clock once a second.
      await page.waitForTimeout(1200);
    },
  };
}

export const phoneInput = (page: Page) => page.getByLabel("Số điện thoại", { exact: true });
export const newPasswordInput = (page: Page) => page.locator("#reset-new-password");
export const confirmPasswordInput = (page: Page) => page.locator("#reset-confirm-password");
export const otpInput = (page: Page) => page.getByRole("textbox", { name: /Nhập mã xác thực OTP/ });
export const continueButton = (page: Page) => page.getByRole("button", { name: "Tiếp tục", exact: true });
export const savePasswordButton = (page: Page) => page.getByRole("button", { name: "Lưu mật khẩu", exact: true });
export const confirmOtpButton = (page: Page) => page.getByRole("button", { name: "Xác nhận", exact: true });
/** The dialog on top: native dialogs make everything behind them inert. */
export const openDialog = (page: Page) => page.locator("dialog[open]").last();

const forgotPasswordLink = (page: Page) => page.getByRole("link", { name: "Quên mật khẩu?" });

/** The app's home ("/") sends a signed-out visitor to the login page, where every journey starts. */
export async function openHome(page: Page): Promise<void> {
  await page.goto("/");
  await forgotPasswordLink(page).waitFor();
}

/** Home → "Quên mật khẩu?" → the phone number step. Opens the home page first unless already there. */
export async function openForgotPassword(page: Page): Promise<void> {
  if (!new URL(page.url(), "http://x").pathname.startsWith("/login")) await openHome(page);
  // The link sits below the fold. With the captcha frame on the page, a click that also has to scroll
  // sometimes does not reach the link, so scroll first and click again if the page has not moved on.
  const heading = page.getByRole("heading", { name: "Quên mật khẩu" });
  for (let attempt = 0; attempt < 3 && !(await heading.isVisible()); attempt++) {
    await forgotPasswordLink(page).scrollIntoViewIfNeeded();
    await forgotPasswordLink(page).click();
    await heading.waitFor({ timeout: 8000 }).catch(() => undefined);
  }
  await heading.waitFor();
  await phoneInput(page).waitFor();
}

/** The first frame of every forgot-password flow. */
export const HOME_STEP = ["trang-chu", "Trang chủ - Đăng nhập"] as const;

/** Step 1 → 2: a registered phone number leads to the new-password form. */
export async function submitPhone(page: Page, phone = SAMPLE_PHONE): Promise<void> {
  await phoneInput(page).fill(phone);
  await waitEnabled(continueButton(page));
  await continueButton(page).click();
}

export async function fillNewPassword(page: Page, password = SAMPLE_PASSWORD, confirmation = password): Promise<void> {
  await newPasswordInput(page).waitFor();
  await newPasswordInput(page).fill(password);
  await confirmPasswordInput(page).fill(confirmation);
}

/** Step 2 → channel dialog: the password passes the server check and the dialog opens. */
export async function savePassword(page: Page): Promise<void> {
  await waitEnabled(savePasswordButton(page));
  await savePasswordButton(page).click();
}

export async function waitChannelDialog(page: Page): Promise<void> {
  await page.getByRole("radio", { name: "Tin nhắn SMS" }).waitFor();
  await waitEnabled(page.getByRole("button", { name: "Nhận mã OTP", exact: true }));
}

export async function selectChannel(page: Page, channel: Channel): Promise<void> {
  await page.getByRole("radio", { name: CHANNEL_RADIO[channel] }).check();
}

/** Channel dialog → OTP screen, with the session details loaded. */
export async function requestOtp(page: Page, channel: Channel = "SMS"): Promise<void> {
  await selectChannel(page, channel);
  await page.getByRole("button", { name: "Nhận mã OTP", exact: true }).click();
  await otpInput(page).waitFor();
  await page.getByRole("timer").waitFor();
}

/** The OTP screen names the channel the code went to in its heading. */
export async function waitOtpScreenFor(page: Page, channel: Channel): Promise<void> {
  await page.getByRole("heading", { name: CHANNEL_RADIO[channel], exact: true }).waitFor();
}

/** Enters the accepted code and waits for the success screen. */
export async function finishWithOtp(page: Page): Promise<void> {
  await submitOtp(page, DEV_OTP);
  await page.getByRole("heading", { name: "Đặt lại mật khẩu thành công" }).waitFor();
}

/** From a fresh page straight to the OTP screen. */
export async function goToOtpStep(page: Page, channel: Channel = "SMS"): Promise<void> {
  await openForgotPassword(page);
  await submitPhone(page);
  await fillNewPassword(page);
  await savePassword(page);
  await waitChannelDialog(page);
  await requestOtp(page, channel);
}

/**
 * Replaces whatever is in the code field. The field moves the caret to the end whenever it gains
 * focus, so `fill()` would append to the old code instead of replacing it; erase it key by key.
 */
export async function typeOtp(page: Page, code: string): Promise<void> {
  const input = otpInput(page);
  await input.focus();
  for (let remaining = (await input.inputValue()).length; remaining > 0; remaining--) await page.keyboard.press("Backspace");
  await input.pressSequentially(code);
}

export async function submitOtp(page: Page, code: string): Promise<void> {
  await typeOtp(page, code);
  await waitEnabled(confirmOtpButton(page));
  await confirmOtpButton(page).click();
}
