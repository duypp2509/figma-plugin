import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page, Request } from "playwright";
import { expect } from "playwright/test";
import { defineFlow, type FlowContext } from "../../capture";
import { mockPin } from "./superplatform-screen-lock";
import { franchiseGroup, type FranchiseSection } from "./superplatform-franchise-sections";
import { pickCalendarDay } from "./calendar";

/*
 * "Thông tin pháp lý" (/workspace/organizations/{id}?section=legal-entities, /legal/edit, /legal/replace,
 * /legal/history) and "Người đại diện" (?section=representatives) of SuperPlatform, against an in-browser stand-in of
 * /v1/organizations/{id}/legal-profile/** (change requests included) and /v1/organizations/{id}/representatives/**,
 * plus the organization pages around them and POST /v1/document-uploads (the registration certificate, read on
 * upload). Shapes and sentences follow OrganizationLegalProfileService, LegalProfilePresenter, LegalProfileRules,
 * OrganizationRepresentativeService and RepresentativeRules. The page clock is frozen by mockPin at 12/10/2026 09:00,
 * so "today" and every date below stay the same on each run.
 *
 * Roles: "admin" is Nguyễn Minh Anh, Quản trị hệ thống: verifies, and their own "Sửa" of verified details and "Thay
 * chủ thể" take effect at once, verified against the source they name (Đ2-18). "manager" is Phạm Thu Trang, Quản lý
 * nhượng quyền: such a change becomes a change request waiting for the verification (P12, P13).
 */

export const STEP_UP_CODE = "515060";
const NOW = "2026-10-12T02:00:00.000Z";
const TODAY = "2026-10-12";
const ADMIN = "Nguyễn Minh Anh";
const MANAGER = "Phạm Thu Trang";

/** Exact sentences of the backend. */
export const MESSAGES = {
  declared: "Đã khai báo thông tin pháp lý. Đang chờ Quản trị hệ thống xác minh.",
  saved: "Đã lưu thông tin pháp lý.",
  savedPending: "Đã lưu thông tin pháp lý. Đang chờ Quản trị hệ thống xác minh lại.",
  amendmentSent: "Đã gửi yêu cầu sửa thông tin pháp lý. Đang chờ Quản trị hệ thống xác minh.",
  replaced: "Đã thay chủ thể pháp lý.",
  replacementSent: "Đã gửi yêu cầu thay chủ thể pháp lý. Đang chờ Quản trị hệ thống xác minh.",
  changePending: "Đang có yêu cầu thay đổi chờ xác minh.",
  withdrawn: "Đã rút yêu cầu.",
  verified: "Đã xác minh thông tin pháp lý.",
  rejected: "Đã từ chối xác minh.",
  unchanged: "Không có thay đổi.",
  sameNumber: "Mã số giống chủ thể hiện tại. Nếu chỉ đăng ký thay đổi thì dùng Sửa.",
  notPending: "Thông tin pháp lý này không còn chờ xác minh. Hãy tải lại.",
  requestNotPending: "Yêu cầu này không còn chờ xác minh. Hãy tải lại.",
  sourceRequired: "Hãy chọn nguồn đối chiếu.",
  wrongCode: "Mã xác thực không đúng hoặc đã được sử dụng.",
  notActive: (name: string) => `${name} đang tạm ngưng, kích hoạt lại rồi mới cập nhật được thông tin pháp lý.`,
  appointed: "Đã bổ nhiệm người đại diện.",
  repSaved: "Đã lưu thông tin người đại diện.",
  repEnded: "Đã kết thúc nhiệm kỳ người đại diện.",
  repSuspended: "Đơn vị đang tạm ngưng, kích hoạt lại rồi mới thay đổi được người đại diện.",
  repDuplicate: (label: string) => `Người này đang là người đại diện ${label.toLowerCase()} của đơn vị.`,
  householdSingle: "Hộ kinh doanh chỉ có một người đại diện theo pháp luật là chủ hộ. Hãy kết thúc nhiệm kỳ người cũ trước.",
};

/* ---- Catalogs (enums of the backend) ---- */

const LEGAL_FORMS = { ENTERPRISE: "Doanh nghiệp", HOUSEHOLD_BUSINESS: "Hộ kinh doanh", INDIVIDUAL: "Cá nhân" } as const;
type LegalForm = keyof typeof LEGAL_FORMS;
const ENTERPRISE_TYPES: Record<string, string> = {
  LLC_ONE_MEMBER: "Công ty TNHH một thành viên", LLC_MULTI_MEMBER: "Công ty TNHH hai thành viên trở lên",
  JOINT_STOCK: "Công ty cổ phần", PARTNERSHIP: "Công ty hợp danh", PRIVATE_ENTERPRISE: "Doanh nghiệp tư nhân",
};
const SOURCES: Record<string, [label: string, phrase: string]> = {
  NATIONAL_BUSINESS_REGISTRY: ["Cổng thông tin quốc gia về đăng ký doanh nghiệp", "tại Cổng thông tin quốc gia về đăng ký doanh nghiệp"],
  TAX_PAYER_LOOKUP: ["Trang tra cứu thông tin người nộp thuế", "tại trang tra cứu thông tin người nộp thuế"],
  REGISTRATION_DOCUMENT: ["Tệp giấy đăng ký", "với tệp giấy đăng ký"],
};
const REPLACEMENT_BASIS: Record<string, string> = {
  FRANCHISE_CONTRACT_APPENDIX: "Phụ lục hợp đồng nhượng quyền", TRANSFER_DOCUMENT: "Văn bản chuyển nhượng",
  NEW_REGISTRATION_CERTIFICATE: "Giấy chứng nhận đăng ký mới", OTHER: "Khác",
};
const ORIGINS = { DECLARED: "Khai báo", AMENDED: "Sửa", REPLACED: "Thay chủ thể" } as const;
type Origin = keyof typeof ORIGINS;
const REP_TYPES = { LEGAL_REPRESENTATIVE: "Theo pháp luật", AUTHORIZED_REPRESENTATIVE: "Theo ủy quyền" } as const;
type RepType = keyof typeof REP_TYPES;
const BASIS_TYPES: Record<string, string> = {
  BUSINESS_REGISTRATION_CERTIFICATE: "Giấy chứng nhận đăng ký doanh nghiệp", HOUSEHOLD_REGISTRATION_CERTIFICATE: "Giấy chứng nhận đăng ký hộ kinh doanh",
  COMPANY_CHARTER: "Điều lệ công ty", APPOINTMENT_DECISION: "Quyết định bổ nhiệm", POWER_OF_ATTORNEY: "Giấy ủy quyền",
  AUTHORIZATION_CONTRACT: "Hợp đồng ủy quyền",
};
/** The documents a term may rest on, by kind of representative (RepresentativeBasisDocumentType.allowedFor). */
function basisByType(legal: { legal_form: string; enterprise_type: string | null } | null) {
  const pick = (codes: string[]) => codes.map(code => ({ code, name: BASIS_TYPES[code]! }));
  if (!legal) return {};
  const byLaw = legal.legal_form === "HOUSEHOLD_BUSINESS" ? ["HOUSEHOLD_REGISTRATION_CERTIFICATE"]
    : legal.legal_form === "INDIVIDUAL" ? []
    : legal.enterprise_type === "PRIVATE_ENTERPRISE" ? ["BUSINESS_REGISTRATION_CERTIFICATE"]
    : legal.enterprise_type === "PARTNERSHIP" ? ["BUSINESS_REGISTRATION_CERTIFICATE", "COMPANY_CHARTER"]
    : ["BUSINESS_REGISTRATION_CERTIFICATE", "COMPANY_CHARTER", "APPOINTMENT_DECISION"];
  return { LEGAL_REPRESENTATIVE: pick(byLaw), AUTHORIZED_REPRESENTATIVE: pick(["POWER_OF_ATTORNEY", "AUTHORIZATION_CONTRACT"]) };
}
const TERMINATION_TYPES: Record<string, string> = {
  AMENDED_REGISTRATION_CERTIFICATE: "Giấy chứng nhận đăng ký thay đổi", DISMISSAL_DECISION: "Quyết định miễn nhiệm",
  AUTHORIZATION_TERMINATION: "Văn bản chấm dứt ủy quyền", OTHER: "Khác",
};
const choices = (map: Record<string, string>) => Object.entries(map).map(([code, name]) => ({ code, name }));

const PROVINCES = [
  { code: "P01", name: "Thành phố Hà Nội" }, { code: "P02", name: "Thành phố Hải Phòng" },
  { code: "P21", name: "Thành phố Đà Nẵng" }, { code: "P29", name: "Thành phố Hồ Chí Minh" },
];
const WARDS: Record<string, { code: string; name: string }[]> = {
  P01: ["Phường Hà Đông", "Phường Dương Nội", "Phường Kiến Hưng", "Phường Yên Nghĩa", "Phường Long Biên", "Phường Bồ Đề",
    "Phường Việt Hưng", "Phường Cầu Giấy", "Xã Gia Lâm", "Xã Đông Anh", "Xã Mê Linh"].map((name, i) => ({ code: `P01W${String(i + 1).padStart(3, "0")}`, name })),
  P02: ["Phường Hồng Bàng", "Phường Ngô Quyền", "Phường Lê Chân"].map((name, i) => ({ code: `P02W${String(i + 1).padStart(3, "0")}`, name })),
  P21: ["Phường Hải Châu", "Phường Ngũ Hành Sơn"].map((name, i) => ({ code: `P21W${String(i + 1).padStart(3, "0")}`, name })),
  P29: ["Phường Sài Gòn", "Phường Tân Bình", "Phường Tân Sơn Hòa"].map((name, i) => ({ code: `P29W${String(i + 1).padStart(3, "0")}`, name })),
};
const ward = (name: string) => WARDS.P01!.find(item => item.name === name)!;
const hanoi = (line: string, wardName: string) => ({ province_code: "P01", ward_code: ward(wardName).code, address_line: line });

/* ---- Units ---- */

interface Unit {
  id: string; code: string; name: string; type_code: "CORPORATION" | "FRANCHISE_PARTNER" | "POST_OFFICE"; type_name: string;
  parent: { id: string; name: string } | null; created_at: string; start: string; phone: string; email: string | null;
  website: string | null; office: string | null; creator: string | null; model?: { code: string; name: string; since: string };
}
const CORP: Unit = { id: "org-corp", code: "CTT29DH7NDV", name: "CÔNG TY CỔ PHẦN SUPERSHIP VIỆT NAM", type_code: "CORPORATION",
  type_name: "Tổng công ty", parent: null, created_at: "2016-02-01T01:00:00Z", start: "2016-02-01", phone: "02873005588",
  email: "lienhe@supership.vn", website: "https://supership.vn", office: "Tầng 9, số 31 đường Nguyễn Văn Đậu, Phường Bình Thạnh, Thành phố Hồ Chí Minh", creator: null };
const franchise = (id: string, code: string, name: string, extra: Partial<Unit>): Unit => ({ id, code, name, type_code: "FRANCHISE_PARTNER",
  type_name: "Nhượng quyền", parent: { id: CORP.id, name: CORP.name }, created_at: "2025-03-10T02:00:00Z", start: "2025-03-10",
  phone: "", email: null, website: null, office: null, creator: ADMIN, ...extra });

export const HA_DONG = franchise("org-hd", "NQT01P4X8N2", "NHƯỢNG QUYỀN HÀ ĐÔNG", { phone: "0912345678", email: "dieuhanh@vanchuyenhadong.vn",
  website: "https://vanchuyenhadong.vn", office: "Tầng 3, số 8 Tố Hữu, Phường Kiến Hưng, Thành phố Hà Nội" });
export const LONG_BIEN = franchise("org-lb", "NQT01L6B2K9", "NHƯỢNG QUYỀN LONG BIÊN", { created_at: "2024-06-03T02:00:00Z", start: "2024-06-03",
  phone: "02438725566", email: "nqlongbien@supership.vn", office: "Số 120 đường Nguyễn Văn Cừ, Phường Bồ Đề, Thành phố Hà Nội" });
