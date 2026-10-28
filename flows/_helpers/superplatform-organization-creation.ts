import type { Locator, Page } from "playwright";
import { expect } from "playwright/test";
import { defineFlow, type FlowContext } from "../../capture";
import { mockPin } from "./superplatform-screen-lock";
import { franchiseGroup } from "./superplatform-franchise-sections";

/*
 * "Thêm đối tác nhượng quyền" (/workspace/organizations/new/franchise) and "Mở bưu cục"
 * (/workspace/organizations/{franchise}/post-offices/new) of SuperPlatform, against an in-browser stand-in of
 * POST /v1/franchises, POST /v1/franchises/{id}/post-offices and the directory and detail pages around them.
 * The page clock is frozen by mockPin at 12/10/2026, so "today" and every date below stay the same on each run.
 */

export const LIST_URL = "/workspace/organizations";
export const STEP_UP_CODE = "515060";
const AT = "2026-10-12T02:00:00.000Z";
const LATER = "2026-10-12T02:05:00.000Z";

/** Exact sentences of the backend (CompanyEmailDomainRules, OperationalCreationSupport, MfaUnitOfWork). */
export const MESSAGES = {
  domainTaken: "Tên miền Email công ty đã được dùng cho đơn vị khác.",
  wardOutside: "Phường, xã không thuộc tỉnh đã chọn.",
  franchiseSuspended: "NHƯỢNG QUYỀN HÀ ĐÔNG đang tạm ngưng, không mở được bưu cục.",
  wrongCode: "Mã xác thực không đúng hoặc đã được sử dụng.",
  forbiddenPostOffice: "Bạn không có quyền mở bưu cục.",
};

const unit = (id: string, code: string, name: string, type_code: string, type_name: string, parent: { id: string; name: string } | null) =>
  ({ id, code, name, type_code, type_name, parent_id: parent?.id ?? null, parent_name: parent?.name ?? null });

