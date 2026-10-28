import type { Locator, Page, Route } from "playwright";
import { defineFlow, type FlowContext } from "../../capture";
import { mockTurnstile } from "./turnstile";
import { franchiseGroup } from "./superplatform-franchise-sections";

/*
 * "Danh sách tổ chức" (/workspace/organizations) of SuperPlatform and the "Bưu cục" tab of a franchise
 * (/workspace/organizations/{id}/post-offices), against an in-browser stand-in of GET /v1/organizations/list-options,
 * GET /v1/organizations and GET /v1/organization-directory/regions with the shapes of OrganizationDirectoryService
 * (tabs, sorts per tab, buttons, post_office_count, blocked_message, "⋯" actions). Search, filters, sort and paging are
 * applied here as the server does, so every picture shows what the server would return.
 * The session is our own (not mockPin's) so the workplace in the header is the viewer's: Tổng công ty or a franchise.
 * The page clock is frozen at 12/10/2026 09:00.
 */

export const LIST_URL = "/workspace/organizations";
const START = Date.parse("2026-10-12T09:00:00+07:00");
const AT = new Date(START).toISOString();
const EXPIRY = new Date(START + 86400000).toISOString();

/** Exact sentences of OrganizationDirectoryService. */
export const MESSAGES = {
  noFranchiseList: "Bạn không có quyền xem danh sách nhượng quyền.",
  searchTooLong: "Từ khóa tối đa 100 ký tự.",
  wardOutside: "Phường, xã không thuộc tỉnh đã chọn.",
  provinceFirst: "Hãy chọn tỉnh, thành phố trước.",
};

/* ---- Address catalog: the 34 provinces from 01/07/2025, wards only where a unit sits ---- */

const PROVINCES = [
  ["01", "Thành phố Hà Nội"], ["04", "Tỉnh Cao Bằng"], ["08", "Tỉnh Tuyên Quang"], ["11", "Tỉnh Điện Biên"], ["12", "Tỉnh Lai Châu"],
  ["14", "Tỉnh Sơn La"], ["15", "Tỉnh Lào Cai"], ["19", "Tỉnh Thái Nguyên"], ["20", "Tỉnh Lạng Sơn"], ["22", "Tỉnh Quảng Ninh"],
  ["24", "Tỉnh Bắc Ninh"], ["25", "Tỉnh Phú Thọ"], ["31", "Thành phố Hải Phòng"], ["33", "Tỉnh Hưng Yên"], ["37", "Tỉnh Ninh Bình"],
  ["38", "Tỉnh Thanh Hóa"], ["40", "Tỉnh Nghệ An"], ["42", "Tỉnh Hà Tĩnh"], ["44", "Tỉnh Quảng Trị"], ["46", "Thành phố Huế"],
  ["48", "Thành phố Đà Nẵng"], ["51", "Tỉnh Quảng Ngãi"], ["52", "Tỉnh Gia Lai"], ["56", "Tỉnh Khánh Hòa"], ["66", "Tỉnh Đắk Lắk"],
  ["68", "Tỉnh Lâm Đồng"], ["75", "Tỉnh Đồng Nai"], ["79", "Thành phố Hồ Chí Minh"], ["80", "Tỉnh Tây Ninh"], ["82", "Tỉnh Đồng Tháp"],
  ["86", "Tỉnh Vĩnh Long"], ["91", "Tỉnh An Giang"], ["92", "Thành phố Cần Thơ"], ["96", "Tỉnh Cà Mau"],
].map(([code, name]) => ({ code: code!, name: name! }));
const WARD_NAMES: Record<string, string[]> = {
  "01": ["Phường Ba Đình", "Phường Cầu Giấy", "Phường Dương Nội", "Phường Hà Đông", "Phường Hoàn Kiếm", "Phường Kiến Hưng",
    "Phường Phú Lương", "Phường Từ Liêm", "Phường Yên Nghĩa"],
  "31": ["Phường Hồng Bàng", "Phường Lê Chân", "Phường Ngô Quyền"],
  "46": ["Phường Phú Xuân", "Phường Thuận Hóa"],
  "48": ["Phường Hải Châu", "Phường Ngũ Hành Sơn", "Phường Sơn Trà"],
  "52": ["Phường Hội Phú", "Phường Pleiku", "Phường Quy Nhơn"],
  "79": ["Phường Bến Thành", "Phường Sài Gòn", "Phường Tân Bình", "Phường Tân Sơn Hòa"],
};
const WARDS: Record<string, { code: string; name: string }[]> = Object.fromEntries(Object.entries(WARD_NAMES)
  .map(([province, names]) => [province, names.map((name, i) => ({ code: `${province}${String(i + 1).padStart(3, "0")}`, name }))]));
