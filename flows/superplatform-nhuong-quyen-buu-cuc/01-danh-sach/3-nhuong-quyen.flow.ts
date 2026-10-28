import { expect } from "playwright/test";
import {
  HA_DONG, HAI_PHONG, VAN_QUAN, appliedFilters, applyFilters, directoryFlow, filterPanel, nameCell, openDirectory, openFilters, pick, pickMany,
  rows, tab, tick, waitRows,
} from "../../_helpers/superplatform-directory";

const openButton = (page: import("playwright").Page) => page.getByRole("button", { name: "Mở bưu cục", exact: true });
const SUSPENDED = `${HA_DONG.name} đang tạm ngưng, không mở được bưu cục.`;

/** From the "Nhượng quyền" tab, the franchise's post-office count opens its "Bưu cục" tab. */
async function openFranchisePage(page: import("playwright").Page, franchise: { id: string; name: string }, count: string) {
  await page.getByRole("link", { name: `Bưu cục của ${franchise.name}: ${count}`, exact: true }).click();
  await page.waitForURL(`**/workspace/organizations/${franchise.id}/post-offices`);
  await page.getByRole("heading", { name: "Bưu cục", exact: true }).waitFor();
  // The app's top progress bar runs until the new page settles.
  await page.locator('[role="status"][aria-label="Đang tải trang"]').waitFor({ state: "hidden" });
}