export const CORPORATION = unit("org-corp", "CTT29DH7NDV", "CÔNG TY CỔ PHẦN SUPERSHIP VIỆT NAM", "CORPORATION", "Tổng công ty", null);
export const FRANCHISE = unit("org-hd", "NQT01P4X8N2", "NHƯỢNG QUYỀN HÀ ĐÔNG", "FRANCHISE_PARTNER", "Nhượng quyền", CORPORATION);
const FRANCHISES = [
  { ...unit("org-hcm", "CTT29Y5S0B0", "CÔNG TY TNHH SUPERSHIP HỒ CHÍ MINH", "FRANCHISE_PARTNER", "Nhượng quyền", CORPORATION),
    locality: "Phường Tân Bình, Thành phố Hồ Chí Minh", phone: "0907628341", registration_number_display: "0316284502", post_office_count: "2", created_at: "2024-01-01T01:00:00Z" },
  { ...unit("org-hn", "CTT01DFQ9Z1", "CÔNG TY TNHH SUPERSHIP HÀ NỘI", "FRANCHISE_PARTNER", "Nhượng quyền", CORPORATION),
    locality: "Phường Từ Liêm, Thành phố Hà Nội", phone: "0983657214", registration_number_display: "0109358703", post_office_count: "1", created_at: "2024-01-02T01:00:00Z" },
  { ...unit("org-dn", "CTT218GXDKV", "HỘ KINH DOANH SUPERSHIP ĐÀ NẴNG", "FRANCHISE_PARTNER", "Nhượng quyền", CORPORATION),
    locality: "Phường Ngũ Hành Sơn, Thành phố Đà Nẵng", phone: "0905286147", registration_number_display: "********4217", post_office_count: "1", created_at: "2024-01-03T01:00:00Z" },
  { ...unit("org-gl", "CTT24W45Z2X", "NHƯỢNG QUYỀN SUPERSHIP GIA LAI", "FRANCHISE_PARTNER", "Nhượng quyền", CORPORATION),
    locality: "Phường Pleiku, Tỉnh Gia Lai", phone: "0973641852", registration_number_display: "********6358", post_office_count: "1", created_at: "2024-01-04T01:00:00Z" },
  { ...FRANCHISE, locality: "Phường Hà Đông, Thành phố Hà Nội", phone: "02433556789", registration_number_display: "0109876543", post_office_count: "2", created_at: "2025-03-10T01:00:00Z" },
];
const POST_OFFICES = [
  { ...unit("org-yn", "BCT01H6C8V3", "BƯU CỤC YÊN NGHĨA", "POST_OFFICE", "Bưu cục", FRANCHISE),
    locality: "Phường Yên Nghĩa, Thành phố Hà Nội", phone: "02433551188", operation_model_name: "Bưu cục giao nhận", created_at: "2025-04-01T01:00:00Z" },
  { ...unit("org-dn2", "BCT01B9F4L7", "BƯU CỤC DƯƠNG NỘI", "POST_OFFICE", "Bưu cục", FRANCHISE),
    locality: "Phường Dương Nội, Thành phố Hà Nội", phone: "02433552266", operation_model_name: "Bưu cục lấy", created_at: "2025-05-12T01:00:00Z" },
];
const PROVINCES = [
  { code: "P01", name: "Thành phố Hà Nội" }, { code: "P02", name: "Thành phố Hải Phòng" },
  { code: "P21", name: "Thành phố Đà Nẵng" }, { code: "P29", name: "Thành phố Hồ Chí Minh" },
];
const WARDS: Record<string, { code: string; name: string }[]> = {
  P01: ["Phường Hà Đông", "Phường Dương Nội", "Phường Kiến Hưng", "Phường Yên Nghĩa", "Phường Phú Lương", "Phường Cầu Giấy"]
    .map((name, i) => ({ code: `P01C${String(i + 1).padStart(4, "0")}`, name })),
  P02: ["Phường Hồng Bàng", "Phường Ngô Quyền", "Phường Lê Chân"].map((name, i) => ({ code: `P02C${String(i + 1).padStart(4, "0")}`, name })),
  P21: ["Phường Hải Châu", "Phường Ngũ Hành Sơn"].map((name, i) => ({ code: `P21C${String(i + 1).padStart(4, "0")}`, name })),
  P29: ["Phường Sài Gòn", "Phường Tân Bình", "Phường Tân Sơn Hòa"].map((name, i) => ({ code: `P29C${String(i + 1).padStart(4, "0")}`, name })),
};
const OPERATION_MODELS = [
  { code: "DELIVERY_PICKUP", name: "Bưu cục giao nhận", description: "Vừa lấy hàng tại Shop vừa giao hàng tới người nhận trong khu vực phụ trách." },
  { code: "PICKUP", name: "Bưu cục lấy", description: "Lấy hàng tại địa chỉ của Shop rồi chuyển về kho; không giao hàng tới người nhận." },
  { code: "DELIVERY", name: "Bưu cục giao", description: "Nhận hàng từ kho và giao tới người nhận trong khu vực phụ trách; không lấy hàng tại Shop." },
];
const CONTACT_TYPES = [
  { code: "PHONE", name: "Số điện thoại", value_kind: "PHONE", required: true },
  { code: "EMAIL", name: "Email", value_kind: "EMAIL", required: false },
  { code: "WEBSITE", name: "Website", value_kind: "URL", required: false },
];
const FRANCHISE_OPTIONS = {
  parent: { id: CORPORATION.id, name: CORPORATION.name }, belongs_to_label: "Thuộc",
  legal_forms: [{ code: "ENTERPRISE", name: "Doanh nghiệp" }, { code: "HOUSEHOLD_BUSINESS", name: "Hộ kinh doanh" }, { code: "INDIVIDUAL", name: "Cá nhân" }],
  enterprise_types: [
    { code: "LLC_ONE_MEMBER", name: "Công ty TNHH một thành viên" }, { code: "LLC_MULTI_MEMBER", name: "Công ty TNHH hai thành viên trở lên" },
    { code: "JOINT_STOCK", name: "Công ty cổ phần" }, { code: "PARTNERSHIP", name: "Công ty hợp danh" }, { code: "PRIVATE_ENTERPRISE", name: "Doanh nghiệp tư nhân" },
  ],
  basis_document_types: [
    { code: "BUSINESS_REGISTRATION_CERTIFICATE", name: "Giấy chứng nhận đăng ký doanh nghiệp", default_for: ["ENTERPRISE"] },
    { code: "HOUSEHOLD_REGISTRATION_CERTIFICATE", name: "Giấy chứng nhận đăng ký hộ kinh doanh", default_for: ["HOUSEHOLD_BUSINESS"] },
    { code: "COMPANY_CHARTER", name: "Điều lệ công ty", default_for: [] }, { code: "APPOINTMENT_DECISION", name: "Quyết định bổ nhiệm", default_for: [] },
    { code: "POWER_OF_ATTORNEY", name: "Giấy ủy quyền", default_for: [] }, { code: "AUTHORIZATION_CONTRACT", name: "Hợp đồng ủy quyền", default_for: [] },
  ],
  representative_rules: {
    LLC_ONE_MEMBER: { min: 1, max: null, name_from: null, fixed_title: null }, LLC_MULTI_MEMBER: { min: 1, max: null, name_from: null, fixed_title: null },
    JOINT_STOCK: { min: 1, max: null, name_from: null, fixed_title: null }, PARTNERSHIP: { min: 1, max: null, name_from: null, fixed_title: null },
    PRIVATE_ENTERPRISE: { min: 1, max: 1, name_from: null, fixed_title: null },
    HOUSEHOLD_BUSINESS: { min: 1, max: 1, name_from: "household_owner_name", fixed_title: "Chủ hộ kinh doanh" },
    INDIVIDUAL: { min: 0, max: 0, name_from: null, fixed_title: null },
  },
  contact_types: CONTACT_TYPES,
  address_types: [{ code: "TRANSACTION_OFFICE", name: "Văn phòng giao dịch", required: false }],
  limits: { name: 200, logo_bytes: 5 * 1024 * 1024, document_bytes: 10 * 1024 * 1024, document_types: ["application/pdf", "image/jpeg", "image/png"] },
};

/** Same picture the franchise flow uploads, shown on the profile after it is added. */
export const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="32" fill="#0f766e"/><text x="80" y="88" font-family="sans-serif" font-weight="bold" font-size="64" fill="#fff" text-anchor="middle" dominant-baseline="middle">HĐ</text></svg>';
const LOGO_URL = `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`;

