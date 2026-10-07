// Fixtures, a stateful stand-in backend and steps for the invitations a signed-in person received
// (SuperShip Web, /settings/invitations — "Lời mời" in the sidebar): the ones still waiting, to accept
// or decline, and the history of the ones that are not. Answering one must first be confirmed with an
// OTP sent to the account's phone number; the confirmation then holds for the rest of the flow.
//
// Components: MemberInvitationInbox, MemberInvitationHistory and InvitationResponseConfirmation
// (features/member-invitations), MfaChallengeHost and OtpStepUpForm (features/mfa). The person is the owner of the seed's Khả Ái
// shop, invited by other shops.
import type { Page } from "playwright";
import { defineFlow, type FlowContext, type FlowDefinition } from "../../capture";
import { DEV_OTP, OtpSessionMock, isFailure } from "./otp-session";
import { KHA_AI_SHOP, mockSignedInShop, type Backend } from "./supership-session";
import { OWNER_PERMISSIONS } from "./supership-shop-roles";

/** The Section that holds every flow of the person's own invitations. */
export const GROUP = "LỜI MỜI THAM GIA CỦA TÔI";
export const INVITATIONS_URL = "/settings/invitations";

/** The moment every flow runs at, so dates in the pictures do not change from run to run. */
const NOW = Date.parse("2026-10-06T09:00:00+07:00");
const at = (value: string) => new Date(`${value}+07:00`).toISOString();
const WEEK_MS = 7 * 86_400_000;
/** The account's email as the backend shows it to its owner: masked. */
const UNVERIFIED_EMAIL = "dok***@gmail.com";
/** The account's verified phone number, where the code that confirms an answer goes. */
const MASKED_PHONE = "090****735";

export { DEV_OTP };

type Status = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "CANCELLED";

export interface InvitationFixture {
  id: string;
  shop: string;
  shopCode: string;
  inviter: string;
  role: string;
  sentAt: string;
}

export const MOC_MIEN: InvitationFixture = { id: "my-inv-moc-mien", shop: "Cửa hàng Mộc Miên", shopCode: "MOCMIEN", inviter: "Nguyễn Minh An", role: "Nhân viên vận hành", sentAt: at("2026-10-05T14:30:00") };
export const HA_VY: InvitationFixture = { id: "my-inv-ha-vy", shop: "Tiệm Bánh Hạ Vy", shopCode: "HAVY", inviter: "Lê Hạ Vy", role: "Kế toán", sentAt: at("2026-10-03T09:15:00") };

const invitationDto = (fixture: InvitationFixture, status: Status, extra: Record<string, unknown> = {}) => ({
  id: fixture.id, organization_id: `org-${fixture.id}`, organization_name: fixture.shop, organization_code: fixture.shopCode,
  organization_logo_url: null, invitee_type: "PHONE", invitee_contact: "090****735", invitee_name: KHA_AI_SHOP.fullName,
  role_ids: [`role-${fixture.id}`], role_names: [fixture.role], status, close_reason: null,
  inviter_name: fixture.inviter, inviter_role_names: ["Chủ cửa hàng"],
  created_at: fixture.sentAt, expires_at: new Date(Date.parse(fixture.sentAt) + WEEK_MS).toISOString(),
  responded_at: null, resulting_membership_id: null, version: 1, reissue: null,
  ...extra,
});

/** Invitations that were answered, ran out or were withdrawn before today. */
const PAST = [
  invitationDto({ id: "my-inv-nha-lam", shop: "Shop Gốm Nhà Lam", shopCode: "NHALAM", inviter: "Phạm Thanh Lam", role: "Nhân viên vận hành", sentAt: at("2026-09-20T10:00:00") },
    "ACCEPTED", { responded_at: at("2026-09-21T08:40:00"), resulting_membership_id: "membership-nha-lam" }),
  invitationDto({ id: "my-inv-an-nhien", shop: "Cửa hàng Trà An Nhiên", shopCode: "ANNHIEN", inviter: "Võ An Nhiên", role: "Kế toán", sentAt: at("2026-09-12T16:20:00") },
    "DECLINED", { responded_at: at("2026-09-13T09:05:00") }),
  invitationDto({ id: "my-inv-may", shop: "Shop Phụ Kiện Mây", shopCode: "MAY", inviter: "Đặng Thùy Mây", role: "Nhân viên vận hành", sentAt: at("2026-08-25T11:00:00") }, "EXPIRED"),
  invitationDto({ id: "my-inv-thu-cuc", shop: "Tiệm Hoa Thu Cúc", shopCode: "THUCUC", inviter: "Trần Thu Cúc", role: "Nhân viên vận hành", sentAt: at("2026-08-10T08:30:00") },
    "CANCELLED", { close_reason: "CANCELLED_BY_INVITER", responded_at: at("2026-08-11T15:45:00") }),
];

