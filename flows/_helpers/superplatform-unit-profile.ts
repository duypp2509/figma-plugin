import type { Locator, Page, Request } from "playwright";
import { expect } from "playwright/test";
import { defineFlow, type FlowContext } from "../../capture";
import { mockPin } from "./superplatform-screen-lock";
import { franchiseGroup } from "./superplatform-franchise-sections";

/*
 * The page of an internal unit of SuperPlatform (/workspace/organizations/{id}): "Tổng quan" (the admin profile),
 * "Liên hệ" and "Địa chỉ", against an in-browser stand-in of /v1/admin/organizations/{id}/profile|contacts|addresses
 * (AdminProfileService, AdminContactService, AdminAddressService) and the calls around them. Every save really
 * changes the state the page reads back, with the server's checks and sentences. The page clock is frozen by
 * mockPin at 12/10/2026 09:00, so every date below stays the same on each run.
 */

const NOW = "2026-10-12T02:00:00.000Z";
const LATER = "2026-10-12T02:05:00.000Z";
const ME = { full_name: "Nguyễn Minh Anh", organization_name: "SuperTek" };

/** Exact sentences of the backend. */
export const MESSAGES = {
  profileSuspended: "Đơn vị đang tạm ngưng, kích hoạt lại rồi mới sửa được hồ sơ.",
  profileConflict: "Hồ sơ vừa được người khác sửa. Hãy tải lại rồi sửa tiếp.",
  logoConflict: "Hồ sơ vừa được người khác sửa. Hãy tải lại rồi đổi logo.",
  noChange: "Không có thay đổi.",
  contactsSuspended: "Đơn vị đang tạm ngưng, kích hoạt lại rồi mới cập nhật được liên hệ.",
  contactsConflict: "Liên hệ vừa được người khác sửa. Hãy tải lại rồi sửa tiếp.",
  addressesSuspended: "Đơn vị đang tạm ngưng, kích hoạt lại rồi mới cập nhật được địa chỉ.",
  addressesConflict: "Địa chỉ vừa được người khác sửa. Hãy tải lại rồi sửa tiếp.",
  missing: "Còn thiếu, cần cập nhật",
  oldRegion: "Địa chỉ theo địa giới cũ, hãy cập nhật",
  phone: "Số điện thoại không đúng. Nhập số di động 10 số (ví dụ 0912 345 678) hoặc số cố định có mã vùng 11 số (ví dụ 024 3355 1234).",
  phoneRequired: "Hãy nhập số điện thoại.",
  email: "Email không hợp lệ.",
  website: "Website phải là địa chỉ đầy đủ, bắt đầu bằng https://.",
  province: "Hãy chọn tỉnh, thành phố.",
  ward: "Hãy chọn phường, xã.",
  line: "Hãy nhập địa chỉ chi tiết.",
  wardOutside: "Phường, xã không thuộc tỉnh đã chọn.",
};

/* ---- Catalogs ---- */

