// Shared steps and a stand-in backend for the page a Shop member invitation link opens
// (SuperShip Web, /member-invitations/<token>) when the invited person has no account yet.
// Labels come from features/member-invitations/components/MemberInvitationLinkPage.tsx and
// features/invitation-signup (SignupForm, PhoneVerificationStep, copy.ts). Error codes and messages are
// copied from the backend (InvitationAccountSignup, InvitationSignupException, MemberInvitationExceptionHandler).
import type { Page, Route } from "playwright";
import { DEV_OTP, OtpSessionMock, isFailure, type OtpChannel, type OtpFailure } from "./otp-session";
import { mockTurnstile } from "./turnstile";
import { waitEnabled } from "./wait";

export { DEV_OTP };
export type Channel = OtpChannel;
export const CHANNELS: readonly Channel[] = ["SMS", "ZALO"];
export const CHANNEL_NAME: Record<Channel, string> = { SMS: "SMS", ZALO: "Zalo" };
const CHANNEL_RADIO: Record<Channel, string> = { SMS: "Tin nhắn SMS", ZALO: "Ứng dụng Zalo" };
export const otherChannel = (channel: Channel): Channel => channel === "SMS" ? "ZALO" : "SMS";

const FLOW_NAME = "CHẤP NHẬN LỜI MỜI THAM GIA SHOP (CHƯA CÓ TÀI KHOẢN)";
/** The parent Section that holds every flow of one OTP channel. */
export const groupName = (channel: Channel) => `${FLOW_NAME} - XÁC THỰC OTP QUA ${CHANNEL_NAME[channel].toUpperCase()}`;
export const OTHER_FAILURES_NAME = `${FLOW_NAME} - CÁC TRƯỜNG HỢP KHÁC`;

const TOKEN = "capture-invitation";
export const INVITED_PHONE = "0912345347";
export const INVITING_SHOP = "Cửa hàng Mộc Miên";
export const SAMPLE = {
  fullName: "Trần Ngọc Hân",
  email: "tranngochan@example.com",
  password: "MatKhau@2026",
  shopName: "Tiệm Nắng Mai",
  addressLine: "Số 12 đường Lê Lợi",
} as const;

type Endpoint = "signup" | "signup/resend" | "signup/complete" | "decline";

/** Failures a flow can ask the stand-in backend for, with the backend's own wording. */
export const FAILURES = {
  emailAlreadyUsed: {
    status: 409, code: "INVITATION_IDENTIFIER_ALREADY_USED",
    message: "Email này đã được dùng cho một tài khoản khác. Nếu đó là tài khoản của bạn, hãy đăng nhập.",
  },
  codeDeliveryFailed: { status: 503, code: "CODE_DELIVERY_FAILED", message: "Chưa gửi được mã xác thực. Vui lòng thử lại sau ít phút." },
  dailyOtpLimit: { status: 429, code: "OTP_DAILY_LIMIT_EXCEEDED", message: "Bạn đã nhận nhiều mã trong hôm nay. Vui lòng thử lại sau." },
  // The code was right, so the account and its Shop were created, but the invitation closed meanwhile.
  invitationClosedDuringSignup: {
    status: 410, code: "INVITATION_NO_LONGER_VALID",
    message: "Lời mời không còn hiệu lực. Vui lòng liên hệ người đã mời bạn để nhận lời mời mới.",
  },
} as const satisfies Record<string, OtpFailure>;

export interface InvitationMock {
  /** What the link shows when opened: an open invitation by default. */
  preview: { status: "PENDING" | "EXPIRED" | "CANCELLED" | "ACCEPTED" | "DECLINED"; accountState: "NEEDS_ACCOUNT" | "HAS_ACCOUNT" };
  /** Makes the next call to this endpoint fail once. */
  failNext(endpoint: Endpoint, failure: OtpFailure): void;
  /** Moves the page's clock and the stand-in backend forward together. */
  travel(seconds: number): Promise<void>;
}

/**
 * Freezes the page's clock at a fixed moment and answers every invitation and OTP-session endpoint in
 * the browser. No account or shop is created and no OTP is sent. Captcha is replaced too.
 */