export const GIA_LAM = franchise("org-gl", "NQT01G3L7M5", "NHƯỢNG QUYỀN GIA LÂM", { created_at: "2025-11-17T03:00:00Z", start: "2025-11-17",
  phone: "0983216457", office: "Số 46 đường Cổ Bi, Xã Gia Lâm, Thành phố Hà Nội" });
export const DONG_ANH = franchise("org-da", "NQT01D8A4N6", "NHƯỢNG QUYỀN ĐÔNG ANH", { created_at: "2025-06-02T02:00:00Z", start: "2025-06-02",
  phone: "02439651234", email: "dieuhanh@giaonhandonganh.vn", office: "Số 15 đường Cao Lỗ, Xã Đông Anh, Thành phố Hà Nội" });
export const ME_LINH = franchise("org-ml", "NQT01M2L9H4", "NHƯỢNG QUYỀN MÊ LINH", { created_at: "2026-02-09T02:00:00Z", start: "2026-02-09",
  phone: "0904518236", office: "Thôn Đại Bái, Xã Mê Linh, Thành phố Hà Nội" });
export const YEN_NGHIA: Unit = { id: "org-yn", code: "BCT01H6C8V3", name: "BƯU CỤC YÊN NGHĨA", type_code: "POST_OFFICE", type_name: "Bưu cục",
  parent: { id: HA_DONG.id, name: HA_DONG.name }, created_at: "2025-04-01T01:00:00Z", start: "2025-04-01", phone: "02433551188",
  email: "buucucyennghia@supership.vn", website: null, office: "Số 2 đường Quang Trung, Phường Yên Nghĩa, Thành phố Hà Nội", creator: ADMIN,
  model: { code: "DELIVERY_PICKUP", name: "Bưu cục giao nhận", since: "2025-04-01T01:00:00Z" } };
const DUONG_NOI: Unit = { ...YEN_NGHIA, id: "org-dn2", code: "BCT01B9F4L7", name: "BƯU CỤC DƯƠNG NỘI", created_at: "2025-05-12T01:00:00Z" };
const UNITS = [CORP, HA_DONG, LONG_BIEN, GIA_LAM, DONG_ANH, ME_LINH, YEN_NGHIA, DUONG_NOI];

/* ---- Legal profile rows ---- */

interface Verification {
  status: "UNVERIFIED" | "VERIFIED" | "REJECTED"; at: string | null; by: string | null; source: string | null; checked: string | null;
  /** The reason chosen when it was rejected (its name, "Khác: …" for Khác). */
  reason: string | null;
}
interface LegalRow {
  id: string; version: number; origin: Origin; legal_form: LegalForm; enterprise_type: string | null; registered_name: string;
  number: string; household_owner_name: string | null; certificate: { number: string; issued_on: string; issuer: string;
    latest_amendment_number: number | null; latest_amendment_on: string | null } | null;
  address: { province_code: string; ward_code: string; address_line: string }; head_office_phone: string | null;
  head_office_email: string | null; invoice_email: string; document: string | null;
  /** Media type of the stored certificate (application/pdf unless said). */
  document_type?: string; valid_from: string; valid_to: string | null;
  subject_started_on: string; by: string; verification: Verification;
  basis: { type: string; number: string | null; date: string | null } | null;
}
const verified = (at: string, source: string, by = ADMIN, checked = at.slice(0, 10)): Verification => ({ status: "VERIFIED", at, by, source, checked, reason: null });
const unverified = (): Verification => ({ status: "UNVERIFIED", at: null, by: null, source: null, checked: null, reason: null });
const HN_REGISTRY = "Phòng Đăng ký kinh doanh - Sở Tài chính Thành phố Hà Nội";

/** Nhượng quyền Hà Đông: declared in 2025, then the head office moved (đăng ký thay đổi lần 2) in September 2026. */
function haDongRows(status: Verification["status"]): LegalRow[] {
  const base = { legal_form: "ENTERPRISE" as const, enterprise_type: "LLC_MULTI_MEMBER", registered_name: "CÔNG TY TNHH VẬN CHUYỂN HÀ ĐÔNG",
    number: "0109876543", household_owner_name: null, head_office_phone: "02433556789", head_office_email: "lienhe@vanchuyenhadong.vn",
    invoice_email: "ketoan@vanchuyenhadong.vn", document: "doc-hd-1", subject_started_on: "2025-03-10", by: "Phạm Thu Trang", basis: null };
  return [
    { ...base, id: "legal-hd-1", version: 2, origin: "DECLARED", valid_from: "2025-03-10T02:15:00Z", valid_to: "2026-09-06T03:20:00Z",
      certificate: { number: "0109876543", issued_on: "2023-05-16", issuer: HN_REGISTRY, latest_amendment_number: 1, latest_amendment_on: "2024-11-04" },
      address: hanoi("Số 25 đường Quang Trung", "Phường Hà Đông"), verification: verified("2025-03-12T03:30:00Z", "NATIONAL_BUSINESS_REGISTRY") },
    { ...base, id: "legal-hd-2", version: status === "UNVERIFIED" ? 3 : 4, origin: "AMENDED", valid_from: "2026-09-06T03:20:00Z", valid_to: null,
      certificate: { number: "0109876543", issued_on: "2023-05-16", issuer: HN_REGISTRY, latest_amendment_number: 2, latest_amendment_on: "2026-09-05" },
      address: hanoi("Số 8 đường Tố Hữu", "Phường Hà Đông"),
      verification: status === "VERIFIED" ? verified("2026-09-08T02:40:00Z", "NATIONAL_BUSINESS_REGISTRY")
        : status === "REJECTED" ? { status, at: "2026-09-08T02:40:00Z", by: ADMIN, source: null, checked: null, reason: "Thông tin không khớp giấy tờ" } : unverified() },
  ];
}
const LEGAL_ROWS: Record<string, (status: Verification["status"]) => LegalRow[]> = {
  [HA_DONG.id]: haDongRows,
  [GIA_LAM.id]: () => [{ id: "legal-gl-1", version: 2, origin: "DECLARED", legal_form: "INDIVIDUAL", enterprise_type: null,
    registered_name: "Nguyễn Thị Hồng Nhung", number: "001190012345", household_owner_name: null, certificate: null,
    address: hanoi("Số 46 đường Cổ Bi", "Xã Gia Lâm"), head_office_phone: "0983216457", head_office_email: null,
    invoice_email: "hongnhung.gialam@gmail.com", document: null, valid_from: "2025-11-17T03:10:00Z", valid_to: null,
    subject_started_on: "2025-11-17", by: ADMIN, verification: verified("2025-11-19T02:20:00Z", "TAX_PAYER_LOOKUP"), basis: null }],
  [DONG_ANH.id]: () => [{ id: "legal-da-1", version: 2, origin: "DECLARED", legal_form: "ENTERPRISE", enterprise_type: "JOINT_STOCK",
    registered_name: "CÔNG TY CỔ PHẦN GIAO NHẬN ĐÔNG ANH", number: "0110456789", household_owner_name: null,
    certificate: { number: "0110456789", issued_on: "2024-04-22", issuer: HN_REGISTRY, latest_amendment_number: null, latest_amendment_on: null },
    address: hanoi("Số 15 đường Cao Lỗ", "Xã Đông Anh"), head_office_phone: "02439651234", head_office_email: "lienhe@giaonhandonganh.vn",
    invoice_email: "ketoan@giaonhandonganh.vn", document: "doc-da-1", valid_from: "2025-06-02T02:30:00Z", valid_to: null,
    subject_started_on: "2025-06-02", by: ADMIN, verification: verified("2025-06-04T03:00:00Z", "NATIONAL_BUSINESS_REGISTRY"), basis: null }],
  [ME_LINH.id]: () => [{ id: "legal-ml-1", version: 2, origin: "DECLARED", legal_form: "HOUSEHOLD_BUSINESS", enterprise_type: null,
    registered_name: "HỘ KINH DOANH VẬN CHUYỂN MÊ LINH", number: "001085004321", household_owner_name: "Phạm Văn Hùng",
    certificate: { number: "01H8012345", issued_on: "2025-12-15", issuer: "Phòng Kinh tế xã Mê Linh", latest_amendment_number: null, latest_amendment_on: null },
    address: hanoi("Thôn Đại Bái", "Xã Mê Linh"), head_office_phone: "0904518236", head_office_email: null,
    invoice_email: "hkdvanchuyenmelinh@gmail.com", document: "doc-ml-1", document_type: "image/png", valid_from: "2026-02-09T02:30:00Z", valid_to: null,
    subject_started_on: "2026-02-09", by: ADMIN, verification: verified("2026-02-11T02:00:00Z", "TAX_PAYER_LOOKUP"), basis: null }],
};

/* ---- Representatives ---- */

interface RepDocument { type: string; number: string; date: string }
interface Rep {
  id: string; full_name: string; person: { id: string; full_name: string } | null; type: RepType; title: string;
  scope: string | null; start: string; end: string | null; basis: RepDocument; termination: RepDocument | null;
  end_reason: string | null; version: number;
  /** Đ2-05: where the term stands with the verification (the long-standing terms were verified when declared). */
  verification: "UNVERIFIED" | "VERIFIED" | "REJECTED";
}
const rep = (id: string, full_name: string, type: RepType, title: string, start: string, basis: [string, string, string],
  extra: Partial<Rep> = {}): Rep => ({ id, full_name, person: null, type, title, scope: null, start, end: null,
  basis: { type: basis[0], number: basis[1], date: basis[2] }, termination: null, end_reason: null, version: 1,
  verification: "VERIFIED", ...extra });
const REPRESENTATIVES: Record<string, () => Rep[]> = {
  [HA_DONG.id]: () => [
    rep("rep-hd-1", "Nguyễn Văn An", "LEGAL_REPRESENTATIVE", "Giám đốc", "2025-03-10", ["BUSINESS_REGISTRATION_CERTIFICATE", "0109876543", "2023-05-16"],
      { person: { id: "person-an", full_name: "Nguyễn Văn An" } }),
    rep("rep-hd-2", "Trần Thị Mai", "LEGAL_REPRESENTATIVE", "Chủ tịch Hội đồng thành viên", "2025-03-10", ["COMPANY_CHARTER", "01/2023/ĐL-HĐTV", "2023-05-10"]),
    rep("rep-hd-3", "Lê Hoàng Phúc", "AUTHORIZED_REPRESENTATIVE", "Trưởng phòng kinh doanh", "2026-01-05", ["POWER_OF_ATTORNEY", "05/2026/UQ", "2026-01-02"],
      { scope: "Ký hợp đồng nhượng quyền, biên bản đối soát với SuperShip", end: "2026-10-31", person: { id: "person-phuc", full_name: "Lê Hoàng Phúc" },
        verification: "UNVERIFIED" }),
    rep("rep-hd-4", "Phạm Đức Thắng", "AUTHORIZED_REPRESENTATIVE", "Phó phòng kinh doanh", "2025-04-01", ["POWER_OF_ATTORNEY", "12/2025/UQ", "2025-03-28"],
      { scope: "Ký biên bản đối soát với SuperShip", end: "2025-12-31", end_reason: "Hết thời hạn ủy quyền" }),
    rep("rep-hd-5", "Đỗ Thị Hương", "AUTHORIZED_REPRESENTATIVE", "Kế toán trưởng", "2025-03-15", ["POWER_OF_ATTORNEY", "03/2025/UQ", "2025-03-14"],
      { scope: "Ký biên bản xác nhận công nợ với SuperShip", end: "2025-09-30",
        termination: { type: "AUTHORIZATION_TERMINATION", number: "07/2025/CDUQ", date: "2025-09-30" }, verification: "UNVERIFIED" }),
  ],
  [GIA_LAM.id]: () => [
    rep("rep-gl-1", "Đỗ Minh Tuấn", "AUTHORIZED_REPRESENTATIVE", "Quản lý vận hành", "2025-12-01", ["POWER_OF_ATTORNEY", "01/2025/UQ", "2025-11-28"],
      { scope: "Ký biên bản đối soát, nhận hàng hoàn với SuperShip" }),
  ],
  [DONG_ANH.id]: () => [
    rep("rep-da-1", "Ngô Thanh Hà", "AUTHORIZED_REPRESENTATIVE", "Phó Giám đốc", "2025-06-10", ["POWER_OF_ATTORNEY", "02/2025/UQ", "2025-06-09"],
      { scope: "Ký hợp đồng, biên bản đối soát với SuperShip", verification: "UNVERIFIED" }),
    rep("rep-da-2", "Bùi Quang Huy", "LEGAL_REPRESENTATIVE", "Giám đốc", "2025-06-02", ["BUSINESS_REGISTRATION_CERTIFICATE", "0110456789", "2024-04-22"],
      { end: "2026-09-30", termination: { type: "DISMISSAL_DECISION", number: "08/2026/QĐ-HĐQT", date: "2026-09-30" } }),
  ],
  [ME_LINH.id]: () => [
    rep("rep-ml-1", "Phạm Văn Hùng", "LEGAL_REPRESENTATIVE", "Chủ hộ kinh doanh", "2026-02-09", ["HOUSEHOLD_REGISTRATION_CERTIFICATE", "01H8012345", "2025-12-15"]),
  ],
};
const EMPLOYEES: Record<string, { person_id: string; full_name: string }[]> = {
  [HA_DONG.id]: [["person-an", "Nguyễn Văn An"], ["person-phuc", "Lê Hoàng Phúc"], ["person-lan", "Vũ Thị Lan"], ["person-trang", "Phạm Thu Trang"]]
    .map(([person_id, full_name]) => ({ person_id: person_id!, full_name: full_name! })),
  [DONG_ANH.id]: [["person-bao", "Đặng Quốc Bảo"], ["person-ha", "Ngô Thanh Hà"]].map(([person_id, full_name]) => ({ person_id: person_id!, full_name: full_name! })),
};

