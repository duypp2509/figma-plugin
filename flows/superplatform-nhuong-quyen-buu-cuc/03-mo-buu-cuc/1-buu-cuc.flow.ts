import { expect } from "playwright/test";
import {
  FRANCHISE, MESSAGES, confirm, confirmDialog, created, creationFlow, enterCode, field, fillPostOffice, openChoice,
  openPostOfficeButton, openPostOfficeForm, openPostOffices, scrollToSection, scrollTop, submit, submitButton, waitCode,
} from "../../_helpers/superplatform-organization-creation";

const CONFIRM_TITLE = "Mở bưu cục?";
const SAVED = "BƯU CỤC VĂN QUÁN";

async function submitAndConfirm(page: import("playwright").Page) {
  await submit(page, "Mở bưu cục");
  await confirmDialog(page, CONFIRM_TITLE).waitFor();
  await confirm(page, CONFIRM_TITLE, "Mở bưu cục");
}

export default [
  creationFlow("buu-cuc", {
    id: "quan-tri-thanh-cong", name: "01. QUẢN TRỊ HỆ THỐNG MỞ BƯU CỤC",
    async run({ page, shot, mock }) {
      await openPostOffices(page);
      await shot("danh-sach-buu-cuc", "Thẻ Bưu cục của nhượng quyền");
      await openPostOfficeForm(page, true);
      await shot("form-trong", "Form mở bưu cục", { mode: "fullPage" });

      await page.getByRole("radio", { name: "Bưu cục giao nhận", exact: true }).check();
      await scrollToSection(page, "#step-model");
      await shot("chon-loai-hinh", "Chọn loại hình bưu cục");

      await fillPostOffice(page);
      await openChoice(page, "addresses.SERVICE_POINT.ward_code", "Phường Hà Đông");
      await page.keyboard.press("Escape");
      await scrollTop(page);
      await shot("da-nhap", "Đã nhập đủ thông tin, khung Bưu cục mới cập nhật theo", { mode: "fullPage" });

      await submit(page, "Mở bưu cục");
      await confirmDialog(page, CONFIRM_TITLE).waitFor();
      await shot("xac-nhan", "Kiểm tra lại trước khi mở");
      await confirm(page, CONFIRM_TITLE, "Mở bưu cục");
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");
      await enterCode(page);
      await created(page, SAVED);
      await shot("ho-so", "Đã mở, vào trang bưu cục");
      expect(mock.input.operation_model).toBe("DELIVERY_PICKUP");
    },
  }),
  creationFlow("buu-cuc", {
    id: "quan-ly-khong-co-quyen", name: "02. QUẢN LÝ NHƯỢNG QUYỀN KHÔNG MỞ ĐƯỢC BƯU CỤC", role: "manager",
    async run({ page, shot }) {
      await openPostOffices(page);
      await expect(openPostOfficeButton(page)).toHaveCount(0);
      await shot("khong-co-nut", "Không có nút Mở bưu cục");
      await page.goto(`/workspace/organizations/${FRANCHISE.id}/post-offices/new`);
      await page.getByRole("heading", { name: "Bạn không có quyền truy cập", exact: true }).waitFor();
      await shot("mo-thang-trang", "Mở thẳng đường dẫn: không có quyền mở bưu cục");
    },
  }),
  creationFlow("buu-cuc", {
    id: "nhap-lieu", name: "03. NHẬP THIẾU THÔNG TIN",
    async run({ page, shot, mock }) {
      await openPostOfficeForm(page);
      await submit(page, "Mở bưu cục");
      await page.getByText("Hãy chọn loại hình bưu cục.", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("bo-trong", "Bấm Mở bưu cục khi chưa nhập: báo dưới từng ô", { mode: "fullPage" });
      expect(mock.writes).toBe(0);
    },
  }),
  creationFlow("buu-cuc", {
    id: "may-chu-tu-choi", name: "04. MÁY CHỦ TỪ CHỐI",
    setup: { rejections: [
      { status: 409, code: "FRANCHISE_NOT_ACTIVE", message: MESSAGES.franchiseSuspended },
      { status: 400, code: "ORGANIZATION_INPUT_INVALID", message: MESSAGES.wardOutside, fields: { "addresses.SERVICE_POINT.ward_code": MESSAGES.wardOutside } },
    ] },
    async run({ page, shot, mock }) {
      await openPostOfficeForm(page);
      await fillPostOffice(page);
      await submitAndConfirm(page);
      await page.getByText(MESSAGES.franchiseSuspended).first().waitFor();
      await shot("nhuong-quyen-tam-ngung", "Nhượng quyền vừa bị tạm ngưng");

      await field(page, "name").fill("Bưu cục Văn Quán");
      await submitAndConfirm(page);
      await page.getByText(MESSAGES.wardOutside).first().waitFor();
      await shot("phuong-xa-sai-tinh", "Phường, xã không thuộc tỉnh đã chọn");
      expect(mock.writes).toBe(0);
    },
  }),
  creationFlow("buu-cuc", {
    id: "nhuong-quyen-tam-ngung", name: "05. NHƯỢNG QUYỀN ĐANG TẠM NGƯNG", setup: { franchiseStatus: "SUSPENDED" },
    async run({ page, shot }) {
      await openPostOffices(page);
      await expect(openPostOfficeButton(page)).toBeDisabled();
      await page.getByText(MESSAGES.franchiseSuspended).first().waitFor();
      await shot("nut-bi-khoa", "Nút Mở bưu cục bị khóa, kèm lý do");
      await page.goto(`/workspace/organizations/${FRANCHISE.id}/post-offices/new`);
      await page.getByRole("heading", { name: "Không mở được bưu cục" }).waitFor();
      await shot("mo-thang-trang", "Mở thẳng đường dẫn: không mở được bưu cục");
    },
  }),
];
