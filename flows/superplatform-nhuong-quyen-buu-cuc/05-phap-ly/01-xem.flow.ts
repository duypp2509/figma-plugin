import { HA_DONG, legalFlow, openLegal, openOverview, scrollTop } from "../../_helpers/superplatform-legal-profile";

export default [
  legalFlow({
    id: "xem", name: "01. XEM THÔNG TIN PHÁP LÝ",
    async run({ page, shot }) {
      await openOverview(page, HA_DONG);
      await page.getByText("CÔNG TY TNHH VẬN CHUYỂN HÀ ĐÔNG").first().waitFor();
      await shot("tong-quan", "Tổng quan nhượng quyền, ô Thông tin pháp lý", { mode: "fullPage" });

      await page.getByRole("link", { name: "Xem chi tiết Thông tin pháp lý" }).click();
      await page.waitForURL("**section=legal-entities");
      await openLegal(page, HA_DONG);
      await page.getByText("Chưa xác minh. Đang chờ Quản trị hệ thống đối chiếu từ ngày 06/09/2026.").waitFor();
      await scrollTop(page);
      await shot("phap-ly", "Thông tin pháp lý: doanh nghiệp, chưa xác minh", { mode: "fullPage" });
    },
  }),
];