/* ---- Flow wrapper ---- */

type Role = "admin" | "manager";
export interface Rejection { path: RegExp; status: number; code: string; message: string; fields?: Record<string, string> }
export interface UnitSetup {
  role: Role;
  /** Verification of Nhượng quyền Hà Đông's current legal profile. */
  haDong: Verification["status"];
  /** Units that are suspended ("Tạm ngưng"). */
  suspended: string[];
  /** Server answers to the next matching writes, in order, before the code is asked. */
  rejections: Rejection[];
  /** GET /v1/document-uploads/settings: an uploaded registration certificate is read (on for "Pháp lý"). */
  reading: boolean;
}
export interface UnitMock extends UnitSetup {
  legal: Record<string, LegalRow[]>;
  /** Change requests of the legal profile ("Sửa" of verified details, "Thay chủ thể"), oldest first. */
  requests: Record<string, ChangeRequest[]>;
  reps: Record<string, Rep[]>;
  /** Writes the server accepted (after the code). */
  writes: number;
  /** Body of the last accepted write. */
  input: any;
}
export interface UnitContext extends FlowContext { mock: UnitMock }

export function unitFlow(section: FranchiseSection, prefix: string, { id, name, setup = {}, run }: {
  id: string; name: string; setup?: Partial<UnitSetup>; run: (ctx: UnitContext) => Promise<void>;
}) {
  return defineFlow({
    id: `${prefix}${id}`, name, app: "superplatform", group: franchiseGroup(section),
    async run(ctx) {
      const base: UnitSetup = { role: "admin", haDong: "UNVERIFIED", suspended: [], rejections: [], reading: false, ...setup };
      const mock: UnitMock = {
        ...base, writes: 0, input: null, requests: {},
        legal: Object.fromEntries(Object.entries(LEGAL_ROWS).map(([org, rows]) => [org, rows(base.haDong)])),
        reps: Object.fromEntries(Object.entries(REPRESENTATIVES).map(([org, rows]) => [org, rows()])),
      };
      await mockUnits(ctx.page, ctx.log, mock);
      await run({ ...ctx, mock });
    },
  });
}

export const legalFlow = (flow: Parameters<typeof unitFlow>[2]) =>
  unitFlow("phap-ly", "superplatform-phap-ly-", { ...flow, setup: { reading: true, ...flow.setup } });

/* ---- Presenting ---- */

const pad = (n: number) => String(n).padStart(2, "0");
/** dd/MM/yyyy of a yyyy-MM-dd day, or of an instant on the Vietnamese calendar. */
function day(value: string | null): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split("-").reverse().join("/");
  const local = new Date(Date.parse(value) + 7 * 3600_000);
  return `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()}`;
}
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400_000).toISOString().slice(0, 10);
/** The number as the screens show it: in full, a personal identification number too (23/10/2026). */
const masked = (row: LegalRow) => row.number;
const regionOf = (address: LegalRow["address"]) => {
  const province = PROVINCES.find(p => p.code === address.province_code);
  const found = WARDS[address.province_code]?.find(w => w.code === address.ward_code);
  return { province, ward: found };
};
function addressDisplay(address: LegalRow["address"]) {
  const { province, ward: found } = regionOf(address);
  return [address.address_line, found?.name, province?.name].filter(Boolean).join(", ");
}
function verificationText(row: LegalRow) {
  const v = row.verification;
  if (v.status === "UNVERIFIED") return `Chưa xác minh. Đang chờ Quản trị hệ thống đối chiếu từ ngày ${day(row.valid_from)}.`;
  if (v.status === "REJECTED") return `Từ chối xác minh ngày ${day(v.at)}.`;
  let text = `Đã xác minh ngày ${v.checked ? day(v.checked) : day(v.at)}`;
  if (v.source) text += `, đối chiếu ${SOURCES[v.source]![1]}`;
  if (v.by) text += `, người xác minh: ${v.by}`;
  return `${text}.`;
}
function presentCurrent(row: LegalRow) {
  const { province, ward: found } = regionOf(row.address);
  return {
    id: row.id, version: row.version, legal_form: row.legal_form, legal_form_name: LEGAL_FORMS[row.legal_form],
    enterprise_type: row.enterprise_type, enterprise_type_name: row.enterprise_type ? ENTERPRISE_TYPES[row.enterprise_type] : null,
    registered_name: row.registered_name, registration_number_display: masked(row), household_owner_name: row.household_owner_name,
    private_owner_name: null, certificate: row.legal_form === "INDIVIDUAL" ? null : row.certificate,
    registered_address: { province_code: province?.code ?? null, province_name: province?.name ?? null, ward_code: found?.code ?? null,
      ward_name: found?.name ?? null, address_line: row.address.address_line, display: addressDisplay(row.address) },
    head_office_phone: row.head_office_phone, head_office_email: row.head_office_email, invoice_email: row.invoice_email,
    registration_document: { present: Boolean(row.document), media_type: row.document ? row.document_type ?? "application/pdf" : null },
    valid_from: row.valid_from, subject_started_on: row.subject_started_on, origin: row.origin,
    declared_by: { full_name: row.by }, declared_at: row.valid_from,
    verification: { status: row.verification.status, text: verificationText(row), verified_at: row.verification.at,
      verified_by_name: row.verification.by, source: row.verification.source,
      source_name: row.verification.source ? SOURCES[row.verification.source]![0] : null, checked_on: row.verification.checked,
      rejection_reason: row.verification.reason },
  };
}

/** LegalProfileFields: what is compared and what is shown, in the screen's order. */
function fieldsOf(row: LegalRow): [field: string, compared: string, shown: string | null][] {
  const c = row.certificate;
  return [
    ["enterprise_type", row.enterprise_type ?? "", row.enterprise_type ? ENTERPRISE_TYPES[row.enterprise_type]! : null],
    ["registered_name", row.registered_name, row.registered_name],
    ["registration_number", row.number, masked(row)],
    ["household_owner_name", row.household_owner_name ?? "", row.household_owner_name],
    ["certificate_number", c?.number ?? "", c?.number ?? null],
    ["certificate_issued_on", c?.issued_on ?? "", c?.issued_on ? day(c.issued_on) : null],
    ["certificate_issuer", c?.issuer ?? "", c?.issuer ?? null],
    ["latest_amendment_number", String(c?.latest_amendment_number ?? ""), c?.latest_amendment_number ? String(c.latest_amendment_number) : null],
    ["latest_amendment_on", c?.latest_amendment_on ?? "", c?.latest_amendment_on ? day(c.latest_amendment_on) : null],
    ["address", JSON.stringify(row.address), addressDisplay(row.address)],
    ["head_office_phone", row.head_office_phone ?? "", row.head_office_phone],
    ["head_office_email", row.head_office_email ?? "", row.head_office_email],
    ["invoice_email", row.invoice_email, row.invoice_email],
    ["registration_document", row.document ?? "", row.document ? "Có" : "Chưa có"],
  ];
}
function fieldLabel(field: string, form: LegalForm) {
  const individual = form === "INDIVIDUAL";
  return ({
    enterprise_type: "Loại hình doanh nghiệp",
    registered_name: form === "ENTERPRISE" ? "Tên doanh nghiệp" : form === "HOUSEHOLD_BUSINESS" ? "Tên hộ kinh doanh" : "Họ tên",
    registration_number: form === "ENTERPRISE" ? "Mã số doanh nghiệp" : "Số định danh cá nhân", household_owner_name: "Họ tên chủ hộ",
    certificate_number: "Số giấy đăng ký", certificate_issued_on: "Ngày cấp lần đầu", certificate_issuer: "Cơ quan cấp",
    latest_amendment_number: "Đăng ký thay đổi lần thứ", latest_amendment_on: "Ngày đăng ký thay đổi",
    address: individual ? "Địa chỉ liên hệ" : "Địa chỉ trụ sở", head_office_phone: individual ? "Số điện thoại" : "Số điện thoại trụ sở",
    head_office_email: individual ? "Email" : "Email trụ sở", invoice_email: "Email nhận hóa đơn", registration_document: "Tệp giấy đăng ký",
  } as Record<string, string>)[field] ?? field;
}
function changes(before: LegalRow, after: LegalRow) {
  const old = new Map(fieldsOf(before).map(([field, compared, shown]) => [field, { compared, shown }]));
  return fieldsOf(after).filter(([field, compared]) => old.get(field)?.compared !== compared)
    .map(([field, , shown]) => ({ field, field_name: fieldLabel(field, after.legal_form), before: old.get(field)?.shown ?? null, after: shown }));
}
const REVERIFY = new Set(["enterprise_type", "registered_name", "household_owner_name", "certificate_number", "certificate_issued_on",
  "certificate_issuer", "latest_amendment_number", "latest_amendment_on", "address"]);
const NEEDS_AMENDMENT = new Set(["enterprise_type", "registered_name", "address"]);

function historyItem(rows: LegalRow[], index: number) {
  const row = rows[index]!, older = rows[index - 1], successor = rows[index + 1];
  const replaced = successor?.origin === "REPLACED";
  return {
    id: row.id, period: { from: row.valid_from, to: row.valid_to }, action: row.origin, action_name: ORIGINS[row.origin],
    registered_name: row.registered_name, registration_number_display: masked(row), subject_started_on: row.subject_started_on,
    subject_ended_on: replaced ? addDays(successor!.subject_started_on, -1) : null, current: row.valid_to === null, replaced,
    changes: older && row.origin !== "DECLARED" ? changes(older, row) : [],
    basis: row.origin === "REPLACED" && row.basis ? { document_type: row.basis.type, document_type_name: REPLACEMENT_BASIS[row.basis.type] ?? null,
      document_number: row.basis.number, document_date: row.basis.date } : null,
    verification_status: row.verification.status, verification_text: verificationText(row), actor: row.by, at: row.valid_from,
  };
}

