import type { Page, Request } from "playwright";
import { expect } from "playwright/test";
import { defineFlow, type FlowContext } from "../../capture";
import { mockPin } from "./superplatform-screen-lock";
import { franchiseGroup } from "./superplatform-franchise-sections";

/*
 * "Tạm ngưng, Kích hoạt lại, Ngừng hoạt động" of a franchise or a post office and "Đổi loại hình bưu cục" in
 * SuperPlatform, against an in-browser stand-in of /v1/admin/organizations/{id}/status, /status/suspension|reactivation|closure,
 * /operation-model and the directory and detail pages around them (sentences copied from AdminUnitStatusService,
 * AdminOperationModelService, AdminProfileService and OrganizationDirectoryService). Every change asks for the code of
 * the step-up dialog first, as the server does. The page clock is frozen by mockPin at 12/10/2026 09:00.
 */

export const STATUS_GROUP = franchiseGroup("trang-thai");
export const TYPE_GROUP = franchiseGroup("loai-hinh");
export const LIST_URL = "/workspace/organizations";
export const STEP_UP_CODE = "515060";
/** The frozen "now" of mockPin. */
const NOW = "2026-10-12T02:00:00.000Z";
const LATER = "2026-10-12T02:05:00.000Z";
/** When "someone else" changed the post office type, a few minutes before the page was opened. */
const ELSEWHERE = "2026-10-12T01:52:00.000Z";

export const MESSAGES = {
  wrongCode: "Mã xác thực không đúng hoặc đã được sử dụng.",
  wrongName: "Tên gõ lại không đúng.",
  modelConflict: "Loại hình của bưu cục vừa được người khác đổi. Hãy tải lại rồi đổi tiếp.",
  statusConflict: "Đơn vị vừa được người khác thay đổi. Hãy tải lại rồi làm tiếp.",
};

type Status = "ACTIVE" | "SUSPENDED" | "CLOSED";
const STATUS_NAME: Record<Status, string> = { ACTIVE: "Đang hoạt động", SUSPENDED: "Tạm ngưng", CLOSED: "Ngừng hoạt động" };

const MODELS = [
  { code: "PICKUP", name: "Bưu cục lấy", description: "Lấy hàng tại địa chỉ của Shop rồi chuyển về kho; không giao hàng tới người nhận." },
  { code: "DELIVERY", name: "Bưu cục giao", description: "Nhận hàng từ kho và giao tới người nhận trong khu vực phụ trách; không lấy hàng tại Shop." },
  { code: "DELIVERY_PICKUP", name: "Bưu cục giao nhận", description: "Vừa lấy hàng tại Shop vừa giao hàng tới người nhận trong khu vực phụ trách." },
];
const modelName = (code: string) => MODELS.find(model => model.code === code)!.name;

interface Legal {
  legal_form_name: string; enterprise_type_name: string | null; registered_name: string; registration_number_display: string;
  verification_status: string; verification_status_name: string; registered_address: string; invoice_email: string | null;
}
interface Unit {
  id: string; code: string; name: string; type_code: "CORPORATION" | "FRANCHISE_PARTNER" | "POST_OFFICE"; parent_id: string | null;
  status: Status; version: number; since: string | null; closed_on: string | null; start: string; created_at: string;
  /** People with a working place at the unit (closing needs none) and working sessions open right now. */
  people: number; sessions: number;
  phone: string; email: string | null; address: string; ward: string; province: string;
  legal?: Legal; representatives?: { full_name: string; position_title: string }[];
  model?: { code: string; since: string; version: number };
}

