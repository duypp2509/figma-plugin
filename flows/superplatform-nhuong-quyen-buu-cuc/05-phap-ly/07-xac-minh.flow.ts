import { expect } from "playwright/test";
import {
  HA_DONG, MESSAGES, dialog, enterCode, legalButton, legalFlow, openLegal, pick, scrollTop, toast, waitCode,
} from "../../_helpers/superplatform-legal-profile";

export default [
  legalFlow({
    id: "xac-minh", name: "07. XÁC MINH THÔNG TIN PHÁP LÝ",
    async run({ page, shot, mock }) {
      await openLegal(page, HA_DONG);
      await legalButton(page, "Xác minh").click();
      const box = dialog(page, "Xác minh thông tin pháp lý?");
      await box.waitFor();
      await shot("hop-xac-minh", "Hộp xác minh: nguồn đối chiếu, ngày đối chiếu mặc định hôm nay");

      await pick(page, "verification-source", "Cổng thông tin quốc gia về đăng ký doanh nghiệp");
      await shot("da-chon-nguon", "Đã chọn nguồn đối chiếu");
      await box.getByRole("button", { name: "Xác minh", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");

      await enterCode(page);
      await toast(page, MESSAGES.verified).waitFor();
      await page.locator(".legal-verification").getByText("Đã xác minh", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("da-xac-minh", "Đã xác minh: ghi người, ngày và nguồn đối chiếu", { mode: "fullPage" });
      expect(mock.input).toMatchObject({ status: "VERIFIED", source: "NATIONAL_BUSINESS_REGISTRY", checked_on: "2026-10-12" });
    },
  }),
  legalFlow({
    id: "tu-choi-xac-minh", name: "08. TỪ CHỐI XÁC MINH",
    async run({ page, shot, mock }) {
      await openLegal(page, HA_DONG);
      await legalButton(page, "Từ chối xác minh").click();
      const box = dialog(page, "Từ chối xác minh?");
      await box.waitFor();
      await shot("hop-tu-choi", "Hỏi trước khi từ chối xác minh");
      await box.getByRole("button", { name: "Từ chối", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");

      await enterCode(page);
      await toast(page, MESSAGES.rejected).waitFor();
      await page.getByText("Bị từ chối ngày 12/10/2026. Hãy sửa lại thông tin.", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("bi-tu-choi", "Bị từ chối: chờ đơn vị sửa lại thông tin", { mode: "fullPage" });
      expect(mock.input.status).toBe("REJECTED");
    },
  }),
  legalFlow({
    id: "lich-su", name: "09. XEM LỊCH SỬ", setup: { haDong: "VERIFIED" },
    async run({ page, shot }) {
      await openLegal(page, HA_DONG);
      await legalButton(page, "Xem lịch sử").click();
      const history = dialog(page, "Lịch sử thông tin pháp lý");
      await history.getByRole("heading", { name: "Khai báo", exact: true }).waitFor();
      await history.getByRole("heading", { name: "Thông tin thay đổi", exact: true }).waitFor();
      await shot("lich-su", "Lịch sử: lần khai báo và lần sửa, kèm ô đã đổi");
    },
  }),
];
