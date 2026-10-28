import { GIA_LAM, dialog, enterCode, legalButton, legalFlow, openLegal, scrollTop, waitCode } from "../../_helpers/superplatform-legal-profile";

export default [
  legalFlow({
    id: "xem-so-dinh-danh", name: "03. XEM SỐ ĐỊNH DANH CÁ NHÂN",
    async run({ page, shot }) {
      await openLegal(page, GIA_LAM);
      await page.getByText("********2345", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("so-bi-che", "Cá nhân: số định danh luôn che, chỉ hiện 4 số cuối", { mode: "fullPage" });

      await legalButton(page, "Xem số định danh").click();
      const confirm = dialog(page, "Xem số định danh cá nhân?");
      await confirm.waitFor();
      await shot("xac-nhan", "Hỏi trước khi xem: mỗi lần xem được ghi nhật ký");
      await confirm.getByRole("button", { name: "Xem", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");

      await enterCode(page);
      await page.getByText("Che lại sau 60 giây", { exact: true }).waitFor();
      await page.locator("dd", { hasText: "001190012345" }).waitFor();
      await scrollTop(page);
      await shot("hien-so", "Hiện số đầy đủ trong 60 giây rồi tự che lại", { mode: "fullPage" });
    },
  }),
];
