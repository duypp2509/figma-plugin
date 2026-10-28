import { ME_LINH, STEP_UP_CODE, codeDialog, dialog, enterCode, field, legalFlow, openLegal, scrollTop, waitCode } from "../../_helpers/superplatform-legal-profile";

/*
 * The personal identification number is no longer masked nor revealed behind a code (23/10/2026): it shows in full.
 * The sensitive view left behind a code, and logged, is the registration certificate ("Giấy đăng ký" → "Xem"), so
 * this flow keeps its frames for that: a household business, whose number is its owner's identification number.
 */
export default [
  legalFlow({
    id: "xem-so-dinh-danh", name: "XEM SỐ ĐỊNH DANH VÀ GIẤY ĐĂNG KÝ",
    async run({ page, shot }) {
      await openLegal(page, ME_LINH);
      await page.locator(".legal-page").getByText("001085004321", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("so-bi-che", "Hộ kinh doanh: số định danh cá nhân của chủ hộ hiện đầy đủ", { mode: "fullPage" });

      await page.locator(".legal-info-card", { hasText: "Giấy đăng ký" }).getByRole("button", { name: "Xem", exact: true }).click();
      await waitCode(page);
      await codeDialog(page).getByText("Lần xem này được ghi nhật ký.", { exact: false }).waitFor();
      await shot("xac-nhan", "Xem giấy đăng ký: hỏi mã xác thực, lần xem được ghi nhật ký");
      await field(page, "step-up-code").fill(STEP_UP_CODE);
      await shot("ma-xac-thuc", "Nhập mã xác thực");

      await enterCode(page);
      const viewer = dialog(page, "Giấy đăng ký");
      const picture = viewer.getByRole("img", { name: "Giấy đăng ký" });
      await picture.waitFor();
      await picture.evaluate(node => (node as HTMLImageElement).decode());
      await shot("hien-so", "Giấy đăng ký mở trong trình xem");
    },
  }),
];