export interface MyInvitationsMock {
  /** Leaves the person with no waiting invitation and, with `history`, no past one either. */
  clear(history?: boolean): void;
  /**
   * Makes the invitation one sent to an email address the account holds but has not verified yet (an
   * email may stay unverified after registering; a phone number never does). It can only be accepted
   * once that email is verified.
   */
  sentToUnverifiedEmail(fixture: InvitationFixture): void;
  /** Closes a waiting invitation behind the person's back, as the shop withdrawing it does. */
  withdraw(fixture: InvitationFixture): void;
}

/** Answers the endpoints of the signed-in person's own invitations; accepting and declining move them to the history. */
export async function mockMyInvitations(page: Page, backend: Backend): Promise<MyInvitationsMock> {
  await page.clock.setFixedTime(NOW);
  let waiting = [MOC_MIEN, HA_VY].map((fixture) => ({ fixture, unverifiedEmail: false }));
  let history = [...PAST];
  const close = (id: string, status: Status, extra: Record<string, unknown> = {}) => {
    const entry = waiting.find((candidate) => candidate.fixture.id === id);
    if (!entry) return null;
    waiting = waiting.filter((candidate) => candidate !== entry);
    const closed = invitationDto(entry.fixture, status, { responded_at: new Date(NOW).toISOString(), ...extra });
    history = [closed, ...history];
    return closed;
  };
  const notFound = { status: 404, code: "MEMBER_INVITATION_NOT_FOUND", message: "Không tìm thấy lời mời." };

  // Answering an invitation is refused until this session has confirmed with an OTP.
  let confirmed = false;
  const otp = new OtpSessionMock("capture-step-up", MASKED_PHONE, () => NOW);
  const confirmationRequired = (answer: string) => ({
    status: 403, code: "MFA_REQUIRED", message: `Cần xác nhận bằng mã OTP để ${answer} lời mời tham gia cửa hàng.`,
  });
  backend.on("GET", /^\/v1\/me\/mfa$/, () => ({
    data: {
      enrolled: false, factor_status: "NONE", recovery_codes_remaining: 0, has_internal_membership: false, removal_allowed: false,
      membership_mfa_applicable: true, membership_mfa_enabled: false, authenticator_shared: false,
      enrollment_channels: [{ channel: "PHONE", masked_destination: MASKED_PHONE }],
    },
  }));
  backend.on("POST", /^\/v1\/me\/step-up\/otp$/, (request) => {
    otp.start(String((request.postDataJSON() as { channel?: string } | null)?.channel ?? "SMS"));
    return { data: { challenge_id: otp.id, channel: "PHONE", masked_destination: MASKED_PHONE, expires_at: otp.expiresAt, resend_available_at: otp.resendAvailableAt } };
  });
  backend.on("POST", /^\/v1\/me\/step-up\/otp\/verify$/, (request) => {
    const wrong = otp.verify((request.postDataJSON() as { otp_code?: string }).otp_code);
    if (wrong) return wrong;
    confirmed = true;
    return { data: { otp_step_up_expires_at: new Date(NOW + 300_000).toISOString() } };
  });
  backend.on("GET", /^\/v1\/otp-sessions\/[^/]+$/, () => ({ data: otp.snapshot() }));
  backend.on("POST", /^\/v1\/otp-sessions\/delivery$/, (request) => {
    const result = otp.deliver(request.postDataJSON() as Record<string, unknown>);
    return isFailure(result) ? result : { data: result };
  });

  backend.on("GET", /^\/v1\/me\/member-invitations$/, () => ({
    data: waiting.map(({ fixture, unverifiedEmail }) => unverifiedEmail
      ? {
        invitation: invitationDto(fixture, "PENDING", { invitee_type: "EMAIL", invitee_contact: UNVERIFIED_EMAIL }),
        recipient_state: "CONTACT_VERIFICATION_REQUIRED",
        verification: { identifier_type: "EMAIL", identifier_id: "identifier-email", masked_value: UNVERIFIED_EMAIL },
      }
      : { invitation: invitationDto(fixture, "PENDING"), recipient_state: "READY", verification: null }),
  }));
  backend.on("GET", /^\/v1\/me\/member-invitations\/history$/, () => ({
    data: { items: history, page: 0, size: 10, total_items: history.length, total_pages: 1 },
  }));
  backend.on("POST", /^\/v1\/me\/member-invitations\/([^/]+)\/accept$/, (_request, match) => {
    if (!confirmed) return confirmationRequired("chấp nhận");
    const accepted = close(match[1]!, "ACCEPTED", { resulting_membership_id: `membership-${match[1]}` });
    return accepted ? { data: { invitation: accepted, membership_id: `membership-${match[1]}`, access_provisioning: "DONE" } } : notFound;
  });
  backend.on("POST", /^\/v1\/me\/member-invitations\/([^/]+)\/decline$/, (_request, match) => {
    if (!confirmed) return confirmationRequired("từ chối");
    const declined = close(match[1]!, "DECLINED");
    return declined ? { data: declined } : notFound;
  });
  // Read again after joining a shop, so the new working unit can be chosen.
  backend.on("GET", /^\/v1\/me\/memberships$/, () => ({
    data: [{
      membership_id: "capture-membership", org_id: KHA_AI_SHOP.organizationId, org_code: KHA_AI_SHOP.code, org_name: KHA_AI_SHOP.name,
      org_type: "SHOP", membership_type: "OWNER", title: KHA_AI_SHOP.title, status: "ACTIVE", provisioning_status: "DONE",
      application_code: "SUPERSHIP", eligible: true, reason_code: null, reason_message: null, suggested_action: null, is_default: true,
    }],
  }));

  return {
    clear: (alsoHistory = false) => { waiting = []; if (alsoHistory) history = []; },
    sentToUnverifiedEmail: (fixture) => { waiting = waiting.map((entry) => entry.fixture === fixture ? { ...entry, unverifiedEmail: true } : entry); },
    withdraw: (fixture) => { close(fixture.id, "CANCELLED", { close_reason: "CANCELLED_BY_INVITER" }); },
  };
}