/** The legal row a declaration (the `legal` object of the dialogs) describes. */
function rowFrom(input: any, previous: LegalRow | null, extra: Partial<LegalRow>): LegalRow {
  const form = (input.legal_form ?? previous?.legal_form) as LegalForm;
  const number = String(input.registration_number ?? "").replace(/\D/g, "") || previous?.number || "";
  const phone = input.head_office_phone ? String(input.head_office_phone).replace(/[\s.()-]/g, "").replace(/^\+84/, "0") : null;
  return {
    id: "", version: 0, origin: "DECLARED", legal_form: form, enterprise_type: form === "ENTERPRISE" ? input.enterprise_type ?? null : null,
    registered_name: String(input.registered_name).trim(), number, household_owner_name: input.household_owner_name ?? null,
    certificate: form === "INDIVIDUAL" ? null : { number: input.certificate_number, issued_on: input.certificate_issued_on,
      issuer: input.certificate_issuer, latest_amendment_number: input.latest_amendment_number ? Number(input.latest_amendment_number) : null,
      latest_amendment_on: input.latest_amendment_on ?? null },
    address: { province_code: input.address.province_code, ward_code: input.address.ward_code, address_line: String(input.address.address_line).trim() },
    head_office_phone: phone, head_office_email: input.head_office_email ? String(input.head_office_email).toLowerCase() : null,
    invoice_email: String(input.invoice_email).toLowerCase(), document: previous?.document ?? null, valid_from: NOW, valid_to: null,
    subject_started_on: previous?.subject_started_on ?? TODAY, by: ADMIN, verification: unverified(), basis: null, ...extra,
  };
}

/* ---- Change requests (LegalChangeRequestRecord, LegalProfilePresenter.changeRequest) ---- */

const KINDS = { AMENDMENT: "Sửa", REPLACEMENT: "Thay chủ thể" } as const;
const REQUEST_STATUSES = { PENDING: "Chờ xác minh", APPROVED: "Đã xác minh", REJECTED: "Từ chối xác minh", WITHDRAWN: "Đã rút" } as const;
interface ChangeRequest {
  id: string; version: number; kind: keyof typeof KINDS; status: keyof typeof REQUEST_STATUSES; by: string; at: string;
  /** The current row it was sent over, and the row it proposes. */
  base: LegalRow; proposed: LegalRow; documentChanged: boolean;
  replacement: { effective_on: string; type: string | null; number: string | null; date: string | null; ending: string[] } | null;
  decidedBy: string | null; decidedAt: string | null; source: string | null; checked: string | null; reason: string | null;
}
function presentRequest(request: ChangeRequest) {
  const row = request.proposed;
  const { province, ward: found } = regionOf(row.address);
  const r = request.replacement;
  return {
    id: request.id, version: request.version, kind: request.kind, kind_name: KINDS[request.kind], status: request.status,
    status_name: REQUEST_STATUSES[request.status], requested_by: { full_name: request.by }, requested_at: request.at, base_profile_id: request.base.id,
    proposed: {
      legal_form: row.legal_form, legal_form_name: LEGAL_FORMS[row.legal_form], enterprise_type: row.enterprise_type,
      enterprise_type_name: row.enterprise_type ? ENTERPRISE_TYPES[row.enterprise_type] : null, registered_name: row.registered_name,
      registration_number_display: masked(row), household_owner_name: row.household_owner_name, private_owner_name: null,
      certificate: row.legal_form === "INDIVIDUAL" ? null : row.certificate,
      registered_address: { province_code: province?.code ?? null, province_name: province?.name ?? null, ward_code: found?.code ?? null,
        ward_name: found?.name ?? null, address_line: row.address.address_line, display: addressDisplay(row.address) },
      head_office_phone: row.head_office_phone, head_office_email: row.head_office_email, invoice_email: row.invoice_email,
      registration_document: { present: Boolean(row.document), media_type: row.document ? row.document_type ?? "application/pdf" : null },
      document_changed: request.documentChanged,
    },
    changes: changes(request.base, row),
    replacement: r ? { effective_on: r.effective_on, basis_document_type: r.type, basis_document_type_name: r.type ? REPLACEMENT_BASIS[r.type] ?? null : null,
      basis_document_number: r.number, basis_document_date: r.date, representatives_to_end: r.ending } : null,
    decided_by: request.decidedBy ? { full_name: request.decidedBy } : null, decided_at: request.decidedAt,
    verification_source: request.source, verification_source_name: request.source ? SOURCES[request.source]![0] : null,
    verification_checked_on: request.checked, rejection_reason: request.reason,
  };
}

/* ---- "Lý do thao tác" of a rejection (V1430__common_action_reasons.sql, VERIFICATION_REJECT) ---- */

const REJECT_REASONS = [
  ["GIAY_TO_KHONG_RO", "Giấy tờ không rõ"], ["THONG_TIN_KHONG_KHOP_GIAY_TO", "Thông tin không khớp giấy tờ"],
  ["GIAY_TO_HET_HIEU_LUC", "Giấy tờ hết hiệu lực"], ["THIEU_GIAY_TO", "Thiếu giấy tờ"], ["OTHER", "Khác"],
].map(([code, name]) => ({ code: code!, name: name!, note_required: code === "OTHER" }));
/** What the server keeps for the chosen reason: its name, or "Khác: <words>". */
function reasonText(body: any): string | null {
  const chosen = REJECT_REASONS.find(item => item.code === body?.reason_code);
  if (!chosen) return typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : null;
  return chosen.note_required ? `${chosen.name}: ${String(body.reason_note ?? "").trim()}` : chosen.name;
}

/* ---- Registration certificates: the files the flows upload and what their reading gives ---- */

const PAPERS = path.join(import.meta.dirname, "assets", "legal-papers");
/** Sample certificates drawn like mau-giay-dang-ky-ocr (fictitious data, "BẢN MẪU KIỂM THỬ" watermark). */
export const PAPER = {
  longBien: "giay-chung-nhan-dkdn-giao-van-long-bien.pdf",
  giaLam: "giay-chung-nhan-dkdn-van-chuyen-gia-lam.pdf",
  haDong: "giay-chung-nhan-dkdn-van-chuyen-ha-dong-thay-doi-lan-2.pdf",
  meLinh: "giay-chung-nhan-dkhkd-van-chuyen-me-linh.png",
} as const;
/** A certificate as setInputFiles takes it. */
export function paperFile(name: string) {
  return { name, mimeType: name.endsWith(".pdf") ? "application/pdf" : "image/png", buffer: readFileSync(path.join(PAPERS, name)) };
}
type Reading = { source: "PDF_TEXT" | "OCR" | "NONE"; fields: Record<string, { value: string; confidence: number }>; warnings: string[] };
/** RegistrationCertificateReader: 0.9 labelled, 0.6 guessed (the street, the issuer's full name); below 0.8 asks "Kiểm tra lại". */
const read = (fields: Record<string, [string, number]>): Reading =>
  ({ source: "PDF_TEXT", fields: Object.fromEntries(Object.entries(fields).map(([key, [value, confidence]]) => [key, { value, confidence }])), warnings: [] });
const READINGS: Record<string, Reading> = {
  [PAPER.longBien]: read({
    legal_form: ["ENTERPRISE", 0.9], enterprise_type: ["LLC_ONE_MEMBER", 0.9], registered_name: ["CÔNG TY TNHH GIAO VẬN LONG BIÊN", 0.9],
    registration_number: ["0108765432", 0.9], certificate_number: ["0108765432", 0.9], certificate_issued_on: ["2024-05-20", 0.9],
    certificate_issuer: ["Phòng Đăng ký kinh doanh - Sở Tài chính Thành phố Hà Nội", 0.6],
    address_line: ["Số 120 đường Nguyễn Văn Cừ, Phường Bồ Đề, Thành phố Hà Nội, Việt Nam", 0.6],
    address_province_code: ["P01", 0.9], address_ward_code: [ward("Phường Bồ Đề").code, 0.9],
    head_office_phone: ["02438725566", 0.9], head_office_email: ["lienhe@giaovanlongbien.vn", 0.9],
  }),
  [PAPER.giaLam]: read({
    legal_form: ["ENTERPRISE", 0.9], enterprise_type: ["LLC_ONE_MEMBER", 0.9], registered_name: ["CÔNG TY TNHH VẬN CHUYỂN GIA LÂM", 0.9],
    registration_number: ["0110234567", 0.9], certificate_number: ["0110234567", 0.9], certificate_issued_on: ["2026-09-18", 0.9],
    certificate_issuer: ["Phòng Đăng ký kinh doanh - Sở Tài chính Thành phố Hà Nội", 0.6],
    address_line: ["Số 46 đường Cổ Bi, Xã Gia Lâm, Thành phố Hà Nội, Việt Nam", 0.6],
    address_province_code: ["P01", 0.9], address_ward_code: [ward("Xã Gia Lâm").code, 0.9],
    head_office_phone: ["02436782468", 0.9], head_office_email: ["lienhe@vanchuyengialam.vn", 0.9],
  }),
  [PAPER.haDong]: read({
    legal_form: ["ENTERPRISE", 0.9], enterprise_type: ["LLC_MULTI_MEMBER", 0.9], registered_name: ["CÔNG TY TNHH VẬN CHUYỂN HÀ ĐÔNG", 0.9],
    registration_number: ["0109876543", 0.9], certificate_number: ["0109876543", 0.9], certificate_issued_on: ["2023-05-16", 0.9],
    certificate_issuer: ["Phòng Đăng ký kinh doanh - Sở Tài chính Thành phố Hà Nội", 0.6],
    latest_amendment_number: ["2", 0.9], latest_amendment_on: ["2026-09-05", 0.9],
    address_line: ["Số 8 đường Tố Hữu, Phường Hà Đông, Thành phố Hà Nội, Việt Nam", 0.6],
    address_province_code: ["P01", 0.9], address_ward_code: [ward("Phường Hà Đông").code, 0.9],
    head_office_phone: ["02433556789", 0.9], head_office_email: ["lienhe@vanchuyenhadong.vn", 0.9],
  }),
};
/** The stored certificate of a unit, as GET …/registration-document sends it. */
const STORED_PAPERS: Record<string, string> = { [HA_DONG.id]: PAPER.haDong, [ME_LINH.id]: PAPER.meLinh };

/* ---- Representatives presenting ---- */

const activeRep = (r: Rep) => r.start <= TODAY && (!r.end || r.end >= TODAY);
const repDoc = (doc: RepDocument | null, names: Record<string, string>) => doc
  ? { document_type: doc.type, document_type_name: names[doc.type] ?? null, document_number: doc.number, document_date: doc.date } : null;

/* ---- Backend ---- */

function capability(key: string) {
  return {
    permission_key: key, allowed: true, available: true, availability: "AVAILABLE", requires_mfa: false, requires_approval: false,
    required_scope_types: ["ORGANIZATION"], rejection_reasons: [],
    grants: [{ assignment_id: "capture-grant", source_type: "ROLE_VERSION", effect: "ALLOW", role_id: null, role_version_id: null,
      scopes: [{ scope_type: "ORGANIZATION", organization_mode: "GLOBAL", anchor_organization_id: null, organization_ids: [],
        application_ids: [], resources: [], attribute_conditions: [] }] }],
  };
}