const CORP_ID = "org-corp";
function units(): Unit[] {
  const base = { version: 3, since: null, closed_on: null, people: 0, sessions: 0 };
  const corp: Unit = { ...base, id: CORP_ID, code: "CTT29DH7NDV", name: "CÔNG TY CỔ PHẦN SUPERSHIP VIỆT NAM", type_code: "CORPORATION",
    parent_id: null, status: "ACTIVE", start: "2016-02-01", created_at: "2016-02-01T01:00:00Z", phone: "02873008866",
    email: "lienhe@supership.vn", address: "Tầng 5, số 222 Điện Biên Phủ", ward: "Phường Xuân Hòa", province: "Thành phố Hồ Chí Minh" };
  const franchise = (id: string, code: string, name: string, created: string, phone: string, address: string, ward: string, province: string,
    legal: Legal, representatives: Unit["representatives"], people = 4): Unit =>
    ({ ...base, id, code, name, type_code: "FRANCHISE_PARTNER", parent_id: CORP_ID, status: "ACTIVE", start: created.slice(0, 10),
      created_at: created, phone, email: null, address, ward, province, legal, representatives, people, sessions: people });
  const enterprise = (registered: string, number: string, address: string, invoice: string): Legal => ({
    legal_form_name: "Doanh nghiệp", enterprise_type_name: "Công ty TNHH hai thành viên trở lên", registered_name: registered,
    registration_number_display: number, verification_status: "VERIFIED", verification_status_name: "Đã xác minh",
    registered_address: address, invoice_email: invoice });
  const office = (id: string, code: string, name: string, parent: string, model: string, created: string, phone: string,
    address: string, ward: string, province: string, people: number): Unit =>
    ({ ...base, id, code, name, type_code: "POST_OFFICE", parent_id: parent, status: "ACTIVE", start: created.slice(0, 10),
      created_at: created, phone, email: `${id.replace("org-", "bc")}@supership.vn`, address, ward, province, people, sessions: people,
      model: { code: model, since: created, version: 1 } });
  return [
    corp,
    franchise("org-hcm", "CTT29Y5S0B0", "CÔNG TY TNHH SUPERSHIP HỒ CHÍ MINH", "2024-01-01T01:00:00Z", "0907628341",
      "Số 45 đường Cộng Hòa", "Phường Tân Bình", "Thành phố Hồ Chí Minh",
      enterprise("CÔNG TY TNHH SUPERSHIP HỒ CHÍ MINH", "0316284502", "Số 45 đường Cộng Hòa, Phường Tân Bình, Thành phố Hồ Chí Minh", "ketoan@supershiphcm.vn"),
      [{ full_name: "Võ Thanh Tùng", position_title: "Giám đốc" }]),
    franchise("org-hn", "CTT01DFQ9Z1", "CÔNG TY TNHH SUPERSHIP HÀ NỘI", "2024-01-02T01:00:00Z", "0983657214",
      "Số 18 đường Hồ Tùng Mậu", "Phường Từ Liêm", "Thành phố Hà Nội",
      enterprise("CÔNG TY TNHH SUPERSHIP HÀ NỘI", "0109358703", "Số 18 đường Hồ Tùng Mậu, Phường Từ Liêm, Thành phố Hà Nội", "ketoan@supershiphn.vn"),
      [{ full_name: "Đỗ Minh Quân", position_title: "Giám đốc" }]),
    franchise("org-dn", "CTT218GXDKV", "HỘ KINH DOANH SUPERSHIP ĐÀ NẴNG", "2024-01-03T01:00:00Z", "0905286147",
      "Số 9 đường Lê Văn Hiến", "Phường Ngũ Hành Sơn", "Thành phố Đà Nẵng",
      { legal_form_name: "Hộ kinh doanh", enterprise_type_name: null, registered_name: "HỘ KINH DOANH SUPERSHIP ĐÀ NẴNG",
        registration_number_display: "********4217", verification_status: "VERIFIED", verification_status_name: "Đã xác minh",
        registered_address: "Số 9 đường Lê Văn Hiến, Phường Ngũ Hành Sơn, Thành phố Đà Nẵng", invoice_email: "supershipdanang@gmail.com" },
      [{ full_name: "Phan Thị Diệu", position_title: "Chủ hộ kinh doanh" }]),
    franchise("org-gl", "CTT24W45Z2X", "NHƯỢNG QUYỀN SUPERSHIP GIA LAI", "2024-01-04T01:00:00Z", "0973641852",
      "Số 60 đường Trần Phú", "Phường Pleiku", "Tỉnh Gia Lai",
      { legal_form_name: "Hộ kinh doanh", enterprise_type_name: null, registered_name: "HỘ KINH DOANH VẬN CHUYỂN PHỐ NÚI",
        registration_number_display: "********6358", verification_status: "VERIFIED", verification_status_name: "Đã xác minh",
        registered_address: "Số 60 đường Trần Phú, Phường Pleiku, Tỉnh Gia Lai", invoice_email: "vanchuyenphonui@gmail.com" },
      [{ full_name: "Rơ Mah Hiền", position_title: "Chủ hộ kinh doanh" }]),
    { ...franchise("org-hd", "NQT01P4X8N2", "NHƯỢNG QUYỀN HÀ ĐÔNG", "2025-03-10T01:00:00Z", "02433556789",
      "Tầng 3, số 8 Tố Hữu", "Phường Kiến Hưng", "Thành phố Hà Nội",
      enterprise("CÔNG TY TNHH VẬN CHUYỂN HÀ ĐÔNG", "0109876543", "Số 25 đường Quang Trung, Phường Hà Đông, Thành phố Hà Nội", "ketoan@vanchuyenhadong.vn"),
      [{ full_name: "Nguyễn Văn An", position_title: "Giám đốc" }, { full_name: "Trần Thị Mai", position_title: "Chủ tịch Hội đồng thành viên" }], 6),
      email: "dieuhanh@vanchuyenhadong.vn", sessions: 35 },
    office("org-tb", "BCT29T4B7K1", "BƯU CỤC TÂN BÌNH", "org-hcm", "DELIVERY_PICKUP", "2024-02-01T01:00:00Z", "02838112233",
      "Số 120 đường Hoàng Văn Thụ", "Phường Tân Bình", "Thành phố Hồ Chí Minh", 14),
    office("org-tsh", "BCT29S8H2M5", "BƯU CỤC TÂN SƠN HÒA", "org-hcm", "DELIVERY", "2024-03-05T01:00:00Z", "02838445566",
      "Số 31 đường Phổ Quang", "Phường Tân Sơn Hòa", "Thành phố Hồ Chí Minh", 9),
    office("org-cg", "BCT01C3G9P4", "BƯU CỤC CẦU GIẤY", "org-hn", "DELIVERY_PICKUP", "2024-02-20T01:00:00Z", "02437654321",
      "Số 88 đường Trần Duy Hưng", "Phường Cầu Giấy", "Thành phố Hà Nội", 11),
    office("org-nhs", "BCT21N5H8S2", "BƯU CỤC NGŨ HÀNH SƠN", "org-dn", "PICKUP", "2024-04-15T01:00:00Z", "02363987654",
      "Số 14 đường Lê Văn Hiến", "Phường Ngũ Hành Sơn", "Thành phố Đà Nẵng", 7),
    office("org-pk", "BCT24P7L3K9", "BƯU CỤC PLEIKU", "org-gl", "DELIVERY", "2024-06-01T01:00:00Z", "02693825147",
      "Số 102 đường Hùng Vương", "Phường Pleiku", "Tỉnh Gia Lai", 0),
    office("org-yn", "BCT01H6C8V3", "BƯU CỤC YÊN NGHĨA", "org-hd", "DELIVERY_PICKUP", "2025-04-01T01:00:00Z", "02433551188",
      "Số 18 Quốc lộ 6", "Phường Yên Nghĩa", "Thành phố Hà Nội", 17),
    office("org-dn2", "BCT01B9F4L7", "BƯU CỤC DƯƠNG NỘI", "org-hd", "PICKUP", "2025-05-12T01:00:00Z", "02433552266",
      "Số 5 đường Lê Quang Đạo", "Phường Dương Nội", "Thành phố Hà Nội", 12),
  ];
}