export const provinceName = (code: string) => PROVINCES.find(p => p.code === code)!.name;
const ward = (province: string, name: string) => WARDS[province]!.find(w => w.name === name)!;

/* ---- Units ---- */

type Status = "ACTIVE" | "SUSPENDED" | "CLOSED";
interface Unit {
  id: string; code: string; name: string; type_code: "FRANCHISE_PARTNER" | "POST_OFFICE"; parent_id: string;
  status: Status; province: string | null; ward: string | null; phone: string | null; created_at: string;
  /** Franchise: legal form and the plain number of the legal profile (null when none was declared). */
  legal?: { form: "ENTERPRISE" | "HOUSEHOLD_BUSINESS" | "INDIVIDUAL"; number: string } | null;
  model?: "DELIVERY_PICKUP" | "PICKUP" | "DELIVERY";
}

export const CORPORATION = { id: "org-corp", code: "CTT29DH7NDV", name: "CÔNG TY CỔ PHẦN SUPERSHIP VIỆT NAM" };
const franchise = (id: string, code: string, name: string, province: string, wardName: string | null, phone: string,
  legal: Unit["legal"], created: string, status: Status = "ACTIVE"): Unit =>
  ({ id, code, name, type_code: "FRANCHISE_PARTNER", parent_id: CORPORATION.id, status, province, ward: wardName && ward(province, wardName).code,
    phone, created_at: `${created}T02:00:00Z`, legal });
const office = (id: string, code: string, name: string, parent: string, model: Unit["model"], province: string, wardName: string,
  phone: string, created: string, status: Status = "ACTIVE"): Unit =>
  ({ id, code, name, type_code: "POST_OFFICE", parent_id: parent, status, province, ward: ward(province, wardName).code, phone,
    created_at: `${created}T02:00:00Z`, model });

export const HA_DONG = franchise("org-hd", "NQT01P4X8N2", "NHƯỢNG QUYỀN HÀ ĐÔNG", "01", "Phường Hà Đông", "02433556789",
  { form: "ENTERPRISE", number: "0109876543" }, "2025-03-10");
export const GIA_LAI = franchise("org-gl", "NQT52W45Z2X", "NHƯỢNG QUYỀN SUPERSHIP GIA LAI", "52", "Phường Pleiku", "0973641852",
  { form: "HOUSEHOLD_BUSINESS", number: "064085006358" }, "2024-06-18", "SUSPENDED");
export const DA_NANG = franchise("org-dn", "NQT48G8XDKV", "HỘ KINH DOANH SUPERSHIP ĐÀ NẴNG", "48", "Phường Ngũ Hành Sơn", "0905286147",
  { form: "HOUSEHOLD_BUSINESS", number: "048090004217" }, "2024-04-02");
export const HAI_PHONG = franchise("org-hp", "NQT31R2M7VB", "NHƯỢNG QUYỀN HẢI PHÒNG", "31", "Phường Ngô Quyền", "0936172845",
  null, "2026-09-28");
