import { expect } from "playwright/test";
import {
  LONG_BIEN, alertDialog, chooseFormCard, dialog, field, legalButton, legalFlow, openLegal, pick, press, scrollToElement,
} from "../../_helpers/superplatform-legal-profile";

const TITLE = "Khai báo thông tin pháp lý";

export default [
  legalFlow({
    id: "nhap-lieu", name: "NHẬP THIẾU HOẶC SAI THÔNG TIN",
    async run({ page, shot, mock }) {
      await openLegal(page, LONG_BIEN);
      await page.getByText("Chưa khai báo thông tin pháp lý", { exact: true }).waitFor();
      await shot("chua-khai-bao", "Đơn vị chưa khai báo thông tin pháp lý");

      await legalButton(page, "Khai báo").first().click();
      const box = dialog(page, TITLE);
      await box.getByText("Tải giấy đăng ký lên", { exact: true }).waitFor();
      await shot("hop-khai-bao", "Bấm Khai báo: hộp khai báo");

      // No certificate at hand: the legal form is chosen by hand, then every field is typed.
      await box.getByRole("button", { name: "Chọn hình thức pháp lý", exact: true }).click();
      await box.getByRole("radio", { name: "Doanh nghiệp", exact: true }).waitFor();
      await shot("chon-hinh-thuc", "Chưa có giấy đăng ký, bấm Chọn hình thức pháp lý để nhập tay");
      await chooseFormCard(box, "Doanh nghiệp");
      await field(page, "registered_name").waitFor();
      await shot("doanh-nghiep", "Chọn Doanh nghiệp: hiện các ô của doanh nghiệp");

      await press(box.getByRole("button", { name: "Khai báo", exact: true }));
      await box.getByText("Hãy chọn loại hình doanh nghiệp.", { exact: true }).waitFor();
      await box.getByText("Hãy chọn tệp giấy đăng ký.", { exact: true }).waitFor();
      await scrollToElement(page, '[data-field="registration_document"]');
      await shot("bo-trong", "Bấm Khai báo khi chưa nhập: báo dưới từng ô, kể cả giấy đăng ký");

      await pick(page, "enterprise_type", "Công ty TNHH một thành viên");
      await field(page, "registered_name").fill("CÔNG TY TNHH GIAO VẬN LONG BIÊN");
      await field(page, "registration_number").fill("0108765432001");
      await field(page, "head_office_phone").fill("024 387");
      await field(page, "invoice_email").fill("ketoan@giaovanlongbien");
      await press(box.getByRole("button", { name: "Khai báo", exact: true }));
      await box.getByText("Mã số doanh nghiệp chưa hợp lệ.", { exact: true }).waitFor();
      await scrollToElement(page, 'label[for="registered_name"]');
      await shot("ma-so-13-so", "Nhập mã 13 số của chi nhánh: báo mã số doanh nghiệp chưa hợp lệ");
      await box.getByText("Email nhận hóa đơn không hợp lệ.", { exact: true }).waitFor();
      await box.getByText("Số điện thoại chưa đúng định dạng.", { exact: true }).waitFor();
      await scrollToElement(page, '[id="head_office_phone"]');
      await shot("sai-dinh-dang", "Số điện thoại và Email nhận hóa đơn sai định dạng");

      // The choice waits for the confirmation, so the field keeps "Doanh nghiệp" until "Đổi".
      await box.getByRole("radio", { name: "Cá nhân", exact: true }).click();
      const change = alertDialog(page, "Đổi hình thức pháp lý?");
      await change.waitFor();
      await shot("doi-hinh-thuc", "Chọn Cá nhân khi đã nhập: hỏi trước khi xóa các ô không dùng");
      await change.getByRole("button", { name: "Hủy", exact: true }).click();
      await change.waitFor({ state: "hidden" });
      await expect(box.getByRole("radio", { name: "Doanh nghiệp", exact: true })).toBeChecked();

      await box.getByRole("button", { name: "Hủy", exact: true }).last().click();
      const discard = dialog(page, "Bỏ những gì đã nhập?");
      await discard.waitFor();
      await shot("bo-nhap", "Bấm Hủy khi đang nhập dở: hỏi bỏ những gì đã nhập");
      expect(mock.writes).toBe(0);
    },
  }),
];
