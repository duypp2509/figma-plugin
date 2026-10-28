import type { Locator, Page, Route } from "playwright";
import { defineFlow, type FlowContext } from "../../capture";
import { mockPin } from "./superplatform-screen-lock";
import { DONG_ANH, HA_DONG, LONG_BIEN, STEP_UP_CODE } from "./superplatform-legal-profile";

/*
 * "Yêu cầu xác minh" (/workspace/verification-requests, Tổ chức › Yêu cầu xác minh) of SuperPlatform, against an
 * in-browser stand-in of GET /v1/scope/verification-requests and of what the page opens from a row: the unit's legal
 * profile (its declaration, its pending change request), the files behind a code, the representatives' basis files,
 * the decisions (legal profile, change request, representative) and a Shop's business verification
 * (/v1/internal/shops/business-verifications/**). Shapes and sentences follow VerificationRequestController,
 * LegalVerificationRequestSource, RepresentativeVerificationRequests, ShopBusinessVerificationRequestSource,
 * OrganizationLegalProfileService, OrganizationRepresentativeService, ShopBusinessReviewService and
 * BusinessVerificationTerms. The session is Nguyễn Minh Anh, Quản trị hệ thống (mockPin), clock frozen at
 * 12/10/2026 09:00.
 */

export { STEP_UP_CODE } from "./superplatform-legal-profile";
export { codeDialog, enterCode, field, pick, pickDate, pickIn, toast, waitCode } from "./superplatform-legal-profile";

export const GROUP = "SUPERPLATFORM — YÊU CẦU XÁC MINH";
export const LIST_URL = "/workspace/verification-requests";
const NOW = "2026-10-12T02:00:00.000Z";

/** Exact sentences of the backend and of the page. */
export const MESSAGES = {
  legalVerified: "Đã xác minh thông tin pháp lý.",
  legalRejected: "Đã từ chối xác minh.",
  repVerified: "Đã xác minh người đại diện.",
  repRejected: "Đã từ chối xác minh người đại diện.",
  shopApproved: "Đã duyệt giấy phép kinh doanh.",
  shopRejected: "Đã từ chối hồ sơ.",
  sourceRequired: "Hãy chọn nguồn đối chiếu.",
  dateRequired: "Hãy chọn ngày đối chiếu.",
  empty: "Không có yêu cầu chờ xác minh",
  noMatch: "Không có yêu cầu phù hợp",
};

/* ---- Catalogs ---- */

const SOURCES = [
  { code: "NATIONAL_BUSINESS_REGISTRY", name: "Cổng thông tin quốc gia về đăng ký doanh nghiệp" },
  { code: "TAX_PAYER_LOOKUP", name: "Trang tra cứu thông tin người nộp thuế" },
  { code: "REGISTRATION_DOCUMENT", name: "Tệp giấy đăng ký" },
];
/** V1430__common_action_reasons.sql, VERIFICATION_REJECT. */
const REJECT_REASONS = [
  ["GIAY_TO_KHONG_RO", "Giấy tờ không rõ"], ["THONG_TIN_KHONG_KHOP_GIAY_TO", "Thông tin không khớp giấy tờ"],
  ["GIAY_TO_HET_HIEU_LUC", "Giấy tờ hết hiệu lực"], ["THIEU_GIAY_TO", "Thiếu giấy tờ"], ["OTHER", "Khác"],
].map(([code, name]) => ({ code: code!, name: name!, note_required: code === "OTHER" }));
/** BusinessVerificationTerms: the reviewer's checks and the reasons of a rejection of a Shop's certificate. */
const SHOP_CHECKS = [
  ["REGISTRY_MATCH", "Tên, mã số thuế, địa chỉ khớp cổng đăng ký doanh nghiệp hoặc cổng thuế"],
  ["TAX_ACTIVE", "Mã số thuế đang hoạt động"],
  ["DOCUMENT_GENUINE", "Giấy rõ, đủ trang, là bản mới nhất, không có dấu hiệu sửa"],
].map(([code, name]) => ({ code: code!, name: name! }));
export const SHOP_CHECK_NAMES = SHOP_CHECKS.map(check => check.name);
const SHOP_REJECT_REASONS = [
  ["UNCLEAR", "Giấy không rõ"], ["REGISTRY_MISMATCH", "Thông tin không khớp cổng tra cứu"], ["TAX_INACTIVE", "Mã số thuế không hoạt động"],
  ["OUTDATED", "Không phải bản mới nhất"], ["SUSPECTED_FRAUD", "Nghi giả mạo"], ["OTHER", "Khác"],
].map(([code, name]) => ({ code: code!, name: name! }));
const LOOKUPS = [
  { label: "Cổng thông tin quốc gia về đăng ký doanh nghiệp", url: "https://dangkykinhdoanh.gov.vn" },
  { label: "Tra cứu thông tin người nộp thuế", url: "https://tracuunnt.gdt.gov.vn" },
];
const HN_REGISTRY = "Phòng Đăng ký kinh doanh - Sở Tài chính Thành phố Hà Nội";

/* ---- Units ---- */

interface UnitRef { id: string; code: string; name: string; type_code: string; type_name: string }
const unit = (u: { id: string; code: string; name: string; type_code: string; type_name: string }): UnitRef =>
  ({ id: u.id, code: u.code, name: u.name, type_code: u.type_code, type_name: u.type_name });
export const THANH_XUAN: UnitRef = { id: "org-tx", code: "NQT01T5X3H8", name: "NHƯỢNG QUYỀN THANH XUÂN", type_code: "FRANCHISE_PARTNER", type_name: "Nhượng quyền" };
export const KHA_AI: UnitRef = { id: "shop-kha-ai", code: "SHP2410587", name: "Mỹ phẩm Khả Ái", type_code: "SHOP", type_name: "Cửa hàng" };
export const HUONG_GIANG: UnitRef = { id: "shop-huong-giang", code: "SHP2510942", name: "Gốm sứ Hương Giang", type_code: "SHOP", type_name: "Cửa hàng" };
const UNITS: UnitRef[] = [unit(HA_DONG), unit(LONG_BIEN), unit(DONG_ANH), THANH_XUAN];

/* ---- The waiting requests ---- */