export const PROVINCES = [
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
const OPERATION_MODELS: Record<string, string> = { DELIVERY_PICKUP: "Bưu cục giao nhận", PICKUP: "Bưu cục lấy", DELIVERY: "Bưu cục giao" };
const CONTACT_KINDS = [
  { type: "PHONE", type_name: "Số điện thoại", value_kind: "PHONE", required: true, types: ["CORPORATION", "FRANCHISE_PARTNER", "POST_OFFICE"] },
  { type: "EMAIL", type_name: "Email", value_kind: "EMAIL", required: false, types: ["CORPORATION", "FRANCHISE_PARTNER", "POST_OFFICE"] },
  { type: "WEBSITE", type_name: "Website", value_kind: "URL", required: false, types: ["CORPORATION", "FRANCHISE_PARTNER"] },
];
const ADDRESS_KINDS = [
  { type: "SERVICE_POINT", type_name: "Địa chỉ điểm phục vụ", required: true, types: ["POST_OFFICE"] },
  { type: "TRANSACTION_OFFICE", type_name: "Văn phòng giao dịch", required: false, types: ["CORPORATION", "FRANCHISE_PARTNER"] },
];
/** DisplayText: days as dd/MM/yyyy on the Vietnamese calendar, "Chưa có" for nothing yet. */
const MISSING = "Chưa có";
const day = (value: string | null) => {
  if (!value) return MISSING;
  const iso = value.length === 10 ? value : new Date(Date.parse(value) + 7 * 3600_000).toISOString().slice(0, 10);
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const typeWord = (typeCode: string) => typeCode === "POST_OFFICE" ? "bưu cục" : typeCode === "FRANCHISE_PARTNER" ? "nhượng quyền" : "Tổng công ty";

/* ---- Units ---- */

export interface Address {
  address_line: string; province_code: string | null; province_name: string; ward_code: string | null; ward_name: string;
  /** Set only on an address of the 3-level structure that ended on 01/07/2025. */
  district_name?: string;
}
/** One change of a kind: `before` null when the kind had none, `after` null when it was cleared. */
export interface HistoryItem {
  id: string; type: string; before: string | null; after: string | null; at: string;
  by: { full_name: string; organization_name: string | null };
}
export interface Unit {
  id: string; code: string; name: string; type_code: string; type_name: string; parent: { id: string; name: string } | null;
  status: "ACTIVE" | "SUSPENDED"; since: string | null; logo_url: string | null; operation_start_date: string | null; created_at: string;
  created_by: { full_name: string; organization_name: string | null } | null; operation_model: string | null; people: number;
  version: number; contacts: Record<string, string | null>; contactsVersion: number;
  addresses: Record<string, Address | null>; addressesVersion: number;
  contactHistory: HistoryItem[]; addressHistory: HistoryItem[];
}

const person = (full_name: string, organization_name: string) => ({ full_name, organization_name });
const BAO = person("Trần Quốc Bảo", "CÔNG TY CỔ PHẦN SUPERSHIP VIỆT NAM");
const HUNG = person("Lê Văn Hùng", "NHƯỢNG QUYỀN HÀ ĐÔNG");
const HA = person("Phạm Thu Hà", "BƯU CỤC VĂN QUÁN");

const empty = () => ({ contacts: {}, contactsVersion: 1, addresses: {}, addressesVersion: 1, contactHistory: [], addressHistory: [], people: 0,
  operation_model: null as string | null, logo_url: null as string | null, since: null as string | null });

export const CORPORATION_ID = "org-corp";
export const FRANCHISE_ID = "org-hd";
export const POST_OFFICE_ID = "org-vq";

export const addressText = (address: Address) =>
  [address.address_line, address.ward_name, address.district_name, address.province_name].filter(Boolean).join(", ");
const ward = (name: string) => WARDS.P01!.find(item => item.name === name)!;
export const hanoi = (line: string, wardName: string): Address =>
  ({ address_line: line, province_code: "P01", province_name: "Thành phố Hà Nội", ward_code: ward(wardName).code, ward_name: wardName });
/** Bưu cục Văn Quán as it was typed before the merger of July 2025: a district, no codes of the new catalog. */
export const OLD_SERVICE_POINT: Address = { address_line: "Số 12 đường Văn Quán", province_code: null, province_name: "Thành phố Hà Nội",
  ward_code: null, ward_name: "Phường Văn Quán", district_name: "Quận Hà Đông" };

function units(): Record<string, Unit> {
  const corporation: Unit = { ...empty(), id: CORPORATION_ID, code: "CTT29DH7NDV", name: "CÔNG TY CỔ PHẦN SUPERSHIP VIỆT NAM",
    type_code: "CORPORATION", type_name: "Tổng công ty", parent: null, status: "ACTIVE", operation_start_date: "2016-02-01",
    created_at: "2016-02-01T01:00:00Z", created_by: null, version: 4, contacts: { PHONE: "02873008866" }, addresses: {} };
  const franchise: Unit = { ...empty(), id: FRANCHISE_ID, code: "NQT01P4X8N2", name: "NHƯỢNG QUYỀN HÀ ĐÔNG", type_code: "FRANCHISE_PARTNER",
    type_name: "Nhượng quyền", parent: { id: corporation.id, name: corporation.name }, status: "ACTIVE", operation_start_date: "2025-03-15",
    created_at: "2025-03-01T02:30:00Z", created_by: BAO, version: 3, people: 4,
    contacts: { PHONE: "02433556789", EMAIL: "lienhe@vanchuyenhadong.vn", WEBSITE: "https://vanchuyenhadong.vn" }, contactsVersion: 2,
    addresses: { TRANSACTION_OFFICE: hanoi("Tầng 3, số 8 Tố Hữu", "Phường Kiến Hưng") }, addressesVersion: 2,
    contactHistory: [
      { id: "fc-3", type: "WEBSITE", before: null, after: "https://vanchuyenhadong.vn", at: "2025-03-01T02:30:00Z", by: BAO },
      { id: "fc-2", type: "EMAIL", before: null, after: "lienhe@vanchuyenhadong.vn", at: "2025-03-01T02:30:00Z", by: BAO },
      { id: "fc-1", type: "PHONE", before: null, after: "02433556789", at: "2025-03-01T02:30:00Z", by: BAO },
    ],
    addressHistory: [
      { id: "fa-1", type: "TRANSACTION_OFFICE", before: null, after: "Tầng 3, số 8 Tố Hữu, Phường Kiến Hưng, Thành phố Hà Nội",
        at: "2025-03-01T02:30:00Z", by: BAO },
    ] };
  const parent = { id: franchise.id, name: franchise.name };
  const office = (id: string, code: string, name: string, model: string, created_at: string, phone: string): Unit => ({ ...empty(),
    id, code, name, type_code: "POST_OFFICE", type_name: "Bưu cục", parent, status: "ACTIVE", operation_start_date: created_at.slice(0, 10),
    created_at, created_by: HUNG, operation_model: model, version: 1, contacts: { PHONE: phone }, addresses: {} });
  const postOffice: Unit = { ...office(POST_OFFICE_ID, "BCT01K7M9Q2", "BƯU CỤC VĂN QUÁN", "DELIVERY_PICKUP", "2025-03-05T03:00:00Z", "02433551234"),
    operation_start_date: "2025-03-20", version: 2, people: 6,
    contacts: { PHONE: "02433551234", EMAIL: "buucucvanquan@supership.vn" }, contactsVersion: 3,
    addresses: { SERVICE_POINT: hanoi("Số 12 đường Văn Quán", "Phường Hà Đông") }, addressesVersion: 2,
    contactHistory: [
      { id: "pc-4", type: "EMAIL", before: "vanquan.hd@supership.vn", after: "buucucvanquan@supership.vn", at: "2026-08-15T02:20:00Z", by: HA },
      { id: "pc-3", type: "PHONE", before: "02433558866", after: "02433551234", at: "2026-06-02T03:10:00Z", by: HA },
      { id: "pc-2", type: "EMAIL", before: null, after: "vanquan.hd@supership.vn", at: "2025-03-05T03:00:00Z", by: HUNG },
      { id: "pc-1", type: "PHONE", before: null, after: "02433558866", at: "2025-03-05T03:00:00Z", by: HUNG },
    ],
    addressHistory: [
      { id: "pa-2", type: "SERVICE_POINT", before: addressText(OLD_SERVICE_POINT), after: "Số 12 đường Văn Quán, Phường Hà Đông, Thành phố Hà Nội",
        at: "2025-07-08T04:15:00Z", by: HA },
      { id: "pa-1", type: "SERVICE_POINT", before: null, after: addressText(OLD_SERVICE_POINT), at: "2025-03-05T03:00:00Z", by: HUNG },
    ] };
  return Object.fromEntries([corporation, franchise, postOffice,
    office("org-yn", "BCT01H6C8V3", "BƯU CỤC YÊN NGHĨA", "PICKUP", "2025-04-01T01:00:00Z", "02433551188"),
    office("org-dn2", "BCT01B9F4L7", "BƯU CỤC DƯƠNG NỘI", "DELIVERY", "2025-05-12T01:00:00Z", "02433552266"),
  ].map(unit => [unit.id, unit]));
}

/** The franchise's legal information as the legal function keeps it (flow "Thông tin pháp lý"). */
const LEGAL = { legal_form_name: "Doanh nghiệp", enterprise_type_name: "Công ty TNHH hai thành viên trở lên",
  registered_name: "CÔNG TY TNHH VẬN CHUYỂN HÀ ĐÔNG", registration_number_display: "0109876543", verification_status: "VERIFIED",
  verification_status_name: "Đã xác minh", registered_address: "Số 25 đường Quang Trung, Phường Hà Đông, Thành phố Hà Nội",
  invoice_email: "ketoan@vanchuyenhadong.vn" };
const CORPORATION_LEGAL = { legal_form_name: "Doanh nghiệp", enterprise_type_name: "Công ty cổ phần",
  registered_name: "CÔNG TY CỔ PHẦN SUPERSHIP VIỆT NAM", registration_number_display: "0313791580", verification_status: "VERIFIED",
  verification_status_name: "Đã xác minh", registered_address: "Số 1 Phổ Quang, Phường Tân Sơn Hòa, Thành phố Hồ Chí Minh", invoice_email: null };
const REPRESENTATIVES: Record<string, { full_name: string; position_title: string }[]> = {
  [CORPORATION_ID]: [{ full_name: "Đỗ Thành Nhân", position_title: "Tổng giám đốc" }],
  [FRANCHISE_ID]: [{ full_name: "Nguyễn Văn An", position_title: "Giám đốc" }, { full_name: "Trần Thị Mai", position_title: "Chủ tịch Hội đồng thành viên" }],
};

/* ---- The mock ---- */

export type Role = "admin" | "viewer";
export interface UnitMock {
  units: Record<string, Unit>;
  role: Role;
  /** Accepted saves. */
  writes: number;
  /** Every body sent to a save, accepted or not. */
  bodies: any[];
  /** Runs once right before the next save is answered, e.g. another manager saving first. */
  beforeWrite: (() => void) | null;
}
export interface UnitContext extends FlowContext { mock: UnitMock }

export type UnitFeature = "ho-so" | "lien-he" | "dia-chi";

export function unitFlow(feature: UnitFeature, { id, name, role = "admin", setup, run }: {
  id: string; name: string; role?: Role; setup?: (units: Record<string, Unit>) => void; run: (ctx: UnitContext) => Promise<void>;
}) {
  return defineFlow({
    id: `superplatform-${feature}-${id}`, name, app: "superplatform", group: franchiseGroup(feature),
    async run(ctx) {
      const mock: UnitMock = { units: units(), role, writes: 0, bodies: [], beforeWrite: null };
      setup?.(mock.units);
      await mockUnits(ctx.page, ctx.log, mock);
      await run({ ...ctx, mock });
    },
  });
}
export const profileFlow = (options: Parameters<typeof unitFlow>[1]) => unitFlow("ho-so", options);

function capability(key: string) {
  return {
    permission_key: key, allowed: true, available: true, availability: "AVAILABLE", requires_mfa: false,
    requires_approval: false, required_scope_types: ["ORGANIZATION"], rejection_reasons: [],
    grants: [{ assignment_id: "capture-grant", source_type: "ROLE_VERSION", effect: "ALLOW", role_id: null, role_version_id: null,
      scopes: [{ scope_type: "ORGANIZATION", organization_mode: "GLOBAL", anchor_organization_id: null,
        organization_ids: [], application_ids: [], resources: [], attribute_conditions: [] }] }],
  };
}
const ADMIN = ["organization.profile.update", "organization.contact.manage", "organization.address.manage", "organization.status.manage",
  "organization.classification.update", "organization.post_office.create", "organization.franchise.create",
  "organization.legal_entity.update", "organization.legal_entity.view_sensitive"];

const allowed = { available: true, enabled: true, disabled_reason: null };
const unavailable = { available: false, enabled: false, disabled_reason: null };
const blocked = (reason: string) => ({ available: true, enabled: false, disabled_reason: reason });
const change = (permitted: boolean, unit: Unit, reason: string) => !permitted ? unavailable : unit.status === "ACTIVE" ? allowed : blocked(reason);
const statusName = (status: string) => status === "ACTIVE" ? "Đang hoạt động" : "Tạm ngưng";

class Refusal { constructor(readonly status: number, readonly code: string, readonly message: string, readonly fields?: Record<string, string>) {} }
const field = (key: string, message: string) => new Refusal(400, "ORGANIZATION_INPUT_INVALID", message, { [key]: message });
const conflict = (message: string) => new Refusal(409, "VERSION_CONFLICT", message);
const unchanged = () => new Refusal(409, "NO_CHANGE", MESSAGES.noChange);
function requireActive(unit: Unit, what: string) {
  if (unit.status !== "ACTIVE") throw new Refusal(409, "ORGANIZATION_NOT_ACTIVE", `${unit.name} đang tạm ngưng, kích hoạt lại rồi mới ${what}.`);
}

/** VietnamesePhoneNumbers: separators dropped, +84 read as 0; mobile 10 digits 03/05/07/08/09, landline 11 digits 02. */
function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+84")) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith("84") && digits.length === 11) digits = `0${digits.slice(2)}`;
  return /^0[35789]\d{8}$/.test(digits) || /^02\d{9}$/.test(digits) ? digits : null;
}

async function mockUnits(page: Page, log: (line: string) => void, mock: UnitMock) {
  await mockPin(page, log, false);
  const admin = mock.role === "admin";
  const capabilities = ["identity.view", "organization.view", "organization.legal_entity.view", ...(admin ? ADMIN : [])];
  const all = () => Object.values(mock.units);
  const children = (id: string) => all().filter(unit => unit.parent?.id === id);

  const summary = (unit: Unit) => ({ id: unit.id, code: unit.code, name: unit.name, type_code: unit.type_code, type_name: unit.type_name,
    parent_id: unit.parent?.id ?? null, parent_name: unit.parent?.name ?? null, status: unit.status, status_name: statusName(unit.status),
    valid_from: unit.created_at, valid_to: null, created_at: unit.created_at, blocked_message: null });
  const row = (unit: Unit) => ({ ...summary(unit),
    locality: unit.addresses.SERVICE_POINT ? `${unit.addresses.SERVICE_POINT.ward_name}, ${unit.addresses.SERVICE_POINT.province_name}` : "Phường Hà Đông, Thành phố Hà Nội",
    phone: unit.contacts.PHONE ?? null, operation_model_name: unit.operation_model ? OPERATION_MODELS[unit.operation_model] : null,
    registration_number_display: null, post_office_count: unit.type_code === "FRANCHISE_PARTNER" ? children(unit.id).length : null });

  /** The nearest unit above that is not active (AdminStatusStore.blockedAbove). */
  const blockedAbove = (unit: Unit): Unit | null => {
    for (let cursor = unit.parent ? mock.units[unit.parent.id] : undefined; cursor; cursor = cursor.parent ? mock.units[cursor.parent.id] : undefined)
      if (cursor.status !== "ACTIVE") return cursor;
    return null;
  };
  const contactKinds = (unit: Unit) => CONTACT_KINDS.filter(kind => kind.types.includes(unit.type_code));
  const addressKinds = (unit: Unit) => ADDRESS_KINDS.filter(kind => kind.types.includes(unit.type_code));

  const profile = (unit: Unit) => {
    const postOffice = unit.type_code === "POST_OFFICE";
    const holder = postOffice ? unit.parent!.id : unit.id;
    const legal = holder === FRANCHISE_ID ? LEGAL : holder === CORPORATION_ID ? CORPORATION_LEGAL : null;
    const corporation = unit.type_code === "CORPORATION";
    const franchise = unit.type_code === "FRANCHISE_PARTNER";
    const edit = change(admin, unit, MESSAGES.profileSuspended);
    const representatives = (REPRESENTATIVES[unit.id] ?? []).map(rep => ({ ...rep, value: `${rep.full_name}, ${rep.position_title}`, missing: false }));
    const blocker = blockedAbove(unit);
    return {
      id: unit.id, code: unit.code, name: unit.name, logo_url: unit.logo_url, type_code: unit.type_code, type_name: unit.type_name,
      status: unit.status, status_name: statusName(unit.status), operation_start_date: day(unit.operation_start_date),
      operation_start_date_value: unit.operation_start_date, created_at: day(unit.created_at), closed_on: null,
      blocked_message: blocker ? `Đang bị chặn vì ${blocker.name} ${blocker.status === "SUSPENDED" ? "đang tạm ngưng" : "đã ngừng hoạt động"}.` : null,
      parent: corporation ? null : unit.parent,
      created_by: corporation ? null : unit.created_by ?? { full_name: MISSING, organization_name: null },
      operation_model: !postOffice ? null : unit.operation_model
        ? { code: unit.operation_model, name: OPERATION_MODELS[unit.operation_model], since: day("2025-03-05T03:00:00Z") }
        : { code: null, name: MISSING, since: null },
      legal: legal ? { declared: true, via_franchise_name: postOffice ? unit.parent!.name : null, ...legal,
        invoice_email: franchise ? legal.invoice_email ?? MISSING : null }
        : { declared: false, via_franchise_name: postOffice ? unit.parent!.name : null, legal_form_name: MISSING, enterprise_type_name: null,
          registered_name: MISSING, registration_number_display: MISSING, verification_status: null, verification_status_name: MISSING,
          registered_address: MISSING, invoice_email: franchise ? MISSING : null },
      legal_representatives: postOffice ? null
        : representatives.length ? representatives : [{ full_name: null, position_title: null, value: MISSING, missing: true }],
      addresses: addressKinds(unit).map(kind => { const value = unit.addresses[kind.type];
        return { type: kind.type, type_name: kind.type_name, value: value ? addressText(value) : "Chưa có", missing: !value }; }),
      contacts: contactKinds(unit).map(kind => { const value = unit.contacts[kind.type];
        return { type: kind.type, type_name: kind.type_name, value: value ?? "Chưa có", missing: !value }; }),
      version: unit.version,
      actions: { edit, change_logo: edit,
        change_operation_model: postOffice ? change(admin, unit, "Bưu cục đang tạm ngưng, kích hoạt lại rồi mới đổi được loại hình.") : unavailable },
    };
  };
  const contacts = (unit: Unit) => ({ organization_id: unit.id, version: unit.contactsVersion,
    items: contactKinds(unit).map(kind => ({ type: kind.type, type_name: kind.type_name, value_kind: kind.value_kind, required: kind.required,
      value: unit.contacts[kind.type] ?? null, reminder: !unit.contacts[kind.type] && kind.required ? MESSAGES.missing : null })),
    actions: { edit: change(admin, unit, MESSAGES.contactsSuspended), history: allowed } });
  const addresses = (unit: Unit) => ({ organization_id: unit.id, version: unit.addressesVersion,
    items: addressKinds(unit).map(kind => {
      const value = unit.addresses[kind.type] ?? null;
      const old = Boolean(value?.district_name);
      return { type: kind.type, type_name: kind.type_name, required: kind.required, display: value ? addressText(value) : null,
        province_code: old ? null : value?.province_code ?? null, province_name: old ? null : value?.province_name ?? null,
        ward_code: old ? null : value?.ward_code ?? null, ward_name: old ? null : value?.ward_name ?? null,
        address_line: value?.address_line ?? null, old_region: old,
        reminder: !value ? (kind.required ? MESSAGES.missing : null) : old ? MESSAGES.oldRegion : null };
    }),
    actions: { edit: change(admin, unit, MESSAGES.addressesSuspended), history: allowed } });
  const status = (unit: Unit) => {
    const changeable = admin && unit.type_code !== "CORPORATION";
    const below = children(unit.id).length;
    const missing = !changeable ? [] : unit.type_code === "FRANCHISE_PARTNER" && below
      ? [`Còn ${below} bưu cục trực thuộc chưa ngừng hoạt động. Ngừng hoạt động các bưu cục đó trước.`]
      : unit.people ? [`Còn ${unit.people} người đang làm việc ở ${unit.name}. Điều chuyển hoặc cho nghỉ việc trước.`] : [];
    const phrase = unit.name + (unit.type_code === "FRANCHISE_PARTNER" && below ? ` và ${below} bưu cục trực thuộc` : "");
    return { organization_id: unit.id, name: unit.name, status: unit.status, status_name: statusName(unit.status), version: unit.version,
      since: unit.since, closed_on: null, operation_start_date: unit.operation_start_date, blocked_by: null,
      actions: { suspend: changeable && unit.status === "ACTIVE" ? allowed : unavailable,
        reactivate: changeable && unit.status === "SUSPENDED" ? allowed : unavailable,
        close: changeable ? (missing.length ? blocked(missing[0]!) : allowed) : unavailable },
      dialogs: changeable ? { suspend_impact: `${phrase} sẽ không làm việc được.${unit.people ? ` ${unit.people} người đang làm việc sẽ bị kết thúc phiên làm việc.` : ""}`,
        reactivate_impact: `${phrase} làm việc lại được. Người làm phải chọn lại đơn vị làm việc.`,
        close_warning: `${unit.name} sẽ ngừng hoạt động vĩnh viễn, không kích hoạt lại được. Dữ liệu được giữ để tra cứu.`, close_missing: missing } : null };
  };
  const history = (items: HistoryItem[], kinds: { type: string; type_name: string }[], url: URL) => {
    const type = url.searchParams.get("type"), from = url.searchParams.get("from"), to = url.searchParams.get("to");
    const day = (at: string) => new Date(Date.parse(at) + 7 * 3600_000).toISOString().slice(0, 10);
    const matching = items.filter(item => (!type || item.type === type) && (!from || day(item.at) >= from) && (!to || day(item.at) <= to))
      .sort((a, b) => b.at.localeCompare(a.at));
    const pageNumber = Number(url.searchParams.get("page") ?? 0);
    return { items: matching.slice(pageNumber * 20, pageNumber * 20 + 20)
      .map(({ at, type, before, after, by }) => ({ at, type, type_name: kinds.find(kind => kind.type === type)?.type_name ?? type, before, after, by })),
      page: pageNumber, size: 20, total: matching.length };
  };
  /** One history item per changed kind, a clear included (`after` null), as replaceContact / replaceAddress do. */
  const record = (list: HistoryItem[], type: string, before: string | null, after: string | null) => {
    list.unshift({ id: `${type}-${list.length + 1}`, type, before, after, at: LATER, by: ME });
  };

  const saveProfile = (unit: Unit, body: any) => {
    requireActive(unit, "sửa được hồ sơ");
    const raw = String(body?.name ?? "").trim();
    if (!raw) throw field("name", "Hãy nhập tên đơn vị.");
    if (raw.length > 200) throw field("name", "Tên đơn vị tối đa 200 ký tự.");
    const name = raw.replace(/\s+/g, " ").toLocaleUpperCase("vi");
    const start = String(body?.operation_start_date ?? "").trim() || null;
    if (!start && unit.operation_start_date) throw field("operation_start_date", "Hãy nhập ngày bắt đầu hoạt động.");
    if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) throw field("operation_start_date", "Ngày bắt đầu hoạt động không hợp lệ.");
    if (body.version !== unit.version) throw conflict(MESSAGES.profileConflict);
    if (name === unit.name && start === unit.operation_start_date) throw unchanged();
    unit.name = name; unit.operation_start_date = start; unit.version++;
    for (const child of children(unit.id)) child.parent = { id: unit.id, name };
    return profile(unit);
  };
  const saveLogo = (unit: Unit, request: Request) => {
    requireActive(unit, "sửa được hồ sơ");
    const { version, file } = multipart(request);
    if (!file) throw field("logo", "Hãy chọn ảnh JPEG, PNG hoặc WebP, tối đa 8000 × 8000 điểm ảnh.");
    if (Number(version) !== unit.version) throw conflict(MESSAGES.logoConflict);
    unit.logo_url = `data:${file.type};base64,${file.data.toString("base64")}`; unit.version++;
    return profile(unit);
  };
  const saveContacts = (unit: Unit, body: any) => {
    requireActive(unit, "cập nhật được liên hệ");
    const input: Record<string, string> = body?.contacts ?? {};
    const kinds = contactKinds(unit);
    for (const key of Object.keys(input)) {
      const kind = CONTACT_KINDS.find(item => item.type === key.toUpperCase());
      if (!kind) throw field(`contacts.${key}`, "Loại liên hệ không hợp lệ.");
      if (!kinds.includes(kind)) throw field(`contacts.${kind.type}`, `Loại liên hệ ${kind.type_name} không dùng cho ${typeWord(unit.type_code)}.`);
    }
    const next: Record<string, string | null> = {};
    for (const kind of kinds) {
      const value = String(input[kind.type] ?? "").trim();
      if (!value) { if (kind.required) throw field(`contacts.${kind.type}`, MESSAGES.phoneRequired); next[kind.type] = null; continue; }
      if (kind.type === "PHONE") next.PHONE = normalizePhone(value) ?? (() => { throw field("contacts.PHONE", MESSAGES.phone); })();
      if (kind.type === "EMAIL") {
        if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value)) throw field("contacts.EMAIL", MESSAGES.email);
        next.EMAIL = value.toLowerCase();
      }
      if (kind.type === "WEBSITE") {
        if (!/^https:\/\/[^\s/@]+\.[a-z]{2,}(\/\S*)?$/i.test(value)) throw field("contacts.WEBSITE", MESSAGES.website);
        next.WEBSITE = value.replace(/\/$/, "");
      }
    }
    if (body.version !== unit.contactsVersion) throw conflict(MESSAGES.contactsConflict);
    const changed = kinds.filter(kind => (unit.contacts[kind.type] ?? null) !== next[kind.type]);
    if (!changed.length) throw unchanged();
    for (const kind of changed) {
      record(unit.contactHistory, kind.type, unit.contacts[kind.type] ?? null, next[kind.type] ?? null);
      unit.contacts[kind.type] = next[kind.type] ?? null;
    }
    unit.contactsVersion++;
    return contacts(unit);
  };
  const saveAddresses = (unit: Unit, body: any) => {
    requireActive(unit, "cập nhật được địa chỉ");
    const input: Record<string, { province_code?: string; ward_code?: string; address_line?: string }> = body?.addresses ?? {};
    const kinds = addressKinds(unit);
    for (const key of Object.keys(input)) {
      const kind = ADDRESS_KINDS.find(item => item.type === key.toUpperCase());
      if (!kind) throw field(`addresses.${key}`, "Loại địa chỉ không hợp lệ.");
      if (!kinds.includes(kind)) throw field(`addresses.${kind.type}`, `Loại địa chỉ ${kind.type_name} không dùng cho ${typeWord(unit.type_code)}.`);
    }
    const next: Record<string, Address | null> = {};
    for (const kind of kinds) {
      const value = input[kind.type];
      const [province, wardCode, line] = [value?.province_code, value?.ward_code, value?.address_line].map(part => String(part ?? "").trim());
      const prefix = `addresses.${kind.type}`;
      if (!province && !wardCode && !line) {
        if (kind.required) throw field(prefix, `Hãy nhập ${kind.type_name.toLocaleLowerCase("vi")}.`);
        next[kind.type] = null; continue;
      }
      if (!province) throw field(`${prefix}.province_code`, MESSAGES.province);
      if (!wardCode) throw field(`${prefix}.ward_code`, MESSAGES.ward);
      if (!line) throw field(`${prefix}.address_line`, MESSAGES.line);
      if (line.length > 500) throw field(`${prefix}.address_line`, "Địa chỉ chi tiết tối đa 500 ký tự.");
      const provinceRow = PROVINCES.find(item => item.code === province);
      if (!provinceRow) throw field(`${prefix}.province_code`, "Tỉnh, phường xã không có trong danh mục địa giới mới.");
      const wardRow = WARDS[province]?.find(item => item.code === wardCode);
      if (!wardRow) throw field(`${prefix}.ward_code`, MESSAGES.wardOutside);
      next[kind.type] = { address_line: line, province_code: province, province_name: provinceRow.name, ward_code: wardCode, ward_name: wardRow.name };
    }
    if (body.version !== unit.addressesVersion) throw conflict(MESSAGES.addressesConflict);
    const squeeze = (text: string) => text.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
    const same = (a: Address | null, b: Address | null) => !a || !b ? a === b : !a.district_name && a.province_code === b.province_code
      && a.ward_code === b.ward_code && squeeze(a.address_line) === squeeze(b.address_line);
    const changed = kinds.filter(kind => !same(unit.addresses[kind.type] ?? null, next[kind.type] ?? null));
    if (!changed.length) throw unchanged();
    for (const kind of changed) {
      const before = unit.addresses[kind.type], after = next[kind.type];
      record(unit.addressHistory, kind.type, before ? addressText(before) : null, after ? addressText(after) : null);
      unit.addresses[kind.type] = after ?? null;
    }
    unit.addressesVersion++;
    return addresses(unit);
  };

  // Registered after mockPin, so it is asked first and falls back to it for the session calls.
  await page.context().route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/backend/, "");
    const method = request.method();
    const send = (data: unknown, status = 200, message = "") => route.fulfill({ status,
      headers: { "X-Browser-Session-Version": "1" }, json: { error: status >= 400, message, data } });
    const write = (answer: () => unknown, message: string | (() => string)) => {
      if (method !== "GET") {
        try { mock.bodies.push(request.headers()["content-type"]?.startsWith("multipart/") ? "multipart" : request.postDataJSON()); } catch { /* none */ }
        const before = mock.beforeWrite; mock.beforeWrite = null; before?.();
      }
      try { const data = answer(); if (method !== "GET") mock.writes++; return send(data, 200, typeof message === "function" ? message() : message); }
      catch (error) {
        if (!(error instanceof Refusal)) throw error;
        return send({ code: error.code, ...(error.fields ? { fields: error.fields } : {}) }, error.status, error.message);
      }
    };

    if (path === "/v1/me/capabilities") return send({
      context: { context_id: "pin-context", context_type: "SUPERPLATFORM", application_name: "SUPERPLATFORM", membership_id: "pin-member", organization_id: "pin-org" },
      assurance: { level: 2, mfa_verified: true, mfa_verified_at: NOW }, capabilities: capabilities.map(capability),
      revision: "capture", generated_at: NOW, expires_at: LATER,
    });
    /* ---- Shell ---- */
    if (path === "/v1/me/employee-invitations/count") return send({ pending: 0 });
    if (path === "/v1/shops/list-options") return send({ internal_allowed: true, shops_allowed: false, types: [], statuses: [],
      franchises: [], post_offices: [], operation_models: [] });
    if (path === "/v1/organizations/list-options") return send({ internal_allowed: true, shops_allowed: false,
      types: [{ code: "FRANCHISE_PARTNER", name: "Nhượng quyền" }, { code: "POST_OFFICE", name: "Bưu cục" }],
      statuses: [{ code: "", name: "Tất cả" }, { code: "ACTIVE", name: "Đang hoạt động" }, { code: "SUSPENDED", name: "Tạm ngưng" }, { code: "CLOSED", name: "Ngừng hoạt động" }],
      franchises: [], post_offices: [], operation_models: Object.entries(OPERATION_MODELS).map(([code, name]) => ({ code, name })) });
    /* ---- "Bưu cục trực thuộc" of a franchise ---- */
    if (path === "/v1/organizations" && method === "GET") {
      const type = url.searchParams.get("typeCode"), franchise = url.searchParams.get("franchiseId");
      const items = all().filter(unit => unit.type_code !== "CORPORATION" && (!type || unit.type_code === type) && (!franchise || unit.parent?.id === franchise))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).map(row);
      return send({ items, page: 0, size: 20, has_next: false, total_elements: items.length, total_pages: 1 });
    }
    const options = path.match(/^\/v1\/franchises\/([^/]+)\/post-office-creation-options$/);
    if (options) {
      const franchise = mock.units[options[1]!]!;
      const reason = franchise.status === "ACTIVE" ? null : `${franchise.name} đang tạm ngưng, không mở được bưu cục.`;
      return send({ franchise: { id: franchise.id, name: franchise.name, status: franchise.status, status_name: statusName(franchise.status) },
        can_open: !reason, blocked_reason: reason, operation_models: [], address_types: [], contact_types: [] });
    }

    /* ---- Admin API of an internal unit ---- */
    const adminPath = path.match(/^\/v1\/admin\/organizations\/([^/]+)\/(.+)$/);
    if (adminPath) {
      const unit = mock.units[adminPath[1]!];
      if (!unit) return send({ code: "ORGANIZATION_NOT_FOUND" }, 404, "Không tìm thấy đơn vị.");
      const rest = adminPath[2]!;
      const body = () => method === "GET" || rest === "profile/logo" ? null : request.postDataJSON();
      if (rest === "profile") return write(() => method === "PATCH" ? saveProfile(unit, body()) : profile(unit),
        () => method === "PATCH" ? `Đã lưu hồ sơ ${unit.name}.` : "Hồ sơ tổ chức.");
      if (rest === "profile/logo") return write(() => saveLogo(unit, request), "Đã đổi logo.");
      if (rest === "contacts") return write(() => method === "PUT" ? saveContacts(unit, body()) : contacts(unit), "Đã lưu liên hệ.");
      if (rest === "addresses") return write(() => method === "PUT" ? saveAddresses(unit, body()) : addresses(unit), "Đã lưu địa chỉ.");
      if (rest === "contacts/history") return send(history(unit.contactHistory, contactKinds(unit), url));
      if (rest === "addresses/history") return send(history(unit.addressHistory, addressKinds(unit), url));
      if (rest === "address-regions") {
        const province = url.searchParams.get("province_code");
        return send(province ? WARDS[province] ?? [] : PROVINCES);
      }
      if (rest === "status") return send(status(unit));
    }

    /* ---- Organization page ---- */
    const match = path.match(/^\/v1\/organizations\/([^/]+)(\/.*)?$/);
    if (match && method === "GET") {
      const [, orgId, rest = ""] = match;
      const unit = mock.units[orgId!];
      if (!unit) return send({ code: "ORGANIZATION_NOT_FOUND" }, 404, "Không tìm thấy tổ chức.");
      if (rest === "") return send(summary(unit));
      if (rest === "/profile") return send({ id: unit.id, code: unit.code, name: unit.name, logo_url: unit.logo_url,
        type: { id: `type-${unit.type_code}`, code: unit.type_code, name: unit.type_name }, internal: true, status: unit.status,
        operation_start_date: unit.operation_start_date, valid_from: unit.created_at, valid_to: null, version: unit.version,
        user_model: "MULTI_USER", created_at: unit.created_at, updated_at: unit.created_at });
      if (rest === "/breadcrumb") {
        const chain: Unit[] = [];
        for (let cursor: Unit | undefined = unit; cursor; cursor = cursor.parent ? mock.units[cursor.parent.id] : undefined) chain.unshift(cursor);
        return send({ items: chain.map(summary) });
      }
    }
    return route.fallback();
  });
}