async function mockUnits(page: Page, log: (line: string) => void, mock: UnitMock) {
  await mockPin(page, log, false);
  const admin = mock.role === "admin";
  const capabilities = ["identity.view", "organization.view", "organization.legal_entity.view", "organization.legal_entity.update",
    "organization.representative.view", "organization.representative.appoint", "organization.representative.update",
    "organization.representative.terminate",
    ...(admin ? ["organization.legal_entity.view_sensitive", "organization.legal_entity.verify"] : [])];
  let challenges = 0;
  // Registered after mockPin, so it is asked first and falls back to it for the session calls.
  await page.context().route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/backend/, "");
    const method = request.method();
    const send = (data: unknown, status = 200, message = "") => route.fulfill({ status,
      headers: { "X-Browser-Session-Version": "1" }, json: { error: status >= 400, message, data } });
    const fail = (status: number, code: string, message: string, fields?: Record<string, string>) =>
      send({ code, ...(fields ? { fields } : {}) }, status, message);
    /** 403 STEP_UP_REQUIRED until the right code comes with the repeated request; true once it did. */
    const stepUp = async (action: string, summary: string) => {
      const code = request.headers()["x-step-up-code"];
      if (!code) {
        await send({ code: "STEP_UP_REQUIRED", challenge_id: `challenge-${++challenges}`, action, summary, method: "AUTHENTICATOR",
          expires_at: "2026-10-12T02:05:00.000Z" }, 403, "Hãy nhập mã xác thực.");
        return false;
      }
      if (code !== STEP_UP_CODE) { await fail(400, "MFA_INVALID_CODE", MESSAGES.wrongCode); return false; }
      return true;
    };
    const rejection = () => {
      const index = mock.rejections.findIndex(item => item.path.test(path));
      return index < 0 ? null : mock.rejections.splice(index, 1)[0]!;
    };
    const status = (unit: Unit) => mock.suspended.includes(unit.id) ? "SUSPENDED" : "ACTIVE";
    const statusName = (unit: Unit) => status(unit) === "ACTIVE" ? "Đang hoạt động" : "Tạm ngưng";
    const currentRow = (orgId: string) => mock.legal[orgId]?.find(row => row.valid_to === null) ?? null;

    if (path === "/v1/me/capabilities") return send({
      context: { context_id: "pin-context", context_type: "SUPERPLATFORM", application_name: "SUPERPLATFORM", membership_id: "pin-member", organization_id: "pin-org" },
      assurance: { level: 2, mfa_verified: true, mfa_verified_at: NOW }, capabilities: capabilities.map(capability),
      revision: "capture", generated_at: NOW, expires_at: "2026-10-13T02:00:00.000Z",
    });

    /*
     * DocumentUploadController: the registration certificate of "Pháp lý" is read on upload (canned readings by file
     * name); the "Tệp căn cứ" of a representative is only attached (the "Người đại diện" flows keep the reading off).
     */
    if (path === "/v1/document-uploads/settings") return send({ reading: mock.reading }, 200, "Cấu hình nhận diện tệp.");
    if (path === "/v1/document-uploads" && method === "POST") {
      const body = request.postDataBuffer()?.toString("latin1") ?? "";
      const fileName = Buffer.from(body.match(/filename="([^"]+)"/)?.[1] ?? "", "latin1").toString("utf8");
      const mediaType = fileName.endsWith(".pdf") ? "application/pdf" : fileName.endsWith(".png") ? "image/png" : "image/jpeg";
      const reading = !mock.reading ? null : READINGS[fileName] ?? { source: "NONE", fields: {}, warnings: [] };
      return send({ file_token: `upload-${fileName}`, file_name: fileName, media_type: mediaType, size: body.length,
        expires_at: "2026-10-13T02:00:00.000Z", reading }, 200,
        !reading ? "Đã tải tệp lên." : Object.keys(reading.fields).length ? "Đã nhận diện, hãy kiểm tra lại thông tin." : "Chưa đọc được thông tin trong tệp, hãy nhập tay.");
    }
    if (/^\/v1\/document-uploads\/[^/]+\/reading$/.test(path))
      return send({ source: "NONE", fields: {}, warnings: ["OCR_UNAVAILABLE"] }, 200, "Chưa đọc được thông tin trong tệp, hãy nhập tay.");
    if (path === "/v1/reasons/VERIFICATION_REJECT") return send({ function_code: "VERIFICATION_REJECT", reasons: REJECT_REASONS });

    /* ---- Shell ---- */
    if (path === "/v1/me/employee-invitations/count") return send({ pending: 0 });
    if (path === "/v1/shops/list-options") return send({ internal_allowed: true, shops_allowed: false, types: [], statuses: [],
      franchises: [], post_offices: [], operation_models: [] });
    if (path === "/v1/franchises/creation-regions" || path === "/v1/organization-directory/regions") {
      const province = url.searchParams.get("province_code") ?? url.searchParams.get("provinceCode");
      return send(province ? WARDS[province] ?? [] : PROVINCES);
    }
    if (path === "/v1/organizations" && method === "GET") {
      const franchiseId = url.searchParams.get("franchiseId"), type = url.searchParams.get("typeCode");
      const items = UNITS.filter(unit => (!type || unit.type_code === type) && (!franchiseId || unit.parent?.id === franchiseId))
        .map(unit => ({ id: unit.id, code: unit.code, name: unit.name, type_code: unit.type_code, type_name: unit.type_name,
          parent_id: unit.parent?.id ?? null, parent_name: unit.parent?.name ?? null, status: status(unit), status_name: statusName(unit),
          locality: "", phone: unit.phone, operation_model_name: unit.model?.name ?? null, blocked_message: null,
          registration_number_display: null, post_office_count: null, created_at: unit.created_at }));
      return send({ items, page: 0, size: 20, has_next: false, total_elements: items.length, total_pages: 1 });
    }

    /* ---- Admin pages of an internal unit ---- */
    // "Địa điểm phục vụ" of Bưu cục Yên Nghĩa on its overview (AdminServiceWards).
    if (/^\/v1\/admin\/organizations\/[^/]+\/service-wards$/.test(path) && method === "GET") {
      const id = path.split("/")[4]!;
      const names = id === YEN_NGHIA.id ? ["Phường Yên Nghĩa", "Phường Dương Nội", "Phường Kiến Hưng"] : [];
      return send({ organization_id: id, total: names.length, reminder: names.length ? null : "Chưa có địa điểm phục vụ",
        wards: names.map(ward_name => ({ province_code: "P01", province_name: "Thành phố Hà Nội", district_code: null, district_name: null,
          ward_code: ward(ward_name).code, ward_name, since: "2025-04-01", also_served_by: [] })),
        actions: { edit: { available: false, enabled: false, disabled_reason: null }, history: { available: true, enabled: true, disabled_reason: null } } });
    }
    // The overview asks for the unit's addresses only for their reminders: none here.
    if (/^\/v1\/admin\/organizations\/[^/]+\/addresses$/.test(path) && method === "GET") return send({ items: [], version: 1, actions: {} });
    const adminMatch = path.match(/^\/v1\/admin\/organizations\/([^/]+)\/(profile|status|operation-model)$/);
    if (adminMatch && method === "GET") {
      const unit = UNITS.find(item => item.id === adminMatch[1]);
      if (!unit) return fail(404, "ORGANIZATION_NOT_FOUND", "Không tìm thấy đơn vị.");
      const none = { available: false, enabled: false, disabled_reason: null };
      if (adminMatch[2] === "status") return send({ organization_id: unit.id, name: unit.name, status: status(unit), status_name: statusName(unit),
        version: 1, since: null, closed_on: null, operation_start_date: unit.start, blocked_by: null,
        actions: { suspend: none, reactivate: none, close: none }, dialogs: null });
      if (adminMatch[2] === "operation-model") return send({ organization_id: unit.id, version: 1,
        current: unit.model ? { code: unit.model.code, name: unit.model.name, description: null, since: unit.model.since } : null,
        options: [], actions: { change: none } });
      const holder = unit.type_code === "POST_OFFICE" ? unit.parent!.id : unit.id;
      const legal = currentRow(holder);
      const contacts: [string, string, string | null][] = [["PHONE", "Số điện thoại", unit.phone], ["EMAIL", "Email", unit.email],
        ...(unit.type_code === "POST_OFFICE" ? [] : [["WEBSITE", "Website", unit.website] as [string, string, string | null]])];
      return send({
        id: unit.id, code: unit.code, name: unit.name, logo_url: null, type_code: unit.type_code, type_name: unit.type_name,
        status: status(unit), status_name: statusName(unit), operation_start_date: day(unit.start), operation_start_date_value: unit.start,
        created_at: day(unit.created_at), version: 1,
        parent: unit.parent, created_by: unit.creator ? { full_name: unit.creator, organization_name: CORP.name } : null,
        operation_model: unit.model ? { ...unit.model, since: day(unit.model.since) } : null,
        legal: legal ? { declared: true, via_franchise_name: unit.type_code === "POST_OFFICE" ? unit.parent!.name : null,
          legal_form_name: LEGAL_FORMS[legal.legal_form], enterprise_type_name: legal.enterprise_type ? ENTERPRISE_TYPES[legal.enterprise_type] : null,
          registered_name: legal.registered_name, registration_number_display: masked(legal), verification_status: legal.verification.status,
          verification_status_name: { UNVERIFIED: "Chưa xác minh", VERIFIED: "Đã xác minh", REJECTED: "Bị từ chối" }[legal.verification.status],
          registered_address: addressDisplay(legal.address), invoice_email: unit.type_code === "FRANCHISE_PARTNER" ? legal.invoice_email : null }
          : { declared: false, via_franchise_name: unit.type_code === "POST_OFFICE" ? unit.parent!.name : null, legal_form_name: null,
            enterprise_type_name: null, registered_name: null, registration_number_display: null, verification_status: null,
            verification_status_name: null, registered_address: null, invoice_email: null },
        legal_representatives: unit.type_code === "POST_OFFICE" ? null
          : (mock.reps[unit.id] ?? []).filter(r => r.type === "LEGAL_REPRESENTATIVE" && activeRep(r)).map(r => ({ full_name: r.full_name, position_title: r.title,
            verification_status: r.verification, verification_status_name: r.verification === "VERIFIED" ? "Đã xác minh" : "Chờ xác minh" })),
        contacts: contacts.map(([type, type_name, value]) => ({ type, type_name, value: value ?? "Chưa có", missing: !value })),
        addresses: [unit.type_code === "POST_OFFICE" ? ["SERVICE_POINT", "Địa chỉ điểm phục vụ"] : ["TRANSACTION_OFFICE", "Văn phòng giao dịch"]]
          .map(([type, type_name]) => ({ type, type_name, value: unit.office ?? "Chưa có", missing: !unit.office })),
        actions: { edit: { available: true, enabled: status(unit) === "ACTIVE", disabled_reason: status(unit) === "ACTIVE" ? null : "Đơn vị đang tạm ngưng, kích hoạt lại rồi mới sửa được hồ sơ." },
          change_logo: { available: true, enabled: status(unit) === "ACTIVE", disabled_reason: null }, change_operation_model: none },
      });
    }

    /* ---- Legal profile ---- */
    const legalMatch = path.match(/^\/v1\/organizations\/([^/]+)\/legal-profile(?:\/(options|history|change-requests)|\/change-requests\/([^/]+)\/(verification|withdrawal)|\/([^/]+)\/(amendment|replacement|verification|registration-document))?$/);
    if (legalMatch) {
      const [, orgId, list, requestId, requestAction, profileId, action] = legalMatch;
      const unit = UNITS.find(item => item.id === orgId);
      if (!unit) return fail(404, "ORGANIZATION_NOT_FOUND", "Không tìm thấy đơn vị.");
      if (unit.type_code === "POST_OFFICE") return fail(409, "LEGAL_PROFILE_NOT_APPLICABLE", `Bưu cục dùng thông tin pháp lý của ${unit.parent!.name}, không khai báo riêng.`);
      const rows = mock.legal[unit.id] ??= [];
      const requests = mock.requests[unit.id] ??= [];
      const current = currentRow(unit.id);
      const pending = requests.find(item => item.status === "PENDING") ?? null;
      const active = status(unit) === "ACTIVE";
      const blocked = (reason: string) => ({ available: true, enabled: false, disabled_reason: reason });
      const allowed = { available: true, enabled: true, disabled_reason: null };
      const unavailable = { available: false, enabled: false, disabled_reason: null };
      const NOT_DECLARED = "Đơn vị chưa khai báo thông tin pháp lý.";
      const verifiedBy = (source: string, checked: string): Verification => ({ status: "VERIFIED", at: NOW, by: ADMIN, source, checked, reason: null });
      /** The source and day a system administrator names for a change taking effect at once (P25). */
      const checkedOf = async (body: any) => {
        if (!SOURCES[body.verification_source]) { await fail(400, "ORGANIZATION_INPUT_INVALID", MESSAGES.sourceRequired, { verification_source: MESSAGES.sourceRequired }); return null; }
        return { source: body.verification_source as string, checked: (body.checked_on as string | undefined) ?? TODAY };
      };
      /** A change request made the current profile, verified (by "Xác minh", or at once for a system administrator). */
      const approve = (request: ChangeRequest, source: string, checked: string) => {
        const base = currentRow(unit.id)!;
        const next: LegalRow = { ...request.proposed, version: base.version + 1, valid_from: NOW, verification: verifiedBy(source, checked) };
        base.valid_to = NOW; rows.push(next);
        Object.assign(request, { status: "APPROVED", decidedBy: ADMIN, decidedAt: NOW, source, checked, version: request.version + 1 });
        const ended: string[] = [];
        if (request.replacement) for (const r of mock.reps[unit.id] ?? []) {
          if (!activeRep(r)) continue;
          const last = addDays(request.replacement.effective_on, -1);
          r.end = last < r.start ? r.start : last; r.end_reason = "Thay chủ thể pháp lý"; r.version++; ended.push(r.full_name);
        }
        return { next, ended };
      };
      const sendRequest = (kind: ChangeRequest["kind"], base: LegalRow, proposed: LegalRow, documentChanged: boolean,
        replacement: ChangeRequest["replacement"]): ChangeRequest => {
        const request: ChangeRequest = { id: `request-${unit.id}-${requests.length + 1}`, version: 1, kind, status: "PENDING", by: ADMIN, at: NOW,
          base, proposed, documentChanged, replacement, decidedBy: null, decidedAt: null, source: null, checked: null, reason: null };
        requests.push(request);
        return request;
      };

      if (!list && !profileId && !requestId && method === "GET") {
        const change = !current ? blocked(NOT_DECLARED) : !active ? blocked(MESSAGES.notActive(unit.name)) : pending ? blocked(MESSAGES.changePending) : allowed;
        const target = pending ? { kind: "LEGAL_CHANGE_REQUEST", id: pending.id, version: pending.version }
          : current?.verification.status === "UNVERIFIED" ? { kind: "LEGAL_PROFILE", id: current.id, version: current.version } : null;
        const decide = !admin ? unavailable : !current ? blocked(NOT_DECLARED) : !active ? blocked(MESSAGES.notActive(unit.name))
          : target ? allowed
          : current.verification.status === "REJECTED" ? blocked("Thông tin pháp lý đã bị từ chối xác minh. Hãy sửa lại thông tin.")
          : blocked("Thông tin pháp lý đã được xác minh.");
        const latest = requests.at(-1);
        return send({
          organization_id: unit.id, declared: Boolean(current), current: current ? presentCurrent(current) : null,
          notice: current ? null : NOT_DECLARED, duplicate_warning: null,
          actions: {
            declare: current ? blocked("Đơn vị đã có thông tin pháp lý. Hãy dùng Sửa hoặc Thay chủ thể.") : !active ? blocked(MESSAGES.notActive(unit.name)) : allowed,
            amend: change, replace: change,
            view_document: !admin ? unavailable : !current ? blocked(NOT_DECLARED) : !current.document ? blocked("Chưa có tệp giấy đăng ký.") : allowed,
            verify: decide, reject: decide, history: rows.length ? allowed : blocked("Chưa có lịch sử."),
            withdraw_request: !pending ? unavailable : !active ? blocked(MESSAGES.notActive(unit.name)) : allowed,
          },
          pending_request: pending ? presentRequest(pending) : null,
          last_rejection: !pending && latest?.status === "REJECTED" ? { request_id: latest.id, kind: latest.kind, kind_name: KINDS[latest.kind],
            reason: latest.reason, rejected_at: latest.decidedAt, rejected_by: { full_name: latest.decidedBy } } : null,
          verification_target: admin ? target : null,
          skips_verification: admin,
        }, 200, "Thông tin pháp lý.");
      }
      if (list === "options") return send({
        legal_forms: Object.entries(LEGAL_FORMS).map(([code, name]) => ({ code, name })), enterprise_types: choices(ENTERPRISE_TYPES),
        verification_sources: Object.entries(SOURCES).map(([code, [name]]) => ({ code, name })), replacement_basis_types: choices(REPLACEMENT_BASIS),
        representatives_ending: (mock.reps[unit.id] ?? []).filter(activeRep).map(r => `${r.full_name} (${REP_TYPES[r.type].toLowerCase()})`),
      });
      if (list === "history") {
        const items = rows.map((_, index) => historyItem(rows, index)).reverse();
        return send({ items, page: 0, size: 20, total: items.length });
      }
      if (list === "change-requests") {
        const items = requests.slice().reverse().map(request => {
          const shown = presentRequest(request);
          return { id: shown.id, kind: shown.kind, kind_name: shown.kind_name, status: shown.status, status_name: shown.status_name,
            requested_by: shown.requested_by, requested_at: shown.requested_at, changes: shown.changes, rejection_reason: shown.rejection_reason,
            decided_by: shown.decided_by, decided_at: shown.decided_at };
        });
        return send({ items, page: 0, size: 20, total: items.length });
      }

      if (method === "POST" && !list && !profileId && !requestId) {
        if (!active) return fail(409, "ORGANIZATION_NOT_ACTIVE", MESSAGES.notActive(unit.name));
        const refused = rejection();
        if (refused) return fail(refused.status, refused.code, refused.message, refused.fields);
        if (current) return fail(409, "LEGAL_PROFILE_EXISTS", "Đơn vị đã có thông tin pháp lý. Hãy dùng Sửa hoặc Thay chủ thể.");
        const input = readInput(request);
        if (!(await stepUp("LEGAL_ENTITY_DECLARE", `Khai báo thông tin pháp lý của ${unit.name}`))) return;
        const document = multipartNames(request).includes("registration_document");
        const row = rowFrom(input, null, { id: `legal-${unit.id}-new`, version: 1, document: document ? "doc-new" : null });
        rows.push(row); mock.writes++; mock.input = input;
        return send({ id: row.id, verification_status: "UNVERIFIED" }, 201, MESSAGES.declared);
      }
      if (method === "POST" && (action === "amendment" || action === "replacement")) {
        if (!active) return fail(409, "ORGANIZATION_NOT_ACTIVE", MESSAGES.notActive(unit.name));
        const body = readInput(request);
        if (!current) return fail(409, "LEGAL_PROFILE_NOT_DECLARED", "Đơn vị chưa có thông tin pháp lý. Hãy khai báo.");
        if (current.id !== profileId || current.version !== body.version) return fail(409, "LEGAL_PROFILE_VERSION_CONFLICT", "Thông tin pháp lý vừa được người khác sửa. Hãy tải lại.");
        const refused = rejection();
        if (refused) return fail(refused.status, refused.code, refused.message, refused.fields);
        const document = multipartNames(request).includes("registration_document");
        if (action === "amendment") {
          const next = rowFrom(body.legal, current, { id: `${current.id}-a${rows.length}`, origin: "AMENDED", version: current.version + 1,
            document: document ? `doc-new-${rows.length}` : current.document, document_type: document ? "application/pdf" : current.document_type,
            number: current.number, legal_form: current.legal_form });
          const changed = changes(current, next);
          if (changed.some(item => NEEDS_AMENDMENT.has(item.field)) && (!next.certificate?.latest_amendment_number || !next.certificate.latest_amendment_on)) {
            return fail(400, "ORGANIZATION_INPUT_INVALID", "Hãy nhập lần đăng ký thay đổi và ngày.", { "legal.latest_amendment_number": "Hãy nhập lần đăng ký thay đổi và ngày." });
          }
          if (!changed.length) return fail(409, "LEGAL_PROFILE_UNCHANGED", MESSAGES.unchanged);
          const reverify = current.verification.status === "REJECTED" || changed.some(item => REVERIFY.has(item.field));
          // P12: a verified profile stays in effect; a change of its registered details waits for a verification.
          const waits = reverify && current.verification.status === "VERIFIED";
          const checked = waits && admin ? await checkedOf(body) : null;
          if (waits && admin && !checked) return;
          if (pending) return fail(409, "LEGAL_CHANGE_PENDING", MESSAGES.changePending);
          if (!(await stepUp("LEGAL_ENTITY_AMEND", `Sửa thông tin pháp lý của ${unit.name}`))) return;
          mock.writes++; mock.input = body;
          if (checked) {
            const sent = sendRequest("AMENDMENT", current, next, document, null);
            const { next: approved } = approve(sent, checked.source, checked.checked);
            return send({ id: approved.id, verification_status: "VERIFIED", version: approved.version, message: MESSAGES.saved,
              ended_representatives: [], request_id: sent.id, pending: false }, 200, MESSAGES.saved);
          }
          if (waits) {
            const sent = sendRequest("AMENDMENT", current, next, document, null);
            return send({ id: current.id, verification_status: current.verification.status, version: current.version, message: MESSAGES.amendmentSent,
              ended_representatives: [], request_id: sent.id, pending: true }, 200, MESSAGES.amendmentSent);
          }
          if (!reverify) next.verification = { ...current.verification };
          current.valid_to = NOW; rows.push(next);
          const message = next.verification.status === "UNVERIFIED" ? MESSAGES.savedPending : MESSAGES.saved;
          return send({ id: next.id, verification_status: next.verification.status, version: next.version, message,
            ended_representatives: [], request_id: null, pending: false }, 200, message);
        }
        const number = String(body.legal?.registration_number ?? "").replace(/\D/g, "");
        if (number && number === current.number) {
          return fail(400, "ORGANIZATION_INPUT_INVALID", MESSAGES.sameNumber, { "legal.registration_number": MESSAGES.sameNumber });
        }
        const checked = admin ? await checkedOf(body) : null;
        if (admin && !checked) return;
        if (pending) return fail(409, "LEGAL_CHANGE_PENDING", MESSAGES.changePending);
        if (!(await stepUp("LEGAL_ENTITY_REPLACE", `Thay chủ thể pháp lý của ${unit.name}`))) return;
        const next = rowFrom(body.legal, null, { id: `${unit.id}-r${rows.length}`, origin: "REPLACED", version: current.version + 1,
          document: document ? `doc-new-${rows.length}` : null, subject_started_on: body.effective_on,
          basis: body.basis_document_type ? { type: body.basis_document_type, number: body.basis_document_number ?? null, date: body.basis_document_date ?? null } : null });
        const ending = (mock.reps[unit.id] ?? []).filter(activeRep).map(r => `${r.full_name} (${REP_TYPES[r.type].toLowerCase()})`);
        const sent = sendRequest("REPLACEMENT", current, next, document, { effective_on: body.effective_on, type: body.basis_document_type ?? null,
          number: body.basis_document_number ?? null, date: body.basis_document_date ?? null, ending });
        mock.writes++; mock.input = body;
        if (checked) {
          const { next: approved, ended } = approve(sent, checked.source, checked.checked);
          return send({ id: approved.id, verification_status: "VERIFIED", version: approved.version, message: MESSAGES.replaced,
            ended_representatives: ended, request_id: sent.id, pending: false }, 200, MESSAGES.replaced);
        }
        return send({ id: current.id, verification_status: current.verification.status, version: current.version, message: MESSAGES.replacementSent,
          ended_representatives: [], request_id: sent.id, pending: true }, 200, MESSAGES.replacementSent);
      }
      if (method === "GET" && action === "registration-document") {
        const row = rows.find(item => item.id === profileId);
        if (!row?.document) return fail(404, "LEGAL_DOCUMENT_NOT_FOUND", "Chưa có tệp giấy đăng ký.");
        if (!(await stepUp("LEGAL_ENTITY_SENSITIVE_VIEW", `Xem giấy đăng ký của ${unit.name}. Lần xem này được ghi nhật ký.`))) return;
        const file = paperFile(STORED_PAPERS[unit.id] ?? PAPER.haDong);
        return route.fulfill({ status: 200, headers: { "X-Browser-Session-Version": "1", "Content-Type": file.mimeType, "Cache-Control": "no-store",
          "Content-Disposition": `inline; filename="${file.name}"` }, body: file.buffer });
      }
      if (method === "POST" && (action === "verification" || requestAction === "verification")) {
        const body = request.postDataJSON();
        if (!active) return fail(409, "ORGANIZATION_NOT_ACTIVE", MESSAGES.notActive(unit.name));
        const refused = rejection();
        if (refused) return fail(refused.status, refused.code, refused.message, refused.fields);
        const accepted = body.status === "VERIFIED";
        const reason = accepted ? null : reasonText(body);
        if (!accepted && !reason) return fail(400, "ORGANIZATION_INPUT_INVALID", "Hãy nhập lý do từ chối.", { reason: "Hãy nhập lý do từ chối." });
        if (accepted && !SOURCES[body.source]) return fail(400, "ORGANIZATION_INPUT_INVALID", MESSAGES.sourceRequired, { source: MESSAGES.sourceRequired });
        if (requestAction) {
          const target = requests.find(item => item.id === requestId);
          if (!target || target.status !== "PENDING") return fail(409, "LEGAL_CHANGE_REQUEST_NOT_PENDING", MESSAGES.requestNotPending);
          const kindWords = target.kind === "REPLACEMENT" ? " yêu cầu thay chủ thể pháp lý của " : " yêu cầu sửa thông tin pháp lý của ";
          if (!(await stepUp("LEGAL_ENTITY_VERIFY", `${accepted ? "Xác minh" : "Từ chối"}${kindWords}${unit.name}`))) return;
          if (accepted) approve(target, body.source, body.checked_on ?? TODAY);
          else Object.assign(target, { status: "REJECTED", decidedBy: ADMIN, decidedAt: NOW, reason, version: target.version + 1 });
          mock.writes++; mock.input = body;
          return send({ id: target.id, verification_status: accepted ? "VERIFIED" : "REJECTED", version: target.version }, 200, accepted ? MESSAGES.verified : MESSAGES.rejected);
        }
        const row = rows.find(item => item.id === profileId);
        if (!row || row.valid_to !== null || row.verification.status !== "UNVERIFIED") return fail(409, "LEGAL_PROFILE_NOT_PENDING", MESSAGES.notPending);
        if (row.version !== body.version) return fail(409, "LEGAL_PROFILE_VERSION_CONFLICT", "Thông tin pháp lý vừa được sửa. Hãy tải lại rồi đối chiếu lại.");
        if (!(await stepUp("LEGAL_ENTITY_VERIFY", `${accepted ? "Xác minh" : "Từ chối xác minh"} thông tin pháp lý của ${unit.name}`))) return;
        row.verification = accepted ? verifiedBy(body.source, body.checked_on ?? TODAY)
          : { status: "REJECTED", at: NOW, by: ADMIN, source: null, checked: null, reason };
        row.version++; mock.writes++; mock.input = body;
        return send({ id: row.id, verification_status: row.verification.status, version: row.version }, 200, accepted ? MESSAGES.verified : MESSAGES.rejected);
      }
      if (method === "POST" && requestAction === "withdrawal") {
        const target = requests.find(item => item.id === requestId);
        if (!target || target.status !== "PENDING") return fail(409, "LEGAL_CHANGE_REQUEST_NOT_PENDING", MESSAGES.requestNotPending);
        Object.assign(target, { status: "WITHDRAWN", decidedBy: ADMIN, decidedAt: NOW, version: target.version + 1 });
        mock.writes++;
        return send(presentRequest(target), 200, MESSAGES.withdrawn);
      }
    }

    /* ---- Representatives ---- */
    const repMatch = path.match(/^\/v1\/organizations\/([^/]+)\/representatives(?:\/(options)|\/([^/]+?)(\/terminate)?)?$/);
    if (repMatch) {
      const [, orgId, options, repId, terminate] = repMatch;
      const unit = UNITS.find(item => item.id === orgId);
      if (!unit) return fail(404, "ORGANIZATION_NOT_FOUND", "Không tìm thấy đơn vị.");
      if (unit.type_code === "POST_OFFICE") return fail(409, "REPRESENTATIVE_NOT_APPLICABLE", "Bưu cục không có người đại diện. Người phụ trách bưu cục là Trưởng bưu cục.");
      const reps = mock.reps[unit.id] ??= [];
      const legal = currentRow(unit.id);
      const active = status(unit) === "ACTIVE";
      const action = (r: Rep) => !activeRep(r) ? { available: false, enabled: false, disabled_reason: null }
        : active ? { available: true, enabled: true, disabled_reason: null } : { available: true, enabled: false, disabled_reason: MESSAGES.repSuspended };
      const item = (r: Rep) => {
        const live = activeRep(r);
        return {
          id: r.id, full_name: r.full_name, person: r.person, representative_type: r.type, representative_type_name: REP_TYPES[r.type],
          position_title: r.title, scope_of_authority: r.scope, start_date: r.start, end_date: r.end,
          valid_from: `${addDays(r.start, -1)}T17:00:00Z`, valid_to: r.end ? `${r.end}T17:00:00Z` : null,
          status: live ? "ACTIVE" : "ENDED", status_name: live ? "Đang hiệu lực" : "Đã kết thúc",
          basis: repDoc(r.basis, BASIS_TYPES), termination_basis: repDoc(r.termination, TERMINATION_TYPES),
          end_reason: live ? null : r.end_reason, version: r.version,
          actions: { update: action(r), terminate: action(r), verify: { available: false, enabled: false, disabled_reason: null } },
          // RepresentativeVerificationStatus: an ended term never verified waits for nothing any more (endedLabel()).
          verification_status: r.verification,
          verification_status_name: r.verification === "VERIFIED" ? "Đã xác minh" : r.verification === "REJECTED" ? "Từ chối xác minh"
            : live ? "Chờ xác minh" : "Chưa xác minh",
          rejection_reason: null, verified_at: r.verification === "VERIFIED" ? `${r.start}T03:00:00Z` : null,
          pending_change: null, last_rejection: null,
          has_basis_document: Boolean(r.basis),
        };
      };
      if (!options && !repId && method === "GET") {
        const history = url.searchParams.get("include_history") === "true";
        const current = reps.filter(activeRep);
        const reminders: string[] = [];
        if (!legal) reminders.push("Chưa khai báo thông tin pháp lý, chưa xác định được người đại diện theo pháp luật.");
        else if (legal.legal_form !== "INDIVIDUAL" && !current.some(r => r.type === "LEGAL_REPRESENTATIVE")) reminders.push("Chưa có người đại diện theo pháp luật, cần cập nhật.");
        for (const r of current) {
          if (r.type === "AUTHORIZED_REPRESENTATIVE" && r.end && r.end <= addDays(TODAY, 30)) reminders.push(`Ủy quyền của ${r.full_name} sắp hết hạn ngày ${day(r.end)}.`);
        }
        const order = (r: Rep) => `${activeRep(r) ? 0 : 1}${r.type === "LEGAL_REPRESENTATIVE" ? 0 : 1}${r.start}`;
        return send({ organization_id: unit.id, representatives: (history ? reps : current).slice().sort((a, b) => order(a).localeCompare(order(b))).map(item),
          reminders, appoint: active ? { available: true, enabled: true, disabled_reason: null } : { available: true, enabled: false, disabled_reason: MESSAGES.repSuspended } });
      }
      if (options) return send({
        legal_form: legal?.legal_form ?? null, enterprise_type: legal?.enterprise_type ?? null,
        representative_types: !legal ? [] : Object.entries(REP_TYPES).filter(([code]) => legal.legal_form !== "INDIVIDUAL" || code === "AUTHORIZED_REPRESENTATIVE")
          .map(([code, name]) => ({ code, name })),
        basis_document_types: choices(BASIS_TYPES), termination_basis_types: choices(TERMINATION_TYPES),
        basis_document_types_by_type: basisByType(legal), registration_document_available: Boolean(legal?.document),
        household_owner_name: legal?.household_owner_name ?? null, employees: EMPLOYEES[unit.id] ?? [],
      });
      if (!active && method !== "GET") return fail(409, "ORGANIZATION_NOT_ACTIVE", `${unit.name} đang tạm ngưng, kích hoạt lại rồi mới thay đổi được người đại diện.`);
      const body = method === "GET" ? null : request.postDataJSON();
      const person = (id: string | undefined) => (EMPLOYEES[unit.id] ?? []).map(e => ({ id: e.person_id, full_name: e.full_name })).find(e => e.id === id) ?? null;
      if (method === "POST" && !repId) {
        const refused = rejection();
        if (refused) return fail(refused.status, refused.code, refused.message, refused.fields);
        if (!legal) return fail(409, "LEGAL_PROFILE_REQUIRED", "Hãy khai báo thông tin pháp lý của đơn vị trước khi bổ nhiệm người đại diện.");
        const type = body.representative_type as RepType;
        if (type === "LEGAL_REPRESENTATIVE" && legal.legal_form === "HOUSEHOLD_BUSINESS" && reps.some(r => activeRep(r) && r.type === type)) {
          return fail(409, "SINGLE_LEGAL_REPRESENTATIVE", MESSAGES.householdSingle);
        }
        if (reps.some(r => activeRep(r) && r.type === type && r.full_name.toLowerCase() === String(body.full_name).trim().toLowerCase())) {
          return fail(409, "REPRESENTATIVE_DUPLICATE", MESSAGES.repDuplicate(REP_TYPES[type]));
        }
        if (!(await stepUp("REPRESENTATIVE_APPOINT", `Bổ nhiệm người đại diện ${REP_TYPES[type].toLowerCase()} cho ${unit.name}`))) return;
        const created = rep(`rep-new-${reps.length + 1}`, String(body.full_name).trim(), type, body.position_title, body.start_date,
          [body.basis_document_type, body.basis_document_number, body.basis_document_date],
          { scope: body.scope_of_authority ?? null, end: body.end_date ?? null, person: person(body.person_id), verification: "UNVERIFIED" });
        reps.push(created); mock.writes++; mock.input = body;
        return send({ organization_id: unit.id, representative: item(created), message: MESSAGES.appointed }, 201, MESSAGES.appointed);
      }
      const target = reps.find(r => r.id === repId);
      if (!target) return fail(404, "REPRESENTATIVE_NOT_FOUND", "Không tìm thấy người đại diện.");
      if (!activeRep(target)) return fail(409, "REPRESENTATIVE_ENDED", "Người đại diện này đã kết thúc nhiệm kỳ. Hãy tải lại.");
      if (target.version !== body.version) return fail(409, "REPRESENTATIVE_VERSION_CONFLICT", "Thông tin người đại diện vừa được người khác sửa. Hãy tải lại.");
      const refused = rejection();
      if (refused) return fail(refused.status, refused.code, refused.message, refused.fields);
      if (method === "PATCH") {
        const next = { full_name: String(body.full_name).trim(), title: body.position_title, scope: body.scope_of_authority ?? null,
          end: body.end_date ?? null, person: person(body.person_id),
          basis: { type: body.basis_document_type, number: body.basis_document_number, date: body.basis_document_date } };
        if (next.full_name === target.full_name && next.title === target.title && next.scope === target.scope && next.end === target.end
          && next.person?.id === target.person?.id && JSON.stringify(next.basis) === JSON.stringify(target.basis)) {
          return fail(409, "REPRESENTATIVE_UNCHANGED", MESSAGES.unchanged);
        }
        if (!(await stepUp("REPRESENTATIVE_UPDATE", `Sửa thông tin người đại diện ${target.full_name} của ${unit.name}`))) return;
        Object.assign(target, next); target.version++; mock.writes++; mock.input = body;
        return send({ organization_id: unit.id, representative: item(target), message: MESSAGES.repSaved }, 200, MESSAGES.repSaved);
      }
      if (method === "POST" && terminate) {
        if (!(await stepUp("REPRESENTATIVE_TERMINATE", `Kết thúc nhiệm kỳ người đại diện ${target.full_name} của ${unit.name}`))) return;
        target.end = body.end_date; target.termination = { type: body.basis_document_type, number: body.basis_document_number, date: body.basis_document_date };
        target.version++; mock.writes++; mock.input = body;
        const left = legal && legal.legal_form !== "INDIVIDUAL" && !reps.some(r => r !== target && activeRep(r) && r.type === "LEGAL_REPRESENTATIVE");
        const message = MESSAGES.repEnded + (left && target.type === "LEGAL_REPRESENTATIVE" ? ` ${unit.name} chưa có người đại diện theo pháp luật. Hãy bổ nhiệm người mới.` : "");
        return send({ organization_id: unit.id, representative: item(target), message }, 200, message);
      }
    }

    /* ---- Organization pages ---- */
    const match = path.match(/^\/v1\/organizations\/([^/]+)(\/.*)?$/);
    if (match && method === "GET") {
      const [, orgId, rest = ""] = match;
      const unit = UNITS.find(item => item.id === orgId);
      if (!unit) return fail(404, "ORGANIZATION_NOT_FOUND", "Không tìm thấy tổ chức.");
      const summary = (item: Unit) => ({ id: item.id, code: item.code, name: item.name, type_code: item.type_code, type_name: item.type_name,
        parent_id: item.parent?.id ?? null, parent_name: item.parent?.name ?? null, status: status(item), status_name: statusName(item),
        valid_from: item.created_at, valid_to: null, created_at: item.created_at });
      if (rest === "") return send(summary(unit));
      if (rest === "/profile") return send({ id: unit.id, code: unit.code, name: unit.name, logo_url: null,
        type: { id: `type-${unit.type_code}`, code: unit.type_code, name: unit.type_name }, internal: true, status: status(unit),
        operation_start_date: unit.start, valid_from: unit.created_at, valid_to: null, version: 1, user_model: "MULTI_USER",
        created_at: unit.created_at, updated_at: unit.created_at });
      if (rest === "/breadcrumb") {
        const chain = [CORP, ...(unit.parent && unit.parent.id !== CORP.id ? [UNITS.find(item => item.id === unit.parent!.id)!] : []), ...(unit === CORP ? [] : [unit])];
        return send({ items: chain.map(summary) });
      }
      if (rest === "/children") return send({ items: [], page: 0, size: 20, has_next: false });
    }
    return route.fallback();
  });
}

