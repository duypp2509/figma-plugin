import type { Page, Route } from "playwright";
import { defineFlow, type FlowContext } from "../../capture";
import { CONSENT_TEXT, PERMANENT, fakeCamera, verified } from "./superplatform-identity-document";
import { mockPin, openAccountMenu } from "./superplatform-screen-lock";
import { capability } from "./supership-session";

/*
 * "Lời mời của tôi" of the SuperPlatform console (/workspace/account/invitations, "Lời mời tham gia" in the account
 * menu): the employee invitations sent to the signed-in staff member Nguyễn Minh Anh of the workspace stand-in in
 * superplatform-screen-lock.ts. Accepting reads the details again, takes the face when the invitation needs it, then
 * asks the code of accepting (403 STEP_UP_REQUIRED, the Authenticator); declining asks why and no code.
 * Components: AccountInvitationsPage, EmployeeInvitationInbox, InvitationReviewDialog, InvitationEkycDialog,
 * InvitationResponseConfirmation (features/employee-invitation-inbox). Sentences: MyEmployeeInvitationController,
 * EmployeeInvitationWording, EmployeeInvitationResponseService, reason catalog V1303.
 */

export const INVITATIONS_URL = "/workspace/account/invitations";
export const STEP_UP_CODE = "515060";
const at = (value: string) => new Date(`${value}+07:00`).toISOString();

export const MESSAGES = {
  emptyPending: "Bạn không có lời mời nào đang chờ.",
  emptyHistory: "Chưa có lời mời nào trong lịch sử.",
  declined: "Đã từ chối lời mời.",
  expired: "Lời mời đã hết hạn. Liên hệ người đã mời bạn.",
  wrongCode: "Mã xác thực không đúng hoặc đã được sử dụng.",
  reasonMissing: "Hãy chọn lý do từ chối.",
  noteMissing: "Hãy ghi rõ lý do từ chối.",
  faceVerified: "Đã xác thực khuôn mặt.",
};

export interface InvitationFixture {
  id: string; unit: string; type: "JOIN" | "ADDITIONAL" | "TRANSFER"; position: string; number: string;
  validFrom: string | null; sentAt: string; expiresAt: string; deadline: string; explanation: string;
  accept: { title: string; lines: string[] }; accepted: string;
}

/** "Mời làm thêm" at a post office, keeping the work at SuperTek. */
export const GO_VAP: InvitationFixture = {
  id: "emp-inv-go-vap", unit: "Bưu cục SuperShip Gò Vấp", type: "ADDITIONAL", position: "Nhân viên giao nhận", number: "SST00218",
  validFrom: at("2026-10-15T00:00:00"), sentAt: at("2026-10-10T14:30:00"), expiresAt: at("2026-10-17T14:30:00"),
  deadline: "Còn 5 ngày, đến 17/10/2026",
  explanation: "Bạn làm thêm ở Bưu cục SuperShip Gò Vấp. Công việc ở SuperTek giữ nguyên.",
  accept: { title: "Chấp nhận làm thêm ở Bưu cục SuperShip Gò Vấp?", lines: ["Bạn vẫn làm ở SuperTek như cũ.",
    "Chức vụ: Nhân viên giao nhận. Vai trò mới: Nhân viên giao nhận. Bắt đầu: 15/10/2026."] },
  accepted: "Bạn đã là nhân viên Bưu cục SuperShip Gò Vấp. Bạn bắt đầu làm việc từ ngày 15/10/2026.",
};
/** "Điều chuyển" to a franchise: the work at SuperTek ends. */
export const HA_DONG: InvitationFixture = {
  id: "emp-inv-ha-dong", unit: "Nhượng quyền SuperShip Hà Đông", type: "TRANSFER", position: "Nhân viên kho", number: "SST00218",
  validFrom: null, sentAt: at("2026-10-09T09:15:00"), expiresAt: at("2026-10-16T09:15:00"), deadline: "Còn 4 ngày, đến 16/10/2026",
  explanation: "Bạn chuyển sang làm việc ở Nhượng quyền SuperShip Hà Đông. Công việc ở SuperTek kết thúc.",
  accept: { title: "Chấp nhận chuyển sang Nhượng quyền SuperShip Hà Đông?", lines: ["Công việc ở SuperTek kết thúc khi bạn chấp nhận.",
    "Chức vụ: Nhân viên kho. Bắt đầu: khi bạn chấp nhận."] },
  accepted: "Bạn đã chuyển sang Nhượng quyền SuperShip Hà Đông.",
};

