import { expect } from "playwright/test";
import {
  DA_NANG, GIA_LAI, HA_DONG, MESSAGES, VAN_QUAN, advancedButton, choose, directoryFlow, nameCell, openDirectory, rows, scrollTableToEnd, search, searchBox, tab, waitRows,
} from "../../_helpers/superplatform-directory";

const NO_MATCH = "Không có đơn vị nào khớp.";

export default [
  directoryFlow({
    id: "tim-kiem", name: "03. TÌM THEO SỐ ĐIỆN THOẠI HOẶC MÃ SỐ",
    async run({ page, shot }) {
      await openDirectory(page, "?tab=POST_OFFICE");
      await search(page, "van quan");
      await expect(rows(page)).toHaveCount(1);
      await nameCell(page, VAN_QUAN.name).waitFor();
      await shot("tim-ten-khong-dau", "Gõ tên không dấu: ra BƯU CỤC VĂN QUÁN", { mode: "fullPage" });

      await search(page, "+84 24 3355 1234");
      await expect(rows(page)).toHaveCount(1);
      await nameCell(page, VAN_QUAN.name).waitFor();
      // The post-office table is wider than the card at 1440 px: scroll it so the phone column shows.
      await scrollTableToEnd(page);
      await page.getByRole("cell", { name: "024 3355 1234", exact: true }).waitFor();
      await shot("tim-so-dien-thoai", "Gõ số điện thoại có +84: ra bưu cục có số đó", { mode: "fullPage" });

      // The keyword is kept across tabs; wait for the switch to settle before typing a new one.
      await tab(page, "Nhượng quyền").click();
      await page.waitForURL(url => new URL(url).searchParams.get("tab") === "FRANCHISE_PARTNER");
      await page.getByRole("heading", { name: NO_MATCH, exact: true }).waitFor();
      await search(page, "0109876543");
      await expect(rows(page)).toHaveCount(1);
      await nameCell(page, HA_DONG.name).waitFor();
      await shot("tim-ma-so-doanh-nghiep", "Thẻ Nhượng quyền: gõ mã số doanh nghiệp", { mode: "fullPage" });

      await search(page, "064085006358");
      await expect(rows(page)).toHaveCount(1);
      await nameCell(page, GIA_LAI.name).waitFor();
      await expect(rows(page).first()).toContainText("********6358");
      await shot("tim-so-dinh-danh", "Gõ đủ 12 số định danh: ra hộ kinh doanh, số vẫn che", { mode: "fullPage" });

      await search(page, "006358");
      await page.getByRole("heading", { name: NO_MATCH, exact: true }).waitFor();
      await shot("mot-phan-so-dinh-danh", "Gõ một phần số định danh: không ra", { mode: "fullPage" });

      await page.getByRole("button", { name: "Xóa tìm kiếm", exact: true }).click();
      await waitRows(page);
      await searchBox(page).fill("Nhượng quyền vận chuyển giao nhận hàng hóa nhanh tại các phường trung tâm Thành phố Hà Nội và Thành phố Hồ Chí Minh");
      await page.getByText(MESSAGES.searchTooLong, { exact: true }).waitFor();
      await shot("tu-khoa-qua-dai", "Từ khóa quá 100 ký tự");
    },
  }),
  directoryFlow({
    id: "khong-khop", name: "04. KHÔNG CÓ ĐƠN VỊ NÀO KHỚP",
    async run({ page, shot }) {
      await openDirectory(page);
      await search(page, "Long Biên");
      await page.getByRole("heading", { name: NO_MATCH, exact: true }).waitFor();
      await shot("khong-khop-tu-khoa", "Không có đơn vị nào khớp từ khóa, nút Xóa tìm kiếm", { mode: "fullPage" });

      await page.getByRole("button", { name: "Xóa tìm kiếm", exact: true }).click();
      await waitRows(page);
      await expect(searchBox(page)).toHaveValue("");
      await shot("xoa-tim-kiem", "Xóa tìm kiếm: danh sách trở lại", { mode: "fullPage" });

      await choose(page, "filter-status", "Tạm ngưng");
      await advancedButton(page).click();
      await choose(page, "filter-provinceCode", "Thành phố Đà Nẵng");
      await page.getByRole("heading", { name: NO_MATCH, exact: true }).waitFor();
      await expect(advancedButton(page)).toHaveText("Bộ lọc nâng cao (1)");
      await shot("khong-khop-bo-loc", "Không có đơn vị nào khớp bộ lọc, nút Xóa bộ lọc", { mode: "fullPage" });

      await page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
      await waitRows(page);
      await nameCell(page, DA_NANG.name).waitFor();
      await expect(advancedButton(page)).toHaveText("Bộ lọc nâng cao");
      await shot("xoa-bo-loc", "Xóa bộ lọc: mọi ô về mặc định", { mode: "fullPage" });
    },
  }),
];