export const UNITS = {
  hadong: { id: "org-hd", name: "NHƯỢNG QUYỀN HÀ ĐÔNG" },
  yenNghia: { id: "org-yn", name: "BƯU CỤC YÊN NGHĨA" },
  duongNoi: { id: "org-dn2", name: "BƯU CỤC DƯƠNG NỘI" },
  pleiku: { id: "org-pk", name: "BƯU CỤC PLEIKU" },
};

type Role = "admin" | "manager";
export interface UnitMock {
  /** Status of some units when the flow starts, with the day they changed. */
  start: Record<string, { status: Status; since: string }>;
  /** Accepted changes (after the code). */
  writes: number;
  /** Someone else changes the post office type to `code` before the next save. */
  changeElsewhere(id: string, code: string): void;
  unit(id: string): Unit;
}
export interface UnitContext extends FlowContext { mock: UnitMock }

function capability(key: string, admin: boolean) {
  return {
    permission_key: key, allowed: true, available: true, availability: "AVAILABLE", requires_mfa: false,
    requires_approval: false, required_scope_types: ["ORGANIZATION"], rejection_reasons: [],
    grants: [{ assignment_id: "capture-grant", source_type: "ROLE_VERSION", effect: "ALLOW", role_id: null, role_version_id: null,
      scopes: [{ scope_type: "ORGANIZATION", organization_mode: admin ? "GLOBAL" : "SELF", anchor_organization_id: admin ? null : UNITS.hadong.id,
        organization_ids: [], application_ids: [], resources: [], attribute_conditions: [] }] }],
  };
}

function unitFlow(prefix: string, group: [string, ...string[]], { id, name, role = "admin", start = {}, run }: {
  id: string; name: string; role?: Role; start?: UnitMock["start"]; run: (ctx: UnitContext) => Promise<void>;
}) {
  return defineFlow({
    id: `${prefix}${id}`, name, app: "superplatform", group,
    async run(ctx) {
      const mock = await mockUnits(ctx.page, ctx.log, role, start);
      await run({ ...ctx, mock });
    },
  });
}
export const statusFlow = (options: Parameters<typeof unitFlow>[2]) => unitFlow("superplatform-trang-thai-", STATUS_GROUP, options);
export const typeFlow = (options: Parameters<typeof unitFlow>[2]) => unitFlow("superplatform-loai-hinh-", TYPE_GROUP, options);