const TYPE_LABEL = { JOIN: "Mời vào làm", ADDITIONAL: "Mời làm thêm", TRANSFER: "Điều chuyển" } as const;
const STATUS_LABEL = { PENDING: "Chờ trả lời", ACCEPTED: "Đã chấp nhận", DECLINED: "Đã từ chối", EXPIRED: "Hết hạn", CANCELLED: "Đã hủy" } as const;
type Status = keyof typeof STATUS_LABEL;

const inviter = (unit: string) => ({ name: "Phạm Gia Huy", position_title: unit.startsWith("Bưu cục") ? "Trưởng bưu cục" : "Quản lý nhượng quyền",
  organization_name: unit });

function dto(fixture: InvitationFixture, status: Status, extra: Record<string, unknown> = {}) {
  return {
    id: fixture.id, invitation_type: fixture.type, invitation_type_label: TYPE_LABEL[fixture.type], reuse_profile_id: null,
    organization_id: `org-${fixture.id}`, organization_name: fixture.unit, organization_code: null,
    employee_number: fixture.number, job_position_code: "POSITION", job_position_name: fixture.position, headline: null,
    status, status_label: STATUS_LABEL[status], cancel_reason_label: null,
    created_at: fixture.sentAt, expires_at: fixture.expiresAt, responded_at: null,
    role_names: [fixture.position], valid_from: fixture.validFrom,
    employment_type_label: "Toàn thời gian", contract_type_label: "Hợp đồng không xác định thời hạn", contract_end_date: null,
    company_email: "anh.nm@supership.vn", inviter: inviter(fixture.unit),
    explanation: status === "PENDING" ? fixture.explanation : null, deadline: status === "PENDING" ? fixture.deadline : null,
    accept_confirmation: { ...fixture.accept, confirm_label: "Xác nhận", cancel_label: "Hủy" },
    decline_confirmation: { title: `Từ chối lời mời làm việc tại ${fixture.unit}?`, lines: [], confirm_label: "Xác nhận từ chối", cancel_label: "Hủy" },
    ...extra,
  };
}

/** Invitations no longer waiting: one of each closing. */
const PAST = [
  dto({ ...GO_VAP, id: "emp-inv-tan-binh", unit: "Bưu cục SuperShip Tân Bình", type: "JOIN", position: "Nhân viên vận hành",
    validFrom: at("2026-03-10T00:00:00"), sentAt: at("2026-03-02T08:00:00"), expiresAt: at("2026-03-09T08:00:00") }, "ACCEPTED", { responded_at: at("2026-03-03T09:10:00") }),
  dto({ ...GO_VAP, id: "emp-inv-thu-duc", unit: "Bưu cục SuperShip Thủ Đức", type: "ADDITIONAL", position: "Nhân viên giao nhận",
    validFrom: at("2026-08-20T00:00:00"), sentAt: at("2026-08-12T10:00:00"), expiresAt: at("2026-08-19T10:00:00") }, "DECLINED", { responded_at: at("2026-08-13T16:20:00") }),
  dto({ ...GO_VAP, id: "emp-inv-cau-giay", unit: "Nhượng quyền SuperShip Cầu Giấy", type: "TRANSFER", position: "Nhân viên kho",
    validFrom: null, sentAt: at("2026-07-01T08:30:00"), expiresAt: at("2026-07-08T08:30:00") }, "EXPIRED"),
  dto({ ...GO_VAP, id: "emp-inv-binh-thanh", unit: "Bưu cục SuperShip Bình Thạnh", type: "ADDITIONAL", position: "Nhân viên giao nhận",
    validFrom: at("2026-06-15T00:00:00"), sentAt: at("2026-06-05T13:00:00"), expiresAt: at("2026-06-12T13:00:00") }, "CANCELLED",
    { responded_at: at("2026-06-06T08:45:00"), cancel_reason_label: "Người mời đã thu hồi" }),
];

export interface InvitationsMock {
  /** The waiting invitations, first shown first. */
  waiting: InvitationFixture[];
  history: Record<string, unknown>[];
  /** Invitations whose accepting first asks the face (eKYC mode FACE). */
  needsFace: Set<string>;
  /** Invitations that ran out while the list was open: accepting is refused, the list read again leaves them out. */
  lapsed: Set<string>;
  /** Bodies of every decline, in order. */
  declines: Record<string, unknown>[];
}
export interface InvitationsContext extends FlowContext { mock: InvitationsMock }

