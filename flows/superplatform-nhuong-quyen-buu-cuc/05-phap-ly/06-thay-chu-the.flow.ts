import { expect } from "playwright/test";
import {
  CERTIFICATE, GIA_LAM, HN_REGISTRY_NAME, MESSAGES, dialog, enterCode, field, formButton, legalButton, legalFlow, openLegal, pick,
  pickDate, press, scrollTop, toast, waitCode,
} from "../../_helpers/superplatform-legal-profile";

const CONFIRM = "Thay chủ thể pháp lý?";

export default [
  legalFlow({
    id: "thay-chu-the", name: "06. THAY CHỦ THỂ PHÁP LÝ",
    async run({ page, shot, mock }) {
      await openLegal(page, GIA_LAM);
      await legalButton(page, "Thay chủ thể").click();
      await page.waitForURL("**/legal/replace");
      await page.getByRole("heading", { level: 1, name: "Thay chủ thể pháp lý", exact: true }).waitFor();
      await page.getByText("Người đại diện kết thúc nhiệm kỳ cùng ngày: Đỗ Minh Tuấn (theo ủy quyền)", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("trang-thay", "Trang thay chủ thể: chủ thể hiện tại và người đại diện sẽ kết thúc", { mode: "fullPage" });

      // Cá nhân lập công ty, hai bên ký phụ lục chuyển hợp đồng nhượng quyền sang công ty từ 01/10/2026.
      await pick(page, "legal_form", "Doanh nghiệp");
      await pick(page, "enterprise_type", "Công ty TNHH một thành viên");
      await field(page, "registered_name").fill("CÔNG TY TNHH VẬN CHUYỂN GIA LÂM");
      await field(page, "registration_number").fill("0110234567");
      await field(page, "certificate_number").fill("0110234567");
      await pickDate(page, "certificate_issued_on", "2026-09-18");
      await field(page, "certificate_issuer").fill(HN_REGISTRY_NAME);
      await pick(page, "address.province_code", "Thành phố Hà Nội");
      await pick(page, "address.ward_code", "Xã Gia Lâm");
      await field(page, "address.address_line").fill("Số 46 đường Cổ Bi");
      await field(page, "head_office_phone").fill("024 3678 2468");
      await field(page, "head_office_email").fill("lienhe@vanchuyengialam.vn");
      await field(page, "invoice_email").fill("ketoan@vanchuyengialam.vn");
      await page.locator('[id="registration_document"] input[type="file"]').setInputFiles(CERTIFICATE);
      await pickDate(page, "effective_on", "2026-10-01");
      await pick(page, "basis_document_type", "Phụ lục hợp đồng nhượng quyền");
      await field(page, "basis_document_number").fill("02/2026/PLHĐ-NQ");
      await pickDate(page, "basis_document_date", "2026-09-25");
      await scrollTop(page);
      await shot("da-nhap", "Đã nhập chủ thể mới, ngày áp dụng và căn cứ", { mode: "fullPage" });

      await press(formButton(page, "Thay chủ thể"));
      await dialog(page, CONFIRM).waitFor();
      await shot("xac-nhan", "Kiểm tra lại trước khi thay chủ thể");
      await dialog(page, CONFIRM).getByRole("button", { name: "Thay chủ thể", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");

      await enterCode(page);
      await page.waitForURL("**section=legal-entities");
      await toast(page, MESSAGES.replaced).waitFor();
      await page.getByText("CÔNG TY TNHH VẬN CHUYỂN GIA LÂM", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("da-thay", "Đã thay: chủ thể mới chưa xác minh, nhắc bổ nhiệm người đại diện", { mode: "fullPage" });

      await toast(page, MESSAGES.replaced).waitFor({ state: "hidden", timeout: 15_000 });
      await legalButton(page, "Xem lịch sử").click();
      const history = dialog(page, "Lịch sử thông tin pháp lý");
      await history.getByText("Đã thay", { exact: true }).waitFor();
      await shot("lich-su", "Lịch sử: chủ thể cũ ở trạng thái Đã thay, kèm căn cứ thay");
      expect(mock.input.effective_on).toBe("2026-10-01");
      expect(mock.reps[GIA_LAM.id]![0]!.end_reason).toBe("Thay chủ thể pháp lý");
    },
  }),
];