const FRANCHISES: Unit[] = [
  HAI_PHONG,
  franchise("org-hue", "NQT46T3K9PL", "CÔNG TY TNHH GIAO NHẬN THUẬN HÓA", "46", "Phường Thuận Hóa", "0234382615",
    { form: "ENTERPRISE", number: "3301654812" }, "2025-11-20"),
  HA_DONG, GIA_LAI, DA_NANG,
  franchise("org-hn", "NQT01DFQ9Z1", "CÔNG TY TNHH SUPERSHIP HÀ NỘI", "01", "Phường Từ Liêm", "0983657214",
    { form: "ENTERPRISE", number: "0109358703" }, "2024-01-15"),
  franchise("org-hcm", "NQT79Y5S0B0", "CÔNG TY TNHH SUPERSHIP HỒ CHÍ MINH", "79", "Phường Tân Bình", "0907628341",
    { form: "ENTERPRISE", number: "0316284502" }, "2024-01-08"),
];
export const VAN_QUAN = office("org-vq", "BCT01K7M9Q2", "BƯU CỤC VĂN QUÁN", HA_DONG.id, "DELIVERY_PICKUP", "01", "Phường Hà Đông", "02433551234", "2026-08-05");
export const QUANG_TRUNG = office("org-qt", "BCT01M2D5T8", "BƯU CỤC QUANG TRUNG", HA_DONG.id, "PICKUP", "01", "Phường Hà Đông", "02433557788", "2026-02-16");
export const PLEIKU = office("org-pk", "BCT52P8N1C6", "BƯU CỤC PLEIKU", GIA_LAI.id, "DELIVERY_PICKUP", "52", "Phường Pleiku", "02693825146", "2024-07-01", "CLOSED");
const POST_OFFICES: Unit[] = [
  VAN_QUAN,
  office("org-kh", "BCT01J4W6R1", "BƯU CỤC KIẾN HƯNG", HA_DONG.id, "DELIVERY", "01", "Phường Kiến Hưng", "0912345678", "2026-05-22"),
  QUANG_TRUNG,
  office("org-th", "BCT46F9B2S5", "BƯU CỤC THUẬN HÓA", "org-hue", "DELIVERY_PICKUP", "46", "Phường Thuận Hóa", "02343826677", "2025-12-08"),
  office("org-dn2", "BCT01B9F4L7", "BƯU CỤC DƯƠNG NỘI", HA_DONG.id, "PICKUP", "01", "Phường Dương Nội", "02433552266", "2025-05-12"),
  office("org-yn", "BCT01H6C8V3", "BƯU CỤC YÊN NGHĨA", HA_DONG.id, "DELIVERY_PICKUP", "01", "Phường Yên Nghĩa", "02433551188", "2025-04-01"),
  office("org-tsh", "BCT79Q1L8H4", "BƯU CỤC TÂN SƠN HÒA", "org-hcm", "PICKUP", "79", "Phường Tân Sơn Hòa", "02838456712", "2025-02-14"),
  office("org-hp2", "BCT52C7V3N9", "BƯU CỤC HỘI PHÚ", GIA_LAI.id, "DELIVERY", "52", "Phường Hội Phú", "02693826034", "2024-11-25"),
  office("org-nhs", "BCT48S5T2G7", "BƯU CỤC NGŨ HÀNH SƠN", DA_NANG.id, "DELIVERY_PICKUP", "48", "Phường Ngũ Hành Sơn", "02363958421", "2024-09-10"),
  PLEIKU,
  office("org-sg", "BCT79E3X6K2", "BƯU CỤC SÀI GÒN", "org-hcm", "DELIVERY", "79", "Phường Sài Gòn", "02838227461", "2024-05-06"),
  office("org-cg", "BCT01N8Z4D3", "BƯU CỤC CẦU GIẤY", "org-hn", "PICKUP", "01", "Phường Cầu Giấy", "02437931548", "2024-03-18"),
  office("org-md", "BCT01V2P7F5", "BƯU CỤC MỸ ĐÌNH", "org-hn", "DELIVERY_PICKUP", "01", "Phường Từ Liêm", "02437854126", "2024-02-26"),
  office("org-tb", "BCT79A6R9M1", "BƯU CỤC TÂN BÌNH", "org-hcm", "DELIVERY_PICKUP", "79", "Phường Tân Bình", "02838114593", "2024-01-22"),
];
const OPERATION_MODELS = [
  { code: "DELIVERY_PICKUP", name: "Bưu cục giao nhận", description: "Vừa lấy hàng tại Shop vừa giao hàng tới người nhận trong khu vực phụ trách." },
  { code: "PICKUP", name: "Bưu cục lấy", description: "Lấy hàng tại địa chỉ của Shop rồi chuyển về kho; không giao hàng tới người nhận." },
  { code: "DELIVERY", name: "Bưu cục giao", description: "Nhận hàng từ kho và giao tới người nhận trong khu vực phụ trách; không lấy hàng tại Shop." },
];
const STATUS_NAMES: Record<Status, string> = { ACTIVE: "Đang hoạt động", SUSPENDED: "Tạm ngưng", CLOSED: "Ngừng hoạt động" };

/* ---- Viewers ---- */

export type Viewer = "admin" | "manager";
const VIEWERS = {
  admin: { name: "Lê Thu Hà", identity: "id-thuha", title: "Quản trị hệ thống", org: { id: CORPORATION.id, code: CORPORATION.code, name: CORPORATION.name, type: "CORPORATION" },
    email: "thuha.le@supership.vn", phone: "0904216835" },
  manager: { name: "Trần Quốc Bảo", identity: "id-quocbao", title: "Quản lý nhượng quyền", org: { id: HA_DONG.id, code: HA_DONG.code, name: HA_DONG.name, type: "FRANCHISE_PARTNER" },
    email: "quocbao.tran@vanchuyenhadong.vn", phone: "0912873546" },
};

export interface DirectoryMock {
  viewer: Viewer;
  /** Manager only: the right to open post offices, granted by Tổng công ty. */
  canOpenPostOffice: boolean;
  /** Status of Nhượng quyền Hà Đông. */
  haDongStatus: Status;
}
export interface DirectoryContext extends FlowContext { mock: DirectoryMock }

