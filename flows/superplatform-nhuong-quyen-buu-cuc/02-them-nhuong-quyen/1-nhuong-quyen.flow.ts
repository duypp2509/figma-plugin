import { expect } from "playwright/test";
import {
  LOGO_SVG, MESSAGES, NEW_FRANCHISE, choose, codeDialog, confirm, confirmDialog, created, creationFlow, enterCode, field, fillAddress,
  fillEnterprise, fillFranchise, fillFranchiseContacts, fillGeneral, fillRepresentative, openFranchiseForm, openList, pickDate,
  scrollToSection, scrollTop, submit, submitButton, waitCode,
} from "../../_helpers/superplatform-organization-creation";

const CONFIRM_TITLE = "Thêm đối tác nhượng quyền?";

/** A logo drawn in the page, so the picture needs no file on disk. */
async function logo(page: import("playwright").Page) {
  const data = await page.evaluate(async svg => {
    const image = new Image(); image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 320;
    canvas.getContext("2d")!.drawImage(image, 0, 0, 320, 320);
    return canvas.toDataURL("image/png").split(",")[1]!;
  }, LOGO_SVG);
  return { name: "logo-ha-dong.png", mimeType: "image/png", buffer: Buffer.from(data, "base64") };
}
/** A one-page PDF standing in for the scanned registration certificate. */
const certificate = { name: "giay-dang-ky-doanh-nghiep.pdf", mimeType: "application/pdf",
  // Padded to the size of a real scan so the picker shows a believable file size.
  buffer: Buffer.concat([Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"), Buffer.alloc(1_258_291, 0x20)]) };

async function submitAndConfirm(page: import("playwright").Page) {
  await submit(page);
  await confirmDialog(page, CONFIRM_TITLE).waitFor();
  await confirm(page, CONFIRM_TITLE, "Thêm");
  await waitCode(page);
}

export default [
  creationFlow("nhuong-quyen", {
    id: "thanh-cong", name: "01. THÊM NHƯỢNG QUYỀN LÀ DOANH NGHIỆP",
    async run({ page, shot, mock }) {
      await openList(page);
      await shot("danh-sach", "Danh sách tổ chức, thẻ Nhượng quyền");
      await openFranchiseForm(page, true);
      await shot("form-trong", "Form thêm đối tác nhượng quyền", { mode: "fullPage" });

      await fillGeneral(page);
      await page.locator('[id="logo"]').setInputFiles(await logo(page));
      const crop = page.getByRole("dialog", { name: "Cắt logo" });
      await crop.getByRole("button", { name: "Xác nhận", exact: true }).click();
      await crop.waitFor({ state: "hidden" });
      await fillEnterprise(page);
      await page.locator('[id="registration_document"]').setInputFiles(certificate);
      await fillRepresentative(page, 0, "Nguyễn Văn An", "Giám đốc", "2023-05-16");
      await page.getByRole("button", { name: "Thêm người đại diện", exact: true }).click();
      await fillRepresentative(page, 1, "Trần Thị Mai", "Chủ tịch Hội đồng thành viên", "2023-05-16");
      await fillFranchiseContacts(page);
      await field(page, "contacts.WEBSITE").fill("https://vanchuyenhadong.vn");
      await fillAddress(page, "office_address", "Tầng 3, số 8 Tố Hữu", "Phường Kiến Hưng");
      await scrollTop(page);
      await shot("da-nhap", "Đã nhập đủ năm mục", { mode: "fullPage" });

      await submit(page);
      await confirmDialog(page, CONFIRM_TITLE).waitFor();
      await shot("xac-nhan", "Kiểm tra lại trước khi thêm");
      await confirm(page, CONFIRM_TITLE, "Thêm");
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");
      await enterCode(page);
      await created(page, NEW_FRANCHISE.saved);
      await shot("ho-so", "Đã thêm, mở trang nhượng quyền");
      expect(mock.writes).toBe(1);
      expect(mock.logo && mock.document).toBe(true);
      expect(mock.input.representatives).toHaveLength(2);
    },
  }),
  creationFlow("nhuong-quyen", {
    id: "ca-nhan", name: "02. THÊM NHƯỢNG QUYỀN LÀ CÁ NHÂN",
    async run({ page, shot, mock }) {
      await openFranchiseForm(page);
      await fillGeneral(page);
      await page.getByRole("radio", { name: "Cá nhân", exact: true }).check();
      await field(page, "legal.registered_name").waitFor();
      await scrollTop(page);
      await shot("chon-ca-nhan", "Cá nhân: số định danh 12 số, không có người đại diện, không có tệp giấy đăng ký", { mode: "fullPage" });

      await field(page, "legal.registered_name").fill("Nguyễn Thị Hồng Nhung");
      await field(page, "legal.registration_number").fill("001190012345");
      await fillAddress(page, "legal.address", "Số 7 ngõ 42 Trần Phú", "Phường Hà Đông");
      await field(page, "legal.head_office_phone").fill("0983 216 457");
      await field(page, "legal.invoice_email").fill("hongnhung.hd@gmail.com");
      await fillFranchiseContacts(page, { phone: "0983 216 457", email: "" });
      await scrollTop(page);
      await shot("da-nhap", "Đã nhập; số định danh được che khi rời ô", { mode: "fullPage" });

      await submitAndConfirm(page);
      await enterCode(page);
      await created(page, NEW_FRANCHISE.saved);
      await shot("ho-so", "Đã thêm nhượng quyền cá nhân");
      expect(mock.input.legal.legal_form).toBe("INDIVIDUAL");
      expect(mock.input.representatives).toHaveLength(0);
    },
  }),
  creationFlow("nhuong-quyen", {
    id: "ho-kinh-doanh", name: "03. THÊM NHƯỢNG QUYỀN LÀ HỘ KINH DOANH",
    async run({ page, shot, mock }) {
      await openFranchiseForm(page);
      await fillGeneral(page);
      await page.getByRole("radio", { name: "Hộ kinh doanh", exact: true }).check();
      await field(page, "legal.registered_name").fill("HỘ KINH DOANH VẬN CHUYỂN HÀ ĐÔNG");
      await field(page, "legal.registration_number").fill("001085004321");
      await field(page, "legal.household_owner_name").fill("Phạm Văn Hùng");
      await field(page, "legal.certificate_number").fill("01G8012345");
      await pickDate(page, "legal.certificate_issued_on", "2024-03-05");
      await field(page, "legal.certificate_issuer").fill("Phòng Kinh tế, Hạ tầng và Đô thị phường Hà Đông");
      await fillAddress(page, "legal.address", "Số 25 đường Quang Trung");
      await field(page, "legal.invoice_email").fill("ketoan.hkdhadong@gmail.com");
      await pickDate(page, "representatives.0.start_date", "2024-03-05");
      await expect(field(page, "representatives.0.full_name")).toHaveValue("Phạm Văn Hùng");
      await scrollToSection(page, "#step-representatives");
      await shot("nguoi-dai-dien-la-chu-ho", "Người đại diện là chủ hộ, căn cứ điền sẵn theo giấy đăng ký");

      await fillFranchiseContacts(page, { phone: "0904 518 236", email: "" });
      await submitAndConfirm(page);
      await enterCode(page);
      await created(page, NEW_FRANCHISE.saved);
      await shot("ho-so", "Đã thêm nhượng quyền hộ kinh doanh");
      expect(mock.input.representatives[0]).toMatchObject({ full_name: "Phạm Văn Hùng", position_title: "Chủ hộ kinh doanh",
        basis_document_type: "HOUSEHOLD_REGISTRATION_CERTIFICATE", basis_document_number: "01G8012345" });
    },
  }),
  creationFlow("nhuong-quyen", {
    id: "nhap-lieu", name: "04. NHẬP THIẾU HOẶC SAI THÔNG TIN",
    async run({ page, shot, mock }) {
      await openFranchiseForm(page);
      await submit(page);
      await page.getByText("Hãy nhập tên đơn vị.", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("bo-trong", "Bấm Thêm khi chưa nhập: báo dưới từng ô, chấm đỏ ở mục có lỗi", { mode: "fullPage" });

      await fillGeneral(page);
      await field(page, "email_domain").fill("gmail.com");
      await fillEnterprise(page, { number: "0109876543001", phone: "024 33" });
      await fillRepresentative(page, 0, "Nguyễn Văn An", "Giám đốc", "2023-05-16");
      await fillFranchiseContacts(page, { email: "dieuhanh@vanchuyenhadong" });
      await submit(page);
      await page.getByText("Mã số doanh nghiệp gồm 10 chữ số. Mã 13 số là của chi nhánh, không nhập ở đây.", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("sai-dinh-dang", "Tên miền công cộng, mã số 13 số, số điện thoại và Email sai định dạng", { mode: "fullPage" });

      await choose(page, "legal.address.province_code", "Thành phố Hồ Chí Minh");
      await expect(page.locator('[data-field="legal.address.ward_code"] [role="combobox"]')).toContainText("Chọn Phường/ Xã");
      await scrollToSection(page, '[data-field="legal.address.ward_code"]');
      await shot("doi-tinh", "Đổi tỉnh: phường, xã đã chọn bị xóa");

      await page.getByRole("radio", { name: "Hộ kinh doanh", exact: true }).click();
      await page.getByRole("heading", { name: "Đổi hình thức pháp lý?", exact: true }).waitFor();
      await shot("doi-hinh-thuc", "Đổi hình thức pháp lý: hỏi trước khi xóa các ô không dùng");
      expect(mock.writes).toBe(0);
    },
  }),
  creationFlow("nhuong-quyen", {
    id: "may-chu-tu-choi", name: "05. MÁY CHỦ TỪ CHỐI",
    setup: { rejections: [
      { status: 400, code: "ORGANIZATION_INPUT_INVALID", message: MESSAGES.domainTaken, fields: { email_domain: MESSAGES.domainTaken } },
      { status: 400, code: "ORGANIZATION_INPUT_INVALID", message: MESSAGES.wardOutside, fields: { "legal.address.ward_code": MESSAGES.wardOutside } },
    ] },
    async run({ page, shot, mock }) {
      await openFranchiseForm(page);
      await fillFranchise(page);
      await field(page, "email_domain").fill("vanchuyenhadong.vn");
      await submit(page);
      await confirm(page, CONFIRM_TITLE, "Thêm");
      await page.getByText(MESSAGES.domainTaken).first().waitFor();
      await shot("ten-mien-da-dung", "Tên miền Email công ty đã được dùng cho đơn vị khác");

      await field(page, "email_domain").fill("");
      await submit(page);
      await confirm(page, CONFIRM_TITLE, "Thêm");
      await page.getByText(MESSAGES.wardOutside).first().waitFor();
      await shot("phuong-xa-sai-tinh", "Phường, xã không thuộc tỉnh đã chọn");
      expect(mock.writes).toBe(0);
    },
  }),
  creationFlow("nhuong-quyen", {
    id: "ma-xac-thuc", name: "06. MÃ XÁC THỰC SAI, HỦY XÁC THỰC",
    async run({ page, shot, mock }) {
      await openFranchiseForm(page);
      await fillFranchise(page);
      await submitAndConfirm(page);
      await enterCode(page, "111111");
      await codeDialog(page).getByText(MESSAGES.wrongCode).waitFor();
      await shot("ma-sai", "Mã xác thực sai: nhập lại");

      await page.keyboard.press("Escape");
      await codeDialog(page).waitFor({ state: "hidden" });
      await expect(field(page, "name")).toHaveValue(NEW_FRANCHISE.name);
      await expect(submitButton(page)).toBeEnabled();
      await shot("huy-xac-thuc", "Hủy xác thực: giữ thông tin đã nhập");
      expect(mock.writes).toBe(0);
    },
  }),
  creationFlow("nhuong-quyen", {
    id: "roi-trang", name: "07. RỜI TRANG KHI ĐANG NHẬP",
    async run({ page, shot }) {
      await openFranchiseForm(page);
      await field(page, "name").fill(NEW_FRANCHISE.name);
      await page.getByRole("link", { name: "Hủy", exact: true }).click();
      await page.getByRole("alertdialog", { name: "Bỏ những gì đã nhập?" }).waitFor();
      await shot("xac-nhan-roi-trang", "Hỏi trước khi bỏ thông tin đã nhập");
      await page.getByRole("button", { name: "Ở lại", exact: true }).click();
      await expect(field(page, "name")).toHaveValue(NEW_FRANCHISE.name);
      await shot("o-lai", "Ở lại: giữ thông tin đã nhập");
    },
  }),
];
