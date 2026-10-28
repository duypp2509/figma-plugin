import { expect } from "playwright/test";
import {
  GIA_LAM, MESSAGES, PAPER, confirmButton, dialog, editPageLoaded, enterCode, field, formButton, legalButton, legalFlow, legalLoaded,
  openHistory, openLegal, pick, pickDate, press, scrollTop, toast, uploadPaper, waitCode,
} from "../../_helpers/superplatform-legal-profile";

const CONFIRM = "Thay chủ thể pháp lý?";

export default [
  legalFlow({
    // Quản trị hệ thống: the change of subject takes effect at once, verified against the source they name (Đ2-18).
    id: "thay-chu-the", name: "THAY CHỦ THỂ PHÁP LÝ",
    async run({ page, shot, mock }) {
      await openLegal(page, GIA_LAM);
      await page.locator(".legal-page").getByText("Nguyễn Thị Hồng Nhung", { exact: true }).first().waitFor();
      await scrollTop(page);
      await shot("phap-ly", "Thông tin pháp lý: chủ thể hiện tại là cá nhân", { mode: "fullPage" });

      await legalButton(page, "Thay chủ thể").click();
      await page.waitForURL("**/legal/replace");
      await editPageLoaded(page, "replace");
      await page.getByText("Nguyễn Thị Hồng Nhung", { exact: true }).waitFor();
      await page.getByText("Tải giấy đăng ký lên", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("trang-thay", "Bấm Thay chủ thể: trang thay chủ thể, tải giấy đăng ký của chủ thể mới", { mode: "fullPage" });

      // Cá nhân lập công ty, hai bên ký phụ lục chuyển hợp đồng nhượng quyền sang công ty từ 01/10/2026.
      await uploadPaper(page, PAPER.giaLam, "legal.registration_document");
      await expect(field(page, "legal.registered_name")).toHaveValue("CÔNG TY TNHH VẬN CHUYỂN GIA LÂM");
      await field(page, "legal.invoice_email").fill("ketoan@vanchuyengialam.vn");
      await pickDate(page, "effective_on", "2026-10-01");
      await page.getByRole("button", { name: "Thông tin thêm", exact: true }).last().click();
      await pick(page, "basis_document_type", "Phụ lục hợp đồng nhượng quyền");
      await field(page, "basis_document_number").fill("02/2026/PLHĐ-NQ");
      await pickDate(page, "basis_document_date", "2026-09-25");
      await pick(page, "verification_source", "Cổng thông tin quốc gia về đăng ký doanh nghiệp");
      await scrollTop(page);
      await shot("da-nhap", "Đã đọc giấy của chủ thể mới, nhập ngày áp dụng, căn cứ và nguồn đối chiếu", { mode: "fullPage" });

      await press(formButton(page, "Thay chủ thể"));
      await dialog(page, CONFIRM).waitFor();
      await shot("xac-nhan", "Kiểm tra lại trước khi thay chủ thể: người đại diện kết thúc nhiệm kỳ");
      await confirmButton(dialog(page, CONFIRM), "Thay chủ thể").click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");

      await enterCode(page);
      await page.waitForURL("**section=legal-entities");
      await toast(page, MESSAGES.replaced).waitFor();
      await legalLoaded(page);
      await page.getByText("CÔNG TY TNHH VẬN CHUYỂN GIA LÂM", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("da-thay", "Đã thay: chủ thể mới áp dụng từ 01/10/2026, đã xác minh", { mode: "fullPage" });

      await toast(page, MESSAGES.replaced).waitFor({ state: "hidden", timeout: 15_000 });
      await openHistory(page);
      await page.getByText("Đã thay", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("lich-su", "Lịch sử: chủ thể cũ ở trạng thái Đã thay, kèm căn cứ thay", { mode: "fullPage" });
      expect(mock.input.effective_on).toBe("2026-10-01");
      expect(mock.input.verification_source).toBe("NATIONAL_BUSINESS_REGISTRY");
      expect(mock.reps[GIA_LAM.id]![0]!.end_reason).toBe("Thay chủ thể pháp lý");
    },
  }),
];