async function mockUnits(page: Page, log: (line: string) => void, role: Role, start: UnitMock["start"]): Promise<UnitMock> {
  await mockPin(page, log, false);
  const admin = role === "admin";
  const capabilities = ["identity.view", "organization.view", "organization.profile.update", "organization.contact.manage",
    "organization.address.manage", "organization.legal_entity.view",
    ...(admin ? ["organization.franchise.create", "organization.post_office.create", "organization.legal_entity.update",
      "organization.legal_entity.view_sensitive", "organization.legal_entity.verify", "organization.status.manage",
      "organization.classification.update"] : ["organization.legal_entity.update"])];
  const all = units();
  for (const [unitId, { status, since }] of Object.entries(start)) {
    const unit = all.find(item => item.id === unitId)!;
    unit.status = status; unit.since = since; unit.version++;
    if (status !== "ACTIVE") unit.sessions = 0;
  }
  const find = (unitId: string) => all.find(unit => unit.id === unitId);
  let challenges = 0;
  const mock: UnitMock = {
    start, writes: 0,
    changeElsewhere(unitId, code) { const unit = find(unitId)!; unit.model = { code, since: ELSEWHERE, version: unit.model!.version + 1 }; },
    unit: unitId => find(unitId)!,
  };

  /* ---- What the server works out ---- */
  const parentOf = (unit: Unit) => unit.parent_id ? find(unit.parent_id) ?? null : null;
  /** The nearest unit above that is suspended or closed. */
  const blocker = (unit: Unit): Unit | null => {
    for (let above = parentOf(unit); above; above = parentOf(above)) if (above.status !== "ACTIVE") return above;
    return null;
  };
  const openBelow = (unit: Unit) => all.filter(item => item.parent_id === unit.id && item.status !== "CLOSED").length;
  const changeable = (unit: Unit) => admin && (unit.type_code === "FRANCHISE_PARTNER" || unit.type_code === "POST_OFFICE");
  const belowPhrase = (unit: Unit) => unit.type_code === "FRANCHISE_PARTNER" && openBelow(unit) > 0 ? ` và ${openBelow(unit)} bưu cục trực thuộc` : "";
  const closeMissing = (unit: Unit) => [
    ...(openBelow(unit) > 0 ? [`Còn ${openBelow(unit)} bưu cục trực thuộc chưa ngừng hoạt động. Ngừng hoạt động các bưu cục đó trước.`] : []),
    ...(unit.people > 0 ? [`Còn ${unit.people} người đang làm việc ở ${unit.name}. Điều chuyển hoặc cho nghỉ việc trước.`] : []),
  ];
  const parentFirst = (above: Unit) => above.status === "SUSPENDED"
    ? `${above.name} đang tạm ngưng, kích hoạt lại nhượng quyền trước.` : `${above.name} đã ngừng hoạt động.`;
  const off = { available: false, enabled: false, disabled_reason: null };
  const on = { available: true, enabled: true, disabled_reason: null };
  const blocked = (reason: string) => ({ available: true, enabled: false, disabled_reason: reason });
  /** AdminUnitAccess.change: absent without the permission or once closed, greyed while suspended. */
  const change = (permitted: boolean, unit: Unit, reason: string) => {
    if (!permitted || unit.status === "CLOSED") return off;
    if (unit.status !== "ACTIVE") return blocked(reason);
    const note = blockedNote(unit);
    return note ? blocked(note) : on;
  };

  /** AdminStatusStore.Blocker.note: the line of a unit below one that is not active. */
  const blockedNote = (unit: Unit) => {
    const above = blocker(unit);
    return above ? `Đang bị chặn vì ${above.name}${above.status === "SUSPENDED" ? " đang tạm ngưng." : " đã ngừng hoạt động."}` : null;
  };
  const statusOf = (unit: Unit) => {
    const ok = changeable(unit), above = blocker(unit), missing = unit.status === "CLOSED" || !ok ? [] : closeMissing(unit);
    const phrase = unit.name + belowPhrase(unit);
    const working = ok && unit.status === "ACTIVE" ? unit.sessions : 0;
    return {
      organization_id: unit.id, name: unit.name, status: unit.status, status_name: STATUS_NAME[unit.status], version: unit.version,
      since: unit.since, closed_on: unit.closed_on, operation_start_date: unit.start,
      blocked_by: blockedNote(unit),
      actions: {
        suspend: ok && unit.status === "ACTIVE" ? on : off,
        reactivate: ok && unit.status === "SUSPENDED" ? above ? blocked(parentFirst(above)) : on : off,
        close: ok && unit.status !== "CLOSED" ? missing.length ? blocked(missing[0]!) : on : off,
      },
      dialogs: ok ? {
        suspend_impact: `${phrase} sẽ không làm việc được.${working > 0 ? ` ${working} người đang làm việc sẽ bị kết thúc phiên làm việc.` : ""}`,
        reactivate_impact: `${phrase} làm việc lại được. Người làm phải chọn lại đơn vị làm việc.`,
        close_warning: `${unit.name} sẽ ngừng hoạt động vĩnh viễn, không kích hoạt lại được. Dữ liệu được giữ để tra cứu.`,
        close_missing: missing,
      } : null,
    };
  };
  const operationModelOf = (unit: Unit) => {
    const current = MODELS.find(model => model.code === unit.model!.code)!;
    return {
      organization_id: unit.id, version: unit.model!.version,
      current: { ...current, since: unit.model!.since },
      options: MODELS.filter(model => model.code !== current.code).map(model => ({ ...model, since: null })),
      actions: { change: change(admin, unit, "Bưu cục đang tạm ngưng, kích hoạt lại rồi mới đổi được loại hình.") },
    };
  };
  const MISSING = "Chưa có";
  /** DisplayText.day: dd/MM/yyyy of a day, or of an instant in Vietnam (UTC+7). */
  const day = (value: string) => (value.length > 10 ? new Date(Date.parse(value) + 7 * 3600_000).toISOString() : value)
    .slice(0, 10).split("-").reverse().join("/");
  const display = (unit: Unit) => `${unit.address}, ${unit.ward}, ${unit.province}`;
  const profileOf = (unit: Unit) => {
    const office = unit.type_code === "POST_OFFICE", parent = parentOf(unit);
    const legalHolder = office ? parent! : unit;
    const edit = change(true, unit, "Đơn vị đang tạm ngưng, kích hoạt lại rồi mới sửa được hồ sơ.");
    return {
      id: unit.id, code: unit.code, name: unit.name, logo_url: null, type_code: unit.type_code,
      type_name: office ? "Bưu cục" : unit.type_code === "CORPORATION" ? "Tổng công ty" : "Nhượng quyền",
      // AdminProfileService: every text ready to show, days as dd/MM/yyyy (Vietnam), "Chưa có" for nothing yet.
      status: unit.status, status_name: STATUS_NAME[unit.status], operation_start_date: day(unit.start),
      operation_start_date_value: unit.start, created_at: day(unit.created_at),
      closed_on: unit.status === "CLOSED" && unit.closed_on ? day(unit.closed_on) : null, blocked_message: blockedNote(unit),
      parent: parent ? { id: parent.id, name: parent.name } : null,
      created_by: unit.type_code === "CORPORATION" ? null : { full_name: "Phạm Thu Hà", organization_name: "CÔNG TY CỔ PHẦN SUPERSHIP VIỆT NAM" },
      operation_model: office ? { code: unit.model!.code, name: modelName(unit.model!.code), since: day(unit.model!.since) } : null,
      legal: legalHolder.legal ? { declared: true, via_franchise_name: office ? legalHolder.name : null, ...legalHolder.legal,
        invoice_email: office ? null : legalHolder.legal.invoice_email }
        : { declared: false, via_franchise_name: office ? legalHolder.name : null, legal_form_name: MISSING, enterprise_type_name: null,
            registered_name: MISSING, registration_number_display: MISSING, verification_status: null, verification_status_name: MISSING,
            registered_address: MISSING, invoice_email: office ? null : MISSING },
      legal_representatives: office ? null : unit.representatives?.length
        ? unit.representatives.map(rep => ({ ...rep, value: `${rep.full_name}, ${rep.position_title}`, missing: false }))
        : [{ full_name: null, position_title: null, value: MISSING, missing: true }],
      contacts: [
        { type: "PHONE", type_name: "Số điện thoại", value: unit.phone, missing: false },
        { type: "EMAIL", type_name: "Email", value: unit.email ?? "Chưa có", missing: !unit.email },
        ...(office ? [] : [{ type: "WEBSITE", type_name: "Website", value: "Chưa có", missing: true }]),
      ],
      addresses: [{ type: office ? "SERVICE_POINT" : "TRANSACTION_OFFICE", type_name: office ? "Địa chỉ điểm phục vụ" : "Văn phòng giao dịch",
        value: display(unit), missing: false }],
      version: unit.version,
      actions: { edit, change_logo: edit,
        change_operation_model: office ? change(admin, unit, "Bưu cục đang tạm ngưng, kích hoạt lại rồi mới đổi được loại hình.") : off },
    };
  };
  const typeName = (unit: Unit) => unit.type_code === "POST_OFFICE" ? "Bưu cục" : unit.type_code === "CORPORATION" ? "Tổng công ty" : "Nhượng quyền";
  const row = (unit: Unit) => {
    const above = blocker(unit), parent = parentOf(unit);
    const blockedMessage = above ? `Bị chặn vì ${above.name} đang ${above.status === "SUSPENDED" ? "tạm ngưng" : "ngừng hoạt động"}` : null;
    return {
      id: unit.id, code: unit.code, name: unit.name, type_code: unit.type_code, type_name: typeName(unit),
      parent_id: unit.parent_id, parent_name: parent?.name ?? null, status: unit.status, status_name: STATUS_NAME[unit.status],
      locality: `${unit.ward}, ${unit.province}`, phone: unit.phone,
      operation_model: unit.model?.code ?? null, operation_model_name: unit.model ? modelName(unit.model.code) : null,
      blocked_message: blockedMessage,
      registration_number_display: unit.type_code === "FRANCHISE_PARTNER" ? unit.legal?.registration_number_display ?? MISSING : null,
      // OrganizationDirectoryService.postOfficeCount: the count as text, "Chưa có" for none.
      post_office_count: unit.type_code === "FRANCHISE_PARTNER" ? openBelow(unit) ? String(openBelow(unit)) : MISSING : null,
      created_at: unit.created_at,
      // OrganizationDirectoryService.withActions: only for the system administrator.
      actions: !admin ? { suspend: off, reactivate: off } : {
        suspend: unit.status === "ACTIVE" ? on : off,
        reactivate: unit.status !== "SUSPENDED" ? off : !blockedMessage ? on : blocked(`${parent?.name} đang tạm ngưng, kích hoạt lại nhượng quyền trước.`),
      },
    };
  };
  const summary = (unit: Unit) => ({ id: unit.id, code: unit.code, name: unit.name, type_code: unit.type_code, type_name: typeName(unit),
    parent_id: unit.parent_id, parent_name: parentOf(unit)?.name ?? null, status: unit.status, status_name: STATUS_NAME[unit.status],
    valid_from: unit.created_at, valid_to: null, created_at: unit.created_at });

  // Registered after mockPin, so it is asked first and falls back to it for the session calls.
  await page.context().route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/backend/, "");
    const method = request.method();
    const send = (data: unknown, status = 200, message = "") => route.fulfill({ status,
      headers: { "X-Browser-Session-Version": "1" }, json: { error: status >= 400, message, data } });
    const refuse = (status: number, code: string, message: string, fields?: Record<string, string>) =>
      send({ code, ...(fields ? { fields } : {}) }, status, message);
    /** StepUpGuard: no code yet → a challenge for this very change; a wrong code → asked again. */
    const stepUp = (action: string, summaryLine: string) => {
      const code = request.headers()["x-step-up-code"];
      if (!code) return send({ code: "STEP_UP_REQUIRED", challenge_id: `challenge-${++challenges}`, action, summary: summaryLine,
        method: "AUTHENTICATOR", expires_at: LATER }, 403, "Vui lòng nhập mã xác thực để xác nhận thao tác này.");
      if (code !== STEP_UP_CODE) return refuse(400, "MFA_INVALID_CODE", MESSAGES.wrongCode);
      return null;
    };

    if (path === "/v1/me/capabilities") return send({
      context: { context_id: "pin-context", context_type: "SUPERPLATFORM", application_name: "SUPERPLATFORM", membership_id: "pin-member", organization_id: "pin-org" },
      assurance: { level: 2, mfa_verified: true, mfa_verified_at: NOW }, capabilities: capabilities.map(key => capability(key, admin)),
      revision: "capture", generated_at: NOW, expires_at: LATER,
    });

    /* ---- Shell ---- */
    if (path === "/v1/me/employee-invitations/count") return send({ pending: 0 });
    if (path === "/v1/shops/list-options") return send({ internal_allowed: true, shops_allowed: false, types: [], statuses: [],
      franchises: [], post_offices: [], operation_models: [] });

    /* ---- Directory ---- */
    if (path === "/v1/organizations/list-options") {
      const visible = all.filter(unit => admin ? unit.type_code !== "CORPORATION" : unit.id === UNITS.hadong.id || unit.parent_id === UNITS.hadong.id);
      const sorts = [{ code: "created_desc", name: "Mới thêm trước" }, { code: "name_asc", name: "Tên A–Z" }];
      // Asked for one franchise (its "Bưu cục" tab): that franchise's "Mở bưu cục" and empty sentence.
      const pageId = url.searchParams.get("franchiseId");
      const page = pageId ? find(pageId) ?? null : null;
      if (pageId && (!page || page.type_code !== "FRANCHISE_PARTNER")) return refuse(404, "ORGANIZATION_NOT_FOUND", "Không tìm thấy nhượng quyền.");
      /** OrganizationDirectoryService.openPostOffice: greyed while the franchise, or a unit above it, is not active. */
      const openPostOffice = (franchise: Unit) => {
        if (!admin) return off;
        if (franchise.status === "ACTIVE") {
          const above = blocker(franchise);
          return above ? blocked(`${above.name} ${above.status === "SUSPENDED" ? "đang tạm ngưng" : "đã ngừng hoạt động"}, không mở được bưu cục.`) : on;
        }
        return blocked(`${franchise.name}${franchise.status === "SUSPENDED" ? " đang tạm ngưng" : " đã ngừng hoạt động"}, không mở được bưu cục.`);
      };
      return send({
        internal_allowed: true, shops_allowed: false,
        types: [{ code: "FRANCHISE_PARTNER", name: "Nhượng quyền" }, { code: "POST_OFFICE", name: "Bưu cục" }],
        statuses: [{ code: "OPERATING", name: "Đang hoạt động và Tạm ngưng" }, { code: "ACTIVE", name: "Đang hoạt động" },
          { code: "SUSPENDED", name: "Tạm ngưng" }, { code: "CLOSED", name: "Ngừng hoạt động" }, { code: "ALL", name: "Tất cả" }],
        franchises: visible.filter(unit => unit.type_code === "FRANCHISE_PARTNER").map(({ id, code, name, parent_id }) => ({ id, code, name, parent_id })),
        post_offices: visible.filter(unit => unit.type_code === "POST_OFFICE").map(({ id, code, name, parent_id }) => ({ id, code, name, parent_id })),
        operation_models: MODELS.map(({ code, name }) => ({ code, name })),
        viewer_type: admin ? "CORPORATION" : "FRANCHISE_PARTNER", viewer_organization_id: admin ? CORP_ID : UNITS.hadong.id,
        tabs: admin ? [{ code: "FRANCHISE_PARTNER", name: "Nhượng quyền" }, { code: "POST_OFFICE", name: "Bưu cục" }] : [{ code: "POST_OFFICE", name: "Bưu cục" }],
        sorts: { FRANCHISE_PARTNER: [...sorts, { code: "post_office_count_desc", name: "Nhiều bưu cục nhất" }, { code: "post_office_count_asc", name: "Ít bưu cục nhất" }],
          POST_OFFICE: sorts, SHOP: sorts },
        page_sizes: [20, 50, 100],
        create_franchise: admin ? on : off, open_post_office: page ? openPostOffice(page) : off,
        empty_message: page ? `${page.name} chưa có bưu cục nào.` : null,
      });
    }
    if (path === "/v1/organization-directory/regions") {
      const province = url.searchParams.get("provinceCode");
      return send(province ? [] : [{ code: "P01", name: "Thành phố Hà Nội" }, { code: "P21", name: "Thành phố Đà Nẵng" },
        { code: "P24", name: "Tỉnh Gia Lai" }, { code: "P29", name: "Thành phố Hồ Chí Minh" }]);
    }
    if (path === "/v1/organizations" && method === "GET") {
      const type = url.searchParams.get("typeCode"), franchise = url.searchParams.get("franchiseId");
      const status = url.searchParams.get("status") || "OPERATING";
      const items = all.filter(unit => unit.type_code !== "CORPORATION" && (!type || unit.type_code === type)
          && (!franchise || unit.parent_id === franchise)
          && (admin || unit.parent_id === UNITS.hadong.id)
          && (status === "ALL" || (status === "OPERATING" ? unit.status !== "CLOSED" : unit.status === status)))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).map(row);
      return send({ items, page: 0, size: 20, has_next: false, total_elements: items.length, total_pages: 1 });
    }
    const options = path.match(/^\/v1\/franchises\/([^/]+)\/post-office-creation-options$/);
    if (options) {
      const franchise = find(options[1]!)!;
      const reason = franchise.status === "ACTIVE" ? null : `${franchise.name} đang tạm ngưng, không mở được bưu cục.`;
      return send({ franchise: { id: franchise.id, name: franchise.name, status: franchise.status, status_name: STATUS_NAME[franchise.status] },
        can_open: !reason, blocked_reason: reason, operation_models: MODELS,
        address_types: [{ code: "SERVICE_POINT", name: "Địa chỉ điểm phục vụ", required: true }],
        contact_types: [{ code: "PHONE", name: "Số điện thoại", value_kind: "PHONE", required: true }, { code: "EMAIL", name: "Email", value_kind: "EMAIL", required: false }] });
    }

    /* ---- Administration of one unit ---- */
    const adminPath = path.match(/^\/v1\/admin\/organizations\/([^/]+)(\/.*)$/);
    if (adminPath) {
      const unit = find(adminPath[1]!);
      if (!unit) return refuse(404, "ORGANIZATION_NOT_FOUND", "Không tìm thấy đơn vị.");
      const rest = adminPath[2]!;
      if (rest === "/profile" && method === "GET") return send(profileOf(unit));
      if (rest === "/status" && method === "GET") return send(statusOf(unit));
      if (rest === "/operation-model" && method === "GET") return send(operationModelOf(unit));
      if (rest === "/status/suspension" || rest === "/status/reactivation" || rest === "/status/closure") {
        const body = request.postDataJSON() ?? {};
        if (!admin) return refuse(403, "PERMISSION_DENIED", "Bạn không có quyền đổi trạng thái đơn vị.");
        if (rest === "/status/suspension") {
          if (unit.status !== "ACTIVE") return refuse(409, "INVALID_STATUS", `${unit.name} không ở trạng thái Đang hoạt động.`);
          if (body.version !== unit.version) return refuse(409, "VERSION_CONFLICT", MESSAGES.statusConflict);
          const asked = stepUp("ORGANIZATION_STATUS_CHANGE", `Tạm ngưng ${unit.name}${belowPhrase(unit)}`);
          if (asked) return asked;
          Object.assign(unit, { status: "SUSPENDED", since: NOW, sessions: 0, version: unit.version + 1 });
        } else if (rest === "/status/reactivation") {
          if (unit.status !== "SUSPENDED") return refuse(409, "INVALID_STATUS", `${unit.name} không ở trạng thái Tạm ngưng.`);
          const above = blocker(unit);
          if (above) return refuse(409, "PARENT_NOT_ACTIVE", parentFirst(above));
          if (body.version !== unit.version) return refuse(409, "VERSION_CONFLICT", MESSAGES.statusConflict);
          const asked = stepUp("ORGANIZATION_STATUS_CHANGE", `Kích hoạt lại ${unit.name}`);
          if (asked) return asked;
          Object.assign(unit, { status: "ACTIVE", since: NOW, version: unit.version + 1 });
        } else {
          if (unit.status === "CLOSED") return refuse(409, "INVALID_STATUS", `${unit.name} đã ngừng hoạt động.`);
          const missing = closeMissing(unit);
          if (missing.length) return refuse(409, "CLOSE_CONDITION_MISSING", missing[0]!);
          const closedOn = String(body.closed_on ?? "").trim();
          if (!closedOn) return refuse(400, "ORGANIZATION_INPUT_INVALID", "Hãy chọn ngày ngừng hoạt động.", { closed_on: "Hãy chọn ngày ngừng hoạt động." });
          if (closedOn > NOW.slice(0, 10) || closedOn < unit.start) return refuse(400, "ORGANIZATION_INPUT_INVALID", "Ngày ngừng hoạt động không hợp lệ.", { closed_on: "Ngày ngừng hoạt động không hợp lệ." });
          const typed = String(body.confirm_name ?? "").trim().toLowerCase();
          if (typed !== unit.name.trim().toLowerCase()) return refuse(400, "ORGANIZATION_INPUT_INVALID", MESSAGES.wrongName, { confirm_name: MESSAGES.wrongName });
          if (body.version !== unit.version) return refuse(409, "VERSION_CONFLICT", MESSAGES.statusConflict);
          const asked = stepUp("ORGANIZATION_STATUS_CHANGE", `Ngừng hoạt động vĩnh viễn ${unit.name} từ ${closedOn.split("-").reverse().join("/")}`);
          if (asked) return asked;
          Object.assign(unit, { status: "CLOSED", since: NOW, closed_on: closedOn, sessions: 0, version: unit.version + 1 });
        }
        mock.writes++;
        const done = rest === "/status/suspension" ? `Đã tạm ngưng ${unit.name}.` : rest === "/status/reactivation" ? `Đã kích hoạt lại ${unit.name}.`
          : `${unit.name} đã ngừng hoạt động từ ${unit.closed_on!.split("-").reverse().join("/")}.`;
        return send(statusOf(unit), 200, done);
      }
      if (rest === "/operation-model" && method === "PUT") {
        const body = request.postDataJSON() ?? {};
        if (!admin) return refuse(403, "PERMISSION_DENIED", "Bạn không có quyền đổi loại hình bưu cục.");
        if (unit.status === "SUSPENDED") return refuse(409, "ORGANIZATION_NOT_ACTIVE", `${unit.name} đang tạm ngưng, kích hoạt lại rồi mới đổi được loại hình.`);
        if (unit.status === "CLOSED") return refuse(409, "ORGANIZATION_NOT_ACTIVE", `${unit.name} đã ngừng hoạt động, không đổi được loại hình.`);
        const code = String(body.operation_model ?? "").trim();
        if (!code) return refuse(400, "ORGANIZATION_INPUT_INVALID", "Hãy chọn loại hình mới.", { operation_model: "Hãy chọn loại hình mới." });
        const next = MODELS.find(model => model.code === code);
        if (!next) return refuse(400, "ORGANIZATION_INPUT_INVALID", "Loại hình bưu cục không hợp lệ.", { operation_model: "Loại hình bưu cục không hợp lệ." });
        if (unit.model!.code === code) return refuse(409, "NO_CHANGE", `${unit.name} đang là ${next.name}.`);
        if (body.version !== unit.model!.version) return refuse(409, "VERSION_CONFLICT", MESSAGES.modelConflict);
        const asked = stepUp("POST_OFFICE_TYPE_CHANGE", `Đổi loại hình ${unit.name} từ ${modelName(unit.model!.code)} sang ${next.name}`);
        if (asked) return asked;
        unit.model = { code, since: NOW, version: unit.model!.version + 1 };
        mock.writes++;
        return send(operationModelOf(unit), 200, `Đã đổi loại hình ${unit.name} sang ${next.name}.`);
      }
    }

    /* ---- Detail pages ---- */
    const detail = path.match(/^\/v1\/organizations\/([^/]+)(\/.*)?$/);
    if (detail && method === "GET") {
      const [, unitId, rest = ""] = detail;
      const unit = find(unitId!);
      if (!unit) return refuse(404, "ORGANIZATION_NOT_FOUND", "Không tìm thấy tổ chức.");
      if (rest === "") return send(summary(unit));
      if (rest === "/profile") return send({ id: unit.id, code: unit.code, name: unit.name, logo_url: null,
        type: { id: `type-${unit.type_code}`, code: unit.type_code, name: typeName(unit) }, internal: true, status: unit.status,
        operation_start_date: unit.start, valid_from: unit.created_at, valid_to: null, version: unit.version, user_model: "MULTI_USER",
        created_at: unit.created_at, updated_at: unit.created_at });
      if (rest === "/breadcrumb") {
        const chain: Unit[] = [];
        for (let item: Unit | null = unit; item; item = parentOf(item)) chain.unshift(item);
        return send({ items: chain.map(summary) });
      }
      if (rest === "/departments/access") return send({ organization_id: unit.id, organization_type: unit.type_code, can_view: false,
        can_manage: false, reason_code: "DEPARTMENT_NOT_SUPPORTED" });
    }
    return route.fallback();
  });
  return mock;
}

