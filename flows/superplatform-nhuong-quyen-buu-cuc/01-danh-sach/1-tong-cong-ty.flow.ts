import { expect } from "playwright/test";
import {
  HA_DONG, HAI_PHONG, QUANG_TRUNG, VAN_QUAN, advancedButton, choose, combo, directoryFlow, nameCell, openDirectory, openSelect, rows, tab, waitRows,
} from "../../_helpers/superplatform-directory";

export default [
  directoryFlow({
    id: "xem-nhuong-quyen", name: "01. TỔNG CÔNG TY XEM DANH SÁCH NHƯỢNG QUYỀN",
    async run({ page, shot }) {
      await openDirectory(page);
      await expect(tab(page, "Nhượng quyền")).toHaveAttribute("aria-selected", "true");
      await nameCell(page, HA_DONG.name).waitFor();
      await shot("danh-sach-nhuong-quyen", "Thẻ Nhượng quyền: cột Mã số, Số bưu cục", { mode: "fullPage" });

      await openSelect(page, "directory-sort");
      await shot("chon-sap-xep", "Chọn cách sắp xếp");

      await choose(page, "directory-sort", "Nhiều bưu cục nhất");
      await expect(rows(page).first()).toContainText(HA_DONG.name);
      await shot("nhieu-buu-cuc-nhat", "Nhiều bưu cục nhất đứng đầu", { mode: "fullPage" });

      await choose(page, "directory-sort", "Ít bưu cục nhất");
      await expect(rows(page).first()).toContainText(HAI_PHONG.name);
      await shot("it-buu-cuc-nhat", "Ít bưu cục nhất: nhượng quyền chưa có bưu cục đứng đầu", { mode: "fullPage" });

      await page.getByRole("link", { name: `Bưu cục của ${HA_DONG.name}: 5`, exact: true }).click();
      await page.waitForURL(`**/workspace/organizations/${HA_DONG.id}/post-offices`);
      await page.getByRole("heading", { name: "Bưu cục", exact: true }).waitFor();
      await waitRows(page);
      await shot("buu-cuc-cua-nhuong-quyen", "Bấm số bưu cục: thẻ Bưu cục ở trang nhượng quyền", { mode: "fullPage" });
    },
  }),
  directoryFlow({
    id: "xem-buu-cuc", name: "02. TỔNG CÔNG TY XEM DANH SÁCH BƯU CỤC",
    async run({ page, shot }) {
      await openDirectory(page);
      await tab(page, "Bưu cục").click();
      await nameCell(page, VAN_QUAN.name).waitFor();
      await page.getByRole("columnheader", { name: "Thuộc nhượng quyền" }).waitFor();
      await expect(page.getByRole("button", { name: "Mở bưu cục" })).toHaveCount(0);
      await shot("danh-sach-buu-cuc", "Thẻ Bưu cục: cột Thuộc nhượng quyền, không có nút Mở bưu cục", { mode: "fullPage" });

      await advancedButton(page).click();
      await combo(page, "filter-operationModel").waitFor();
      await shot("bo-loc-nang-cao", "Bộ lọc nâng cao: tỉnh, phường xã, thuộc nhượng quyền, loại hình", { mode: "fullPage" });

      await choose(page, "filter-provinceCode", "Thành phố Hà Nội");
      await page.waitForURL(url => Boolean(new URL(url).searchParams.get("provinceCode")));
      await expect(combo(page, "filter-wardCode")).toBeEnabled();
      await openSelect(page, "filter-wardCode");
      await shot("chon-phuong-xa", "Chọn tỉnh rồi chọn phường, xã");

      // Each choice is written to the URL; the next one is read from it, so wait for it to land first.
      await choose(page, "filter-wardCode", "Phường Hà Đông");
      await page.waitForURL(url => Boolean(new URL(url).searchParams.get("wardCode")));
      await choose(page, "filter-operationModel", "Bưu cục lấy");
      await page.waitForURL(url => Boolean(new URL(url).searchParams.get("operationModel")));
      await expect(advancedButton(page)).toHaveText("Bộ lọc nâng cao (3)");
      await expect(rows(page)).toHaveCount(1);
      await nameCell(page, QUANG_TRUNG.name).waitFor();
      await shot("da-loc", "Đã lọc: Bộ lọc nâng cao (3)", { mode: "fullPage" });
    },
  }),
];
