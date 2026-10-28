import { expect } from "playwright/test";
import {
  CERTIFICATE, HN_REGISTRY_NAME, LONG_BIEN, MESSAGES, dialog, enterCode, field, legalButton, legalFlow, openLegal, pick, pickDate,
  press, scrollToElement, toast, waitCode,
} from "../../_helpers/superplatform-legal-profile";

const TITLE = "Khai báo thông tin pháp lý";

export default [
  legalFlow({
    id: "khai-bao", name: "02. KHAI BÁO THÔNG TIN PHÁP LÝ",
    async run({ page, shot, mock }) {
      await openLegal(page, LONG_BIEN);
      await page.getByText("Chưa khai báo thông tin pháp lý", { exact: true }).waitFor();
      await shot("chua-khai-bao", "Đơn vị chưa khai báo thông tin pháp lý");

      await legalButton(page, "Khai báo").first().click();
      const box = dialog(page, TITLE);
      await field(page, "legal_form").waitFor({ state: "attached" });
      await shot("hop-khai-bao", "Hộp khai báo: chọn hình thức pháp lý trước");

      await pick(page, "legal_form", "Doanh nghiệp");
      await pick(page, "enterprise_type", "Công ty TNHH một thành viên");
      await field(page, "registered_name").fill("CÔNG TY TNHH GIAO VẬN LONG BIÊN");
      await field(page, "registration_number").fill("0108765432");
      await field(page, "certificate_number").fill("0108765432");
      await pickDate(page, "certificate_issued_on", "2024-05-20");
      await field(page, "certificate_issuer").fill(HN_REGISTRY_NAME);
      await pick(page, "address.province_code", "Thành phố Hà Nội");
      await pick(page, "address.ward_code", "Phường Bồ Đề");
      await field(page, "address.address_line").fill("Số 120 đường Nguyễn Văn Cừ");
      await field(page, "head_office_phone").fill("024 3872 5566");
      await field(page, "head_office_email").fill("lienhe@giaovanlongbien.vn");
      await field(page, "invoice_email").fill("ketoan@giaovanlongbien.vn");
      await page.locator('[id="registration_document"] input[type="file"]').setInputFiles(CERTIFICATE);
      await box.getByText(CERTIFICATE.name).waitFor();
      await scrollToElement(page, 'label[for="legal_form"]');
      await shot("da-nhap", "Đã nhập thông tin trên giấy đăng ký");
      await scrollToElement(page, '[id="head_office_phone"]');
      await shot("da-nhap-lien-he", "Đã nhập liên hệ, Email nhận hóa đơn và tệp giấy đăng ký");

      await press(box.getByRole("button", { name: "Khai báo", exact: true }));
      const confirm = dialog(page, `${TITLE}?`);
      await confirm.waitFor();
      await shot("xac-nhan", "Kiểm tra lại trước khi khai báo");
      await confirm.getByRole("button", { name: "Khai báo", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");

      await enterCode(page);
      await toast(page, MESSAGES.declared).waitFor();
      await page.getByText("CÔNG TY TNHH GIAO VẬN LONG BIÊN", { exact: true }).waitFor();
      await shot("da-khai-bao", "Đã khai báo, đang chờ Quản trị hệ thống xác minh");
      expect(mock.writes).toBe(1);
      expect(mock.input.legal_form).toBe("ENTERPRISE");
    },
  }),
];