/** The version and the file of the multipart logo upload, read from the raw body. */
function multipart(request: Request): { version: string | null; file: { type: string; data: Buffer } | null } {
  const body = request.postDataBuffer() ?? Buffer.alloc(0);
  const boundary = `--${(request.headers()["content-type"] ?? "").split("boundary=")[1] ?? ""}`;
  let version: string | null = null, file: { type: string; data: Buffer } | null = null;
  let start = body.indexOf(boundary);
  while (start >= 0) {
    const next = body.indexOf(boundary, start + boundary.length);
    if (next < 0) break;
    const part = body.subarray(start + boundary.length + 2, next - 2);
    const split = part.indexOf("\r\n\r\n");
    const head = part.subarray(0, split).toString("utf8"), content = part.subarray(split + 4);
    const name = head.match(/name="([^"]+)"/)?.[1];
    if (name === "version") version = content.toString("utf8");
    if (name === "file") file = { type: head.match(/Content-Type: ([^\r\n]+)/i)?.[1] ?? "image/png", data: Buffer.from(content) };
    start = next;
  }
  return { version, file };
}

/* ---- Pages ---- */

export const unitUrl = (id: string, section?: "contacts" | "addresses") =>
  `/workspace/organizations/${id}${section ? `?section=${section}` : ""}`;