type Change = { field: string; field_name: string; before: string | null; after: string | null };
interface Pending {
  type: "LEGAL_PROFILE" | "REPRESENTATIVE" | "SHOP_BUSINESS"; target_kind: string; target_id: string; version: number;
  organization: UnitRef; subject_name: string; request_kind: string; request_kind_name: string;
  submitted_by_name: string; submitted_at: string; changes: Change[]; has_document: boolean | null;
}
const TYPE_NAMES = { LEGAL_PROFILE: "Pháp lý", REPRESENTATIVE: "Người đại diện", SHOP_BUSINESS: "Giấy phép kinh doanh" } as const;
const fresh = (field: string, field_name: string, after: string): Change => ({ field, field_name, before: null, after });
const changed = (field: string, field_name: string, before: string, after: string): Change => ({ field, field_name, before, after });

/** Subjects of the requests, as the rows and panels show them. */
export const SUBJECT = {
  amendment: "CÔNG TY TNHH VẬN CHUYỂN HÀ ĐÔNG",
  declaration: "CÔNG TY TNHH GIAO NHẬN THANH XUÂN",
  replacement: "CÔNG TY CỔ PHẦN GIAO VẬN BỒ ĐỀ",
  appointment: "Ngô Thanh Hà",
  repUpdate: "Lê Hoàng Phúc",
  shop: "CÔNG TY TNHH MỸ PHẨM KHẢ ÁI",
  household: "HỘ KINH DOANH GỐM SỨ HƯƠNG GIANG",
} as const;

function pendingRequests(): Pending[] {
  return [
    { type: "LEGAL_PROFILE", target_kind: "LEGAL_CHANGE_REQUEST", target_id: "request-hd-1", version: 1, organization: unit(HA_DONG),
      subject_name: SUBJECT.amendment, request_kind: "AMENDMENT", request_kind_name: "Sửa", submitted_by_name: "Phạm Thu Trang",
      submitted_at: "2026-10-07T02:15:00Z", has_document: null, changes: [
        changed("latest_amendment_number", "Đăng ký thay đổi lần thứ", "1", "2"),
        changed("latest_amendment_on", "Ngày đăng ký thay đổi", "04/11/2024", "05/09/2026"),
        changed("address", "Địa chỉ trụ sở", "Số 25 đường Quang Trung, Phường Hà Đông, Thành phố Hà Nội", "Số 8 đường Tố Hữu, Phường Hà Đông, Thành phố Hà Nội"),
      ] },
    { type: "SHOP_BUSINESS", target_kind: "SHOP_BUSINESS_VERIFICATION", target_id: "shop-review-kha-ai", version: 1, organization: KHA_AI,
      subject_name: SUBJECT.shop, request_kind: "SHOP_VERIFICATION", request_kind_name: "Doanh nghiệp", submitted_by_name: "Lê Minh Châu",
      submitted_at: "2026-10-08T03:40:00Z", has_document: true, changes: [
        fresh("tax_code", "Mã số thuế", "0316789012"), fresh("warnings", "Cảnh báo", "Shop đã sửa so với giấy, Có giấy ủy quyền"),
      ] },
    { type: "LEGAL_PROFILE", target_kind: "LEGAL_PROFILE", target_id: "legal-tx-1", version: 1, organization: THANH_XUAN,
      subject_name: SUBJECT.declaration, request_kind: "DECLARATION", request_kind_name: "Khai báo", submitted_by_name: "Đỗ Thị Thu Hà",
      submitted_at: "2026-10-09T01:40:00Z", has_document: null, changes: [] },
    { type: "REPRESENTATIVE", target_kind: "REPRESENTATIVE", target_id: "rep-da-1", version: 1, organization: unit(DONG_ANH),
      subject_name: SUBJECT.appointment, request_kind: "APPOINT", request_kind_name: "Bổ nhiệm", submitted_by_name: "Đặng Quốc Bảo",
      submitted_at: "2026-10-09T08:20:00Z", has_document: true, changes: [
        fresh("representative_type", "Loại", "Theo ủy quyền"), fresh("position_title", "Chức danh", "Phó Giám đốc"),
        fresh("scope_of_authority", "Phạm vi ủy quyền", "Ký hợp đồng, biên bản đối soát với SuperShip"),
        fresh("term", "Thời gian", "10/10/2026 – 31/12/2027"), fresh("basis", "Căn cứ", "Giấy ủy quyền · 02/2026/UQ · 09/10/2026"),
      ] },
    { type: "LEGAL_PROFILE", target_kind: "LEGAL_CHANGE_REQUEST", target_id: "request-lb-1", version: 1, organization: unit(LONG_BIEN),
      subject_name: SUBJECT.replacement, request_kind: "REPLACEMENT", request_kind_name: "Thay chủ thể", submitted_by_name: "Phạm Thu Trang",
      submitted_at: "2026-10-10T02:30:00Z", has_document: null, changes: [
        changed("enterprise_type", "Loại hình doanh nghiệp", "Công ty TNHH một thành viên", "Công ty cổ phần"),
        changed("registered_name", "Tên doanh nghiệp", "CÔNG TY TNHH GIAO VẬN LONG BIÊN", SUBJECT.replacement),
        changed("registration_number", "Mã số doanh nghiệp", "0108765432", "0110987654"),
        changed("certificate_number", "Số giấy đăng ký", "0108765432", "0110987654"),
        changed("certificate_issued_on", "Ngày cấp lần đầu", "20/05/2024", "02/10/2026"),
        changed("address", "Địa chỉ trụ sở", "Số 120 đường Nguyễn Văn Cừ, Phường Bồ Đề, Thành phố Hà Nội", "Số 56 đường Ngọc Lâm, Phường Bồ Đề, Thành phố Hà Nội"),
        changed("head_office_phone", "Số điện thoại trụ sở", "02438725566", "02438271199"),
        changed("head_office_email", "Email trụ sở", "lienhe@giaovanlongbien.vn", "lienhe@giaovanbode.vn"),
        changed("invoice_email", "Email nhận hóa đơn", "ketoan@giaovanlongbien.vn", "ketoan@giaovanbode.vn"),
      ] },
    { type: "REPRESENTATIVE", target_kind: "REPRESENTATIVE", target_id: "rep-hd-3", version: 3, organization: unit(HA_DONG),
      subject_name: SUBJECT.repUpdate, request_kind: "UPDATE", request_kind_name: "Sửa thông tin", submitted_by_name: "Phạm Thu Trang",
      submitted_at: "2026-10-10T07:05:00Z", has_document: false, changes: [
        changed("position_title", "Chức danh", "Trưởng phòng kinh doanh", "Giám đốc kinh doanh"),
        changed("scope_of_authority", "Phạm vi ủy quyền", "Ký hợp đồng nhượng quyền, biên bản đối soát với SuperShip",
          "Ký hợp đồng nhượng quyền, biên bản đối soát và xác nhận công nợ với SuperShip"),
      ] },
    { type: "SHOP_BUSINESS", target_kind: "SHOP_BUSINESS_VERIFICATION", target_id: "shop-review-huong-giang", version: 1, organization: HUONG_GIANG,
      subject_name: SUBJECT.household, request_kind: "SHOP_VERIFICATION", request_kind_name: "Hộ kinh doanh", submitted_by_name: "Nguyễn Thị Hương Giang",
      submitted_at: "2026-10-11T04:10:00Z", has_document: true, changes: [
        fresh("tax_code", "Mã số thuế", "8034567812"), fresh("warnings", "Cảnh báo", "Nhập tay"),
      ] },
  ];
}

