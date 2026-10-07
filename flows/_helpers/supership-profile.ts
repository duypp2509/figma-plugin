// A stand-in backend and steps for verifying the account's email on "Thông tin tài khoản"
// (SuperShip Web, /settings/profile). An email may stay unverified after registering; the page marks it
// and offers to verify it with a code sent to it.
//
// Components: MyProfilePage and EmailVerificationDialog (features/profile), OtpSessionActions
// (shared/components). The OTP rules are the backend's own, kept by OtpSessionMock.
import type { Page } from "playwright";
import { defineFlow, type FlowContext, type FlowDefinition } from "../../capture";
import { DEV_OTP, OtpSessionMock, isFailure } from "./otp-session";
import { KHA_AI_SHOP, mockSignedInShop, type Backend } from "./supership-session";
import { OWNER_PERMISSIONS } from "./supership-shop-roles";

export { DEV_OTP };

/** The Section that holds every flow of verifying the account's email. */
export const GROUP = "THÔNG TIN TÀI KHOẢN - XÁC THỰC EMAIL";
export const PROFILE_URL = "/settings/profile";
export const EMAIL = "dokhanhlinh@gmail.com";
const PHONE = "0906842735";

/** The moment a flow starts at, so dates and countdowns in the pictures do not change from run to run. */
const START = Date.parse("2026-10-06T09:00:00+07:00");

export interface ProfileMock {
  /** Moves the page's clock and the stand-in backend forward together. */
  travel(seconds: number): Promise<void>;
}

/** Answers the profile and email verification endpoints for an account whose email is not verified yet. */
export async function mockUnverifiedEmail(page: Page, backend: Backend): Promise<ProfileMock> {
  let now = START;
  await page.clock.setFixedTime(now);
  let emailVerified = false;
  const session = new OtpSessionMock("capture-email-verification", "dok***@gmail.com", () => now, ["EMAIL"]);
  const sent = () => ({ challenge_id: session.id, expires_at: session.expiresAt, resend_available_at: session.resendAvailableAt });

  backend.on("GET", /^\/v1\/me\/profile$/, () => ({
    data: {
      identity_id: "capture-identity", person_id: "capture-person", full_name: KHA_AI_SHOP.fullName, date_of_birth: "1994-05-12", gender: "FEMALE",
      avatar_url: null, status: "ACTIVE", last_login_at: new Date(START).toISOString(), person_version: 1, has_password: true,
      identity_document_type: "CCCD", identity_document_number: "048194001234",
      identifiers: [
        { id: "identifier-phone", type: "PHONE", value: PHONE, verified: true },
        { id: "identifier-email", type: "EMAIL", value: EMAIL, verified: emailVerified },
      ],
    },
  }));
  backend.on("POST", /^\/v1\/identifiers\/email\/verification\/request$/, () => {
    session.start("EMAIL");
    return { data: sent() };
  });
  backend.on("POST", /^\/v1\/identifiers\/email\/verification\/confirm$/, (request) => {
    const wrong = session.verify((request.postDataJSON() as { otp_code?: string }).otp_code);
    if (wrong) return wrong;
    emailVerified = true;
    return { data: {} };
  });
  backend.on("GET", /^\/v1\/otp-sessions\/[^/]+$/, () => ({ data: session.snapshot() }));
  backend.on("POST", /^\/v1\/otp-sessions\/delivery$/, (request) => {
    const result = session.deliver(request.postDataJSON() as Record<string, unknown>);
    return isFailure(result) ? result : { data: result };
  });

  return {
    travel: async (seconds) => {
      now += seconds * 1000;
      await page.clock.setFixedTime(now);
      // The countdowns re-read the clock once a second.
      await page.waitForTimeout(1200);
    },
  };
}

export interface ProfileContext {
  page: Page;
  shot: FlowContext["shot"];
  profile: ProfileMock;
}

/** A flow on the account page of someone whose email is not verified: signed in, stand-in backend answering. */
export function emailVerificationFlow(flow: { id: string; name: string; run(context: ProfileContext): Promise<void> }): FlowDefinition {
  return defineFlow({
    id: `xac-thuc-email-${flow.id}`,
    group: GROUP,
    name: flow.name,
    app: "supership",
    async run({ page, shot, log }) {
      const backend = await mockSignedInShop(page, KHA_AI_SHOP, OWNER_PERMISSIONS, log);
      const profile = await mockUnverifiedEmail(page, backend);
      await flow.run({ page, shot, profile });
    },
  });
}

export const unverifiedMark = (page: Page) => page.getByRole("button", { name: "Email chưa được xác minh" });
export const codeInput = (page: Page) => page.getByRole("textbox", { name: /^Mã xác thực/ });
export const verifyButton = (page: Page) => page.getByRole("button", { name: "Xác thực", exact: true });
/** The dialog on top: native dialogs make everything behind them inert. */
export const openDialog = (page: Page) => page.locator("dialog[open]").last();
/** The open dialog that says `text`: a notice is not always the last dialog in the page. */
export const dialogSaying = (page: Page, text: string | RegExp) => page.locator("dialog[open]").filter({ hasText: text }).last();

export async function openProfile(page: Page): Promise<void> {
  await page.goto(PROFILE_URL);
  await page.getByRole("heading", { level: 1, name: "Thông tin tài khoản" }).waitFor();
  await unverifiedMark(page).waitFor();
}

/** From the account page to the dialog that says the email is not verified. */
export async function openUnverifiedNotice(page: Page): Promise<void> {
  await unverifiedMark(page).click();
  await openDialog(page).getByRole("button", { name: "Xác minh ngay" }).waitFor();
}

/** From that dialog to the code step: the code is sent as it opens. */
export async function startVerification(page: Page): Promise<void> {
  await openDialog(page).getByRole("button", { name: "Xác minh ngay" }).click();
  await page.getByText("Nhập mã 6 số đã gửi đến").waitFor();
  await page.getByRole("timer").waitFor();
}

/**
 * Replaces whatever is in the code field. The field moves the caret to the end whenever it gains focus,
 * so `fill()` would append to the old code instead of replacing it; erase it key by key.
 */
export async function typeCode(page: Page, code: string): Promise<void> {
  const input = codeInput(page);
  await input.focus();
  for (let remaining = (await input.inputValue()).length; remaining > 0; remaining--) await page.keyboard.press("Backspace");
  await input.pressSequentially(code);
}

/**
 * When the dialog closes, focus lands on the mark beside the email and opens its tooltip over the form.
 * Taking focus away leaves the page as someone sees it a moment later.
 */
export async function leaveFocus(page: Page): Promise<void> {
  await page.evaluate(`document.activeElement instanceof HTMLElement && document.activeElement.blur()`);
  await page.getByRole("tooltip").waitFor({ state: "detached" }).catch(() => undefined);
}
