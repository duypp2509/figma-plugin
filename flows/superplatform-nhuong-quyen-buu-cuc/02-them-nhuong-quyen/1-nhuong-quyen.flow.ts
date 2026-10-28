import { expect } from "playwright/test";
import {
  CERTIFICATES, LOGO_SVG, MESSAGES, NEW_FRANCHISE, choose, codeDialog, confirm, confirmDialog, created, creationFlow,
  enterCode, expandMore, field, fillAddress, fillEnterprise, fillFranchise, fillFranchiseContacts, fillGeneral, fillOffice,
  fillRepresentative, goBack, openFranchiseForm, openList, pickDate, scrollToSection, scrollTop, sentForApproval, submit, submitButton,
  uploadCertificate, waitCode, type CreationContext,
} from "../../_helpers/superplatform-organization-creation";

const CONFIRM_TITLE = "Thêm đối tác nhượng quyền?";
/**
 * The app's top progress bar starts on the click of "Hủy" although the unsaved-changes guard keeps the page, and stays
 * there (RouteProgress waits for a new path): left out of these pictures, reported apart.
 */
const ROUTE_PROGRESS = '[role="status"][aria-label="Đang tải trang"]';
const TYPED_NAME = new RegExp(`^${NEW_FRANCHISE.name}$`, "i");

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

/** The road every flow starts on: the list, then "Thêm đối tác nhượng quyền" opens the empty form. */
async function startFromList({ page, shot }: CreationContext) {
  await openList(page);
  await shot("danh-sach", "Danh sách tổ chức, thẻ Nhượng quyền");
  await openFranchiseForm(page);
  await shot("form-trong", "Bấm Thêm đối tác nhượng quyền: form trống", { mode: "fullPage" });
}

/** "Thêm" on the filled form: the summary to check, then "Thêm" in it. */
async function pressAdd({ page, shot }: CreationContext) {
  await submit(page);
  await confirmDialog(page, CONFIRM_TITLE).waitFor();
  await shot("xac-nhan", "Bấm Thêm: kiểm tra lại trước khi thêm");
  await confirm(page, CONFIRM_TITLE, "Thêm");
}

/** "Thêm" accepted: the code is asked, then the new franchise's page opens. */
async function confirmWithCode(ctx: CreationContext, done: string) {
  const { page, shot } = ctx;
  await pressAdd(ctx);
  await waitCode(page);
  await shot("ma-xac-thuc", "Nhập mã xác thực");
  await enterCode(page);
  await created(page, NEW_FRANCHISE.saved);
  await shot("ho-so", done);
}

