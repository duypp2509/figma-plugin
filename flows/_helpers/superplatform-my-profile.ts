import type { Page, Route } from "playwright";
import { defineFlow, type FlowContext } from "../../capture";
import { mockPin } from "./superplatform-screen-lock";

/*
 * "Thông tin tài khoản" of the SuperPlatform console (/workspace/account/profile, "Hồ sơ" in the account menu), for the
 * signed-in staff member Nguyễn Minh Anh of the workspace stand-in in superplatform-screen-lock.ts. This file answers
 * the profile's own calls; a flow changes an answer with mock.on(), checked first, latest first.
 */

export const PROFILE_URL = "/workspace/account/profile";
export const FULL_NAME = "Nguyễn Minh Anh";
export const PHONE = "0906842735";
export const EMAIL = "minhanh.nguyen@gmail.com";
export const EMPLOYEE_NUMBER = "SST00218";
export const COMPANY_EMAIL = "anh.nm@supership.vn";
const AT = "2026-10-12T02:00:00.000Z";

/** Sentences of the web (MyProfilePage) and the server (EmergencyContactService, IdentityContractService). */
export const MESSAGES = {
  saved: "Cập nhật Thông tin tài khoản thành công.",
  avatarSaved: "Cập nhật ảnh đại diện thành công.",
  nameEmpty: "Vui lòng nhập họ và tên.",
  contactIncomplete: "Nhập đủ họ tên, quan hệ và số điện thoại; hoặc xóa hết để gỡ liên hệ khẩn cấp.",
  contactPhoneInvalid: "Số điện thoại không hợp lệ. Nhập số Việt Nam 10 số.",
  conflict: "Thông tin tài khoản đã được cập nhật ở nơi khác. Hãy tải thông tin mới trước khi chỉnh sửa tiếp.",
  cardLock: "Theo căn cước đã xác thực",
};

export type Reply = { status?: number; message?: string; data?: unknown; abort?: true } | undefined;
export interface Identifier { id: string; type: "PHONE" | "EMAIL"; value: string; verified: boolean }
export interface Contact { name: string | null; relationship: string | null; phone_number: string | null; updated_at: string | null }
export interface ProfileMock {
  fullName: string;
  dateOfBirth: string | null;
  gender: string | null;
  avatarUrl: string | null;
  version: number;
  hasPassword: boolean;
  identifiers: Identifier[];
  /** NONE, VERIFIED, EXPIRING, EXPIRED…: the citizen ID card; a verified one locks name, birth date and gender. */
  documentStatus: string;
  contact: Contact | null;
  /** GET /v1/me/profile-update-request: the signed-in person's open request, or null. */
  request: unknown | null;
  employeeNumber: string | null;
  companyEmail: string | null;
  /** Bodies of every PUT /v1/me/profile, in order. */
  updates: Record<string, unknown>[];
  on(method: string, path: string | RegExp, reply: (body: any) => Reply): void;
}
export type ProfileSetup = Partial<Omit<ProfileMock, "on" | "updates">>;
export interface ProfileContext extends FlowContext { mock: ProfileMock }

/** A flow under SUPERPLATFORM → HỒ SƠ CỦA TÔI → `section`; the id gets "superplatform-ho-so-cua-toi-". */
export function profileFlow(section: string, id: string, name: string, run: (ctx: ProfileContext) => Promise<void>,
                            setup: ProfileSetup = {}) {
  return defineFlow({ id: `superplatform-ho-so-cua-toi-${id}`, name, app: "superplatform",
    group: ["SUPERPLATFORM", "HỒ SƠ CỦA TÔI", section],
    async run(ctx) {
      await mockPin(ctx.page, ctx.log, false);
      const overrides: { method: string; path: string | RegExp; reply: (body: any) => Reply }[] = [];
      const mock: ProfileMock = {
        fullName: FULL_NAME, dateOfBirth: "1994-05-18", gender: "FEMALE", avatarUrl: null, version: 3, hasPassword: true,
        identifiers: [{ id: "id-phone", type: "PHONE", value: PHONE, verified: true }, { id: "id-email", type: "EMAIL", value: EMAIL, verified: true }],
        documentStatus: "NONE", contact: null, request: null, employeeNumber: EMPLOYEE_NUMBER, companyEmail: COMPANY_EMAIL,
        updates: [], ...setup,
        on: (method, path, reply) => { overrides.unshift({ method, path, reply }); },
      };
      await mockProfile(ctx.page, mock, overrides);
      await run({ ...ctx, mock });
    },
  });
}