/* ---- Pages ---- */

/** The unit page, "Tổng quan" section, once its status buttons (or their absence) are known. */
export async function openUnit(page: Page, unit: { id: string; name: string }) {
  await page.goto(`/workspace/organizations/${unit.id}`);
  await page.getByRole("heading", { name: "Tổng quan tổ chức", exact: true }).waitFor();
  await page.getByRole("heading", { name: unit.name, exact: true }).first().waitFor();
  await page.getByText("Liên hệ", { exact: true }).first().waitFor();
}
export async function openList(page: Page, tab: "FRANCHISE_PARTNER" | "POST_OFFICE" = "FRANCHISE_PARTNER") {
  await page.goto(`${LIST_URL}${tab === "POST_OFFICE" ? "?tab=POST_OFFICE" : ""}`);
  await page.getByRole("cell", { name: tab === "POST_OFFICE" ? UNITS.yenNghia.name : UNITS.hadong.name }).first().waitFor();
}
/** The "Bưu cục" tab of a franchise: no "Thuộc nhượng quyền" column, so the status column fits on screen. */
export async function openPostOffices(page: Page, franchise = UNITS.hadong) {
  await page.goto(`/workspace/organizations/${franchise.id}/post-offices`);
  await page.getByRole("heading", { name: "Bưu cục", exact: true }).waitFor();
  await page.getByRole("cell", { name: UNITS.yenNghia.name }).first().waitFor();
}
export const button = (page: Page, label: string) =>
  page.locator(".organization-overview-title").getByRole("button", { name: label, exact: true });