type Role = "admin" | "manager";
interface Rejection { status: number; code: string; message: string; fields?: Record<string, string> }
export interface CreationMock {
  /** Server answers to the next submissions, in order, before the code is asked. */
  rejections: Rejection[];
  /** Status of the franchise a post office opens under. */
  franchiseStatus: "ACTIVE" | "SUSPENDED";
  created: Record<string, any> | null;
  input: any;
  logo: boolean;
  document: boolean;
  writes: number;
}
export interface CreationContext extends FlowContext { mock: CreationMock }

function capability(key: string, admin: boolean) {
  return {
    permission_key: key, allowed: true, available: true, availability: "AVAILABLE", requires_mfa: false,
    requires_approval: false, required_scope_types: ["ORGANIZATION"], rejection_reasons: [],
    grants: [{ assignment_id: "capture-grant", source_type: "ROLE_VERSION", effect: "ALLOW", role_id: null, role_version_id: null,
      scopes: [{ scope_type: "ORGANIZATION", organization_mode: admin ? "GLOBAL" : "SELF", anchor_organization_id: admin ? null : FRANCHISE.id,
        organization_ids: [], application_ids: [], resources: [], attribute_conditions: [] }] }],
  };
}

export function creationFlow(feature: "nhuong-quyen" | "buu-cuc", { id, name, role = "admin", setup = {}, run }: {
  id: string; name: string; role?: Role; setup?: Partial<CreationMock>; run: (ctx: CreationContext) => Promise<void>;
}) {
  return defineFlow({
    id: `superplatform-${feature}-${id}`, name, app: "superplatform",
    group: franchiseGroup(feature),
    async run(ctx) {
      const mock: CreationMock = { rejections: [], franchiseStatus: "ACTIVE", created: null, input: null,
        logo: false, document: false, writes: 0, ...setup };
      await mockCreation(ctx.page, ctx.log, role, mock);
      await run({ ...ctx, mock });
    },
  });
}