/** The profile as GET /v1/me/profile answers it. */
export function profileOf(mock: ProfileMock) {
  const locked = ["VERIFIED", "EXPIRING", "EXPIRED"].includes(mock.documentStatus);
  return { identity_id: "pin-identity", person_id: "pin-person", full_name: mock.fullName, date_of_birth: mock.dateOfBirth,
    gender: mock.gender, avatar_url: mock.avatarUrl, status: "ACTIVE", person_version: mock.version, last_login_at: AT,
    identifiers: mock.identifiers, has_password: mock.hasPassword, identity_document_status: mock.documentStatus,
    locked_fields: locked ? ["FULL_NAME", "DATE_OF_BIRTH", "GENDER"].map(field => ({ field, reason: MESSAGES.cardLock })) : [],
    employee_number: mock.employeeNumber, company_email: mock.companyEmail };
}

async function mockProfile(page: Page, mock: ProfileMock, overrides: { method: string; path: string | RegExp; reply: (body: any) => Reply }[]) {
  // Registered after the workspace stand-in, so these answer first; anything else falls back to it.
  await page.context().route("**/api/**", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/backend/, "");
    const method = request.method();
    const send = (data: unknown, status = 200, message = "") => route.fulfill({ status,
      headers: { "X-Browser-Session-Version": "1" }, json: { error: status >= 400, message, data } });
    let body: any = null;
    try { body = request.postDataJSON(); } catch { /* multipart or empty */ }
    for (const override of overrides) {
      if (override.method !== method) continue;
      if (typeof override.path === "string" ? override.path !== path : !override.path.test(path)) continue;
      const reply = override.reply(body);
      if (!reply) continue;
      if (reply.abort) return route.abort("failed");
      return send(reply.data ?? null, reply.status ?? 200, reply.message ?? "");
    }

    if (path === "/v1/me/profile" && method === "GET") return send(profileOf(mock));
    if (path === "/v1/me/profile" && method === "PUT") {
      // UserService.updateProfile: no code with this one.
      if (body.version !== mock.version) return send({}, 409,
        "Hồ sơ Person đã bị thay đổi bởi một yêu cầu khác. Hãy tải lại dữ liệu và thử lại.");
      mock.updates.push(body);
      if ("full_name" in body && body.full_name !== undefined) mock.fullName = body.full_name;
      if ("date_of_birth" in body && body.date_of_birth !== undefined) mock.dateOfBirth = body.date_of_birth;
      if ("gender" in body && body.gender !== undefined) mock.gender = body.gender;
      mock.version++;
      return send(profileOf(mock), 200, "Đã cập nhật hồ sơ.");
    }
    if (path === "/v1/me/emergency-contact" && method === "GET")
      return send(mock.contact ?? { name: null, relationship: null, phone_number: null, updated_at: null });
    if (path === "/v1/me/emergency-contact" && method === "PUT") {
      const empty = !body.name && !body.relationship && !body.phone_number;
      if (!empty && !/^0\d{9}$/.test(String(body.phone_number).replace(/\s/g, "")))
        return send({ code: "VALIDATION_ERROR" }, 400, MESSAGES.contactPhoneInvalid);
      mock.contact = empty ? null : { name: body.name, relationship: body.relationship,
        phone_number: String(body.phone_number).replace(/\s/g, ""), updated_at: AT };
      return send(mock.contact ?? { name: null, relationship: null, phone_number: null, updated_at: null });
    }
    if (path === "/v1/me/profile-update-request" && method === "GET") return send(mock.request);
    if (path === "/v1/me/identity-document" && method === "GET")
      return send({ document: { status: mock.documentStatus, residence: null }, available: true, locked_until: null,
        remaining_attempts: 5, face_scan_available: false });
    // The workspace shell around the page.
    if (path === "/v1/me/reminders") return send({ items: [], banners: [], notices: [] });
    if (path === "/v1/me/employee-invitations/count") return send({ count: 0 });
    if (path === "/v1/public/apps/current") return send({ id: "app-superplatform", code: "SUPERPLATFORM", name: "SuperPlatform",
      app_group: "INTERNAL", status: "ACTIVE" });
    if (path === "/v1/me/access-context/token") return send({ token: "capture-order-token", expires_at: "2026-10-13T02:00:00.000Z" });
    return route.fallback();
  });
}

export async function openProfile(page: Page) {
  await page.goto(PROFILE_URL);
  await page.getByRole("heading", { name: "Thông tin tài khoản" }).waitFor();
  await page.locator("#profile-full-name").waitFor();
}
export const fullNameInput = (page: Page) => page.locator("#profile-full-name");
export const saveButton = (page: Page) => page.getByRole("button", { name: "Cập nhật thông tin", exact: true });
export const contactInput = (page: Page, key: "name" | "relationship" | "phoneNumber") => page.locator(`#profile-emergency-${key}`);
/** The result dialog of a save (ResultDialog), waited for by its sentence. */
export async function result(page: Page, message: string) {
  await page.getByRole("alertdialog").or(page.getByRole("dialog")).getByText(message, { exact: true }).first().waitFor();
}