/** The JSON of the "request" part when the dialog sends multipart, or the JSON body. */
function readInput(request: Request) {
  if (!(request.headers()["content-type"] ?? "").startsWith("multipart/")) return request.postDataJSON();
  const body = request.postDataBuffer()!.toString("latin1");
  const part = body.split(/\r\n--/).find(chunk => /name="request"/.test(chunk))!;
  const json = part.slice(part.indexOf("\r\n\r\n") + 4);
  return JSON.parse(Buffer.from(json, "latin1").toString("utf8"));
}
function multipartNames(request: Request): string[] {
  const body = request.postDataBuffer()?.toString("latin1") ?? "";
  return [...body.matchAll(/name="([^"]+)"/g)].map(found => found[1]!);
}

/* ---- Pages ---- */

export const unitUrl = (unit: Unit, section?: string) => `/workspace/organizations/${unit.id}${section ? `?section=${section}` : ""}`;
export const legalHeading = (page: Page) => page.getByRole("heading", { name: "Thông tin pháp lý", exact: true });
/** "Pháp lý" of a unit, loaded: the declared subject (its "Đăng ký" card) or the empty state. */
export async function openLegal(page: Page, unit: Unit) {
  await page.goto(unitUrl(unit, "legal-entities"));
  await legalLoaded(page);
}
/** The legal section past its skeleton: the cards of the subject or "Chưa khai báo thông tin pháp lý". */
export async function legalLoaded(page: Page) {
  await legalHeading(page).waitFor();
  const section = page.locator(".legal-page");
  await section.locator(".legal-info-card").first().or(section.getByText("Chưa khai báo thông tin pháp lý", { exact: true })).first().waitFor();
  await section.getByRole("status", { name: "Đang tải thông tin pháp lý" }).waitFor({ state: "detached" });
}
/** "Lịch sử thông tin pháp lý" (its own page now), past its skeleton. */
export async function openHistory(page: Page) {
  await legalButton(page, "Lịch sử").click();
  await page.waitForURL("**/legal/history");
  await page.getByRole("heading", { level: 1, name: "Lịch sử thông tin pháp lý", exact: true }).waitFor();
  await page.locator(".legal-page ol > li").first().or(page.getByText("Chưa có lịch sử", { exact: true })).first().waitFor();
}
export async function openOverview(page: Page, unit: Unit) {
  await page.goto(unitUrl(unit));
  await page.getByRole("heading", { name: "Tổng quan tổ chức", exact: true }).waitFor();
  await page.locator(".organization-overview-card").first().waitFor();
}
export const legalButton = (page: Page, label: string) => page.locator(".legal-page").getByRole("button", { name: label, exact: true });
export const dialog = (page: Page, title: string) => page.getByRole("dialog", { name: title, exact: true });
/** A dialog's confirm button: some now read "Xác nhận" instead of the action word. */
export const confirmButton = (box: import("playwright").Locator, label: string) =>
  box.getByRole("button", { name: new RegExp(`^(${label}|Xác nhận)$`) }).last();
