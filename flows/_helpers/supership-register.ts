// Shared steps of the Shop registration screen (SuperShip Web, /register).
// Labels come from features/auth/components/RegisterForm.tsx and OtpChannelDialog.tsx.
import type { Page } from "playwright";
import { waitEnabled } from "./wait";

/** The OTP and MFA code the backend's dev profile always accepts. */
export const DEV_OTP = "515060";

/**
 * Fills the whole form with the app's own dev helper ("Tự điền dữ liệu mẫu"), which also picks a real
 * region from the catalog, then ticks the terms. Each call produces a new phone, email and shop name.
 */
export async function fillRegisterForm(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Tự điền dữ liệu mẫu" }).click();
  await page.waitForFunction(() => (document.querySelector<HTMLInputElement>("#shopName")?.value ?? "") !== "");
  await page.getByRole("button", { name: "Tự điền dữ liệu mẫu" }).waitFor();
  await page.getByRole("checkbox").check();
}

/**
 * Submits the form and waits for the channel dialog to be ready, captcha included. With Cloudflare's
 * test sitekey the captcha passes by itself; with a real sitekey someone has to tick it in a
 * `--headed` browser, so give `captchaTimeoutMs` enough room for that.
 */
export async function openOtpChannelDialog(page: Page, captchaTimeoutMs = 20_000): Promise<void> {
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await page.getByRole("radio", { name: "Tin nhắn SMS" }).waitFor();
  await waitEnabled(page.getByRole("button", { name: "Nhận mã OTP", exact: true }), captchaTimeoutMs);
}

export async function requestOtp(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Nhận mã OTP", exact: true }).click();
  await otpInput(page).waitFor();
  // The resend countdown appears once the OTP session has been read.
  await page.getByText(/gửi lại/i).first().waitFor();
}

export const otpInput = (page: Page) => page.getByRole("textbox", { name: /Nhập mã xác thực OTP/ });

export async function submitOtp(page: Page, code: string = DEV_OTP): Promise<void> {
  await otpInput(page).fill(code);
  await page.getByRole("button", { name: "Xác minh", exact: true }).click();
  await page.getByRole("heading", { name: "Thành công", exact: true }).waitFor();
}

/**
 * Answers the registration endpoints in the browser, so the flow creates no account and uses none of
 * the daily OTP quota. Everything else (region catalog, captcha) still goes to the real services.
 */
export async function mockRegisterApi(page: Page): Promise<void> {
  const sessionId = "capture-registration";
  const ok = (body: unknown) => ({ status: 200, json: { error: false, message: null, data: body } });
  const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

  await page.route(/\/v1\/(auth\/register|otp-sessions)(\/|$|\?)/, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/v1/auth/register/availability")) {
      return route.fulfill(ok({ phone_error: null, email_error: null }));
    }
    if (pathname.endsWith("/v1/auth/register")) {
      return route.fulfill(ok({
        challenge_id: sessionId, expires_at: inMinutes(5), resend_available_at: inMinutes(3),
        next_action: "VERIFY_PHONE", identity_id: "capture-identity", org_code: "capture-shop",
        attempt_count: 0, max_attempts: 5,
      }));
    }
    if (pathname.endsWith(`/v1/otp-sessions/${sessionId}`)) {
      return route.fulfill(ok({
        otp_session_id: sessionId, challenge_id: sessionId, status: "PENDING", channel: "SMS",
        masked_destination: "09*****000", expires_at: inMinutes(5), resend_available_at: inMinutes(3),
        version: 1, remaining_attempts: 5, resends_remaining: 1, channel_changes_remaining: 1,
        available_channels: [
          { channel: "SMS", masked_destination: "09*****000" },
          { channel: "ZALO", masked_destination: "09*****000" },
        ],
      }));
    }
    if (pathname.endsWith("/v1/auth/register/verify")) {
      return route.fulfill(ok({
        identity_id: "capture-identity", identity_status: "ACTIVE", organization_id: "capture-organization",
        org_code: "capture-shop", next_action: "LOGIN",
      }));
    }
    // An endpoint this mock does not know must fail loudly instead of reaching the backend.
    return route.fulfill({ status: 501, json: { error: true, message: `Chưa mock: ${pathname}`, data: null } });
  });
}