export default [
  directoryFlow({
    id: "quan-ly-nhuong-quyen", name: "QUẢN LÝ NHƯỢNG QUYỀN CHỈ THẤY BƯU CỤC CỦA MÌNH", setup: { viewer: "manager", canOpenPostOffice: true },
    async run({ page, shot, mock }) {
      await openDirectory(page);
      await expect(page.getByRole("tab")).toHaveCount(1);
      await expect(tab(page, "Bưu cục")).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("columnheader", { name: "Thuộc nhượng quyền" })).toHaveCount(0);
      await expect(openButton(page)).toBeEnabled();
      await nameCell(page, VAN_QUAN.name).waitFor();
      await shot("chi-the-buu-cuc", "Chỉ có thẻ Bưu cục của nhượng quyền mình, nút Mở bưu cục", { mode: "fullPage" });

      await openFilters(page);
      await filterPanel(page).getByRole("checkbox", { name: "Loại hình bưu cục", exact: true }).waitFor();
      // Six criteria and no "Xem thêm": "Thuộc nhượng quyền" is for Tổng công ty only.
      await expect(filterPanel(page).getByRole("button", { name: "Xem thêm", exact: true })).toHaveCount(0);
      await expect(filterPanel(page).getByRole("checkbox", { name: "Thuộc nhượng quyền", exact: true })).toHaveCount(0);
      await shot("bo-loc-nang-cao", "Bấm Bộ lọc: không có tiêu chí Thuộc nhượng quyền");

      await page.keyboard.press("Escape");
      await filterPanel(page).waitFor({ state: "hidden" });
      await openButton(page).click();
      await page.getByRole("heading", { name: `Mở bưu cục cho ${HA_DONG.name}`, exact: true }).waitFor();
      await shot("trang-mo-buu-cuc", "Bấm Mở bưu cục: nơi thuộc là nhượng quyền của mình");

      // Another manager, not granted the right to open post offices, on the same list.
      mock.canOpenPostOffice = false;
      await openDirectory(page);
      await expect(openButton(page)).toHaveCount(0);
      await shot("chua-duoc-cap-quyen", "Chưa được cấp quyền mở bưu cục: không có nút", { mode: "fullPage" });
    },
  }),
  directoryFlow({
    id: "nhuong-quyen-tam-ngung", name: "NHƯỢNG QUYỀN TẠM NGƯNG KHÔNG MỞ ĐƯỢC BƯU CỤC",
    setup: { viewer: "manager", canOpenPostOffice: true, haDongStatus: "SUSPENDED" },
    async run({ page, shot }) {
      await openDirectory(page);
      await expect(openButton(page)).toBeDisabled();
      await page.getByText(`Bị chặn vì ${HA_DONG.name} đang tạm ngưng`).first().waitFor();
      await shot("bi-chan", "Nút Mở bưu cục tắt; bưu cục giữ trạng thái riêng, kèm dòng Bị chặn vì…", { mode: "fullPage" });

      // The reason of a greyed button shows in its dark tooltip on hover or focus; focus keeps it while the pointer is parked.
      // A full-page picture resizes the window, which hides the tooltip: this one is taken as the viewport.
      await openButton(page).locator("..").focus();
      await page.getByRole("tooltip").filter({ hasText: SUSPENDED }).waitFor();
      await shot("nut-mo-buu-cuc-tat", "Trỏ vào nút Mở bưu cục: lý do trong chú thích");
    },
  }),
  directoryFlow({
    id: "trang-nhuong-quyen", name: "THẺ BƯU CỤC Ở TRANG NHƯỢNG QUYỀN",
    async run({ page, shot }) {
      await openDirectory(page);
      await nameCell(page, HA_DONG.name).waitFor();
      await shot("danh-sach-nhuong-quyen", "Thẻ Nhượng quyền: cột Số bưu cục", { mode: "fullPage" });

      await openFranchisePage(page, HA_DONG, "5");
      await waitRows(page);
      await expect(openButton(page)).toBeEnabled();
      await expect(page.getByRole("columnheader", { name: "Thuộc nhượng quyền" })).toHaveCount(0);
      await shot("the-buu-cuc", "Bấm số bưu cục: thẻ Bưu cục của Nhượng quyền Hà Đông, nút Mở bưu cục", { mode: "fullPage" });

      await openFilters(page);
      await filterPanel(page).getByRole("checkbox", { name: "Loại hình bưu cục", exact: true }).waitFor();
      await shot("bo-loc-nang-cao", "Bấm Bộ lọc: trạng thái, loại hình, tỉnh, phường xã…");

      await tick(page, "Tỉnh/Thành phố");
      await pick(page, "Tỉnh/Thành phố", "Thành phố Hà Nội");
      await tick(page, "Phường/Xã/Đặc khu");
      await pick(page, "Phường/Xã/Đặc khu", "Phường Hà Đông");
      await tick(page, "Loại hình bưu cục");
      await pickMany(page, "Loại hình bưu cục", ["Bưu cục giao nhận"]);
      await filterPanel(page).getByText("Đã chọn 1", { exact: true }).waitFor();
      await shot("da-chon-tieu-chi", "Đã chọn tỉnh, phường xã và loại hình bưu cục");

      await applyFilters(page);
      await page.waitForURL(url => new URL(url).searchParams.get("operationModel") === "DELIVERY_PICKUP");
      await appliedFilters(page, 3).waitFor();
      await expect(rows(page)).toHaveCount(1);
      await nameCell(page, VAN_QUAN.name).waitFor();
      await shot("da-loc", "Áp dụng: Bộ lọc đang áp dụng 3 tiêu chí", { mode: "fullPage" });

      // Back on the list by the side link, the franchise with no post office: its count reads "Chưa có".
      await page.getByRole("link", { name: "Danh sách tổ chức", exact: true }).click();
      await page.waitForURL(url => url.pathname === "/workspace/organizations");
      await waitRows(page);
      await openFranchisePage(page, HAI_PHONG, "Chưa có");
      await page.getByRole("heading", { name: `${HAI_PHONG.name} chưa có bưu cục nào.`, exact: true }).waitFor();
      await expect(openButton(page)).toBeEnabled();
      await shot("chua-co-buu-cuc", "Về danh sách, bấm Chưa có ở Nhượng quyền Hải Phòng: chưa có bưu cục nào", { mode: "fullPage" });
    },
  }),
];