export const alertDialog = (page: Page, title: string) => page.getByRole("alertdialog", { name: title, exact: true });
/**
 * Presses a button without moving the pointer: the dev "Figma" and log buttons of the app appear when the pointer
 * nears the bottom-right corner, right over the form's action bar, and would take the click.
 */
export async function press(button: import("playwright").Locator) {
  await button.waitFor();
  await button.evaluate(node => (node as HTMLButtonElement).click());
}
/** "Sửa thông tin pháp lý" or "Thay chủ thể pháp lý" page of a unit, loaded (its form, past the skeleton). */
export async function openEditPage(page: Page, unit: Unit, mode: "edit" | "replace") {
  await page.goto(`/workspace/organizations/${unit.id}/legal/${mode}`);
  await editPageLoaded(page, mode);
}
export async function editPageLoaded(page: Page, mode: "edit" | "replace") {
  await page.getByRole("heading", { level: 1, name: mode === "edit" ? "Sửa thông tin pháp lý" : "Thay chủ thể pháp lý", exact: true }).waitFor();
  await editForm(page).waitFor();
}
const editForm = (page: Page) => page.locator(".legal-change-page form");
export const formButton = (page: Page, label: string) => editForm(page).getByRole("button", { name: label, exact: true }).last();
export const HN_REGISTRY_NAME = HN_REGISTRY;