export default [
  creationFlow("nhuong-quyen", {
    id: "thanh-cong", name: "THÊM NHƯỢNG QUYỀN LÀ DOANH NGHIỆP",
    async run(ctx) {
      const { page, shot, mock } = ctx;
      await startFromList(ctx);

      await fillGeneral(page);
      await field(page, "logo").setInputFiles(await logo(page));
      const crop = page.getByRole("dialog", { name: "Cắt logo" });
      await crop.getByRole("button", { name: "Xác nhận", exact: true }).waitFor();
      await shot("cat-logo", "Chọn logo: cắt ảnh rồi Xác nhận");
      await crop.getByRole("button", { name: "Xác nhận", exact: true }).click();
      await crop.waitFor({ state: "hidden" });
      await uploadCertificate(page);
      await scrollToSection(page, "#step-legal");
      await shot("doc-giay-dang-ky", "Tải giấy đăng ký: tự điền thông tin pháp lý");

      await fillEnterprise(page);
      await fillRepresentative(page, 0, "Nguyễn Văn An", "Giám đốc", "2023-05-16");
      await page.getByRole("button", { name: "Thêm người đại diện", exact: true }).click();
      await fillRepresentative(page, 1, "Trần Thị Mai", "Chủ tịch Hội đồng thành viên", "2023-05-16");
      await fillFranchiseContacts(page);
      await expandMore(page, "#step-contacts");
      await field(page, "contacts.WEBSITE").fill("https://vanchuyenhadong.vn");
      await fillOffice(page, "Tầng 3, số 8 Tố Hữu", "Phường Kiến Hưng");
      await scrollTop(page);
      await shot("da-nhap", "Đã nhập đủ năm mục", { mode: "fullPage" });

      await confirmWithCode(ctx, "Đã thêm, mở trang nhượng quyền");
      expect(mock.writes).toBe(1);
      expect(mock.logo && mock.document).toBe(true);
      expect(mock.input.representatives).toHaveLength(2);
      expect(mock.input.addresses.TRANSACTION_OFFICE).toBeTruthy();
    },
  }),
  creationFlow("nhuong-quyen", {
    id: "ca-nhan", name: "THÊM NHƯỢNG QUYỀN LÀ CÁ NHÂN",
    async run(ctx) {
      const { page, shot, mock } = ctx;
      await startFromList(ctx);

      await fillGeneral(page);
      // A person has no certificate: the legal form is chosen by hand.
      await page.getByRole("button", { name: "Chọn hình thức pháp lý", exact: true }).click();
      await page.getByRole("radio", { name: "Cá nhân", exact: true }).check();
      await field(page, "legal.registered_name").waitFor();
      await scrollTop(page);
      await shot("chon-ca-nhan", "Chọn hình thức Cá nhân: không có giấy đăng ký, không có người đại diện", { mode: "fullPage" });

      await field(page, "legal.registered_name").fill("Nguyễn Thị Hồng Nhung");
      await field(page, "legal.registration_number").fill("001190012345");
      await fillAddress(page, "legal.address", "Số 7 ngõ 42 Trần Phú", "Phường Hà Đông");
      await field(page, "legal.head_office_phone").fill("0983 216 457");
      await field(page, "legal.head_office_email").fill("hongnhung.hd@gmail.com");
      await field(page, "legal.invoice_email").fill("hongnhung.hd@gmail.com");
      await fillFranchiseContacts(page, { phone: "0983 216 457", email: "hongnhung.hd@gmail.com" });
      await scrollTop(page);
      await shot("da-nhap", "Đã nhập thông tin cá nhân", { mode: "fullPage" });

      await confirmWithCode(ctx, "Đã thêm nhượng quyền cá nhân, logo mặc định");
      expect(mock.input.legal.legal_form).toBe("INDIVIDUAL");
      expect(mock.input.representatives).toHaveLength(0);
      expect(mock.document).toBe(false);
    },
  }),
  creationFlow("nhuong-quyen", {
    id: "ho-kinh-doanh", name: "THÊM NHƯỢNG QUYỀN LÀ HỘ KINH DOANH",
    async run(ctx) {
      const { page, shot, mock } = ctx;
      await startFromList(ctx);

      await fillGeneral(page);
      await uploadCertificate(page, CERTIFICATES.household);
      await expect(field(page, "representatives.0.full_name")).toHaveValue("Phạm Văn Hùng");
      await field(page, "legal.head_office_email").fill("vanchuyenhadong.hkd@gmail.com");
      await field(page, "legal.invoice_email").fill("ketoan.hkdhadong@gmail.com");
      await pickDate(page, "representatives.0.start_date", "2024-03-05");
      await scrollToSection(page, "#step-representatives");
      await shot("nguoi-dai-dien-la-chu-ho", "Tải giấy đăng ký hộ kinh doanh: người đại diện là chủ hộ, căn cứ điền sẵn");

      await fillFranchiseContacts(page, { phone: "0904 518 236", email: "vanchuyenhadong.hkd@gmail.com" });
      await confirmWithCode(ctx, "Đã thêm nhượng quyền hộ kinh doanh");
      expect(mock.input.representatives[0]).toMatchObject({ full_name: "Phạm Văn Hùng", position_title: "Chủ hộ kinh doanh",
        basis_document_type: "HOUSEHOLD_REGISTRATION_CERTIFICATE", basis_document_number: "01G8012345" });
    },
  }),
  creationFlow("nhuong-quyen", {
    id: "nhap-lieu", name: "NHẬP THIẾU HOẶC SAI THÔNG TIN",
    async run(ctx) {
      const { page, shot, mock } = ctx;
      await startFromList(ctx);

      await submit(page);
      await page.getByText("Hãy nhập tên đơn vị.", { exact: true }).waitFor();
      // The form focuses its first refused field a frame later; let it, so scrollTop leaves no field in focus.
      await expect(field(page, "name")).toBeFocused();
      await scrollTop(page);
      await shot("bo-trong", "Bấm Thêm khi chưa nhập: báo dưới từng ô, chấm đỏ ở mục có lỗi", { mode: "fullPage" });

      await fillGeneral(page);
      await uploadCertificate(page);
      await field(page, "legal.registration_number").fill("0109876543001");
      await field(page, "legal.head_office_phone").fill("024 33");
      await fillRepresentative(page, 0, "Nguyễn Văn An", "Giám đốc", "2023-05-16");
      // The Website box first: leaving a wrong Email shows its error and moves the "Thông tin thêm" toggle.
      await expandMore(page, "#step-contacts");
      await field(page, "contacts.WEBSITE").fill("vanchuyenhadong.vn");
      await fillFranchiseContacts(page, { email: "dieuhanh@vanchuyenhadong" });
      await submit(page);
      await page.getByText("Mã số doanh nghiệp chưa hợp lệ.", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("sai-dinh-dang", "Nhập sai rồi bấm Thêm: mã số 13 số, số điện thoại, Email, Website sai; thiếu Email nhận hóa đơn", { mode: "fullPage" });

      await choose(page, "legal.address.province_code", "Thành phố Hồ Chí Minh");
      await expect(page.locator('[data-field="legal.address.ward_code"] [role="combobox"]')).toContainText("Chọn Phường/Xã/Đặc khu");
      await scrollToSection(page, '#step-legal h3:has-text("Địa chỉ trụ sở theo giấy đăng ký")');
      await shot("doi-tinh", "Đổi tỉnh: phường, xã đã chọn bị xóa");

      await page.getByRole("radio", { name: "Hộ kinh doanh", exact: true }).click();
      await page.getByRole("heading", { name: "Đổi hình thức pháp lý?", exact: true }).waitFor();
      await shot("doi-hinh-thuc", "Đổi hình thức pháp lý: hỏi trước khi xóa các ô không dùng");
      expect(mock.writes).toBe(0);
    },
  }),
  creationFlow("nhuong-quyen", {
    id: "may-chu-tu-choi", name: "MÃ SỐ ĐÃ DÙNG, PHƯỜNG XÃ SAI TỈNH",
    setup: { rejections: [
      { status: 400, code: "ORGANIZATION_INPUT_INVALID", message: MESSAGES.numberInUse, fields: { "legal.registration_number": MESSAGES.numberInUse } },
      { status: 400, code: "ORGANIZATION_INPUT_INVALID", message: MESSAGES.wardOutside, fields: { "legal.address.ward_code": MESSAGES.wardOutside } },
    ] },
    async run(ctx) {
      const { page, shot, mock } = ctx;
      await startFromList(ctx);

      await fillFranchise(page);
      await scrollTop(page);
      await shot("da-nhap", "Đã nhập đủ thông tin", { mode: "fullPage" });

      await pressAdd(ctx);
      await expect(page.locator('[data-field="legal.registration_number"]').getByText(MESSAGES.numberInUse)).toBeInViewport();
      await shot("ma-so-da-dung", "Bấm Thêm: mã số doanh nghiệp đã được dùng cho đơn vị khác");

      await field(page, "legal.registration_number").fill("0109876571");
      await submit(page);
      await confirm(page, CONFIRM_TITLE, "Thêm");
      // The app scrolls to the ward, but leaving its hidden native select re-checks it and drops the server's inline
      // sentence at once: the refusal stays in the action bar (reported as a web issue).
      await page.getByRole("alert").filter({ hasText: MESSAGES.wardOutside }).waitFor();
      await expect(page.locator('[data-field="legal.address.ward_code"]')).toBeInViewport();
      await shot("phuong-xa-sai-tinh", "Sửa mã số, bấm Thêm lại: phường, xã không thuộc tỉnh đã chọn");
      expect(mock.writes).toBe(0);
    },
  }),
  creationFlow("nhuong-quyen", {
    id: "ma-xac-thuc", name: "MÃ XÁC THỰC SAI, HỦY XÁC THỰC",
    async run(ctx) {
      const { page, shot, mock } = ctx;
      await startFromList(ctx);

      await fillFranchise(page);
      await scrollTop(page);
      await shot("da-nhap", "Đã nhập đủ thông tin", { mode: "fullPage" });

      await pressAdd(ctx);
      await waitCode(page);
      await shot("nhap-ma", "Hỏi mã xác thực");
      await enterCode(page, "111111");
      await codeDialog(page).getByText(MESSAGES.wrongCode).waitFor();
      await shot("ma-sai", "Nhập mã sai: báo lỗi, nhập lại");

      await codeDialog(page).getByRole("button", { name: "Đóng hộp thoại", exact: true }).click();
      await codeDialog(page).waitFor({ state: "hidden" });
      await expect(field(page, "name")).toHaveValue(TYPED_NAME);
      await expect(submitButton(page)).toBeEnabled();
      await shot("huy-xac-thuc", "Đóng hộp mã xác thực: giữ thông tin đã nhập");
      expect(mock.writes).toBe(0);
    },
  }),
  creationFlow("nhuong-quyen", {
    id: "roi-trang", name: "RỜI TRANG KHI ĐANG NHẬP",
    async run(ctx) {
      const { page, shot } = ctx;
      await startFromList(ctx);

      await field(page, "name").fill(NEW_FRANCHISE.name);
      await scrollTop(page);
      await shot("da-nhap-ten", "Đã nhập tên đơn vị");

      await page.getByRole("link", { name: "Hủy", exact: true }).click();
      await page.getByRole("alertdialog", { name: "Bỏ những gì đã nhập?" }).waitFor();
      await shot("xac-nhan-roi-trang", "Bấm Hủy: hỏi trước khi bỏ thông tin đã nhập", { hide: [ROUTE_PROGRESS] });
      await page.getByRole("button", { name: "Ở lại", exact: true }).click();
      await expect(field(page, "name")).toHaveValue(TYPED_NAME);
      await shot("o-lai", "Ở lại: giữ thông tin đã nhập", { hide: [ROUTE_PROGRESS] });
    },
  }),
  creationFlow("nhuong-quyen", {
    id: "gui-duyet", name: "GỬI YÊU CẦU CHỜ QUẢN TRỊ HỆ THỐNG DUYỆT", role: "support",
    async run(ctx) {
      const { page, shot, mock } = ctx;
      await startFromList(ctx);

      await fillFranchise(page);
      await scrollTop(page);
      await shot("da-nhap", "Đã nhập đủ thông tin", { mode: "fullPage" });

      await pressAdd(ctx);
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");
      await enterCode(page);
      await sentForApproval(page, "thêm", NEW_FRANCHISE.saved);
      await shot("da-gui-yeu-cau", "Đã gửi yêu cầu, chờ Quản trị hệ thống duyệt");

      await goBack(page, "Về danh sách tổ chức");
      await openFranchiseForm(page);
      await page.getByRole("complementary", { name: "Yêu cầu đang chờ duyệt" }).getByRole("link", { name: NEW_FRANCHISE.saved }).waitFor();
      await shot("dang-cho-duyet", "Về danh sách, bấm Thêm đối tác nhượng quyền lần nữa: yêu cầu đang chờ duyệt");
      expect(mock.created).toBeNull();
    },
  }),
  creationFlow("nhuong-quyen", {
    id: "giay-dang-ky", name: "GIẤY ĐĂNG KÝ SAI LOẠI TỆP, KHÔNG ĐỌC ĐƯỢC",
    async run(ctx) {
      const { page, shot, mock } = ctx;
      await startFromList(ctx);

      await field(page, "registration_document").setInputFiles({ name: "giay-dang-ky-doanh-nghiep.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.alloc(48_211, 0x20) });
      await page.locator('[data-field="registration_document"]').getByText("Hãy chọn tệp PDF, JPEG hoặc PNG, tối đa 5 MB.", { exact: true }).waitFor();
      await scrollToSection(page, "#step-legal");
      await shot("sai-loai-tep", "Chọn tệp Word: chỉ nhận PDF, JPEG, PNG tối đa 5 MB");

      await uploadCertificate(page, CERTIFICATES.scan);
      await page.getByRole("radio", { name: "Doanh nghiệp", exact: true }).waitFor();
      await scrollToSection(page, "#step-legal");
      await shot("khong-doc-duoc", "Chọn ảnh chụp không đọc được: nhập tay hoặc đọc lại");
      expect(mock.uploads).toEqual([CERTIFICATES.scan]);
    },
  }),
];