/* ---- Legal profiles the panel reads (GET legal-profile) ---- */

const address = (display: string) => ({ province_code: "P01", province_name: "Thành phố Hà Nội", ward_code: null, ward_name: null,
  address_line: display.split(", ")[0], display });
function current(id: string, extra: Record<string, unknown>) {
  return { id, version: 1, legal_form: "ENTERPRISE", legal_form_name: "Doanh nghiệp", household_owner_name: null, private_owner_name: null,
    registration_document: { present: true, media_type: "image/svg+xml" }, origin: "DECLARED", ...extra };
}
const LEGAL_VIEWS: Record<string, { current: Record<string, unknown>; pending?: Record<string, unknown> }> = {
  [THANH_XUAN.id]: { current: current("legal-tx-1", {
    enterprise_type: "LLC_MULTI_MEMBER", enterprise_type_name: "Công ty TNHH hai thành viên trở lên", registered_name: SUBJECT.declaration,
    registration_number_display: "0110567890", certificate: { number: "0110567890", issued_on: "2026-09-28", issuer: HN_REGISTRY,
      latest_amendment_number: null, latest_amendment_on: null },
    registered_address: address("Số 72 đường Nguyễn Trãi, Phường Thanh Xuân, Thành phố Hà Nội"), head_office_phone: "02435578899",
    head_office_email: "lienhe@giaonhanthanhxuan.vn", invoice_email: "ketoan@giaonhanthanhxuan.vn", valid_from: "2026-10-09T01:40:00Z",
    subject_started_on: "2026-10-09", declared_by: { full_name: "Đỗ Thị Thu Hà" }, declared_at: "2026-10-09T01:40:00Z",
    verification: { status: "UNVERIFIED", text: "Chưa xác minh. Đang chờ Quản trị hệ thống đối chiếu từ ngày 09/10/2026.", verified_at: null,
      verified_by_name: null, source: null, source_name: null, checked_on: null, rejection_reason: null } }) },
  [HA_DONG.id]: { current: current("legal-hd-1", {
    enterprise_type: "LLC_MULTI_MEMBER", enterprise_type_name: "Công ty TNHH hai thành viên trở lên", registered_name: SUBJECT.amendment,
    registration_number_display: "0109876543", certificate: { number: "0109876543", issued_on: "2023-05-16", issuer: HN_REGISTRY,
      latest_amendment_number: 1, latest_amendment_on: "2024-11-04" },
    registered_address: address("Số 25 đường Quang Trung, Phường Hà Đông, Thành phố Hà Nội") }),
    pending: { id: "request-hd-1", version: 1, kind: "AMENDMENT", kind_name: "Sửa", requested_by: { full_name: "Phạm Thu Trang" },
      requested_at: "2026-10-07T02:15:00Z", proposed: { document_changed: true, registration_document: { present: true, media_type: "image/svg+xml" } },
      changes: [], replacement: null } },
  [LONG_BIEN.id]: { current: current("legal-lb-1", {
    enterprise_type: "LLC_ONE_MEMBER", enterprise_type_name: "Công ty TNHH một thành viên", registered_name: "CÔNG TY TNHH GIAO VẬN LONG BIÊN",
    registration_number_display: "0108765432", certificate: { number: "0108765432", issued_on: "2024-05-20", issuer: HN_REGISTRY,
      latest_amendment_number: null, latest_amendment_on: null },
    registered_address: address("Số 120 đường Nguyễn Văn Cừ, Phường Bồ Đề, Thành phố Hà Nội") }),
    pending: { id: "request-lb-1", version: 1, kind: "REPLACEMENT", kind_name: "Thay chủ thể", requested_by: { full_name: "Phạm Thu Trang" },
      requested_at: "2026-10-10T02:30:00Z", proposed: { document_changed: true, registration_document: { present: true, media_type: "image/svg+xml" } },
      changes: [], replacement: { effective_on: "2026-10-15", basis_document_type: "TRANSFER_DOCUMENT", basis_document_type_name: "Văn bản chuyển nhượng",
        basis_document_number: "03/2026/VBCN", basis_document_date: "2026-10-05",
        representatives_to_end: ["Hoàng Văn Nam (theo pháp luật)", "Trịnh Thu Hằng (theo ủy quyền)"] } } },
};

/* ---- A Shop's submission (ShopBusinessReviewService.detail) ---- */