/**
 * Uploads a registration certificate into the "Giấy đăng ký" zone `key` ("registration_document" in the declare
 * dialog, "legal.registration_document" on Sửa / Thay chủ thể) and waits for what its reading filled.
 */
export async function uploadPaper(page: Page, name: string, key = "registration_document") {
  await field(page, key).setInputFiles(paperFile(name));
  const panel = page.locator(`[data-field="${key}"]`);
  await panel.getByText(READINGS[name] ? /^Đã điền \d+ thông tin$/ : /^Đã đính kèm$/).waitFor();
}
/** "Chọn hình thức pháp lý" (typing by hand, no certificate read), then the form's card. */
export async function chooseLegalForm(page: Page, scope: import("playwright").Locator, form: string) {
  await scope.getByRole("button", { name: "Chọn hình thức pháp lý", exact: true }).click();
  await chooseFormCard(scope, form);
}
export async function chooseFormCard(scope: import("playwright").Locator, form: string) {
  await scope.getByRole("radio", { name: form, exact: true }).check();
}

/* ---- Controls ---- */

export const field = (page: Page, id: string) => page.locator(`[id="${id}"]`);
/** The custom listbox of a Select: opens it, waits for the option and picks it. */
export async function pick(page: Page, id: string, option: string) {
  const searchTrigger = page.locator(`button[id="${id}"][aria-haspopup="listbox"]`);
  if (await searchTrigger.count()) return searchPick(page, id, option);
  const trigger = page.locator(`select[id="${id}"] + [role="combobox"]`);
  // A plain native select (AdminSelect, e.g. "Nguồn đối chiếu" of the verify dialog): choose by its label.
  if (!(await trigger.count()) && await page.locator(`select[id="${id}"]`).count()) {
    await page.locator(`select[id="${id}"]`).selectOption({ label: option });
    return;
  }
  await expect(trigger).toBeEnabled();
  const target = page.locator(`[id="${id}-options-list"]`).getByRole("option", { name: option, exact: true });
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!(await target.isVisible())) await trigger.click();
    try { await target.waitFor({ timeout: 2000 }); break; } catch { /* open it again */ }
  }
  await target.click();
  await expect(trigger).toContainText(option);
}
/** The Select inside `scope` (a dialog's reason list, whose id is generated): picks the option. */
export async function pickIn(page: Page, scope: import("playwright").Locator, option: string) {
  const id = await scope.locator("select").first().getAttribute("id");
  await pick(page, id!, option);
}
/** A SearchSelect (a button opening a searchable list, e.g. "Tài khoản liên kết"): opens it and picks the option. */
async function searchPick(page: Page, id: string, option: string) {
  const trigger = page.locator(`button[id="${id}"]`);
  await expect(trigger).toBeEnabled();
  await trigger.click();
  await page.locator(`[role="listbox"][aria-labelledby="${id}"]`).getByRole("option").filter({ hasText: option }).first().click();
  await expect(trigger).toContainText(option);
}
/** Picks a date (yyyy-mm-dd) in the calendar the field `id` opens. */
export async function pickDate(page: Page, id: string, iso: string) {
  await pickCalendarDay(field(page, id), iso);
}
/** Back to the top of the workspace pane before a full-page picture, with no field left in focus. */
export async function scrollTop(page: Page) {
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); document.querySelectorAll<HTMLElement>(".ui-workspace-content").forEach(node => { node.scrollTop = 0; }); window.scrollTo(0, 0); });
}
/** Scrolls the nearest scrolling box (dialog body or workspace pane) so the element sits near its top. */
export async function scrollToElement(page: Page, selector: string) {
  await page.locator(selector).first().evaluate(target => {
    (document.activeElement as HTMLElement | null)?.blur();
    let box: HTMLElement | null = target.parentElement;
    while (box && !(box.scrollHeight > box.clientHeight && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    if (box) box.scrollTop += target.getBoundingClientRect().top - box.getBoundingClientRect().top - 16;
  });
}

/* ---- Step-up and result ---- */

export const codeDialog = (page: Page) => page.getByRole("dialog", { name: "Xác nhận thao tác" });
export async function waitCode(page: Page) { await field(page, "step-up-code").waitFor(); }
export async function enterCode(page: Page, code = STEP_UP_CODE) {
  await field(page, "step-up-code").fill(code);
  await codeDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
}
/** The confirmation of a write ("…?"), then its code dialog. */
export async function confirmAndCode(page: Page, title: string, label: string) {
  await page.getByRole("alertdialog", { name: title }).or(page.getByRole("dialog", { name: title })).getByRole("button", { name: label, exact: true }).click();
  await waitCode(page);
}
export const toast = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text }).first();
/** A header button by its visible label: a disabled one carries "<label>. <reason>" as its accessible name. */
export const labelledButton = (page: Page, label: string) =>
  page.locator(".legal-page button").filter({ hasText: new RegExp(`^${label}$`) });