export function directoryFlow({ id, name, setup = {}, run }: {
  id: string; name: string; setup?: Partial<DirectoryMock>; run: (ctx: DirectoryContext) => Promise<void>;
}) {
  return defineFlow({
    id: `superplatform-danh-sach-${id}`, name, app: "superplatform", group: franchiseGroup("danh-sach"),
    async run(ctx) {
      const mock: DirectoryMock = { viewer: "admin", canOpenPostOffice: false, haDongStatus: "ACTIVE", ...setup };
      await mockDirectory(ctx.page, ctx.log, mock);
      // The pointer is parked before every picture, so the last clicked row or button shows no hover colour.
      const shot: typeof ctx.shot = async (...args) => { await restPointer(ctx.page); return ctx.shot(...args); };
      await run({ ...ctx, shot, mock });
    },
  });
}

function capability(key: string, viewer: Viewer) {
  const global = viewer === "admin";
  return {
    permission_key: key, allowed: true, available: true, availability: "AVAILABLE", requires_mfa: false,
    requires_approval: false, required_scope_types: ["ORGANIZATION"], rejection_reasons: [],
    grants: [{ assignment_id: "capture-grant", source_type: "ROLE_VERSION", effect: "ALLOW", role_id: null, role_version_id: null,
      scopes: [{ scope_type: "ORGANIZATION", organization_mode: global ? "GLOBAL" : "SELF", anchor_organization_id: global ? null : HA_DONG.id,
        organization_ids: [], application_ids: [], resources: [], attribute_conditions: [] }] }],
  };
}

const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

