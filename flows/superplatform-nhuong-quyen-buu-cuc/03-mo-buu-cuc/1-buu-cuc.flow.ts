import { expect } from "playwright/test";
import {
  MESSAGES, confirm, confirmDialog, created, creationFlow, enterCode, field, fillPostOffice, goBack, openChoice,
  openPostOfficeButton, openPostOfficeForm, openPostOffices, scrollToSection, scrollTop, sentForApproval, submit, waitCode,
  type CreationContext,
} from "../../_helpers/superplatform-organization-creation";

const CONFIRM_TITLE = "Mở bưu cục?";
const SAVED = "BƯU CỤC VĂN QUÁN";

/** The road every flow starts on: the franchise's "Bưu cục" tab, then "Mở bưu cục" opens the empty form. */
async function startFromList({ page, shot }: CreationContext) {
  await openPostOffices(page);
  await shot("danh-sach-buu-cuc", "Thẻ Bưu cục của nhượng quyền");
  await openPostOfficeForm(page);
  await shot("form-trong", "Bấm Mở bưu cục: form trống", { mode: "fullPage" });
}

/** The filled form, as a full page. */
async function filled({ page, shot }: CreationContext) {
  await fillPostOffice(page);
  await scrollTop(page);
  await shot("da-nhap", "Đã nhập đủ thông tin, khung Bưu cục mới cập nhật theo", { mode: "fullPage" });
}

/** "Mở bưu cục" on the filled form: the summary to check, then "Mở bưu cục" in it. */
async function pressOpen({ page, shot }: CreationContext) {
  await submit(page, "Mở bưu cục");
  await confirmDialog(page, CONFIRM_TITLE).waitFor();
  await shot("xac-nhan", "Bấm Mở bưu cục: kiểm tra lại trước khi mở");
  await confirm(page, CONFIRM_TITLE, "Mở bưu cục");
}

export default [
  creationFlow("buu-cuc", {
    id: "quan-tri-thanh-cong", name: "QUẢN TRỊ HỆ THỐNG MỞ BƯU CỤC",
    async run(ctx) {
      const { page, shot, mock } = ctx;
      await startFromList(ctx);

      await page.getByRole("radio", { name: "Bưu cục giao nhận", exact: true }).check();
      await scrollToSection(page, "#step-model");
      await shot("chon-loai-hinh", "Chọn loại hình bưu cục");

      await fillPostOffice(page);
      await openChoice(page, "addresses.SERVICE_POINT.ward_code", "Phường Hà Đông");
      await page.keyboard.press("Escape");
      await scrollTop(page);
      await shot("da-nhap", "Đã nhập đủ thông tin, khung Bưu cục mới cập nhật theo", { mode: "fullPage" });

      await pressOpen(ctx);
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");
      await enterCode(page);
      await created(page, SAVED);
      await shot("ho-so", "Đã mở, vào trang bưu cục");
      expect(mock.input.operation_model).toBe("DELIVERY_PICKUP");
    },
  }),
  creationFlow("buu-cuc", {
    id: "quan-ly-khong-co-quyen", name: "QUẢN LÝ NHƯỢNG QUYỀN KHÔNG MỞ ĐƯỢC BƯU CỤC", role: "manager",
    async run({ page, shot }) {
      await openPostOffices(page);
      await expect(openPostOfficeButton(page)).toHaveCount(0);
      await shot("khong-co-nut", "Thẻ Bưu cục: không có nút Mở bưu cục");
    },
  }),
  creationFlow("buu-cuc", {
    id: "nhap-lieu", name: "NHẬP THIẾU THÔNG TIN",
    async run(ctx) {
      const { page, shot, mock } = ctx;
      await startFromList(ctx);

      await submit(page, "Mở bưu cục");
      await page.getByText("Hãy chọn loại hình bưu cục.", { exact: true }).waitFor();
      // The form focuses its first refused field a frame later; let it, so scrollTop leaves no field in focus.
      await expect(field(page, "name")).toBeFocused();
      await scrollTop(page);
      await shot("bo-trong", "Bấm Mở bưu cục khi chưa nhập: báo dưới từng ô", { mode: "fullPage" });
      expect(mock.writes).toBe(0);
    },
  }),
  creationFlow("buu-cuc", {
    id: "may-chu-tu-choi", name: "PHƯỜNG XÃ KHÔNG THUỘC TỈNH",
    setup: { rejections: [
      { status: 400, code: "ORGANIZATION_INPUT_INVALID", message: MESSAGES.wardOutside, fields: { "addresses.SERVICE_POINT.ward_code": MESSAGES.wardOutside } },
    ] },
    async run(ctx) {
      const { page, shot, mock } = ctx;
      await startFromList(ctx);
      await filled(ctx);

      await pressOpen(ctx);
      // The app scrolls to the ward, but leaving its hidden native select re-checks it and drops the server's inline
      // sentence at once: the refusal stays in the action bar (reported as a web issue).
      await page.getByRole("alert").filter({ hasText: MESSAGES.wardOutside }).waitFor();
      await expect(page.locator('[data-field="addresses.SERVICE_POINT.ward_code"]')).toBeInViewport();
      await shot("phuong-xa-sai-tinh", "Phường, xã không thuộc tỉnh đã chọn");
      expect(mock.writes).toBe(0);
    },
  }),
  creationFlow("buu-cuc", {
    id: "nhuong-quyen-tam-ngung", name: "NHƯỢNG QUYỀN ĐANG TẠM NGƯNG", setup: { franchiseStatus: "SUSPENDED" },
    async run({ page, shot }) {
      await openPostOffices(page);
      await expect(openPostOfficeButton(page)).toBeDisabled();
      await shot("danh-sach-buu-cuc", "Thẻ Bưu cục: nút Mở bưu cục bị khóa");

      // The reason is in the tooltip of the greyed button, shown on keyboard focus as on hover.
      await openPostOfficeButton(page).locator("xpath=..").focus();
      await page.getByRole("tooltip").getByText(MESSAGES.franchiseSuspended).waitFor();
      await shot("nut-bi-khoa", "Trỏ vào nút: lý do không mở được bưu cục");
    },
  }),
  creationFlow("buu-cuc", {
    id: "gui-duyet", name: "GỬI YÊU CẦU CHỜ QUẢN TRỊ HỆ THỐNG DUYỆT", role: "support",
    async run(ctx) {
      const { page, shot, mock } = ctx;
      await startFromList(ctx);
      await filled(ctx);

      await pressOpen(ctx);
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");
      await enterCode(page);
      await sentForApproval(page, "mở", SAVED);
      await shot("da-gui-yeu-cau", "Đã gửi yêu cầu, chờ Quản trị hệ thống duyệt");

      await goBack(page, "Về bưu cục");
      await openPostOfficeForm(page);
      await page.getByRole("complementary", { name: "Yêu cầu đang chờ duyệt" }).getByRole("link", { name: SAVED }).waitFor();
      await shot("dang-cho-duyet", "Về thẻ Bưu cục, bấm Mở bưu cục lần nữa: yêu cầu đang chờ duyệt");
      expect(mock.created).toBeNull();
    },
  }),
];