/** A flow under SUPERPLATFORM → LỜI MỜI CỦA TÔI; the id gets "superplatform-loi-moi-cua-toi-". */
export function invitationsFlow(id: string, name: string, run: (ctx: InvitationsContext) => Promise<void>,
                                setup: Partial<InvitationsMock> = {}) {
  return defineFlow({ id: `superplatform-loi-moi-cua-toi-${id}`, name, app: "superplatform",
    group: ["SUPERPLATFORM", "LỜI MỜI CỦA TÔI"],
    async run(ctx) {
      await mockPin(ctx.page, ctx.log, false);
      await fakeCamera(ctx.page);
      const mock: InvitationsMock = { waiting: [GO_VAP, HA_DONG], history: [...PAST], needsFace: new Set(), lapsed: new Set(),
        declines: [], ...setup };
      await mockInvitations(ctx.page, mock);
      await run({ ...ctx, mock });
    },
  });
}

async function mockInvitations(page: Page, mock: InvitationsMock) {
  const passedFace = new Set<string>();
  // Registered after the workspace stand-in, so these answer first; anything else falls back to it.
  await page.context().route("**/api/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/backend/, "");
    const method = request.method();
    const send = (data: unknown, status = 200, message = "") => route.fulfill({ status,
      headers: { "X-Browser-Session-Version": "1" }, json: { error: status >= 400, message, data } });
    const close = (id: string, status: Status, extra: Record<string, unknown> = {}) => {
      const fixture = mock.waiting.find(item => item.id === id)!;
      mock.waiting = mock.waiting.filter(item => item.id !== id);
      const closed = dto(fixture, status, { responded_at: at("2026-10-12T09:00:00"), ...extra });
      mock.history = [closed, ...mock.history];
      return { fixture, closed };
    };

    if (path === "/v1/me/employee-invitations" && method === "GET") {
      return send(mock.waiting.map(item => dto(item, "PENDING")),
        200, mock.waiting.length ? "Danh sách lời mời của bạn." : MESSAGES.emptyPending);
    }
    if (path === "/v1/me/employee-invitations/count") return send({ pending: mock.waiting.length });
    if (path === "/v1/me/employee-invitations/answered") return send([]);
    if (path.startsWith("/v1/me/employee-invitations/history")) return send({ items: mock.history, page: 0, size: 20, total: mock.history.length });

    const ekyc = /^\/v1\/me\/employee-invitations\/([^/]+)\/ekyc$/.exec(path);
    if (ekyc && method === "GET") {
      const id = decodeURIComponent(ekyc[1]!);
      const required = mock.needsFace.has(id);
      return send({ required, mode: required ? "FACE" : null, available: true, consent_granted: true,
        passed: passedFace.has(id), face_scan_available: false });
    }
    if (ekyc && method === "POST") {
      passedFace.add(decodeURIComponent(ekyc[1]!));
      const card = verified().card!;
      return send({ mode: "FACE", result: "VERIFIED", retake: null, message: MESSAGES.faceVerified, remaining_attempts: 5,
        remaining_card_attempts: 5, locked_until: null, card: null,
        document: { status: "VERIFIED", ...card, residence: { permanent_on_card: PERMANENT, permanent: null,
          current_same_as_permanent: true, current: null, updated_at: null } } });
    }

    const accept = /^\/v1\/me\/employee-invitations\/([^/]+)\/accept$/.exec(path);
    if (accept && method === "POST") {
      const id = decodeURIComponent(accept[1]!);
      if (mock.lapsed.has(id)) {
        // The server closes it as it refuses (rejectIfLapsedOrNotPending); the list read again leaves it out.
        close(id, "EXPIRED", { responded_at: null });
        return send({ code: "INVITATION_NOT_AVAILABLE" }, 410, MESSAGES.expired);
      }
      const code = request.headers()["x-step-up-code"];
      if (!code) return send({ code: "STEP_UP_REQUIRED", challenge_id: `invitation-${Date.now()}`, action: "EMPLOYEE_INVITATION_ACCEPT",
        summary: "Chấp nhận lời mời làm nhân viên", method: "AUTHENTICATOR", expires_at: at("2026-10-12T09:05:00") }, 403,
        "Vui lòng nhập mã xác thực.");
      if (code !== STEP_UP_CODE) return send({ code: "MFA_INVALID_CODE" }, 400, MESSAGES.wrongCode);
      const { fixture, closed } = close(id, "ACCEPTED");
      return send(closed, 200, fixture.accepted);
    }
    const decline = /^\/v1\/me\/employee-invitations\/([^/]+)\/decline$/.exec(path);
    if (decline && method === "POST") {
      mock.declines.push(request.postDataJSON() ?? {});
      const { closed } = close(decodeURIComponent(decline[1]!), "DECLINED");
      return send(closed, 200, MESSAGES.declined);
    }
    // "Lý do thao tác" of declining (V1303); "Thông tin cá nhân không đúng" is left out by the page.
    if (path === "/v1/reasons/EMPLOYEE_INVITATION_DECLINE") return send({ reasons: [
      ["OTHER_JOB", "Đã nhận công việc khác"], ["POSITION_NOT_SUITABLE", "Chức vụ, công việc chưa phù hợp"],
      ["TERMS_NOT_SUITABLE", "Hình thức làm việc, hợp đồng chưa phù hợp"], ["LOCATION_NOT_SUITABLE", "Nơi làm việc không thuận tiện"],
      ["START_DATE_NOT_SUITABLE", "Ngày bắt đầu không phù hợp"], ["NOT_FOR_ME", "Lời mời này không dành cho tôi"],
      ["PERSONAL_INFO_WRONG", "Thông tin cá nhân không đúng"], ["OTHER", "Lý do khác"],
    ].map(([code, name]) => ({ code, name, note_required: code === "OTHER" })) });
    // The eKYC wizard: consent already given, the face taken by hand.
    if (path === "/v1/me/consents/ekyc-face") return send({ granted: true, granted_at: at("2026-09-01T08:00:00"), available: true,
      consent_version: "2026-10", consent_text: CONSENT_TEXT, consent_digest: "capture-digest" });
    if (path === "/v1/public/ekyc/face-modes") return send({ manual: true, auto: false });
    // The workspace shell around the page, and the home page the account menu is opened from.
    if (path === "/v1/me/profile-update-request") return send(null);
    if (path === "/v1/me/reminders") return send({ items: [], banners: [], notices: [] });
    if (path === "/v1/me/capabilities") return send({
      context: { context_id: "pin-context", context_type: "SUPERPLATFORM", application_name: "SUPERPLATFORM",
        membership_id: "pin-member", organization_id: "pin-org" },
      assurance: { level: 2, mfa_verified: true, mfa_verified_at: at("2026-10-12T09:00:00") },
      capabilities: [capability("identity.view", "pin-org")], revision: "capture",
      generated_at: at("2026-10-12T09:00:00"), expires_at: at("2026-10-13T09:00:00") });
    if (path === "/v1/public/apps/current") return send({ id: "app-superplatform", code: "SUPERPLATFORM", name: "SuperPlatform",
      app_group: "INTERNAL", status: "ACTIVE" });
    if (path === "/v1/me/access-context/token") return send({ token: "capture-order-token", expires_at: "2026-10-13T02:00:00.000Z" });
    return route.fallback();
  });
}