type ShopField = [field: string, name: string, value: string, read?: string | null];
const SHOP_REVIEWS: Record<string, { shop: UnitRef; kind: [string, string]; fields: ShopField[]; submitter: string; role: string;
  at: string; authorization: string | null; warnings: [string, string][] }> = {
  "shop-review-kha-ai": { shop: KHA_AI, kind: ["ENTERPRISE", "Doanh nghiệp"], submitter: "Lê Minh Châu", role: "Kế toán trưởng",
    at: "2026-10-08T03:40:00Z", authorization: "2027-03-31", warnings: [["EDITED", "Shop đã sửa so với giấy"], ["HAS_AUTHORIZATION", "Có giấy ủy quyền"]],
    fields: [["tax_code", "Mã số thuế", "0316789012"], ["registered_name", "Tên trên giấy", SUBJECT.shop],
      ["enterprise_type", "Loại hình", "Công ty TNHH một thành viên"],
      ["address_line", "Địa chỉ trụ sở", "Số 18 đường Nguyễn Trãi, Phường Bến Thành, Thành phố Hồ Chí Minh", "Số 16 đường Nguyễn Trãi, Phường Bến Thành, Thành phố Hồ Chí Minh"],
      ["certificate_issuer", "Cơ quan cấp", "Phòng Đăng ký kinh doanh - Sở Tài chính Thành phố Hồ Chí Minh"],
      ["certificate_issued_on", "Ngày đăng ký lần đầu", "14/03/2022"], ["latest_amendment_number", "Lần thay đổi", "1"],
      ["latest_amendment_on", "Ngày thay đổi", "06/08/2025"], ["head_office_phone", "Điện thoại", "02838225566", null],
      ["head_office_email", "Thư điện tử", "lienhe@myphamkhaai.vn"], ["representative_name", "Người đứng tên", "TRẦN THỊ KHẢ ÁI"],
      ["representative_title", "Chức danh", "Giám đốc"]] },
  "shop-review-huong-giang": { shop: HUONG_GIANG, kind: ["HOUSEHOLD", "Hộ kinh doanh"], submitter: "Nguyễn Thị Hương Giang", role: "Chủ hộ kinh doanh",
    at: "2026-10-11T04:10:00Z", authorization: null, warnings: [["MANUAL", "Nhập tay"]],
    fields: [["tax_code", "Mã số thuế", "8034567812"], ["registered_name", "Tên trên giấy", SUBJECT.household],
      ["address_line", "Địa chỉ trụ sở", "Số 12 xóm 3, Xã Bát Tràng, Thành phố Hà Nội"],
      ["certificate_issuer", "Cơ quan cấp", "Phòng Kinh tế xã Bát Tràng"], ["certificate_issued_on", "Ngày đăng ký lần đầu", "18/06/2024"],
      ["head_office_phone", "Điện thoại", "0912648351"], ["representative_name", "Người đứng tên", "NGUYỄN THỊ HƯƠNG GIANG"],
      ["representative_title", "Chức danh", "Chủ hộ kinh doanh"]] },
};

/* ---- The papers, drawn as SVG (shown as a picture by the file viewers) ---- */