async function mockCreation(page: Page, log: (line: string) => void, role: Role, mock: CreationMock) {
  await mockPin(page, log, false);
  const admin = role === "admin";
  // A franchise manager keeps the legal profile of their own franchise but, by default, cannot open a post office.
  const capabilities = ["identity.view", "organization.view", "organization.profile.update", "organization.contact.manage",
    "organization.address.manage", "organization.legal_entity.view",
    ...(admin ? ["organization.franchise.create", "organization.post_office.create", "organization.legal_entity.update",
      "organization.legal_entity.view_sensitive", "organization.legal_entity.verify"] : ["organization.legal_entity.update"])];
  // Registered after mockPin, so it is asked first and falls back to it for the session calls.
  await page.context().route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/backend/, "");
    const method = request.method();
    const send = (data: unknown, status = 200, message = "") => route.fulfill({ status,
      headers: { "X-Browser-Session-Version": "1" }, json: { error: status >= 400, message, data } });
    const franchiseRow = () => ({ ...FRANCHISES.at(-1)!, status: mock.franchiseStatus, status_name: mock.franchiseStatus === "ACTIVE" ? "Đang hoạt động" : "Tạm ngưng" });
    const createdRow = () => mock.created && {
      ...unit(mock.created.id, mock.created.code, mock.created.name, mock.created.type_code,
        mock.created.type_code === "POST_OFFICE" ? "Bưu cục" : "Nhượng quyền", { id: mock.created.parent_id, name: mock.created.parent_name }),
      locality: "", phone: mock.input?.contacts?.PHONE ?? null, created_at: LATER,
    };
    const rows = () => [
      ...FRANCHISES.slice(0, -1).map(row => ({ ...row, status: "ACTIVE", status_name: "Đang hoạt động" })), franchiseRow(),
      ...POST_OFFICES.map(row => ({ ...row, status: "ACTIVE", status_name: "Đang hoạt động" })),
      ...(mock.created ? [{ ...createdRow()!, status: "ACTIVE", status_name: "Đang hoạt động" }] : []),
    ].map(row => ({ operation_model_name: null, blocked_message: null, registration_number_display: null, post_office_count: null as string | null, ...row }));
    const summary = (row: ReturnType<typeof rows>[number]) => ({ id: row.id, code: row.code, name: row.name, type_code: row.type_code,
      type_name: row.type_name, parent_id: row.parent_id, parent_name: row.parent_name, status: row.status, status_name: row.status_name,
      valid_from: row.created_at, valid_to: null, created_at: row.created_at });

    if (path === "/v1/me/capabilities") return send({
      context: { context_id: "pin-context", context_type: "SUPERPLATFORM", application_name: "SUPERPLATFORM", membership_id: "pin-member", organization_id: "pin-org" },
      assurance: { level: 2, mfa_verified: true, mfa_verified_at: AT }, capabilities: capabilities.map(key => capability(key, admin)),
      revision: "capture", generated_at: AT, expires_at: LATER,
    });

    /* ---- Shell ---- */
    if (path === "/v1/me/employee-invitations/count") return send({ pending: 0 });
    // The sidebar shows "Tổ chức" from this answer; the shop list stays out of these pictures.
    if (path === "/v1/shops/list-options") return send({ internal_allowed: true, shops_allowed: false, types: [], statuses: [],
      franchises: [], post_offices: [], operation_models: [] });

    /* ---- Directory ---- */
    if (path === "/v1/organizations/list-options") {
      // Asked by a franchise's "Bưu cục" tab: that franchise's "Mở bưu cục" (only with organization.post_office.create,
      // greyed while it is suspended) and its empty sentence, as OrganizationDirectoryService.metadata answers.
      const franchiseId = url.searchParams.get("franchiseId");
      const page = franchiseId ? rows().find(row => row.id === franchiseId) : null;
      if (franchiseId && (!page || page.type_code !== "FRANCHISE_PARTNER")) return send({ code: "ORGANIZATION_NOT_FOUND" }, 404, "Không tìm thấy nhượng quyền.");
      const openPostOffice = !page || !admin ? { available: false, enabled: false, disabled_reason: null }
        : page.status === "ACTIVE" ? { available: true, enabled: true, disabled_reason: null }
          : { available: true, enabled: false, disabled_reason: `${page.name} đang tạm ngưng, không mở được bưu cục.` };
      return send({
      internal_allowed: true, shops_allowed: false,
      viewer_type: admin ? "CORPORATION" : "FRANCHISE_PARTNER", viewer_organization_id: admin ? CORPORATION.id : FRANCHISE.id,
      tabs: admin ? [{ code: "FRANCHISE_PARTNER", name: "Nhượng quyền" }, { code: "POST_OFFICE", name: "Bưu cục" }] : [{ code: "POST_OFFICE", name: "Bưu cục" }],
      sorts: { FRANCHISE_PARTNER: [{ code: "created_desc", name: "Mới thêm trước" }, { code: "name_asc", name: "Tên A–Z" }],
        POST_OFFICE: [{ code: "created_desc", name: "Mới thêm trước" }, { code: "name_asc", name: "Tên A–Z" }] },
      page_sizes: [20, 50, 100],
      create_franchise: { available: admin, enabled: admin, disabled_reason: null },
      open_post_office: openPostOffice,
      empty_message: page ? `${page.name} chưa có bưu cục nào.` : null,
      types: [{ code: "FRANCHISE_PARTNER", name: "Nhượng quyền" }, { code: "POST_OFFICE", name: "Bưu cục" }],
      statuses: [{ code: "OPERATING", name: "Đang hoạt động và Tạm ngưng" }, { code: "ACTIVE", name: "Đang hoạt động" }, { code: "SUSPENDED", name: "Tạm ngưng" },
        { code: "CLOSED", name: "Ngừng hoạt động" }, { code: "ALL", name: "Tất cả" }],
      franchises: rows().filter(row => row.type_code === "FRANCHISE_PARTNER").map(row => ({ id: row.id, code: row.code, name: row.name, parent_id: row.parent_id })),
      post_offices: rows().filter(row => row.type_code === "POST_OFFICE").map(row => ({ id: row.id, code: row.code, name: row.name, parent_id: row.parent_id })),
      operation_models: OPERATION_MODELS.map(({ code, name }) => ({ code, name })),
    });
    }
    if (path === "/v1/organization-directory/regions" || path === "/v1/franchises/creation-regions") {
      const province = url.searchParams.get("provinceCode") ?? url.searchParams.get("province_code");
      return send(province ? WARDS[province] ?? [] : PROVINCES);
    }
    if (path === "/v1/organizations" && method === "GET") {
      const type = url.searchParams.get("typeCode"), franchise = url.searchParams.get("franchiseId");
      const items = rows().filter(row => (!type || row.type_code === type) && (!franchise || row.parent_id === franchise))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return send({ items, page: 0, size: 20, has_next: false, total_elements: items.length, total_pages: 1 });
    }

    /* ---- Creation ---- */
    if (path === "/v1/franchises/creation-options") return send(FRANCHISE_OPTIONS);
    const officeOptions = path.match(/^\/v1\/franchises\/([^/]+)\/post-office-creation-options$/);
    if (officeOptions) {
      if (!admin) return send({ code: "POST_OFFICE_CREATE_FORBIDDEN" }, 403, MESSAGES.forbiddenPostOffice);
      const blocked = mock.franchiseStatus === "ACTIVE" ? null : MESSAGES.franchiseSuspended;
      return send({ franchise: { id: FRANCHISE.id, name: FRANCHISE.name, status: mock.franchiseStatus, status_name: franchiseRow().status_name },
        can_open: !blocked, blocked_reason: blocked, operation_models: OPERATION_MODELS,
        address_types: [{ code: "SERVICE_POINT", name: "Địa chỉ điểm phục vụ", required: true }], contact_types: CONTACT_TYPES.slice(0, 2) });
    }
    const office = path.match(/^\/v1\/franchises\/([^/]+)\/post-offices$/);
    if ((path === "/v1/franchises" || office) && method === "POST") {
      const input = readInput(request);
      const rejection = mock.rejections.shift();
      if (rejection) return send({ code: rejection.code, ...(rejection.fields ? { fields: rejection.fields } : {}) }, rejection.status, rejection.message);
      if (mock.created) return send(mock.created, 201);
      const name = String(input.name).trim();
      const code = request.headers()["x-step-up-code"];
      if (!code) return send({ code: "STEP_UP_REQUIRED", challenge_id: `challenge-${mock.writes + 1}`,
        action: office ? "POST_OFFICE_CREATE" : "FRANCHISE_CREATE",
        summary: office ? `Mở ${name} (${OPERATION_MODELS.find(m => m.code === input.operation_model)?.name}) cho ${FRANCHISE.name}`
          : `Thêm đối tác nhượng quyền ${name} (${input.legal.registered_name}), thuộc ${CORPORATION.name}`,
        method: "AUTHENTICATOR", expires_at: LATER }, 403, "Hãy nhập mã xác thực.");
      if (code !== STEP_UP_CODE) return send({ code: "MFA_INVALID_CODE" }, 400, MESSAGES.wrongCode);
      const parts = multipartNames(request);
      mock.writes++; mock.input = input; mock.logo = parts.includes("logo"); mock.document = parts.includes("registration_document");
      const base = { id: "org-new", name: name.toLocaleUpperCase("vi"), status: "ACTIVE", operation_start_date: input.operation_start_date,
        logo_url: mock.logo ? LOGO_URL : null, created_at: LATER };
      mock.created = office
        ? { ...base, code: "BCT01K7M9Q2", type_code: "POST_OFFICE", parent_id: FRANCHISE.id, parent_name: FRANCHISE.name,
            operation_model: { ...OPERATION_MODELS.find(m => m.code === input.operation_model)!, version: 1 } }
        : { ...base, code: "NQT01Q5Z3R8", type_code: "FRANCHISE_PARTNER", parent_id: CORPORATION.id, parent_name: CORPORATION.name,
            email_domain: input.email_domain ?? null, legal_profile: { id: "legal-new", verification_status: "UNVERIFIED" },
            representative_ids: (input.representatives ?? []).map((_: unknown, i: number) => `rep-${i + 1}`), management_status: "NO_MANAGER" };
      return send(mock.created, 201);
    }

    /* ---- Overview of a unit (GET /v1/admin/organizations/{id}/profile|status) ---- */
    const admin_ = path.match(/^\/v1\/admin\/organizations\/([^/]+)\/(profile|status)$/);
    if (admin_ && method === "GET") {
      const [, orgId, what] = admin_;
      const row = rows().find(item => item.id === orgId);
      if (!row) return send({ code: "ORGANIZATION_NOT_FOUND" }, 404, "Không tìm thấy đơn vị.");
      const fresh = orgId === "org-new";
      const postOffice = row.type_code === "POST_OFFICE";
      const on = { available: true, enabled: true, disabled_reason: null };
      const off = { available: false, enabled: false, disabled_reason: null };
      if (what === "status") return send({ organization_id: row.id, name: row.name, status: "ACTIVE", status_name: "Đang hoạt động",
        version: 1, since: null, closed_on: null, operation_start_date: fresh ? mock.input.operation_start_date : "2025-03-10",
        blocked_by: null, actions: { suspend: admin ? on : off, reactivate: off, close: admin ? on : off },
        dialogs: admin ? { suspend_impact: `${row.name} sẽ không làm việc được.`, reactivate_impact: "",
          close_warning: `${row.name} sẽ ngừng hoạt động vĩnh viễn, không kích hoạt lại được. Dữ liệu được giữ để tra cứu.`, close_missing: [] } : null });
      const input = fresh ? mock.input : null;
      const model = postOffice ? OPERATION_MODELS.find(m => m.code === (input?.operation_model ?? "DELIVERY_PICKUP"))! : null;
      const address = input ? (input.addresses?.SERVICE_POINT ?? input.office_address) : null;
      const province = PROVINCES.find(p => p.code === address?.province_code);
      const ward = WARDS[address?.province_code ?? ""]?.find(w => w.code === address?.ward_code);
      const phone = input ? input.contacts?.PHONE ?? null : (row as { phone?: string }).phone ?? null;
      const email = input ? input.contacts?.EMAIL ?? null : null;
      const legal = input?.legal;
      return send({
        id: row.id, code: row.code, name: row.name, logo_url: fresh && mock.logo ? LOGO_URL : null,
        type_code: row.type_code, type_name: postOffice ? "Bưu cục" : "Đối tác nhượng quyền", status: "ACTIVE", status_name: "Đang hoạt động",
        operation_start_date: input?.operation_start_date ?? "2025-03-10", created_at: row.created_at, version: 1,
        parent: row.parent_id ? { id: row.parent_id, name: row.parent_name } : null,
        created_by: { full_name: admin ? "Lê Thu Hà" : "Trần Quốc Bảo", organization_name: admin ? CORPORATION.name : FRANCHISE.name },
        operation_model: model ? { code: model.code, name: model.name, since: row.created_at } : null,
        legal: postOffice
          ? { declared: true, via_franchise_name: FRANCHISE.name, legal_form_name: "Doanh nghiệp", enterprise_type_name: "Công ty TNHH một thành viên",
              registered_name: "CÔNG TY TNHH VẬN CHUYỂN HÀ ĐÔNG", registration_number_display: "0109876543", verification_status: "VERIFIED",
              verification_status_name: "Đã xác minh", registered_address: "Số 18 Quang Trung, Phường Hà Đông, Thành phố Hà Nội", invoice_email: null }
          : legal
            ? { declared: true, via_franchise_name: null, legal_form_name: FRANCHISE_OPTIONS.legal_forms.find(f => f.code === legal.legal_form)?.name ?? null,
                enterprise_type_name: FRANCHISE_OPTIONS.enterprise_types.find(t => t.code === legal.enterprise_type)?.name ?? null,
                registered_name: legal.registered_name, registration_number_display: legal.legal_form === "ENTERPRISE"
                  ? legal.registration_number : `********${String(legal.registration_number).slice(-4)}`,
                verification_status: "UNVERIFIED", verification_status_name: "Chưa xác minh", registered_address: null, invoice_email: legal.invoice_email ?? null }
            : { declared: false, via_franchise_name: null, legal_form_name: null, enterprise_type_name: null, registered_name: null,
                registration_number_display: null, verification_status: null, verification_status_name: null, registered_address: null, invoice_email: null },
        legal_representatives: postOffice ? null : (input?.representatives ?? []).map((rep: { full_name: string; position_title?: string }) =>
          ({ full_name: rep.full_name, position_title: rep.position_title ?? null })),
        contacts: [["PHONE", "Số điện thoại", phone], ["EMAIL", "Email", email], ...(postOffice ? [] : [["WEBSITE", "Website", input?.contacts?.WEBSITE ?? null]])]
          .map(([type, type_name, value]) => ({ type, type_name, value: value ?? "Chưa có", missing: !value })),
        addresses: [[postOffice ? "SERVICE_POINT" : "TRANSACTION_OFFICE", postOffice ? "Địa chỉ điểm phục vụ" : "Văn phòng giao dịch"]]
          .map(([type, type_name]) => {
            const value = address ? [address.address_line, ward?.name, province?.name].filter(Boolean).join(", ") : null;
            return { type, type_name, value: value ?? "Chưa có", missing: !value };
          }),
        actions: { edit: on, change_logo: on, change_operation_model: postOffice && admin ? on : off },
      });
    }

    /* ---- Detail pages ---- */
    const match = path.match(/^\/v1\/organizations\/([^/]+)(\/.*)?$/);
    if (match && method === "GET") {
      const [, orgId, rest = ""] = match;
      const row = orgId === CORPORATION.id ? { ...CORPORATION, status: "ACTIVE", status_name: "Đang hoạt động", created_at: "2016-02-01T01:00:00Z" }
        : rows().find(item => item.id === orgId);
      if (!row) return send({ code: "ORGANIZATION_NOT_FOUND" }, 404, "Không tìm thấy tổ chức.");
      const fresh = orgId === "org-new";
      if (rest === "") return send(summary(row as ReturnType<typeof rows>[number]));
      if (rest === "/profile") return send({ id: row.id, code: row.code, name: row.name, logo_url: fresh && mock.logo ? LOGO_URL : null,
        type: { id: `type-${row.type_code}`, code: row.type_code, name: row.type_name }, internal: true, status: row.status,
        operation_start_date: fresh ? mock.input.operation_start_date : "2025-03-10",
        valid_from: row.created_at, valid_to: null, version: 1, user_model: "MULTI_USER", created_at: row.created_at, updated_at: row.created_at });
      if (rest === "/breadcrumb") return send({ items: [CORPORATION, ...(row.type_code === "POST_OFFICE" ? [FRANCHISE] : []), row]
        .map(item => ({ ...item, status: "ACTIVE", valid_from: AT, valid_to: null, created_at: AT })) });
      if (rest === "/children") return send({ items: [], page: 0, size: 20, has_next: false });
      if (rest === "/contacts") {
        const contacts = fresh ? Object.entries(mock.input.contacts ?? {}) : [["PHONE", (row as { phone?: string }).phone ?? "02433556789"]];
        return send({ contacts: contacts.map(([type, value], i) => ({ id: `contact-${i}`, contact_type: type, value, label: null,
          is_primary: true, status: "ACTIVE", valid_from: LATER, valid_to: null, created_at: LATER, updated_at: LATER })) });
      }
      if (rest === "/addresses") {
        const address = fresh ? (mock.input.addresses?.SERVICE_POINT ?? mock.input.office_address) : null;
        const province = PROVINCES.find(p => p.code === address?.province_code);
        const ward = WARDS[address?.province_code ?? ""]?.find(w => w.code === address?.ward_code);
        return send({ addresses: address ? [{ id: "address-1", address_type: mock.input.addresses ? "SERVICE_POINT" : "TRANSACTION_OFFICE",
          address_line: address.address_line, region_level: "LEVEL_2", ward_code: ward?.code ?? null, ward_name: ward?.name ?? null,
          district_code: null, district_name: null, province_code: province?.code ?? null, province_name: province?.name ?? null,
          is_primary: true, status: "ACTIVE", valid_from: LATER, valid_to: null, created_at: LATER, updated_at: LATER }] : [] });
      }
    }
    return route.fallback();
  });
}

