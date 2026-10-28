import { expect } from "playwright/test";
import {
  HA_DONG, HN_REGISTRY_NAME, MESSAGES, codeDialog, dialog, enterCode, field, formButton, legalButton, legalFlow, openEditPage,
  openLegal, pick, pickDate, press, scrollToElement, waitCode,
} from "../../_helpers/superplatform-legal-profile";

export default [
  legalFlow({
    id: "may-chu-tu-choi", name: "12. MÁY CHỦ TỪ CHỐI",
    async run({ page, shot, mock }) {
      // Thay chủ thể nhưng nhập lại đúng mã số hiện tại: chỉ là đăng ký thay đổi.
      await openEditPage(page, HA_DONG, "replace");
      await pick(page, "legal_form", "Doanh nghiệp");
      await pick(page, "enterprise_type", "Công ty cổ phần");
      await field(page, "registered_name").fill("CÔNG TY CỔ PHẦN VẬN CHUYỂN HÀ ĐÔNG");
      await field(page, "registration_number").fill("0109876543");
      await field(page, "certificate_number").fill("0109876543");
      await pickDate(page, "certificate_issued_on", "2023-05-16");
      await field(page, "certificate_issuer").fill(HN_REGISTRY_NAME);
      await pick(page, "address.province_code", "Thành phố Hà Nội");
      await pick(page, "address.ward_code", "Phường Hà Đông");
      await field(page, "address.address_line").fill("Số 8 đường Tố Hữu");
      await field(page, "head_office_phone").fill("024 3355 6789");
      await field(page, "invoice_email").fill("ketoan@vanchuyenhadong.vn");
      await pickDate(page, "effective_on", "2026-10-01");
      await press(formButton(page, "Thay chủ thể"));
      await dialog(page, "Thay chủ thể pháp lý?").getByRole("button", { name: "Thay chủ thể", exact: true }).click();
      await page.getByText(MESSAGES.sameNumber, { exact: true }).waitFor();
      await scrollToElement(page, 'label[for="registered_name"]');
      await shot("ma-so-giong", "Thay chủ thể mà mã số giống chủ thể hiện tại: dùng Sửa");

      // Sửa mà không đổi ô nào.
      await openLegal(page, HA_DONG);
      await legalButton(page, "Sửa").click();
      await page.waitForURL("**/legal/edit");
      await field(page, "invoice_email").waitFor();
      // Nothing changed yet: "Lưu thay đổi" stays greyed instead of the server answering "Không có thay đổi."
      await expect(formButton(page, "Lưu thay đổi")).toBeDisabled();
      await shot("khong-co-thay-doi", "Chưa đổi gì: nút Lưu thay đổi bị khóa");

      // Mã xác thực sai khi xác minh.
      await openLegal(page, HA_DONG);
      await legalButton(page, "Xác minh").click();
      const box = dialog(page, "Xác minh thông tin pháp lý?");
      await pick(page, "verification-source", "Cổng thông tin quốc gia về đăng ký doanh nghiệp");
      await box.getByRole("button", { name: "Xác minh", exact: true }).click();
      await waitCode(page);
      await enterCode(page, "111111");
      await codeDialog(page).getByText(MESSAGES.wrongCode).waitFor();
      await shot("ma-sai", "Mã xác thực sai: nhập lại");
      expect(mock.writes).toBe(0);
    },
  }),
];
