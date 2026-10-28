import type { Page } from "playwright";
import {
  EMAIL, FULL_NAME, MFA_CODE, PASSWORD, UNITS, at, loginFlow, openLogin, type LoginContext, type LoginMock, type LoginSetup,
} from "./superplatform-login";

/*
 * The unit picker after the sign-in (CHỌN ĐƠN VỊ LÀM VIỆC KHI ĐĂNG NHẬP), with a list of units of the flow's own on top
 * of the stand-in of superplatform-login.ts: the session of POST /v1/sessions, GET /v1/me/session and
 * GET /v1/me/memberships all carry it, worded as AccessContextEligibilityService and WorkUnitOptionStatus word each unit.
 * Entering a unit of UNITS goes on to the stand-in's own PUT /v1/me/access-context, so the workspace knows that unit.
 */

export const GROUP: [string, ...string[]] = ["SUPERPLATFORM", "ĐĂNG NHẬP", "CHỌN ĐƠN VỊ LÀM VIỆC KHI ĐĂNG NHẬP"];

export interface Unit {
  membership_id: string; org_id: string; org_code: string; org_name: string; org_type: string; org_type_name: string;
  title: string; is_default?: boolean;
  /** Why the unit cannot be entered; absent for a unit that can. */
  blocked?: Blocked;
}
export interface Blocked { reason_code: string; reason_message: string; suggested_action: string; status_name: string; status_tone: string }

export const TAN_BINH: Unit = { ...UNITS[0]! };
export const MIEN_NAM: Unit = { ...UNITS[1]! };
export const GO_VAP: Unit = { membership_id: "c4d8e2f6-3a5b-4c7d-9e1f-6a8b0c2d4e57", org_id: "org-go-vap", org_code: "BCG52M17RTA",
  org_name: "Bưu cục Gò Vấp", org_type: "POST_OFFICE", org_type_name: "Bưu cục", title: "Giao dịch viên" };
export const PHU_NHUAN: Unit = { membership_id: "e7a1b3c5-5d6e-4f80-a1b2-8c9d0e1f2a68", org_id: "org-phu-nhuan", org_code: "BCP63N28SUB",
  org_name: "Bưu cục Phú Nhuận", org_type: "POST_OFFICE", org_type_name: "Bưu cục", title: "Điều phối viên" };
export const THU_DUC: Unit = { membership_id: "f2b4d6e8-7a9c-4e1f-b3d5-0a2c4e6f8b79", org_id: "org-thu-duc", org_code: "BCT74P39VWC",
  org_name: "Bưu cục Thủ Đức", org_type: "POST_OFFICE", org_type_name: "Bưu cục", title: "Giao dịch viên" };

/** The day {@code seconds} after the flow's start, as the server writes it ("dd/MM/yyyy", Vietnam time). */
export const day = (seconds: number) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit",
  month: "2-digit", year: "numeric" }).format(new Date(at(seconds)));

/** Exact sentences of AccessContextEligibilityService (message, action) and labels of WorkUnitOptionStatus. */
export const BLOCKED = {
  /** heldEligibility: the company of the hold is named. */
  held: (company: string): Blocked => ({ reason_code: "ACCESS_HELD",
    reason_message: `Quyền làm việc của bạn tại ${company} đang bị tạm dừng.`,
    suggested_action: "Liên hệ bộ phận nhân sự để biết thêm.", status_name: "Tạm dừng quyền", status_tone: "WARNING" }),
  /** notStartedEligibility: accepted, the work starts later. */
  notStarted: (day: string): Blocked => ({ reason_code: "EMPLOYMENT_NOT_STARTED",
    reason_message: `Bạn bắt đầu làm việc tại đơn vị này từ ngày ${day}.`,
    suggested_action: "Liên hệ người quản lý đơn vị nếu ngày bắt đầu chưa đúng.", status_name: "Chưa đến ngày bắt đầu", status_tone: "NEUTRAL" }),
  employmentSuspended: { reason_code: "EMPLOYMENT_SUSPENDED", reason_message: "Bạn đang tạm ngưng làm việc tại đơn vị này.",
    suggested_action: "Liên hệ bộ phận nhân sự nếu cần.", status_name: "Tạm dừng", status_tone: "WARNING" } as Blocked,
  /** The unit itself is paused. */
  unitSuspended: { reason_code: "ORGANIZATION_SUSPENDED", reason_message: "Đơn vị đang tạm dừng hoạt động.",
    suggested_action: "Liên hệ Tổng công ty để biết thêm.", status_name: "Tạm dừng", status_tone: "WARNING" } as Blocked,
  /** Open itself, but a unit above it (its franchise) is paused. */
  suspendedAbove: { reason_code: "ORGANIZATION_SUSPENDED", reason_message: "Đơn vị đang tạm ngưng hoặc đã ngừng hoạt động.",
    suggested_action: "Liên hệ Tổng công ty để biết thêm.", status_name: "Tạm dừng", status_tone: "WARNING" } as Blocked,
};

/** AuthService.listAccessContextOptions: the unit in use first, then company, franchise, post office, then by name. */
const typeRank = (type: string) => ({ CORPORATION: 0, FRANCHISE_PARTNER: 1, POST_OFFICE: 2 } as Record<string, number>)[type] ?? 3;
const byName = (a: string, b: string) => { const x = a.toUpperCase(), y = b.toUpperCase(); return x < y ? -1 : x > y ? 1 : 0; };

export interface UnitsMock {
  units: Unit[];
  defaultId: string | null;
  signedIn: boolean;
}

