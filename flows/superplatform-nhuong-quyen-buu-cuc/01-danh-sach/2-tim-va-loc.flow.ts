import { expect } from "playwright/test";
import {
  DA_NANG, GIA_LAI, HA_DONG, MESSAGES, VAN_QUAN, appliedFilters, applyFilters, directoryFlow, filterButton, filterPanel, nameCell, openDirectory,
  openFilters, pick, rows, search, searchBox, tab, tick, waitRows,
} from "../../_helpers/superplatform-directory";

const NO_MATCH = "Không có đơn vị nào khớp.";

export default [
  directoryFlow({
    id: "tim-kiem", name: "TÌM THEO SỐ ĐIỆN THOẠI HOẶC MÃ SỐ",
    async run({ page, shot }) {
      await openDirectory(page, "?tab=POST_OFFICE");
      await nameCell(page, VAN_QUAN.name).waitFor();
      await shot("danh-sach-buu-cuc", "Thẻ Bưu cục, ô tìm kiếm", { mode: "fullPage" });

      await search(page, "van quan");
      await expect(rows(page)).toHaveCount(1);
      await nameCell(page, VAN_QUAN.name).waitFor();
      await shot("tim-ten-khong-dau", "Gõ tên không dấu: ra BƯU CỤC VĂN QUÁN", { mode: "fullPage" });

      await search(page, "+84 24 3355 1234");
      await expect(rows(page)).toHaveCount(1);
      await nameCell(page, VAN_QUAN.name).waitFor();
      await page.getByRole("cell", { name: "024 3355 1234", exact: true }).waitFor();
      await shot("tim-so-dien-thoai", "Gõ số điện thoại có +84: ra bưu cục có số đó", { mode: "fullPage" });

      // The keyword is kept across tabs; wait for the switch to settle before typing a new one.
      await tab(page, "Nhượng quyền").click();
      await page.waitForURL(url => new URL(url).searchParams.get("tab") === "FRANCHISE_PARTNER");
      await page.getByRole("heading", { name: NO_MATCH, exact: true }).waitFor();
      await search(page, "0109876543");
      await expect(rows(page)).toHaveCount(1);
      await nameCell(page, HA_DONG.name).waitFor();
      await shot("tim-ma-so-doanh-nghiep", "Sang thẻ Nhượng quyền, gõ mã số doanh nghiệp", { mode: "fullPage" });

      await search(page, "064085006358");
      await expect(rows(page)).toHaveCount(1);
      await nameCell(page, GIA_LAI.name).waitFor();
      await expect(rows(page).first()).toContainText("********6358");
      await shot("tim-so-dinh-danh", "Gõ đủ 12 số định danh: ra hộ kinh doanh, số vẫn che", { mode: "fullPage" });

      await search(page, "006358");
      await page.getByRole("heading", { name: NO_MATCH, exact: true }).waitFor();
      await shot("mot-phan-so-dinh-danh", "Gõ một phần số định danh: không ra", { mode: "fullPage" });

      await search(page, "");
      await waitRows(page);
      await searchBox(page).fill("Nhượng quyền vận chuyển giao nhận hàng hóa nhanh tại các phường trung tâm Thành phố Hà Nội và Thành phố Hồ Chí Minh");
      await page.getByText(MESSAGES.searchTooLong, { exact: true }).waitFor();
      await shot("tu-khoa-qua-dai", "Từ khóa quá 100 ký tự");
    },
  }),
  directoryFlow({
    id: "khong-khop", name: "KHÔNG CÓ ĐƠN VỊ NÀO KHỚP",
    async run({ page, shot }) {
      await openDirectory(page);
      await nameCell(page, HA_DONG.name).waitFor();
      await shot("danh-sach", "Danh sách tổ chức, thẻ Nhượng quyền", { mode: "fullPage" });

      await search(page, "Long Biên");
      await page.getByRole("heading", { name: NO_MATCH, exact: true }).waitFor();
      await shot("khong-khop-tu-khoa", "Gõ Long Biên: không có đơn vị nào khớp từ khóa", { mode: "fullPage" });

      // The list has no "Xóa tìm kiếm" button of its own: the box is emptied.
      await search(page, "");
      await waitRows(page);
      await expect(searchBox(page)).toHaveValue("");
      await shot("xoa-tim-kiem", "Xóa từ khóa: danh sách trở lại", { mode: "fullPage" });

      await openFilters(page);
      await tick(page, "Tạm ngưng");
      await tick(page, "Tỉnh/Thành phố");
      await pick(page, "Tỉnh/Thành phố", "Thành phố Đà Nẵng");
      await shot("chon-bo-loc", "Bấm Bộ lọc, chọn Tạm ngưng và Thành phố Đà Nẵng");

      await applyFilters(page);
      await page.getByRole("heading", { name: NO_MATCH, exact: true }).waitFor();
      await appliedFilters(page, 2).waitFor();
      await shot("khong-khop-bo-loc", "Áp dụng: không có đơn vị nào khớp bộ lọc", { mode: "fullPage" });

      await openFilters(page);
      await filterPanel(page).getByRole("button", { name: "Bỏ lọc", exact: true }).waitFor();
      await shot("mo-lai-bo-loc", "Mở lại Bộ lọc: nút Bỏ lọc");

      await filterPanel(page).getByRole("button", { name: "Bỏ lọc", exact: true }).click();
      await waitRows(page);
      await nameCell(page, DA_NANG.name).waitFor();
      await page.keyboard.press("Escape");
      await filterPanel(page).waitFor({ state: "hidden" });
      await expect(filterButton(page)).toHaveAccessibleName("Bộ lọc");
      await shot("xoa-bo-loc", "Bỏ lọc: danh sách trở lại mặc định", { mode: "fullPage" });
    },
  }),
];