/** From the account menu ("Lời mời tham gia") to the page, waiting for the list or the line saying there is none. */
export async function openFromMenu(page: Page, shot?: FlowContext["shot"]) {
  await page.goto("/workspace");
  await openAccountMenu(page);
  const row = page.getByRole("link", { name: /Lời mời tham gia/ });
  await row.waitFor();
  if (shot) await shot("menu-tai-khoan", "Mục Lời mời tham gia trong menu tài khoản");
  await row.click();
  await waitList(page);
}
export async function openInvitations(page: Page) {
  await page.goto(INVITATIONS_URL);
  await waitList(page);
}
async function waitList(page: Page) {
  await page.getByRole("heading", { name: "Lời mời của tôi" }).waitFor();
  await page.getByText("Đang tải lời mời…").waitFor({ state: "detached" });
}
/** The card of the invitation from `fixture`'s unit on "Đang chờ", or its row on "Lịch sử". */
export const card = (page: Page, fixture: { unit: string }) => page.getByRole("listitem").filter({ hasText: fixture.unit });
export async function openHistory(page: Page) {
  await page.getByRole("tab", { name: "Lịch sử" }).click();
  await page.getByText("Đang tải lịch sử…").waitFor({ state: "detached" });
}
export const dialog = (page: Page, title: string) => page.getByRole("dialog", { name: title });
/** The code of accepting, asked by the shared "Xác nhận thao tác" dialog. */
export const codeDialog = (page: Page) => page.getByRole("dialog", { name: "Xác nhận thao tác" });
export async function enterCode(page: Page, code = STEP_UP_CODE) {
  await page.locator("#step-up-code").fill(code);
}
/** The success notice ("Thành công") with the server's sentence. */
export const notice = (page: Page, text: string) =>
  page.getByRole("alertdialog").or(page.getByRole("dialog")).filter({ hasText: text }).last();