/** The JSON of the "request" part: both creation calls always send multipart. */
function readInput(request: import("playwright").Request) {
  if (!(request.headers()["content-type"] ?? "").startsWith("multipart/")) return request.postDataJSON();
  const body = request.postDataBuffer()!.toString("latin1");
  const part = body.split(/\r\n--/).find(chunk => /name="request"/.test(chunk))!;
  const json = part.slice(part.indexOf("\r\n\r\n") + 4);
  return JSON.parse(Buffer.from(json, "latin1").toString("utf8"));
}
function multipartNames(request: import("playwright").Request): string[] {
  const body = request.postDataBuffer()?.toString("latin1") ?? "";
  return [...body.matchAll(/name="([^"]+)"/g)].map(found => found[1]!);
}

/* ---- Pages ---- */

export async function openList(page: Page) {
  await page.goto(LIST_URL);
  await page.getByRole("cell", { name: FRANCHISE.name }).first().waitFor();
}
export const addFranchiseButton = (page: Page) => page.getByRole("button", { name: "Thêm đối tác nhượng quyền", exact: true });
/** "Thêm đối tác nhượng quyền", fully loaded (options and the province list). */
export async function openFranchiseForm(page: Page, fromList = false) {
  if (fromList) await addFranchiseButton(page).click();
  else await page.goto("/workspace/organizations/new/franchise");
  await page.getByRole("heading", { name: "Thêm đối tác nhượng quyền", exact: true }).waitFor();
}
export async function openPostOffices(page: Page) {
  await page.goto(`/workspace/organizations/${FRANCHISE.id}/post-offices`);
  await page.getByRole("heading", { name: "Bưu cục", exact: true }).waitFor();
  await page.getByRole("cell", { name: POST_OFFICES[0]!.name }).first().waitFor();
}
export const openPostOfficeButton = (page: Page) => page.getByRole("button", { name: "Mở bưu cục", exact: true });
export async function openPostOfficeForm(page: Page, fromList = false) {
  if (fromList) await openPostOfficeButton(page).click();
  else await page.goto(`/workspace/organizations/${FRANCHISE.id}/post-offices/new`);
  await page.getByRole("heading", { name: `Mở bưu cục cho ${FRANCHISE.name}`, exact: true }).waitFor();
}

