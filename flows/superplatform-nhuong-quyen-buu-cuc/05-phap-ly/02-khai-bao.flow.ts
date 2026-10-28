import { expect } from "playwright/test";
import {
  LONG_BIEN, MESSAGES, PAPER, confirmButton, dialog, enterCode, field, legalButton, legalFlow, openLegal, press, scrollToElement,
  toast, uploadPaper, waitCode,
} from "../../_helpers/superplatform-legal-profile";

const TITLE = "Khai báo thông tin pháp lý";

export default [
  legalFlow({
    id: "khai-bao", name: "KHAI BÁO THÔNG TIN PHÁP LÝ",
    async run({ page, shot, mock }) {
      await openLegal(page, LONG_BIEN);
      await page.getByText("Chưa khai báo thông tin pháp lý", { exact: true }).waitFor();
      await shot("chua-khai-bao", "Đơn vị chưa khai báo thông tin pháp lý");

      await legalButton(page, "Khai báo").first().click();
      const box = dialog(page, TITLE);
      await box.getByText("Tải giấy đăng ký lên", { exact: true }).waitFor();
      await shot("hop-khai-bao", "Hộp khai báo: tải giấy đăng ký lên trước, hoặc chọn hình thức pháp lý để nhập tay");

      // The certificate is read on upload: the form, the type and every field on it fill themselves.
      await uploadPaper(page, PAPER.longBien);
      await expect(field(page, "registered_name")).toHaveValue("CÔNG TY TNHH GIAO VẬN LONG BIÊN");
      await field(page, "invoice_email").fill("ketoan@giaovanlongbien.vn");
      await scrollToElement(page, '[data-field="registration_document"]');
      await shot("da-nhap", "Đã đọc giấy đăng ký: tự điền thông tin, ô cần kiểm tra lại được đánh dấu");
      await scrollToElement(page, '[id="head_office_phone"]');
      await shot("da-nhap-lien-he", "Liên hệ trụ sở đọc từ giấy, nhập thêm Email nhận hóa đơn");

      await press(box.getByRole("button", { name: "Khai báo", exact: true }));
      const confirm = dialog(page, `${TITLE}?`);
      await confirm.waitFor();
      await shot("xac-nhan", "Kiểm tra lại trước khi khai báo");
      await confirmButton(confirm, "Khai báo").click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");

      await enterCode(page);
      await toast(page, MESSAGES.declared).waitFor();
      await page.getByText("CÔNG TY TNHH GIAO VẬN LONG BIÊN", { exact: true }).waitFor();
      await shot("da-khai-bao", "Đã khai báo, đang chờ Quản trị hệ thống xác minh");
      expect(mock.writes).toBe(1);
      expect(mock.input.legal_form).toBe("ENTERPRISE");
      expect(mock.input.enterprise_type).toBe("LLC_ONE_MEMBER");
    },
  }),
];