async function mockDirectory(page: Page, log: (line: string) => void, mock: DirectoryMock) {
  await page.clock.setFixedTime(START);
  await mockTurnstile(page, "hidden");
  const viewer = VIEWERS[mock.viewer];
  const admin = mock.viewer === "admin";
  const membership = { membership_id: "dir-member", org_id: viewer.org.id, org_code: viewer.org.code, org_name: viewer.org.name, org_type: viewer.org.type,
    membership_type: "EMPLOYEE", title: viewer.title, status: "ACTIVE", provisioning_status: "READY", application_code: "SUPERPLATFORM", eligible: true, is_default: true };
  const active = { context_id: "dir-context", active_membership_id: "dir-member", org_code: viewer.org.code, org_name: viewer.org.name, application_code: "SUPERPLATFORM" };
  const session = { session_id: "dir-session", expires_at: EXPIRY, assurance_level: 2, next_action: "NONE", identity_id: viewer.identity, full_name: viewer.name,
    avatar_url: null, available_memberships: [membership], active_context: active };
  const cached = { sessionId: session.session_id, expiresAt: EXPIRY, assuranceLevel: 2, nextAction: "NONE", identityId: viewer.identity, fullName: viewer.name, avatarUrl: null,
    availableMemberships: [{ membershipId: membership.membership_id, orgId: membership.org_id, orgCode: membership.org_code, orgName: membership.org_name,
      membershipType: membership.membership_type, applicationCode: "SUPERPLATFORM", eligible: true }],
    activeContext: { contextId: active.context_id, activeMembershipId: active.active_membership_id, orgCode: active.org_code, orgName: active.org_name, applicationName: "SUPERPLATFORM" },
    mfaVerifiedAt: AT, mfaElevationExpiresAt: EXPIRY };
  await page.context().addInitScript(value => {
    if (location.pathname.startsWith("/workspace") && !sessionStorage.getItem("supership.admin.session.v1")) sessionStorage.setItem("supership.admin.session.v1", JSON.stringify(value));
  }, cached);

  const permissions = () => admin
    ? ["identity.view", "organization.view", "organization.franchise.create", "organization.post_office.create", "organization.status.manage",
      "organization.profile.update", "organization.legal_entity.view"]
    : ["identity.view", "organization.view", "organization.legal_entity.view", ...(mock.canOpenPostOffice ? ["organization.post_office.create"] : [])];
  const units = () => [...FRANCHISES, ...POST_OFFICES].map(unit => unit.id === HA_DONG.id ? { ...unit, status: mock.haDongStatus } : unit);
  const byId = (id: string) => units().find(unit => unit.id === id);
  /** Units the viewer may see: everything for Tổng công ty, its own post offices for a franchise. */
  const inScope = () => units().filter(unit => admin || unit.parent_id === HA_DONG.id);
  const blockedReason = (franchiseId: string) => {
    const parent = byId(franchiseId)!;
    return parent.status === "ACTIVE" ? null : `${parent.name}${parent.status === "SUSPENDED" ? " đang tạm ngưng, không mở được bưu cục." : " đã ngừng hoạt động, không mở được bưu cục."}`;
  };
  /** Active and suspended post offices of a franchise; null for other unit types. */
  const postOfficeCount = (unit: Unit) => unit.type_code === "FRANCHISE_PARTNER"
    ? units().filter(child => child.parent_id === unit.id && child.status !== "CLOSED").length : null;
  const off = { available: false, enabled: false, disabled_reason: null };
  const on = { available: true, enabled: true, disabled_reason: null };

  const row = (unit: Unit) => {
    const parent = unit.type_code === "POST_OFFICE" ? byId(unit.parent_id)! : null;
    const province = unit.province ? provinceName(unit.province) : null;
    const wardName = unit.ward ? WARDS[unit.province!]!.find(w => w.code === unit.ward)!.name : null;
    const blocked = parent && parent.status !== "ACTIVE" ? `Bị chặn vì ${parent.name} đang ${parent.status === "SUSPENDED" ? "tạm ngưng" : "ngừng hoạt động"}` : null;
    const model = OPERATION_MODELS.find(m => m.code === unit.model);
    const legal = unit.legal;
    const count = postOfficeCount(unit);
    const reactivate = unit.status !== "SUSPENDED" ? off : blocked ? { available: true, enabled: false, disabled_reason: `${parent!.name} đang tạm ngưng, kích hoạt lại nhượng quyền trước.` } : on;
    return {
      id: unit.id, code: unit.code, name: unit.name, type_code: unit.type_code, type_name: unit.type_code === "POST_OFFICE" ? "Bưu cục" : "Nhượng quyền",
      parent_id: parent?.id ?? CORPORATION.id, parent_name: parent?.name ?? CORPORATION.name, status: unit.status, status_name: STATUS_NAMES[unit.status],
      locality: [wardName, province].filter(Boolean).join(", ") || "Chưa có địa chỉ", phone: unit.phone,
      operation_model: model?.code ?? null, operation_model_name: model?.name ?? null, blocked_message: blocked,
      registration_number_display: !legal ? null : legal.form === "ENTERPRISE" ? legal.number : `********${legal.number.slice(-4)}`,
      // Shown as the server words it: "5", or "Chưa có" for none.
      post_office_count: count === null ? null : count ? String(count) : "Chưa có", created_at: unit.created_at,
      actions: admin ? { suspend: unit.status === "ACTIVE" ? on : off, reactivate } : { suspend: off, reactivate: off },
    };
  };

  const fieldError = (field: string, message: string) => ({ status: 400, message, data: { code: "ORGANIZATION_INPUT_INVALID", fields: { [field]: message } } });
  function list(params: URLSearchParams) {
    const get = (key: string) => params.get(key) || "";
    const type = get("typeCode"), status = get("status") || "OPERATING", search = get("search").trim(), sort = get("sort") || "created_desc";
    const province = get("provinceCode"), wardCode = get("wardCode"), franchiseId = get("franchiseId"), model = get("operationModel");
    const size = Number(get("size") || 20), pageIndex = Number(get("page") || 0);
    if (search.length > 100) return fieldError("search", MESSAGES.searchTooLong);
    if (wardCode && !province) return fieldError("wardCode", MESSAGES.provinceFirst);
    if (province && wardCode && !WARDS[province]?.some(w => w.code === wardCode)) return fieldError("wardCode", MESSAGES.wardOutside);
    if (type === "FRANCHISE_PARTNER" && !admin) return { status: 403, message: MESSAGES.noFranchiseList, data: { code: "DIRECTORY_FORBIDDEN" } };
    const digits = (() => {
      let value = search.replace(/[\s.()-]/g, "");
      if (value.startsWith("+84")) value = `0${value.slice(3)}`;
      else if (value.startsWith("84") && value.length === 11) value = `0${value.slice(2)}`;
      return value;
    })();
    const matches = (unit: Unit) => {
      if (!search) return true;
      const needle = normalize(search);
      if (normalize(unit.name).includes(needle) || normalize(unit.code).includes(needle)) return true;
      if (/^\d{4,15}$/.test(digits) && unit.phone?.includes(digits)) return true;
      return /^(\d{10}|\d{12})$/.test(digits) && unit.legal?.number === digits;
    };
    const items = inScope()
      .filter(unit => !type || unit.type_code === type)
      .filter(unit => status === "ALL" || (status === "OPERATING" ? unit.status !== "CLOSED" : unit.status === status))
      .filter(matches)
      .filter(unit => (!province || unit.province === province) && (!wardCode || unit.ward === wardCode))
      .filter(unit => !model || unit.model === model)
      .filter(unit => !franchiseId || (unit.type_code === "POST_OFFICE" && unit.parent_id === franchiseId))
      .map(unit => ({ unit, row: row(unit), count: postOfficeCount(unit) }));
    const newest = (a: { created_at: string }, b: { created_at: string }) => b.created_at.localeCompare(a.created_at);
    items.sort(sort === "name_asc" ? (a, b) => a.row.name.localeCompare(b.row.name, "vi")
      : sort === "post_office_count_desc" ? (a, b) => (b.count ?? -1) - (a.count ?? -1) || newest(a.row, b.row)
      : sort === "post_office_count_asc" ? (a, b) => (a.count ?? 1e9) - (b.count ?? 1e9) || newest(a.row, b.row)
      : (a, b) => newest(a.row, b.row));
    const total = items.length;
    return { status: 200, message: "Organizations retrieved.", data: { items: items.slice(pageIndex * size, (pageIndex + 1) * size).map(item => item.row), page: pageIndex, size,
      has_next: (pageIndex + 1) * size < total, total_elements: total, total_pages: Math.ceil(total / size) } };
  }

  /** "Mở bưu cục" for one franchise, as OrganizationDirectoryService.openPostOffice answers it. */
  const openPostOffice = (franchiseId: string) => {
    if (!admin && !(mock.canOpenPostOffice && franchiseId === HA_DONG.id)) return off;
    const blocked = blockedReason(franchiseId);
    return blocked ? { available: true, enabled: false, disabled_reason: blocked } : on;
  };
  const options = (shops: boolean, franchiseId: string | null = null) => {
    const franchises = inScope().filter(u => u.type_code === "FRANCHISE_PARTNER");
    const offices = inScope().filter(u => u.type_code === "POST_OFFICE");
    const pick = (u: Unit) => ({ id: u.id, code: u.code, name: u.name, parent_id: u.parent_id });
    const basicSorts = [{ code: "created_desc", name: "Mới thêm trước" }, { code: "name_asc", name: "Tên A–Z" }];
    const page = franchiseId ? byId(franchiseId)! : null;
    return {
      internal_allowed: true, shops_allowed: false,
      types: admin ? [{ code: "CORPORATION", name: "Tổng công ty" }, { code: "FRANCHISE_PARTNER", name: "Nhượng quyền" }, { code: "POST_OFFICE", name: "Bưu cục" }]
        : [{ code: "FRANCHISE_PARTNER", name: "Nhượng quyền" }, { code: "POST_OFFICE", name: "Bưu cục" }],
      statuses: shops
        ? [{ code: "OPERATING", name: "Đang hoạt động và Tạm ngưng" }, { code: "", name: "Tất cả" }, { code: "ACTIVE", name: "Đang hoạt động" },
          { code: "SUSPENDED", name: "Tạm ngưng" }, { code: "CLOSED", name: "Ngừng hoạt động" }, { code: "PENDING", name: "Chờ xử lý" }]
        : [{ code: "OPERATING", name: "Đang hoạt động và Tạm ngưng" }, { code: "ACTIVE", name: "Đang hoạt động" }, { code: "SUSPENDED", name: "Tạm ngưng" },
          { code: "CLOSED", name: "Ngừng hoạt động" }, { code: "ALL", name: "Tất cả" }],
      franchises: franchises.map(pick).sort((a, b) => a.name.localeCompare(b.name, "vi")),
      post_offices: offices.map(pick).sort((a, b) => a.name.localeCompare(b.name, "vi")),
      operation_models: OPERATION_MODELS.map(({ code, name }) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name, "vi")),
      viewer_type: viewer.org.type, viewer_organization_id: viewer.org.id,
      tabs: admin ? [{ code: "FRANCHISE_PARTNER", name: "Nhượng quyền" }, { code: "POST_OFFICE", name: "Bưu cục" }] : [{ code: "POST_OFFICE", name: "Bưu cục" }],
      sorts: { FRANCHISE_PARTNER: [...basicSorts, { code: "post_office_count_desc", name: "Nhiều bưu cục nhất" }, { code: "post_office_count_asc", name: "Ít bưu cục nhất" }],
        POST_OFFICE: basicSorts, SHOP: basicSorts },
      page_sizes: [20, 50, 100],
      create_franchise: admin ? on : off,
      // Asked for one franchise (its page's "Bưu cục" tab): that franchise's button and empty sentence.
      open_post_office: page ? openPostOffice(page.id) : admin ? off : openPostOffice(HA_DONG.id),
      empty_message: page ? `${page.name} chưa có bưu cục nào.` : null,
    };
  };

  const seen = new Set<string>();
  await page.context().route("**/api/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/backend/, "");
    const method = request.method();
    const send = (data: unknown = {}, status = 200, message = "") => route.fulfill({ status,
      headers: { "X-Browser-Session-Version": "1" }, json: { error: status >= 400, message, data } });

    /* ---- Session and shell ---- */
    if (path === "/v1/me/session") return send(session);
    if (path === "/v1/me/auth-state") return send({ next_action: "NONE", enrolled: true, assurance_level: 2, mfa_verified_at: AT, mfa_elevation_expires_at: EXPIRY,
      mfa_access_expires_at: EXPIRY, active_context: active });
    if (path === "/v1/me/memberships") return send([membership]);
    if (path === "/v1/me/capabilities") return send({
      context: { context_id: "dir-context", context_type: "SUPERPLATFORM", application_name: "SUPERPLATFORM", membership_id: "dir-member", organization_id: viewer.org.id },
      assurance: { level: 2, mfa_verified: true, mfa_verified_at: AT }, capabilities: permissions().map(key => capability(key, mock.viewer)),
      revision: "capture", generated_at: AT, expires_at: EXPIRY,
    });
    if (path === "/v1/me/profile") return send({ identity_id: viewer.identity, person_id: "dir-person", full_name: viewer.name, gender: "FEMALE", avatar_url: null,
      status: "ACTIVE", person_version: 1, has_password: true,
      identifiers: [{ type: "EMAIL", value: viewer.email, verified: true }, { type: "PHONE", value: viewer.phone, verified: true }] });
    if (path === "/v1/me/screen-lock") return send({ enabled: false, state: "DISABLED", timeout_seconds: 300, timeout_min_seconds: 10, timeout_max_seconds: 900,
      remaining_attempts: 5, state_version: 1, session_id: "dir-session", enrollment_available: true, server_time: AT, lock_deadline: null });
    if (path === "/v1/me/screen-lock/activity" || path === "/v1/me/sessions/current/activity") return send({});
    if (path === "/v1/me/employee-invitations/count") return send({ pending: 0 });
    if (path === "/v1/auth/passkey/options/autofill") return send({ available: false });

    /* ---- Directory ---- */
    if (path === "/v1/shops/list-options") return send(options(true));
    if (path === "/v1/organizations/list-options") {
      const franchiseId = url.searchParams.get("franchiseId");
      if (franchiseId) {
        const target = byId(franchiseId);
        if (!target || target.type_code !== "FRANCHISE_PARTNER") return send({ code: "ORGANIZATION_NOT_FOUND" }, 404, "Không tìm thấy nhượng quyền.");
        if (!admin && franchiseId !== HA_DONG.id) return send({ code: "ORGANIZATION_FORBIDDEN" }, 403, "Bạn không có quyền xem đơn vị này.");
      }
      return send(options(false, franchiseId));
    }
    if (path === "/v1/organization-directory/regions" || path === "/v1/franchises/creation-regions") {
      const province = url.searchParams.get("provinceCode") ?? url.searchParams.get("province_code");
      if (province && !WARDS[province] && !PROVINCES.some(p => p.code === province))
        return send({ code: "ORGANIZATION_INPUT_INVALID", fields: { provinceCode: "Tỉnh, thành phố không hợp lệ." } }, 400, "Tỉnh, thành phố không hợp lệ.");
      return send(province ? WARDS[province] ?? [] : PROVINCES);
    }
    if (path === "/v1/organizations" && method === "GET") {
      const answer = list(url.searchParams);
      return send(answer.data, answer.status, answer.message);
    }

    /* ---- "Mở bưu cục" ---- */
    const officeOptions = path.match(/^\/v1\/franchises\/([^/]+)\/post-office-creation-options$/);
    if (officeOptions) {
      const target = byId(officeOptions[1]!)!;
      const blocked = blockedReason(target.id);
      return send({ franchise: { id: target.id, name: target.name, status: target.status, status_name: STATUS_NAMES[target.status] },
        can_open: !blocked, blocked_reason: blocked, operation_models: OPERATION_MODELS,
        address_types: [{ code: "SERVICE_POINT", name: "Địa chỉ điểm phục vụ", required: true }],
        contact_types: [{ code: "PHONE", name: "Số điện thoại", value_kind: "PHONE", required: true }, { code: "EMAIL", name: "Email", value_kind: "EMAIL", required: false }] });
    }

    /* ---- The franchise's page around its "Bưu cục" tab ---- */
    const match = path.match(/^\/v1\/organizations\/([^/]+)(\/.*)?$/);
    if (match && method === "GET") {
      const [, orgId, rest = ""] = match;
      const unit = orgId === CORPORATION.id
        ? { ...CORPORATION, type_code: "CORPORATION", parent_id: null, status: "ACTIVE" as Status, created_at: "2016-02-01T01:00:00Z", phone: "02473006868" }
        : byId(orgId!);
      if (!unit) return send({ code: "ORGANIZATION_NOT_FOUND" }, 404, "Không tìm thấy tổ chức.");
      const typeName = unit.type_code === "CORPORATION" ? "Tổng công ty" : unit.type_code === "POST_OFFICE" ? "Bưu cục" : "Nhượng quyền";
      const parent = unit.parent_id === CORPORATION.id ? CORPORATION : unit.parent_id ? byId(unit.parent_id) : null;
      if (rest === "") return send({ id: unit.id, code: unit.code, name: unit.name, type_code: unit.type_code, type_name: typeName,
        parent_id: parent?.id ?? null, parent_name: parent?.name ?? null, status: unit.status, status_name: STATUS_NAMES[unit.status],
        valid_from: unit.created_at, valid_to: null, created_at: unit.created_at });
      if (rest === "/profile") return send({ id: unit.id, code: unit.code, name: unit.name, logo_url: null,
        type: { id: `type-${unit.type_code}`, code: unit.type_code, name: typeName }, internal: true, status: unit.status,
        operation_start_date: unit.created_at.slice(0, 10), valid_from: unit.created_at, valid_to: null, version: 1, user_model: "MULTI_USER",
        created_at: unit.created_at, updated_at: unit.created_at });
      if (rest === "/breadcrumb") {
        const chain = [CORPORATION, ...(unit.type_code === "POST_OFFICE" ? [parent!] : []), ...(unit.id === CORPORATION.id ? [] : [unit])];
        return send({ items: chain.map(item => ({ id: item.id, code: item.code, name: item.name, status: "ACTIVE", valid_from: AT, valid_to: null, created_at: AT })) });
      }
      if (rest === "/children") return send({ items: [], page: 0, size: 20, has_next: false });
      if (rest === "/contacts") return send({ contacts: unit.phone ? [{ id: "contact-1", contact_type: "PHONE", value: unit.phone, label: null, is_primary: true,
        status: "ACTIVE", valid_from: unit.created_at, valid_to: null, created_at: unit.created_at, updated_at: unit.created_at }] : [] });
      if (rest === "/addresses") return send({ addresses: [] });
    }

    const call = `${method} ${path}`;
    if (!seen.has(call)) { seen.add(call); log(`chưa giả lập: ${call}`); }
    return send({ code: "CAPTURE_UNMOCKED" }, 404, call);
  });
}