/** "Tổng quan" of a unit, with every card loaded. */
export async function openOverview(page: Page, id: string) {
  await page.goto(unitUrl(id));
  await page.getByRole("heading", { name: "Tổng quan tổ chức", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Địa chỉ", exact: true }).waitFor();
  await page.getByRole("status", { name: "Đang tải số bưu cục" }).waitFor({ state: "hidden" });
  await page.locator(".organization-sidebar .organization-sidebar-identity").waitFor();
}
export const editProfileButton = (page: Page) => page.getByRole("button", { name: "Sửa hồ sơ", exact: true });
export const logoButton = (page: Page) => page.getByRole("button", { name: "Đổi ảnh đại diện tổ chức", exact: true });
export const profileDialog = (page: Page) => page.getByRole("dialog", { name: "Sửa hồ sơ tổ chức" });
export async function openProfileEdit(page: Page) {
  await editProfileButton(page).click();
  await profileDialog(page).getByLabel("Tên hiển thị").waitFor();
}
export async function saveProfile(page: Page) {
  await profileDialog(page).getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
}

/** A refusal shown while a dialog is open: "Không thể hoàn tất thao tác" with the server's sentence. */
export const errorDialog = (page: Page) => page.getByRole("alertdialog", { name: "Không thể hoàn tất thao tác" });
export async function waitError(page: Page, message: string) {
  await errorDialog(page).getByText(message, { exact: true }).waitFor();
}
export async function dismissError(page: Page) {
  await errorDialog(page).getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await errorDialog(page).waitFor({ state: "hidden" });
}

/** The toast of a save or a refusal. */
export const toast = (page: Page, text: string) => page.getByText(text, { exact: true }).first();
/** Waits until the earlier toasts are gone, so the next picture only shows the new one. */
export async function closeToasts(page: Page) {
  const close = page.getByRole("button", { name: "Đóng thông báo", exact: true });
  for (const button of await close.all()) await button.click().catch(() => undefined);
  await close.first().waitFor({ state: "hidden" });
}

/** Back to the top of the workspace pane before a full-page picture, with no field left in focus. */
export async function scrollTop(page: Page) {
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); document.querySelectorAll<HTMLElement>(".ui-workspace-content").forEach(node => { node.scrollTop = 0; }); window.scrollTo(0, 0); });
}

/** A square logo drawn in the page, so the picture needs no file on disk. */
export async function logoFile(page: Page) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="32" fill="#0f766e"/><text x="80" y="88" font-family="sans-serif" font-weight="bold" font-size="64" fill="#fff" text-anchor="middle" dominant-baseline="middle">HĐ</text></svg>';
  const data = await page.evaluate(async source => {
    const image = new Image(); image.src = `data:image/svg+xml,${encodeURIComponent(source)}`; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 320;
    canvas.getContext("2d")!.drawImage(image, 0, 0, 320, 320);
    return canvas.toDataURL("image/png").split(",")[1]!;
  }, svg);
  return { name: "logo-ha-dong.png", mimeType: "image/png", buffer: Buffer.from(data, "base64") };
}

export { expect };
export type { Locator };