export async function mockMemberInvitation(page: Page): Promise<InvitationMock> {
  // Frozen at the real time: Cloudflare's captcha widget refuses to verify on a clock that is off.
  let now = Date.now();
  await page.clock.setFixedTime(now);
  // The invitation runs out at 09:00 a week from today, so its date does not change between runs of a day.
  const expiry = new Date(now + 7 * 86_400_000);
  expiry.setHours(9, 0, 0, 0);
  await mockTurnstile(page);

  const masked = `${INVITED_PHONE.slice(0, 3)}${"*".repeat(4)}${INVITED_PHONE.slice(-3)}`;
  const session = new OtpSessionMock("capture-invitation-otp", masked, () => now);
  const pending = new Map<Endpoint, OtpFailure>();
  const preview: InvitationMock["preview"] = { status: "PENDING", accountState: "NEEDS_ACCOUNT" };

  const ok = (route: Route, data: unknown) => route.fulfill({ status: 200, json: { error: false, message: null, data } });
  const fail = (route: Route, failure: OtpFailure) =>
    route.fulfill({ status: failure.status, json: { error: true, message: failure.message, data: { code: failure.code, ...failure.extra } } });
  const codeSent = () => ({
    challenge_id: session.id, channel: "PHONE", masked_destination: masked,
    expires_at: session.expiresAt, resend_available_at: session.resendAvailableAt,
  });

  await page.route(/\/v1\/(public\/member-invitations|otp-sessions)\//, async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;

    if (pathname.endsWith(`/v1/otp-sessions/${session.id}`)) return ok(route, session.snapshot());
    if (pathname.endsWith("/v1/otp-sessions/delivery")) {
      const result = session.deliver(body);
      return isFailure(result) ? fail(route, result) : ok(route, result);
    }

    const endpoint = pathname.split("/v1/public/member-invitations/")[1];
    const failure = pending.get(endpoint as Endpoint);
    if (failure) {
      pending.delete(endpoint as Endpoint);
      return fail(route, failure);
    }

    switch (endpoint) {
      case "preview":
        return ok(route, {
          status: preview.status, account_state: preview.accountState, organization_name: INVITING_SHOP,
          inviter_name: "Nguyễn Minh An", role_names: ["Nhân viên bán hàng"],
          expires_at: expiry.toISOString(),
          locked_contact: { channel: "PHONE", value: INVITED_PHONE },
        });
      case "signup":
        session.start(body.otp_channel === "ZALO" ? "ZALO" : "SMS");
        return ok(route, codeSent());
      case "signup/resend":
        session.start("SMS");
        return ok(route, codeSent());
      case "signup/complete": {
        const wrong = session.verify(body.code);
        if (wrong) return fail(route, wrong);
        const shop = (body.shop ?? {}) as { shop_name?: string };
        return ok(route, {
          organization_name: INVITING_SHOP, login_identifier: INVITED_PHONE,
          own_shop_name: shop.shop_name ?? null, own_shop_code: "TN0001",
        });
      }
      case "decline":
        return ok(route, {});
      default:
        // An endpoint this stand-in does not know must fail loudly instead of reaching the backend.
        return route.fulfill({ status: 501, json: { error: true, message: `Chưa mock: ${pathname}`, data: null } });
    }
  });

  return {
    preview,
    failNext: (endpoint, failure) => { pending.set(endpoint, failure); },
    travel: async (seconds) => {
      now += seconds * 1000;
      await page.clock.setFixedTime(now);
      // The countdowns re-read the clock once a second.
      await page.waitForTimeout(1200);
    },
  };
}

export const fullNameInput = (page: Page) => page.getByPlaceholder("Nhập họ và tên");
export const emailInput = (page: Page) => page.getByPlaceholder("Nhập địa chỉ email");
export const passwordInput = (page: Page) => page.locator("#signup-password");
export const confirmPasswordInput = (page: Page) => page.locator("#signup-confirm-password");
export const continueButton = (page: Page) => page.getByRole("button", { name: "Tiếp tục", exact: true });
export const codeInput = (page: Page) => page.getByRole("textbox", { name: /^Mã xác thực/ });
export const joinButton = (page: Page) => page.getByRole("button", { name: "Xác nhận và tham gia", exact: true });
/** The dialog on top: native dialogs make everything behind them inert. */
export const openDialog = (page: Page) => page.locator("dialog[open]").last();

/** The open dialog that says `text`; a notice may sit on top of, or under, another dialog. */
export const dialogSaying = (page: Page, text: string | RegExp) => page.locator("dialog[open]").filter({ hasText: text }).last();

/**
 * The app reports an error (a wrong code, a field that is not valid, a refusal by the server) in a
 * notice the person has to acknowledge before going on. Waits for the one saying `message`.
 */
export async function waitErrorNotice(page: Page, message: string | RegExp): Promise<void> {
  await dialogSaying(page, message).getByRole("button", { name: "Đã hiểu" }).waitFor();
}

