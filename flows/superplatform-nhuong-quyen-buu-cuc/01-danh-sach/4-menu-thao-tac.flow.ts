import { expect } from "playwright/test";
import {
  GIA_LAI, HA_DONG, PLEIKU, applyFilters, directoryFlow, filterPanel, nameCell, openDirectory, openFilters, openRowMenu, rows, tab, tick,
  waitRows,
} from "../../_helpers/superplatform-directory";

const menuItems = (page: import("playwright").Page) => page.getByRole("menu").getByRole("menuitem");

export default [
  directoryFlow({
    id: "menu-thao-tac", name: "MENU ⋯ TẠM NGƯNG / KÍCH HOẠT LẠI",
    async run({ page, shot }) {
      await openDirectory(page);
      await nameCell(page, GIA_LAI.name).waitFor();
      await shot("danh-sach", "Danh sách tổ chức, thẻ Nhượng quyền: nút ⋯ cuối mỗi dòng", { mode: "fullPage" });

      await openRowMenu(page, HA_DONG.name);
      await expect(menuItems(page)).toHaveText(["Xem chi tiết", "Tạm ngưng"]);
      await shot("dang-hoat-dong", "Bấm ⋯ ở nhượng quyền đang hoạt động: Xem chi tiết, Tạm ngưng");

      await page.keyboard.press("Escape");
      await page.getByRole("menu").waitFor({ state: "hidden" });
      await openRowMenu(page, GIA_LAI.name);
      await expect(menuItems(page)).toHaveText(["Xem chi tiết", "Kích hoạt lại"]);
      await shot("tam-ngung", "Bấm ⋯ ở nhượng quyền tạm ngưng: Xem chi tiết, Kích hoạt lại");

      await page.keyboard.press("Escape");
      await page.getByRole("menu").waitFor({ state: "hidden" });
      await tab(page, "Bưu cục").click();
      await page.waitForURL(url => new URL(url).searchParams.get("tab") === "POST_OFFICE");
      await waitRows(page);
      await openFilters(page);
      await tick(page, "Ngừng hoạt động");
      await expect(filterPanel(page).getByRole("checkbox", { name: "Ngừng hoạt động", exact: true })).toBeChecked();
      await shot("loc-ngung-hoat-dong", "Thẻ Bưu cục, bấm Bộ lọc, chọn Ngừng hoạt động");

      await applyFilters(page);
      await page.waitForURL(url => new URL(url).searchParams.get("status") === "CLOSED");
      await expect(rows(page)).toHaveCount(1);
      await nameCell(page, PLEIKU.name).waitFor();
      await openRowMenu(page, PLEIKU.name);
      await expect(menuItems(page)).toHaveText(["Xem chi tiết"]);
      await shot("ngung-hoat-dong", "Áp dụng, bấm ⋯ ở bưu cục ngừng hoạt động: chỉ Xem chi tiết");
    },
  }),
];