export const dialog = (page: Page, title: string) => page.getByRole("dialog", { name: title });
export async function openDialog(page: Page, label: string, title: string) {
  await button(page, label).click();
  await dialog(page, title).waitFor();
}
/** The "⋯" of a directory row, open. */
export async function openRowMenu(page: Page, name: string) {
  await page.getByRole("button", { name: `Thao tác với ${name}` }).click();
  await page.getByRole("menuitem", { name: "Xem chi tiết" }).waitFor();
}

/* ---- Controls ---- */

export const field = (page: Page, id: string) => page.locator(`[id="${id}"]`);
/** Picks a date (yyyy-mm-dd) in the shared calendar: year, month, then the day of that month. */
export async function pickDate(page: Page, id: string, iso: string) {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  const container = field(page, id).locator("xpath=..");
  await field(page, id).click();
  const calendar = container.getByRole("dialog", { name: "Lịch chọn ngày" });
  await calendar.waitFor();
  await calendar.getByRole("button", { name: "Chọn năm" }).click();
  await calendar.getByRole("group", { name: "Danh sách năm" }).getByRole("button", { name: String(year), exact: true }).click();
  await calendar.getByRole("button", { name: "Chọn tháng" }).click();
  await calendar.getByRole("group", { name: "Danh sách tháng" }).getByRole("button", { name: `Tháng ${month}`, exact: true }).click();
  // Days of the neighbouring months share the grid: small numbers repeat at the end, large ones at the start.
  const days = calendar.getByRole("button", { name: String(day), exact: true });
  await (day < 15 ? days.first() : days.last()).click();
  await calendar.waitFor({ state: "hidden" });
}

/* ---- Step-up ---- */

export const codeDialog = (page: Page) => page.getByRole("dialog", { name: "Xác nhận thao tác" });
export async function waitCode(page: Page) { await field(page, "step-up-code").waitFor(); }
export async function enterCode(page: Page, code = STEP_UP_CODE) {
  await field(page, "step-up-code").fill(code);
  await codeDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
}
export const toast = (page: Page, text: string) => page.getByText(text, { exact: true }).first();
export { expect };
export type { Request };