/**
 * Answers every list of units from {@code units} (changed in place by the flow, e.g. a unit paused meanwhile), the
 * default star and the sign-out. Call before page.goto().
 */
export function mockUnits(mock: LoginMock, units: Unit[]): UnitsMock {
  const state: UnitsMock = { units, defaultId: units.find(unit => unit.is_default)?.membership_id ?? null, signedIn: false };
  let mfa = false;
  let active: Unit | null = null;
  const missing = { status: 401, message: "Phiên đăng nhập không tồn tại.", data: { code: "SESSION_MISSING" } };
  const option = (unit: Unit) => {
    const { blocked, is_default: _, ...rest } = unit;
    return { ...rest, org_legal_name: null, membership_type: "EMPLOYEE", status: "ACTIVE", provisioning_status: "READY",
      application_code: "SUPERPLATFORM", eligible: !blocked, reason_code: blocked?.reason_code ?? null,
      reason_message: blocked?.reason_message ?? null, suggested_action: blocked?.suggested_action ?? null,
      status_name: blocked?.status_name ?? "Đang hoạt động", status_tone: blocked?.status_tone ?? "SUCCESS", selectable: !blocked,
      next_action: blocked ? "NONE" : mfa ? "SELECT" : "VERIFY_MFA",
      is_default: unit.membership_id === state.defaultId, is_current: active?.membership_id === unit.membership_id };
  };
  const list = () => [...state.units].sort((a, b) => Number(b.membership_id === active?.membership_id) - Number(a.membership_id === active?.membership_id)
    || typeRank(a.org_type) - typeRank(b.org_type) || byName(a.org_type_name, b.org_type_name) || byName(a.org_name, b.org_name)).map(option);
  const context = () => active && { context_id: `context-${active.org_code}`, active_membership_id: active.membership_id,
    org_code: active.org_code, org_name: active.org_name, application_code: "SUPERPLATFORM", org_type_name: active.org_type_name, title: active.title };
  const session = () => ({ session_id: "login-session", expires_at: at(86400), assurance_level: mfa ? 2 : 1, next_action: "SELECT_CONTEXT",
    identity_id: "identity-thu-ha", full_name: FULL_NAME, avatar_url: null, available_memberships: list(), active_context: context(),
    trust_offer_expires_at: null });

  // Checked last of the overrides: anything about "me" before the sign-in, or after the sign-out, has no session.
  mock.on("GET", /^\/v1\/me\//, () => state.signedIn ? undefined : missing);
  mock.on("POST", "/v1/sessions", body => {
    // The hidden call of primeSignIn() goes on to the stand-in, which then answers what follows a sign-in.
    if (body?.capture_prime) return undefined;
    if (body?.password !== PASSWORD) return undefined;
    state.signedIn = true;
    return { data: session() };
  });
  mock.on("GET", "/v1/me/session", () => state.signedIn ? { message: "Đã lấy phiên đăng nhập.", data: session() }
    : { message: "Chưa có phiên đăng nhập.", data: null });
  mock.on("GET", "/v1/me/memberships", () => state.signedIn ? { message: "Đã tải danh sách đơn vị làm việc.", data: list() } : missing);
  // The stand-in's own check of the code still answers; this only notes that MFA is done.
  mock.on("POST", "/v1/me/mfa/verify", body => { if (body?.code === MFA_CODE) mfa = true; return undefined; });
  mock.on("PUT", "/v1/me/access-context", body => {
    active = state.units.find(unit => unit.membership_id === body?.membership_id) ?? null;
    return undefined;
  });
  mock.on("PUT", "/v1/me/default-membership", body => {
    state.defaultId = body?.membership_id ?? null;
    return { message: state.defaultId ? "Đã đặt đơn vị làm việc mặc định." : "Đã bỏ đơn vị làm việc mặc định.", data: null };
  });
  mock.on("DELETE", "/v1/me/sessions/current", () => {
    state.signedIn = false; active = null;
    return { message: "Đã đăng xuất.", data: { revoked_session_count: 1, revoked_context_count: 0 } };
  });
  return state;
}

/** A flow of this sub-Section; {@code units} is the list the sign-in hands out. The id gets "superplatform-dang-nhap-chon-don-vi-". */
export function unitFlow(id: string, name: string, units: Unit[],
                         run: (ctx: LoginContext & { units: UnitsMock }) => Promise<void>, setup: LoginSetup = {}) {
  return loginFlow(`chon-don-vi-${id}`, GROUP, name, async ctx => {
    const state = mockUnits(ctx.mock, units);
    await run({ ...ctx, units: state });
  }, setup);
}

/**
 * The login page, then a hidden sign-in the page never sees: the stand-in only lets the calls after a sign-in through once
 * it answered one itself, and the visible sign-in is answered with this flow's list instead.
 */
export async function openUnitsLogin(page: Page) {
  await openLogin(page);
  await page.evaluate(async ({ identifier, password }) => {
    await fetch("/api/backend/v1/sessions", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password, capture_prime: true }) });
  }, { identifier: EMAIL, password: PASSWORD });
}

/* ---- The picker ---- */

export const searchField = (page: Page) => page.getByPlaceholder("Tìm theo tên hoặc mã đơn vị");
export const unitRow = (page: Page, unit: Unit) => page.locator("label").filter({ has: page.getByText(unit.org_name, { exact: true }) });
export const starButton = (page: Page, unit: Unit) => page.locator("div").filter({ has: unitRow(page, unit) }).last()
  .getByRole("button", { name: /đơn vị mặc định/i });
export const continueButton = (page: Page) => page.getByRole("button", { name: "Tiếp tục", exact: true });