/* ---- Controls ---- */

export const field = (page: Page, id: string) => page.locator(`[id="${id}"]`);
/** The custom listbox of a field: opens it, waits for the option and picks it. */
export async function choose(page: Page, id: string, option: string) {
  const trigger = page.locator(`[data-field="${id}"] [role="combobox"]`);
  await expect(trigger).toBeEnabled();
  const target = page.locator(`[id="${id}-options-list"]`).getByRole("option", { name: option, exact: true });
  // Leaving a field that then shows its error re-renders the form and can close the list just opened.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!(await target.isVisible())) await trigger.click();
    try { await target.waitFor({ timeout: 2000 }); break; } catch { /* open it again */ }
  }
  await target.click();
  await expect(trigger).toContainText(option);
}
export async function openChoice(page: Page, id: string, option: string) {
  await page.locator(`[data-field="${id}"] [role="combobox"]`).click();
  await page.locator(`[id="${id}-options-list"]`).getByRole("option", { name: option, exact: true }).waitFor();
}
/** Picks a date (yyyy-mm-dd) in the shared calendar: year, month, then the day of that month. */
export async function pickDate(page: Page, id: string, iso: string) {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  const container = field(page, id).locator("xpath=..");
  await field(page, id).click();
  const calendar = container.getByRole("dialog", { name: "Lịch chọn ngày" });
  await calendar.waitFor();
  await calendar.getByRole("button", { name: "Chọn năm" }).click();
  const years = calendar.getByRole("group", { name: "Danh sách năm" });
  for (let i = 0; i < 10 && !(await years.getByRole("button", { name: String(year), exact: true }).isVisible()); i++) {
    const first = Number((await years.locator("span").first().textContent())?.split("–")[0]);
    await years.getByRole("button", { name: first > year ? "12 năm trước" : "12 năm sau" }).click();
  }
  await years.getByRole("button", { name: String(year), exact: true }).click();
  await calendar.getByRole("button", { name: "Chọn tháng" }).click();
  await calendar.getByRole("group", { name: "Danh sách tháng" }).getByRole("button", { name: `Tháng ${month}`, exact: true }).click();
  // Days of the neighbouring months share the grid: small numbers repeat at the end, large ones at the start.
  const days = calendar.getByRole("button", { name: String(day), exact: true });
  await (day < 15 ? days.first() : days.last()).click();
  await calendar.waitFor({ state: "hidden" });
}
export async function fillAddress(page: Page, prefix: string, line: string, ward = "Phường Hà Đông", province = "Thành phố Hà Nội") {
  await choose(page, `${prefix}.province_code`, province);
  await choose(page, `${prefix}.ward_code`, ward);
  await field(page, `${prefix}.address_line`).fill(line);
}
export const submitButton = (page: Page, label = "Thêm") =>
  page.locator(".organization-creation").getByRole("button", { name: label, exact: true }).last();