/** Acknowledges the notice saying `message`, so the form behind it can be used again. */
export async function dismissErrorNotice(page: Page, message: string | RegExp, timeoutMs?: number): Promise<void> {
  const notice = dialogSaying(page, message);
  await notice.getByRole("button", { name: "Đã hiểu" }).click({ timeout: timeoutMs });
  await notice.waitFor({ state: "detached" });
}

/** Opens the invitation link and waits for whatever it leads to: the signup form or an outcome. */
export async function openInvitation(page: Page): Promise<void> {
  await page.goto(`/member-invitations/${TOKEN}`);
  await page.getByText("Đang mở lời mời…").waitFor({ state: "detached" });
  await page.getByRole("heading").first().waitFor();
}

/** Picks the first province matching the search (or the first of the list) and its first ward. */
async function pickRegion(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Chọn khu vực" }).click();
  const dialog = openDialog(page);
  const options = dialog.locator("li button");
  await options.first().waitFor();
  await dialog.getByPlaceholder("Tìm kiếm").fill("Hồ Chí Minh");
  if (await options.count() === 0) await dialog.getByPlaceholder("Tìm kiếm").fill("");
  await options.first().click();
  await dialog.getByText("Chọn Phường/Xã").waitFor();
  await options.first().waitFor();
  await options.first().click();
  await page.locator("dialog[open]").waitFor({ state: "detached" });
}

/** Fills the account and shop details; the invited phone number is fixed by the invitation. */
export async function fillSignupForm(page: Page, overrides: { email?: string; confirmPassword?: string } = {}): Promise<void> {
  await fullNameInput(page).fill(SAMPLE.fullName);
  await emailInput(page).fill(overrides.email ?? SAMPLE.email);
  await passwordInput(page).fill(SAMPLE.password);
  await confirmPasswordInput(page).fill(overrides.confirmPassword ?? SAMPLE.password);
  await page.getByPlaceholder("Nhập tên cửa hàng/công ty").fill(SAMPLE.shopName);
  await page.getByPlaceholder("Nhập địa chỉ chi tiết").fill(SAMPLE.addressLine);
  await pickRegion(page);
  await page.getByRole("checkbox").check();
}

/** Form → channel dialog. */
export async function openChannelDialog(page: Page): Promise<void> {
  // The button unlocks once the captcha has passed. Now and then Cloudflare's widget comes up empty;
  // asking it to run again gets it through.
  for (let attempt = 0; ; attempt++) {
    try {
      await waitEnabled(continueButton(page), 12_000);
      break;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.evaluate(`window.turnstile && window.turnstile.reset()`);
    }
  }
  await continueButton(page).click();
  await page.getByRole("radio", { name: CHANNEL_RADIO.SMS }).waitFor();
}

export async function selectChannel(page: Page, channel: Channel): Promise<void> {
  await page.getByRole("radio", { name: CHANNEL_RADIO[channel] }).check();
}

export async function confirmChannel(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Nhận mã OTP", exact: true }).click();
}

/** The code step says which channel the code went through. */
export async function waitCodeStepFor(page: Page, channel: Channel): Promise<void> {
  await codeInput(page).waitFor();
  await page.getByText(`đã gửi qua ${CHANNEL_NAME[channel]} đến`).waitFor();
}

/** From the open invitation straight to the code step, countdown running. */
export async function goToCodeStep(page: Page, channel: Channel): Promise<void> {
  await fillSignupForm(page);
  await openChannelDialog(page);
  await selectChannel(page, channel);
  await confirmChannel(page);
  await waitCodeStepFor(page, channel);
  await page.getByRole("timer").waitFor();
}

/**
 * Replaces whatever is in the code field. The field moves the caret to the end whenever it gains
 * focus, so `fill()` would append to the old code instead of replacing it; erase it key by key.
 */
export async function typeCode(page: Page, code: string): Promise<void> {
  const input = codeInput(page);
  await input.focus();
  for (let remaining = (await input.inputValue()).length; remaining > 0; remaining--) await page.keyboard.press("Backspace");
  await input.pressSequentially(code);
}

export async function submitCode(page: Page, code: string): Promise<void> {
  await typeCode(page, code);
  await waitEnabled(joinButton(page));
  await joinButton(page).click();
}

/** Enters the accepted code and waits for the "joined" screen. */
export async function finishWithCode(page: Page): Promise<void> {
  await submitCode(page, DEV_OTP);
  await page.getByRole("heading", { name: `Bạn đã tham gia ${INVITING_SHOP}` }).waitFor();
}

/** The first frame of every flow: the invitation as the link opens it. */
export const INVITATION_STEP = ["mo-loi-moi", "Mở lời mời tham gia cửa hàng"] as const;
