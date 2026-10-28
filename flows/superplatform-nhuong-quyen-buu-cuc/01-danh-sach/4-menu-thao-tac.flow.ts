import { expect } from "playwright/test";
import {
  GIA_LAI, HA_DONG, PLEIKU, choose, directoryFlow, nameCell, openDirectory, openRowMenu, rows, tab, waitRows,
} from "../../_helpers/superplatform-directory";

const menuItems = (page: import("playwright").Page) => page.getByRole("menu").getByRole("menuitem");

export default [
  directoryFlow({
    id: "menu-thao-tac", name: "08. MENU ⋯ TẠM NGƯNG / KÍCH HOẠT LẠI",
    async run({ page, shot }) {
      await openDirectory(page);
      await openRowMenu(page, HA_DONG.name);
      await expect(menuItems(page)).toHaveText(["Xem chi tiết", "Tạm ngưng"]);
      await shot("dang-hoat-dong", "Nhượng quyền đang hoạt động: Xem chi tiết, Tạm ngưng");

      await page.keyboard.press("Escape");
      await page.getByRole("menu").waitFor({ state: "hidden" });
      await openRowMenu(page, GIA_LAI.name);
      await expect(menuItems(page)).toHaveText(["Xem chi tiết", "Kích hoạt lại"]);
      await shot("tam-ngung", "Nhượng quyền tạm ngưng: Xem chi tiết, Kích hoạt lại");

      await page.keyboard.press("Escape");
      await page.getByRole("menu").waitFor({ state: "hidden" });
      await tab(page, "Bưu cục").click();
      await page.waitForURL(url => new URL(url).searchParams.get("tab") === "POST_OFFICE");
      await waitRows(page);
      await choose(page, "filter-status", "Ngừng hoạt động");
      await page.waitForURL(url => new URL(url).searchParams.get("status") === "CLOSED");
      await expect(rows(page)).toHaveCount(1);
      await nameCell(page, PLEIKU.name).waitFor();
      await openRowMenu(page, PLEIKU.name);
      await expect(menuItems(page)).toHaveText(["Xem chi tiết"]);
      await shot("ngung-hoat-dong", "Bưu cục ngừng hoạt động: chỉ Xem chi tiết");
    },
  }),
];