/**
 * Presses the form's submit button without moving the pointer: the dev "Figma" and log buttons of the app appear when
 * the pointer nears the bottom-right corner, right over the sticky action bar, and would take the click.
 */
export async function submit(page: Page, label = "Thêm") {
  await submitButton(page, label).evaluate(button => (button as HTMLButtonElement).click());
}
export const confirmDialog = (page: Page, title: string) => page.getByRole("dialog", { name: title });
export async function confirm(page: Page, title: string, label: string) {
  await confirmDialog(page, title).getByRole("button", { name: label, exact: true }).click();
}

/* ---- Filling the forms ---- */

export const NEW_FRANCHISE = { name: "Nhượng quyền Hà Đông 2", saved: "NHƯỢNG QUYỀN HÀ ĐÔNG 2" };

export async function fillGeneral(page: Page, name = NEW_FRANCHISE.name, start = "2026-11-01") {
  await field(page, "name").fill(name);
  await pickDate(page, "operation_start_date", start);
}
/** Doanh nghiệp, công ty TNHH hai thành viên, as on the registration certificate. */
export async function fillEnterprise(page: Page, { number = "0109876543", phone = "024 3355 6789" } = {}) {
  await page.getByRole("radio", { name: "Doanh nghiệp", exact: true }).check();
  await choose(page, "legal.enterprise_type", "Công ty TNHH hai thành viên trở lên");
  await field(page, "legal.registered_name").fill("CÔNG TY TNHH VẬN CHUYỂN HÀ ĐÔNG");
  await field(page, "legal.registration_number").fill(number);
  await field(page, "legal.certificate_number").fill("0109876543");
  await pickDate(page, "legal.certificate_issued_on", "2023-05-16");
  await field(page, "legal.certificate_issuer").fill("Phòng Đăng ký kinh doanh - Sở Tài chính Thành phố Hà Nội");
  await field(page, "legal.latest_amendment_number").fill("2");
  await pickDate(page, "legal.latest_amendment_on", "2025-08-20");
  await fillAddress(page, "legal.address", "Số 25 đường Quang Trung");
  await field(page, "legal.head_office_phone").fill(phone);
  await field(page, "legal.head_office_email").fill("lienhe@vanchuyenhadong.vn");
  await field(page, "legal.invoice_email").fill("ketoan@vanchuyenhadong.vn");
}
/** The representative rows are prefilled with the certificate as basis; only name, title and start date are typed. */
export async function fillRepresentative(page: Page, index: number, name: string, title: string, start: string) {
  await field(page, `representatives.${index}.full_name`).fill(name);
  await field(page, `representatives.${index}.position_title`).fill(title);
  await pickDate(page, `representatives.${index}.start_date`, start);
}
export async function fillFranchiseContacts(page: Page, { phone = "0912 345 678", email = "dieuhanh@vanchuyenhadong.vn" } = {}) {
  await field(page, "contacts.PHONE").fill(phone);
  if (email) await field(page, "contacts.EMAIL").fill(email);
}
/** A complete enterprise franchise with one legal representative. */
export async function fillFranchise(page: Page) {
  await fillGeneral(page);
  await fillEnterprise(page);
  await fillRepresentative(page, 0, "Nguyễn Văn An", "Giám đốc", "2023-05-16");
  await fillFranchiseContacts(page);
}
export async function fillPostOffice(page: Page) {
  await field(page, "name").fill("Bưu cục Văn Quán");
  await pickDate(page, "operation_start_date", "2026-11-15");
  await page.getByRole("radio", { name: "Bưu cục giao nhận", exact: true }).check();
  await fillAddress(page, "addresses.SERVICE_POINT", "Số 12 đường Văn Quán");
  await field(page, "contacts.PHONE").fill("024 3355 1234");
  await field(page, "contacts.EMAIL").fill("buucucvanquan@supership.vn");
}