/* ---- Pages and controls ---- */

export async function openDirectory(page: Page, query = "") {
  await page.goto(`${LIST_URL}${query}`);
  await waitRows(page);
}
/** The table of the current tab has its rows (not the loading state). */
export async function waitRows(page: Page) {
  await page.locator("table tbody tr").first().waitFor();
  // Loading shows a skeleton table (role="status", aria-busy) in place of the rows.
  await page.locator('[role="status"][aria-busy="true"]').first().waitFor({ state: "hidden" });
}
export const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true });
export const nameCell = (page: Page, name: string) => page.getByRole("link", { name, exact: true });
export const rows = (page: Page) => page.locator("table tbody tr");
export const searchBox = (page: Page) => page.locator('input[type="search"]');
export const advancedButton = (page: Page) => page.getByRole("button", { name: /^Bộ lọc nâng cao/ });

/** The custom combobox standing for the hidden native select `id`. */
export const combo = (page: Page, id: string) => page.locator(`.ui-select:has(> select[id="${id}"]) > [role="combobox"]`);
export const optionsList = (page: Page, id: string) => page.locator(`[id="${id}-options-list"]`);
export async function openSelect(page: Page, id: string) {
  await combo(page, id).click();
  await optionsList(page, id).getByRole("option").first().waitFor();
}
export async function choose(page: Page, id: string, option: string) {
  if (!(await optionsList(page, id).isVisible())) await openSelect(page, id);
  await optionsList(page, id).getByRole("option", { name: option, exact: true }).click();
  await combo(page, id).filter({ hasText: option }).waitFor();
}
/** Parks the pointer on empty space beside the breadcrumb, so no row or button shows its hover colour in the picture. */
export async function restPointer(page: Page) {
  await page.mouse.move(1300, 125);
}

/** Types a keyword and waits until the URL carries it (the page sends 0.4 s after the last key). */
export async function search(page: Page, keyword: string) {
  await searchBox(page).fill(keyword);
  await page.waitForURL(url => new URL(url).searchParams.get("search") === keyword.trim());
}
export function rowOf(page: Page, name: string): Locator {
  return rows(page).filter({ has: page.getByRole("link", { name, exact: true }) });
}
/**
 * Scrolls the table to its last columns, as a user does to read "Trạng thái": at 1440 px the post-office table is
 * wider than the card and scrolls on its own (the "⋯" column stays pinned).
 */
export async function scrollTableToEnd(page: Page) {
  await page.locator('[role="region"]:has(> table)').first().evaluate(region => { region.scrollLeft = region.scrollWidth; });
}
export async function openRowMenu(page: Page, name: string) {
  await page.getByRole("button", { name: `Thao tác với ${name}`, exact: true }).click();
  await page.getByRole("menu").getByRole("menuitem").first().waitFor();
}