export interface MyInvitationsContext {
  page: Page;
  shot: FlowContext["shot"];
  backend: Backend;
  invitations: MyInvitationsMock;
}

/** A flow of the person's own invitations: signed in, with the stand-in backend answering before `run` starts. */
export function myInvitationsFlow(flow: { id: string; name: string; run(context: MyInvitationsContext): Promise<void> }): FlowDefinition {
  return defineFlow({
    id: `loi-moi-cua-toi-${flow.id}`,
    group: GROUP,
    name: flow.name,
    app: "supership",
    async run({ page, shot, log }) {
      const backend = await mockSignedInShop(page, KHA_AI_SHOP, OWNER_PERMISSIONS, log);
      const invitations = await mockMyInvitations(page, backend);
      await flow.run({ page, shot, backend, invitations });
    },
  });
}

/** Opens the page on its "Đang chờ" tab and waits for the list, or for the line saying there is none. */
export async function openMyInvitations(page: Page): Promise<void> {
  await page.goto(INVITATIONS_URL);
  await page.getByRole("heading", { level: 1, name: "Lời mời tham gia" }).waitFor();
  await page.getByText("Đang tải lời mời…").waitFor({ state: "detached" });
}

/** The row of the invitation from `fixture`'s shop, on either tab. */
export const invitationRow = (page: Page, fixture: InvitationFixture) => page.getByRole("listitem").filter({ hasText: fixture.shop });

export async function openHistoryTab(page: Page): Promise<void> {
  await page.locator("#invitations-history-tab").click();
  await page.getByText("Đang tải lịch sử…").waitFor({ state: "detached" });
}

/** The dialog on top: native dialogs make everything behind them inert. */
export const openDialog = (page: Page) => page.locator("dialog[open]").last();
/** The open dialog that says `text`: a notice is not always the last dialog in the page. */
export const dialogSaying = (page: Page, text: string | RegExp) => page.locator("dialog[open]").filter({ hasText: text }).last();

/** Acknowledges the notice saying `text`: a success is closed with "Xác nhận", any other notice with "Đã hiểu". */
export async function acknowledge(page: Page, text: string | RegExp): Promise<void> {
  const notice = dialogSaying(page, text);
  await notice.getByRole("button", { name: /^(Xác nhận|Đã hiểu)$/ }).click();
  await notice.waitFor({ state: "detached" });
}

/** The dialog that asks for the OTP before an invitation is answered. */
export const otpDialog = (page: Page) => dialogSaying(page, "Thao tác này cần xác nhận bằng mã OTP.");
export const otpInput = (page: Page) => otpDialog(page).getByRole("textbox", { name: /^Mã OTP/ });

/** From the dialog's choice of where the code goes to the step that asks for the code. */
export async function sendOtp(page: Page): Promise<void> {
  await otpDialog(page).getByRole("button", { name: "Gửi mã OTP" }).click();
  await otpDialog(page).getByText("Đã gửi mã OTP tới").waitFor();
  await otpDialog(page).getByRole("timer").waitFor();
}

/** Replaces whatever is in the code field; the field keeps the caret at the end, so erase key by key. */
export async function typeOtp(page: Page, code: string): Promise<void> {
  const input = otpInput(page);
  await input.focus();
  for (let remaining = (await input.inputValue()).length; remaining > 0; remaining--) await page.keyboard.press("Backspace");
  await input.pressSequentially(code);
}

export const confirmOtp = (page: Page) => otpDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