type Line = { text: string; x?: number; bold?: boolean; size?: number; anchor?: "start" | "middle" | "end"; italic?: boolean; gap?: number; under?: boolean; same?: boolean };
const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function paper(lines: Line[]): Buffer {
  let y = 70;
  const out: string[] = [];
  for (const line of lines) {
    if (!line.same) y += line.gap ?? 28;
    const size = line.size ?? 17;
    out.push(`<text x="${line.x ?? 90}" y="${y}" font-size="${size}" text-anchor="${line.anchor ?? "start"}"${line.bold ? ' font-weight="bold"' : ""}${line.italic ? ' font-style="italic"' : ""}${line.under ? ' text-decoration="underline"' : ""}>${escapeXml(line.text)}</text>`);
  }
  // As tall as its text: a scan cropped to the written part, so the viewer shows it large enough to read.
  const height = Math.max(700, y + 90);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${height}" viewBox="0 0 900 ${height}"><rect width="900" height="${height}" fill="#fff"/><g font-family="'Times New Roman', Times, serif" fill="#111">${out.join("")}</g></svg>`, "utf8");
}
const head = (left: string, leftSub: string): Line[] => [
  { text: left, x: 245, anchor: "middle", gap: 0 }, { text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", x: 630, anchor: "middle", bold: true, same: true },
  { text: leftSub, x: 245, anchor: "middle", bold: true, under: true, gap: 26 }, { text: "Độc lập - Tự do - Hạnh phúc", x: 630, anchor: "middle", bold: true, under: true, same: true },
];
const sign = (title: string, name: string): Line[] => [
  { text: title, x: 650, anchor: "middle", bold: true, gap: 60 }, { text: "(Đã ký)", x: 650, anchor: "middle", italic: true, gap: 26 },
  { text: name, x: 650, anchor: "middle", bold: true, gap: 90 },
];
function enterpriseCertificate(p: { office: string; number: string; first: string; amendment?: string; name: string; type: string;
  address: string; phone: string; email: string; capital: string; owner: string; title: string }): Buffer {
  return paper([
    ...head(p.office, "PHÒNG ĐĂNG KÝ KINH DOANH"),
    { text: "GIẤY CHỨNG NHẬN ĐĂNG KÝ DOANH NGHIỆP", x: 450, anchor: "middle", bold: true, size: 22, gap: 60 },
    { text: p.type.toUpperCase(), x: 450, anchor: "middle", bold: true, gap: 30 },
    { text: `Mã số doanh nghiệp: ${p.number}`, x: 450, anchor: "middle", bold: true, gap: 34 },
    { text: `Đăng ký lần đầu: ${p.first}`, x: 450, anchor: "middle", gap: 28 },
    ...(p.amendment ? [{ text: p.amendment, x: 450, anchor: "middle" as const }] : []),
    { text: `1. Tên công ty viết bằng tiếng Việt: ${p.name}`, bold: true, gap: 50 },
    { text: "2. Địa chỉ trụ sở chính:", bold: true }, { text: p.address, x: 110 },
    { text: `Điện thoại: ${p.phone}`, x: 110 }, { text: `Email: ${p.email}`, x: 520, same: true },
    { text: `3. Vốn điều lệ: ${p.capital}`, bold: true },
    { text: "4. Người đại diện theo pháp luật của công ty", bold: true },
    { text: `Họ và tên: ${p.owner}` }, { text: `Chức danh: ${p.title}`, x: 520, same: true },
    { text: "Loại giấy tờ pháp lý của cá nhân: Thẻ căn cước" },
    ...sign("TRƯỞNG PHÒNG", "Nguyễn Văn Thành"),
  ]);
}
const PAPERS: Record<string, Buffer> = {
  [THANH_XUAN.id]: enterpriseCertificate({ office: "SỞ TÀI CHÍNH THÀNH PHỐ HÀ NỘI", number: "0110567890", first: "ngày 28 tháng 09 năm 2026",
    name: SUBJECT.declaration, type: "Công ty trách nhiệm hữu hạn hai thành viên trở lên", address: "Số 72 đường Nguyễn Trãi, Phường Thanh Xuân, Thành phố Hà Nội, Việt Nam",
    phone: "024 3557 8899", email: "lienhe@giaonhanthanhxuan.vn", capital: "3.000.000.000 đồng", owner: "VŨ ĐỨC MẠNH", title: "Giám đốc" }),
  [HA_DONG.id]: enterpriseCertificate({ office: "SỞ TÀI CHÍNH THÀNH PHỐ HÀ NỘI", number: "0109876543", first: "ngày 16 tháng 05 năm 2023",
    amendment: "Đăng ký thay đổi lần thứ 2: ngày 05 tháng 09 năm 2026", name: SUBJECT.amendment, type: "Công ty trách nhiệm hữu hạn hai thành viên trở lên",
    address: "Số 8 đường Tố Hữu, Phường Hà Đông, Thành phố Hà Nội, Việt Nam", phone: "024 3355 6789", email: "lienhe@vanchuyenhadong.vn",
    capital: "5.000.000.000 đồng", owner: "NGUYỄN VĂN AN", title: "Giám đốc" }),
  [LONG_BIEN.id]: enterpriseCertificate({ office: "SỞ TÀI CHÍNH THÀNH PHỐ HÀ NỘI", number: "0110987654", first: "ngày 02 tháng 10 năm 2026",
    name: SUBJECT.replacement, type: "Công ty cổ phần", address: "Số 56 đường Ngọc Lâm, Phường Bồ Đề, Thành phố Hà Nội, Việt Nam",
    phone: "024 3827 1199", email: "lienhe@giaovanbode.vn", capital: "8.000.000.000 đồng", owner: "ĐINH QUANG HẢI", title: "Tổng Giám đốc" }),
  "shop-review-kha-ai": enterpriseCertificate({ office: "SỞ TÀI CHÍNH THÀNH PHỐ HỒ CHÍ MINH", number: "0316789012", first: "ngày 14 tháng 03 năm 2022",
    amendment: "Đăng ký thay đổi lần thứ 1: ngày 06 tháng 08 năm 2025", name: SUBJECT.shop, type: "Công ty trách nhiệm hữu hạn một thành viên",
    address: "Số 16 đường Nguyễn Trãi, Phường Bến Thành, Thành phố Hồ Chí Minh, Việt Nam", phone: "028 3822 5566", email: "lienhe@myphamkhaai.vn",
    capital: "2.000.000.000 đồng", owner: "TRẦN THỊ KHẢ ÁI", title: "Giám đốc" }),
  "shop-review-huong-giang": paper([
    ...head("ỦY BAN NHÂN DÂN XÃ BÁT TRÀNG", "PHÒNG KINH TẾ"),
    { text: "GIẤY CHỨNG NHẬN ĐĂNG KÝ HỘ KINH DOANH", x: 450, anchor: "middle", bold: true, size: 22, gap: 60 },
    { text: "Mã số hộ kinh doanh: 8034567812", x: 450, anchor: "middle", bold: true, gap: 34 },
    { text: "Đăng ký lần đầu: ngày 18 tháng 06 năm 2024", x: 450, anchor: "middle" },
    { text: `1. Tên hộ kinh doanh: ${SUBJECT.household}`, bold: true, gap: 50 },
    { text: "2. Địa chỉ trụ sở hộ kinh doanh:", bold: true }, { text: "Số 12 xóm 3, Xã Bát Tràng, Thành phố Hà Nội, Việt Nam", x: 110 },
    { text: "Điện thoại: 0912 648 351", x: 110 },
    { text: "3. Ngành, nghề kinh doanh:", bold: true }, { text: "- Sản xuất, bán lẻ đồ gốm sứ", x: 110 },
    { text: "4. Vốn kinh doanh: 300.000.000 đồng", bold: true },
    { text: "5. Chủ hộ kinh doanh", bold: true }, { text: "Họ và tên: NGUYỄN THỊ HƯƠNG GIANG" }, { text: "Giới tính: Nữ", x: 560, same: true },
    ...sign("TRƯỞNG PHÒNG", "Lê Văn Khánh"),
  ]),
  "shop-review-kha-ai-authorization": paper([
    { text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", x: 450, anchor: "middle", bold: true, gap: 0 },
    { text: "Độc lập - Tự do - Hạnh phúc", x: 450, anchor: "middle", bold: true, under: true, gap: 26 },
    { text: "GIẤY ỦY QUYỀN", x: 450, anchor: "middle", bold: true, size: 24, gap: 70 },
    { text: "Số: 08/2026/UQ-KA", x: 450, anchor: "middle", italic: true, gap: 30 },
    { text: `Bên ủy quyền: ${SUBJECT.shop}`, bold: true, gap: 50 }, { text: "Mã số doanh nghiệp: 0316789012", x: 110 },
    { text: "Người đại diện: Bà TRẦN THỊ KHẢ ÁI - Giám đốc", x: 110 },
    { text: "Bên được ủy quyền: Bà LÊ MINH CHÂU", bold: true, gap: 40 }, { text: "Chức danh: Kế toán trưởng", x: 110 },
    { text: "Nội dung ủy quyền:", bold: true, gap: 40 },
    { text: "Thay mặt công ty nộp hồ sơ xác minh doanh nghiệp, cập nhật thông tin pháp lý", x: 110 },
    { text: "của cửa hàng Mỹ phẩm Khả Ái trên nền tảng SuperShip.", x: 110 },
    { text: "Thời hạn ủy quyền: từ ngày 01/10/2026 đến hết ngày 31/03/2027.", gap: 40 },
    { text: "Thành phố Hồ Chí Minh, ngày 01 tháng 10 năm 2026", x: 650, anchor: "middle", italic: true, gap: 50 },
    ...sign("NGƯỜI ỦY QUYỀN", "Trần Thị Khả Ái"),
  ]),
  "rep-da-1": paper([
    { text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", x: 450, anchor: "middle", bold: true, gap: 0 },
    { text: "Độc lập - Tự do - Hạnh phúc", x: 450, anchor: "middle", bold: true, under: true, gap: 26 },
    { text: "GIẤY ỦY QUYỀN", x: 450, anchor: "middle", bold: true, size: 24, gap: 70 },
    { text: "Số: 02/2026/UQ", x: 450, anchor: "middle", italic: true, gap: 30 },
    { text: "Bên ủy quyền: CÔNG TY CỔ PHẦN GIAO NHẬN ĐÔNG ANH", bold: true, gap: 50 }, { text: "Mã số doanh nghiệp: 0110456789", x: 110 },
    { text: "Người đại diện: Ông ĐẶNG QUỐC BẢO - Giám đốc", x: 110 },
    { text: "Bên được ủy quyền: Bà NGÔ THANH HÀ", bold: true, gap: 40 }, { text: "Chức danh: Phó Giám đốc", x: 110 },
    { text: "Nội dung ủy quyền:", bold: true, gap: 40 },
    { text: "Ký hợp đồng, biên bản đối soát với SuperShip.", x: 110 },
    { text: "Thời hạn ủy quyền: từ ngày 10/10/2026 đến hết ngày 31/12/2027.", gap: 40 },
    { text: "Hà Nội, ngày 09 tháng 10 năm 2026", x: 650, anchor: "middle", italic: true, gap: 50 },
    ...sign("NGƯỜI ỦY QUYỀN", "Đặng Quốc Bảo"),
  ]),
};

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
const CAPABILITIES = ["identity.view", "organization.view", "organization.legal_entity.view", "organization.legal_entity.view_sensitive",
  "organization.legal_entity.verify", "organization.representative.view", "shop.business_verification.view", "shop.business_verification.review"];

export interface VerificationSetup {
  /** No request waiting at all. */
  empty: boolean;
}
export interface VerificationMock extends VerificationSetup {
  pending: Pending[];
  /** Body of the last decision the server accepted. */
  input: any;
}
export interface VerificationContext extends FlowContext { mock: VerificationMock }

async function mockVerification(page: Page, log: (line: string) => void, mock: VerificationMock) {
  await mockPin(page, log, false);
  let challenges = 0;
  // Registered after mockPin, so it is asked first and falls back to it for the session and shell calls.
  await page.context().route("**/api/**", async (route: Route) => {
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
      if (code !== STEP_UP_CODE) { await fail(400, "MFA_INVALID_CODE", "Mã xác thực không đúng hoặc đã được sử dụng."); return false; }
      return true;
    };
    const file = (body: Buffer) => route.fulfill({ status: 200, headers: { "X-Browser-Session-Version": "1", "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store" }, body });
    const done = (target: string) => { mock.pending = mock.pending.filter(item => item.target_id !== target); };
    const unitName = (id: string) => UNITS.find(item => item.id === id)?.name ?? "";

    if (path === "/v1/me/capabilities") return send({
      context: { context_id: "pin-context", context_type: "SUPERPLATFORM", application_name: "SUPERPLATFORM", membership_id: "pin-member", organization_id: "pin-org" },
      assurance: { level: 2, mfa_verified: true, mfa_verified_at: NOW }, capabilities: CAPABILITIES.map(capability),
      revision: "capture", generated_at: NOW, expires_at: "2026-10-13T02:00:00.000Z",
    });
    if (path === "/v1/reasons/VERIFICATION_REJECT") return send({ function_code: "VERIFICATION_REJECT", reasons: REJECT_REASONS });
    if (path === "/v1/shops/list-options") return send({ internal_allowed: true, shops_allowed: false, types: [], statuses: [],
      franchises: [], post_offices: [], operation_models: [] });
    // Asked by the shell for "Tổ chức" (OrganizationDirectoryService.metadata of the corporation).
    if (path === "/v1/organizations/list-options") return send({ internal_allowed: true, shops_allowed: false,
      viewer_type: "CORPORATION", viewer_organization_id: "org-corp",
      tabs: [{ code: "FRANCHISE_PARTNER", name: "Nhượng quyền" }, { code: "POST_OFFICE", name: "Bưu cục" }],
      sorts: { FRANCHISE_PARTNER: [{ code: "created_desc", name: "Mới thêm trước" }], POST_OFFICE: [{ code: "created_desc", name: "Mới thêm trước" }] },
      page_sizes: [20, 50, 100], create_franchise: { available: true, enabled: true, disabled_reason: null },
      open_post_office: { available: false, enabled: false, disabled_reason: null }, empty_message: null,
      types: [{ code: "FRANCHISE_PARTNER", name: "Nhượng quyền" }, { code: "POST_OFFICE", name: "Bưu cục" }],
      statuses: [{ code: "ACTIVE", name: "Đang hoạt động" }], franchises: [], post_offices: [], operation_models: [] });

    /* VerificationRequestController: oldest first, searched by the unit's name or code and the subject's name. */
    if (path === "/v1/scope/verification-requests") {
      const type = url.searchParams.get("type");
      const term = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      const size = Number(url.searchParams.get("size") ?? 20), pageNo = Number(url.searchParams.get("page") ?? 0);
      const found = (mock.empty ? [] : mock.pending).filter(item => !term || [item.organization.name, item.organization.code, item.subject_name]
        .some(value => value.toLowerCase().includes(term)));
      const rows = found.filter(item => !type || item.type === type).sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
      const types = (Object.keys(TYPE_NAMES) as (keyof typeof TYPE_NAMES)[])
        .map(code => ({ code, name: TYPE_NAMES[code], count: found.filter(item => item.type === code).length }));
      return send({ items: rows.slice(pageNo * size, pageNo * size + size).map(item => ({ ...item, type_name: TYPE_NAMES[item.type],
        organization: item.organization })), page: pageNo, size, total: rows.length, types },
        200, rows.length ? "Yêu cầu xác minh." : "Không có yêu cầu nào đang chờ xác minh.");
    }

    /* The legal profile of a unit: what the panel reads, the files, the decisions. */
    const legal = path.match(/^\/v1\/organizations\/([^/]+)\/legal-profile(?:\/(options)|\/change-requests\/([^/]+)\/(verification|registration-document)|\/([^/]+)\/(verification|registration-document))?$/);
    if (legal) {
      const [, orgId, options, requestId, requestAction, profileId, profileAction] = legal;
      const view = LEGAL_VIEWS[orgId!];
      const name = unitName(orgId!);
      if (!view) return fail(404, "ORGANIZATION_NOT_FOUND", "Không tìm thấy đơn vị.");
      if (options) return send({ legal_forms: [], enterprise_types: [], verification_sources: SOURCES, replacement_basis_types: [], representatives_ending: [] });
      const waiting = mock.pending.find(item => item.target_id === (requestId ?? profileId));
      if (!requestId && !profileId && method === "GET") {
        const pending = view.pending && mock.pending.some(item => item.target_id === view.pending!.id) ? view.pending : null;
        return send({ organization_id: orgId, declared: true, current: view.current, notice: null, duplicate_warning: null, actions: {},
          pending_request: pending, last_rejection: null, skips_verification: true,
          verification_target: pending ? { kind: "LEGAL_CHANGE_REQUEST", id: pending.id, version: pending.version }
            : mock.pending.some(item => item.target_id === view.current.id) ? { kind: "LEGAL_PROFILE", id: view.current.id, version: 1 } : null }, 200, "Thông tin pháp lý.");
      }
      if (method === "GET" && (requestAction ?? profileAction) === "registration-document") {
        const summary = requestId ? `Xem giấy đăng ký trong yêu cầu thay đổi của ${name}. Lần xem này được ghi nhật ký.`
          : `Xem giấy đăng ký của ${name}. Lần xem này được ghi nhật ký.`;
        if (!(await stepUp("LEGAL_ENTITY_SENSITIVE_VIEW", summary))) return;
        return file(PAPERS[orgId!]!);
      }
      if (method === "POST") {
        const body = request.postDataJSON();
        const accepted = body.status === "VERIFIED";
        if (!waiting) return fail(409, "LEGAL_PROFILE_NOT_PENDING", "Thông tin pháp lý này không còn chờ xác minh. Hãy tải lại.");
        if (accepted && !SOURCES.some(item => item.code === body.source)) return fail(400, "ORGANIZATION_INPUT_INVALID", MESSAGES.sourceRequired, { source: MESSAGES.sourceRequired });
        if (!accepted && !REJECT_REASONS.some(item => item.code === body.reason_code)) return fail(400, "ORGANIZATION_INPUT_INVALID", "Hãy chọn lý do từ chối.", { reason_code: "Hãy chọn lý do từ chối." });
        const summary = requestId
          ? `${accepted ? "Xác minh" : "Từ chối"}${waiting.request_kind === "REPLACEMENT" ? " yêu cầu thay chủ thể pháp lý của " : " yêu cầu sửa thông tin pháp lý của "}${name}`
          : `${accepted ? "Xác minh" : "Từ chối xác minh"} thông tin pháp lý của ${name}`;
        if (!(await stepUp("LEGAL_ENTITY_VERIFY", summary))) return;
        done(waiting.target_id); mock.input = body;
        const ended = accepted && waiting.request_kind === "REPLACEMENT" ? (view.pending as any).replacement.representatives_to_end : [];
        return send({ id: view.current.id, verification_status: accepted ? "VERIFIED" : "REJECTED", version: 2, request_id: requestId ?? null,
          ended_representatives: ended }, 200, accepted ? MESSAGES.legalVerified : MESSAGES.legalRejected);
      }
    }

    /* A representative: its basis file and its decision. */
    const rep = path.match(/^\/v1\/organizations\/([^/]+)\/representatives\/([^/]+)\/(verification|basis-document)$/);
    if (rep) {
      const [, orgId, repId, action] = rep;
      const waiting = mock.pending.find(item => item.target_id === repId);
      const name = unitName(orgId!);
      if (action === "basis-document") {
        if (!PAPERS[repId!]) return fail(409, "REPRESENTATIVE_NO_DOCUMENT", "Người đại diện này chưa có tệp căn cứ.");
        if (!(await stepUp("LEGAL_ENTITY_SENSITIVE_VIEW", `Xem tệp căn cứ của người đại diện ${waiting?.subject_name} của ${name}`))) return;
        return file(PAPERS[repId!]!);
      }
      const body = request.postDataJSON();
      if (!waiting) return fail(409, "REPRESENTATIVE_NOT_PENDING", "Người đại diện này không còn chờ xác minh. Hãy tải lại.");
      const accepted = body.status === "VERIFIED";
      if (!(await stepUp("REPRESENTATIVE_VERIFY", `${accepted ? "Xác minh" : "Từ chối xác minh"} người đại diện ${waiting.subject_name} của ${name}`))) return;
      done(waiting.target_id); mock.input = body;
      return send({ organization_id: orgId, representative: null, message: accepted ? MESSAGES.repVerified : MESSAGES.repRejected },
        200, accepted ? MESSAGES.repVerified : MESSAGES.repRejected);
    }

    /* A Shop's business verification (ShopBusinessReviewController). */
    const shop = path.match(/^\/v1\/internal\/shops\/business-verifications\/([^/]+)(?:\/(decision)|\/documents\/(certificate|authorization))?$/);
    if (shop) {
      const [, id, decision, document] = shop;
      const review = SHOP_REVIEWS[id!];
      if (!review) return fail(404, "BUSINESS_VERIFICATION_NOT_FOUND", "Không tìm thấy hồ sơ.");
      if (document) return file(PAPERS[document === "authorization" ? `${id}-authorization` : id!]!);
      if (decision) {
        const body = request.postDataJSON();
        const accepted = body.status === "VERIFIED";
        if (accepted && SHOP_CHECKS.some(check => !(body.checks ?? []).includes(check.code))) return fail(400, "INVALID_INPUT", "Hãy tích đủ các điểm kiểm.", { checks: "Hãy tích đủ các điểm kiểm." });
        if (accepted && !body.source) return fail(400, "INVALID_INPUT", "Hãy chọn nguồn đã tra.", { source: "Hãy chọn nguồn đã tra." });
        if (!accepted && body.reason_code === "OTHER" && !String(body.reason_text ?? "").trim()) return fail(400, "INVALID_INPUT", "Hãy nhập lý do từ chối.", { reason_text: "Hãy nhập lý do từ chối." });
        if (!(await stepUp("SHOP_BUSINESS_VERIFICATION_REVIEW", `${accepted ? "Duyệt" : "Từ chối"} giấy phép kinh doanh của ${review.shop.name}`))) return;
        done(id!); mock.input = body;
        return send({ message: accepted ? MESSAGES.shopApproved : MESSAGES.shopRejected, request_id: id, status: accepted ? "APPROVED" : "REJECTED" },
          200, accepted ? MESSAGES.shopApproved : MESSAGES.shopRejected);
      }
      return send({
        id, version: 1, status: "PENDING", status_name: "Chờ duyệt", shop: { id: review.shop.id, code: review.shop.code, name: review.shop.name },
        kind: review.kind[0], kind_name: review.kind[1],
        fields: review.fields.map(([field, field_name, value, read]) => ({ field, field_name, value, read_value: read ?? null, edited: read !== undefined })),
        representative_match: "MATCHED", representative_match_name: "Khớp người đã xác minh", submitter_name: review.submitter, submitter_role: review.role,
        submitted_at: review.at, has_authorization: Boolean(review.authorization), authorization_expires_on: review.authorization,
        warnings: review.warnings.map(([code, name]) => ({ code, name })), checks: SHOP_CHECKS,
        sources: SOURCES.slice(0, 2), rejection_reasons: SHOP_REJECT_REASONS, lookups: LOOKUPS, can_decide: true, cannot_decide_reason: null,
        decided_by_name: null, decided_at: null, rejection_reason: null,
      });
    }
    return route.fallback();
  });
}

/* ---- Flow wrapper ---- */

export function verificationFlow({ id, name, setup = {}, run }: {
  id: string; name: string; setup?: Partial<VerificationSetup>; run: (ctx: VerificationContext) => Promise<void>;
}) {
  return defineFlow({
    id: `superplatform-yeu-cau-xac-minh-${id}`, name, app: "superplatform", group: GROUP,
    async run(ctx) {
      const mock: VerificationMock = { empty: false, ...setup, pending: pendingRequests(), input: null };
      await mockVerification(ctx.page, ctx.log, mock);
      await run({ ...ctx, mock });
    },
  });
}

/* ---- Pages and controls ---- */

/** Moves the pointer off the page's buttons, so no hover state or dev corner button shows. */
export async function rest(page: Page) {
  await page.mouse.move(1, 1);
}
/** The list loaded: its first row, or the empty state. */
export async function listLoaded(page: Page) {
  await page.getByRole("heading", { level: 1, name: "Yêu cầu xác minh", exact: true }).waitFor();
  await page.locator("tbody tr").filter({ hasText: /\S/ }).first().or(page.getByText(/^Không có yêu cầu (chờ xác minh|phù hợp)$/)).first().waitFor();
  await page.locator("[aria-busy='true']").first().waitFor({ state: "detached" }).catch(() => {});
}
/** The workspace home, its sidebar entry "Yêu cầu xác minh" shown with its count. */
export async function openHome(page: Page) {
  await page.goto("/workspace");
  await page.getByRole("heading", { level: 1, name: "Trang chủ", exact: true }).waitFor();
  await navEntry(page).waitFor();
}
export const navEntry = (page: Page) => page.getByRole("link", { name: /^Yêu cầu xác minh/ }).first();
/** Home, then the sidebar entry: the list of every waiting request. */
export async function openFromMenu(page: Page) {
  await navEntry(page).click();
  await page.waitForURL(`**${LIST_URL}`);
  await listLoaded(page);
}
/** Straight to the list (the starting screen of a flow that acts on a request). */
export async function openList(page: Page) {
  await page.goto(LIST_URL);
  await listLoaded(page);
}
export const row = (page: Page, subject: string) => page.locator("tbody tr").filter({ hasText: subject });
/** Clicks a row on its subject's name: the panel of that request. */
export async function openRequest(page: Page, subject: string): Promise<Locator> {
  await row(page, subject).getByText(subject, { exact: true }).first().click();
  const panel = page.getByRole("dialog", { name: subject, exact: true });
  await panel.waitFor();
  return panel;
}
/** "Loại yêu cầu" tab of the filter. */
export const typeTab = (page: Page, name: string) => page.getByRole("group", { name: "Loại yêu cầu" }).getByRole("button", { name: new RegExp(`^${name}\\s*\\d+$`) });
export const searchBox = (page: Page) => page.getByRole("searchbox", { name: "Tìm yêu cầu" }).or(page.getByRole("textbox", { name: "Tìm yêu cầu" })).first();
export const dialogNamed = (page: Page, name: string) => page.getByRole("dialog", { name, exact: true }).or(page.getByRole("alertdialog", { name, exact: true })).first();
/** After a decision: the panel gone, the row gone from the list, the server's sentence on screen. */
export async function decided(page: Page, subject: string, message: string) {
  await page.getByRole("status").filter({ hasText: message }).first().waitFor();
  await page.locator(".verification-panel-layer").waitFor({ state: "detached" });
  await row(page, subject).waitFor({ state: "detached" });
}
/** A file viewer opened from the panel, its picture drawn. */
export async function viewerShown(page: Page, title: string) {
  const viewer = page.getByRole("dialog", { name: title, exact: true });
  const picture = viewer.getByRole("img", { name: title });
  await picture.waitFor();
  await picture.evaluate(node => (node as HTMLImageElement).decode());
  return viewer;
}
/** The code dialog of a sensitive action, the code typed (not sent yet). */
export async function typeCode(page: Page) {
  await page.locator('[id="step-up-code"]').waitFor();
  await page.locator('[id="step-up-code"]').fill(STEP_UP_CODE);
}
/** Sends the typed code. */
export async function sendCode(page: Page) {
  await page.getByRole("dialog", { name: "Xác nhận thao tác" }).getByRole("button", { name: "Xác nhận", exact: true }).click();
}
/** Opens the custom list of the Select inside `scope` (a dialog's reason list) and waits for `option`. */
export async function openChoices(page: Page, scope: Locator, option: string) {
  const id = await scope.locator("select").first().getAttribute("id");
  await page.locator(`select[id="${id}"] + [role="combobox"]`).click();
  await page.locator(`[id="${id}-options-list"]`).getByRole("option", { name: option, exact: true }).waitFor();
  return id!;
}
/** Scrolls the nearest scrolling box so `target` sits near its top. */
export async function scrollTo(target: Locator) {
  await target.evaluate(node => {
    (document.activeElement as HTMLElement | null)?.blur();
    let box: HTMLElement | null = node.parentElement;
    while (box && !(box.scrollHeight > box.clientHeight && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
    if (box) box.scrollTop += node.getBoundingClientRect().top - box.getBoundingClientRect().top - 16;
  });
}
