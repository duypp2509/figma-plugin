import { expect } from "playwright/test";
import {
  HA_DONG, HAI_PHONG, QUANG_TRUNG, VAN_QUAN, appliedFilters, applyFilters, chooseSort, directoryFlow, filterPanel, nameCell, openDirectory,
  openFilters, openPicker, openSort, pick, pickMany, rows, tab, tick, waitRows,
} from "../../_helpers/superplatform-directory";

export default [
  directoryFlow({
    id: "xem-nhuong-quyen", name: "TỔNG CÔNG TY XEM DANH SÁCH NHƯỢNG QUYỀN",
    async run({ page, shot }) {
      await openDirectory(page);
      await expect(tab(page, "Nhượng quyền")).toHaveAttribute("aria-selected", "true");
      await nameCell(page, HA_DONG.name).waitFor();
      await shot("danh-sach-nhuong-quyen", "Thẻ Nhượng quyền: cột Mã số, Số bưu cục", { mode: "fullPage" });

      await openSort(page);
      await shot("chon-sap-xep", "Chọn cách sắp xếp");

      await chooseSort(page, "Nhiều bưu cục nhất");
      await expect(rows(page).first()).toContainText(HA_DONG.name);
      await shot("nhieu-buu-cuc-nhat", "Nhiều bưu cục nhất đứng đầu", { mode: "fullPage" });

      await chooseSort(page, "Ít bưu cục nhất");
      await expect(rows(page).first()).toContainText(HAI_PHONG.name);
      await shot("it-buu-cuc-nhat", "Ít bưu cục nhất: nhượng quyền chưa có bưu cục đứng đầu", { mode: "fullPage" });

      await page.getByRole("link", { name: `Bưu cục của ${HA_DONG.name}: 5`, exact: true }).click();
      await page.waitForURL(`**/workspace/organizations/${HA_DONG.id}/post-offices`);
      await page.getByRole("heading", { name: "Bưu cục", exact: true }).waitFor();
      await waitRows(page);
      // The app's top progress bar runs until the new page settles.
      await page.locator('[role="status"][aria-label="Đang tải trang"]').waitFor({ state: "hidden" });
      await shot("buu-cuc-cua-nhuong-quyen", "Bấm số bưu cục: thẻ Bưu cục ở trang nhượng quyền", { mode: "fullPage" });
    },
  }),
  directoryFlow({
    id: "xem-buu-cuc", name: "TỔNG CÔNG TY XEM DANH SÁCH BƯU CỤC",
    async run({ page, shot }) {
      await openDirectory(page);
      await tab(page, "Bưu cục").click();
      await nameCell(page, VAN_QUAN.name).waitFor();
      await page.getByRole("columnheader", { name: "Thuộc nhượng quyền" }).waitFor();
      await expect(page.getByRole("button", { name: "Mở bưu cục" })).toHaveCount(0);
      await shot("danh-sach-buu-cuc", "Thẻ Bưu cục: cột Thuộc nhượng quyền, không có nút Mở bưu cục", { mode: "fullPage" });

      await openFilters(page);
      await filterPanel(page).getByRole("checkbox", { name: "Loại hình bưu cục", exact: true }).waitFor();
      // Six criteria show first; "Thuộc nhượng quyền" (Tổng công ty only) waits behind "Xem thêm".
      await filterPanel(page).getByRole("button", { name: "Xem thêm", exact: true }).waitFor();
      await shot("bo-loc-nang-cao", "Bộ lọc: trạng thái và các tiêu chí lọc");

      await tick(page, "Tỉnh/Thành phố");
      await pick(page, "Tỉnh/Thành phố", "Thành phố Hà Nội");
      await tick(page, "Phường/Xã/Đặc khu");
      await openPicker(page, "Phường/Xã/Đặc khu");
      await shot("chon-phuong-xa", "Chọn tỉnh rồi chọn phường, xã");

      await pick(page, "Phường/Xã/Đặc khu", "Phường Hà Đông");
      await tick(page, "Loại hình bưu cục");
      await pickMany(page, "Loại hình bưu cục", ["Bưu cục lấy"]);
      await filterPanel(page).getByText("Đã chọn 1", { exact: true }).waitFor();
      await shot("da-chon-tieu-chi", "Đã chọn tỉnh, phường xã và loại hình bưu cục");

      await applyFilters(page);
      await page.waitForURL(url => new URL(url).searchParams.get("operationModel") === "PICKUP");
      await appliedFilters(page, 3).waitFor();
      await expect(rows(page)).toHaveCount(1);
      await nameCell(page, QUANG_TRUNG.name).waitFor();
      await shot("da-loc", "Đã lọc: Bộ lọc đang áp dụng 3 tiêu chí", { mode: "fullPage" });
    },
  }),
];
