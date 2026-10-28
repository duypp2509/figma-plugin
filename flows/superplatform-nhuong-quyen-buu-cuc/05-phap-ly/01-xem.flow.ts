import { HA_DONG, legalFlow, legalLoaded, openOverview, scrollTop } from "../../_helpers/superplatform-legal-profile";

export default [
  legalFlow({
    id: "xem", name: "XEM THÔNG TIN PHÁP LÝ",
    async run({ page, shot }) {
      await openOverview(page, HA_DONG);
      await page.getByText("CÔNG TY TNHH VẬN CHUYỂN HÀ ĐÔNG").first().waitFor();
      await shot("tong-quan", "Tổng quan nhượng quyền, ô Thông tin pháp lý", { mode: "fullPage" });

      await page.getByRole("link", { name: "Xem chi tiết Thông tin pháp lý" }).click();
      await page.waitForURL("**section=legal-entities");
      await legalLoaded(page);
      // The amended subject waits for its check: "Chờ xác minh" by the title and in "Xác minh".
      await page.locator(".legal-page aside").getByRole("button", { name: "Xác minh", exact: true }).waitFor();
      await scrollTop(page);
      await shot("phap-ly", "Thông tin pháp lý: doanh nghiệp, chờ xác minh", { mode: "fullPage" });
    },
  }),
];
