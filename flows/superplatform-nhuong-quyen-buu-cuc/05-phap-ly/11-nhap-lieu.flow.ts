import { expect } from "playwright/test";
import {
  LONG_BIEN, dialog, field, legalButton, legalFlow, openLegal, pick, press, scrollToElement,
} from "../../_helpers/superplatform-legal-profile";

const TITLE = "Khai báo thông tin pháp lý";

export default [
  legalFlow({
    id: "nhap-lieu", name: "11. NHẬP THIẾU HOẶC SAI THÔNG TIN",
    async run({ page, shot, mock }) {
      await openLegal(page, LONG_BIEN);
      await legalButton(page, "Khai báo").first().click();
      const box = dialog(page, TITLE);
      await pick(page, "legal_form", "Doanh nghiệp");
      await press(box.getByRole("button", { name: "Khai báo", exact: true }));
      await box.getByText("Hãy chọn loại hình doanh nghiệp.", { exact: true }).waitFor();
      await scrollToElement(page, 'label[for="legal_form"]');
      await shot("bo-trong", "Bấm Khai báo khi chưa nhập: báo dưới từng ô");

      await pick(page, "enterprise_type", "Công ty TNHH một thành viên");
      await field(page, "registered_name").fill("CÔNG TY TNHH GIAO VẬN LONG BIÊN");
      await field(page, "registration_number").fill("0108765432001");
      await field(page, "head_office_phone").fill("024 387");
      await field(page, "invoice_email").fill("ketoan@giaovanlongbien");
      await press(box.getByRole("button", { name: "Khai báo", exact: true }));
      await box.getByText("Mã số doanh nghiệp gồm 10 chữ số. Mã 13 số là của chi nhánh, không nhập ở đây.", { exact: true }).waitFor();
      await scrollToElement(page, 'label[for="registered_name"]');
      await shot("ma-so-13-so", "Nhập mã 13 số của chi nhánh: báo mã số doanh nghiệp gồm 10 chữ số");
      await scrollToElement(page, '[id="head_office_phone"]');
      await box.getByText("Email nhận hóa đơn không hợp lệ.", { exact: true }).waitFor();
      await shot("sai-dinh-dang", "Số điện thoại và Email nhận hóa đơn sai định dạng");

      // The choice waits for the confirmation, so the field keeps "Doanh nghiệp" until "Đổi".
      await page.locator('select[id="legal_form"] + [role="combobox"]').click();
      await page.locator('[id="legal_form-options-list"]').getByRole("option", { name: "Cá nhân", exact: true }).click();
      const change = dialog(page, "Đổi hình thức pháp lý?");
      await change.waitFor();
      await shot("doi-hinh-thuc", "Đổi hình thức khi đã nhập: hỏi trước khi xóa các ô không dùng");
      await change.getByRole("button", { name: "Hủy", exact: true }).or(change.getByRole("button", { name: "Đóng" })).first().click();
      await change.waitFor({ state: "hidden" });

      await box.getByRole("button", { name: "Hủy", exact: true }).last().click();
      const discard = dialog(page, "Bỏ những gì đã nhập?");
      await discard.waitFor();
      await shot("bo-nhap", "Đóng hộp khi đang nhập dở: hỏi bỏ những gì đã nhập");
      expect(mock.writes).toBe(0);
    },
  }),
];
