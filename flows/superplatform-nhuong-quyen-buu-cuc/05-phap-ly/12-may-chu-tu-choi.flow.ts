import { expect } from "playwright/test";
import {
  HA_DONG, MESSAGES, PAPER, codeDialog, confirmButton, dialog, editPageLoaded, enterCode, field, formButton, legalButton, legalFlow,
  openLegal, pick, pickDate, press, scrollToElement, scrollTop, uploadPaper, waitCode,
} from "../../_helpers/superplatform-legal-profile";

const CONFIRM = "Thay chủ thể pháp lý?";

export default [
  legalFlow({
    id: "may-chu-tu-choi", name: "THAY CHỦ THỂ TRÙNG MÃ SỐ, SỬA KHI CHƯA ĐỔI GÌ, SAI MÃ XÁC THỰC",
    async run({ page, shot, mock }) {
      // Thay chủ thể with the current company's amended certificate: same number, so it is only an "đăng ký thay đổi".
      await openLegal(page, HA_DONG);
      await legalButton(page, "Thay chủ thể").waitFor();
      await scrollTop(page);
      await shot("phap-ly", "Thông tin pháp lý của CÔNG TY TNHH VẬN CHUYỂN HÀ ĐÔNG", { mode: "fullPage" });

      await legalButton(page, "Thay chủ thể").click();
      await page.waitForURL("**/legal/replace");
      await editPageLoaded(page, "replace");
      await page.getByText("Tải giấy đăng ký lên", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("trang-thay", "Bấm Thay chủ thể: trang thay chủ thể", { mode: "fullPage" });

      await uploadPaper(page, PAPER.haDong, "legal.registration_document");
      await field(page, "legal.invoice_email").fill("ketoan@vanchuyenhadong.vn");
      await pickDate(page, "effective_on", "2026-10-01");
      await pick(page, "verification_source", "Cổng thông tin quốc gia về đăng ký doanh nghiệp");
      await scrollTop(page);
      await shot("da-nhap", "Tải lên giấy đăng ký thay đổi lần 2 của chính công ty hiện tại", { mode: "fullPage" });

      await press(formButton(page, "Thay chủ thể"));
      await dialog(page, CONFIRM).waitFor();
      await shot("xac-nhan", "Bấm Thay chủ thể: kiểm tra lại trước khi thay");
      await confirmButton(dialog(page, CONFIRM), "Thay chủ thể").click();
      await page.getByText(MESSAGES.sameNumber, { exact: true }).waitFor();
      await scrollToElement(page, 'label[for="legal.registered_name"]');
      await shot("ma-so-giong", "Mã số giống chủ thể hiện tại: chỉ là đăng ký thay đổi, dùng Sửa");

      // Sửa mà không đổi ô nào.
      await openLegal(page, HA_DONG);
      await legalButton(page, "Sửa").click();
      await page.waitForURL("**/legal/edit");
      await editPageLoaded(page, "edit");
      await expect(field(page, "legal.invoice_email")).toHaveValue("ketoan@vanchuyenhadong.vn");
      // Nothing changed yet: "Lưu thay đổi" stays greyed instead of the server answering "Không có thay đổi."
      await expect(formButton(page, "Lưu thay đổi")).toBeDisabled();
      await scrollTop(page);
      await shot("khong-co-thay-doi", "Quay lại Thông tin pháp lý, bấm Sửa, chưa đổi gì: nút Lưu thay đổi bị khóa", { mode: "fullPage" });

      // Mã xác thực sai khi xác minh.
      await openLegal(page, HA_DONG);
      await legalButton(page, "Xác minh").click();
      const box = dialog(page, "Xác minh CÔNG TY TNHH VẬN CHUYỂN HÀ ĐÔNG?");
      await pick(page, "verification-source", "Cổng thông tin quốc gia về đăng ký doanh nghiệp");
      await shot("hop-xac-minh", "Quay lại Thông tin pháp lý, bấm Xác minh, chọn nguồn đối chiếu");
      await box.getByRole("button", { name: "Xác minh", exact: true }).click();
      await waitCode(page);
      await enterCode(page, "111111");
      await codeDialog(page).getByText(MESSAGES.wrongCode).waitFor();
      await shot("ma-sai", "Bấm Xác minh, nhập sai mã xác thực: báo mã không đúng, nhập lại");
      expect(mock.writes).toBe(0);
    },
  }),
];