/** Back to the top of the workspace pane before a full-page picture, with no field left in focus. */
export async function scrollTop(page: Page) {
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); document.querySelectorAll<HTMLElement>(".ui-workspace-content").forEach(node => { node.scrollTop = 0; }); window.scrollTo(0, 0); });
}

/** Brings an element to the top of the workspace pane only, as the app's section rail does, so the header stays put. */
export async function scrollToSection(page: Page, selector: string) {
  await page.locator(selector).first().evaluate(target => {
    (document.activeElement as HTMLElement | null)?.blur();
    const pane = target.closest<HTMLElement>(".ui-workspace-content");
    window.scrollTo(0, 0);
    if (!pane) return;
    pane.scrollTop += target.getBoundingClientRect().top - pane.getBoundingClientRect().top - 20;
  });
}

/* ---- Step-up and result ---- */

export const codeDialog = (page: Page) => page.getByRole("dialog", { name: "Xác nhận thao tác" });
export async function waitCode(page: Page) { await field(page, "step-up-code").waitFor(); }
export async function enterCode(page: Page, code = STEP_UP_CODE) {
  await field(page, "step-up-code").fill(code);
  await codeDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
}
export async function created(page: Page, name: string) {
  await page.waitForURL("**/workspace/organizations/org-new");
  await page.getByRole("heading", { name, exact: true }).first().waitFor();
}
export const toast = (page: Page, text: RegExp) => page.getByText(text).first();
export type { Locator };
