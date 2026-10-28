import { expect } from "playwright/test";
import {
  HA_DONG, HAI_PHONG, VAN_QUAN, advancedButton, choose, combo, directoryFlow, nameCell, openDirectory, rows, scrollTableToEnd, tab, waitRows,
} from "../../_helpers/superplatform-directory";

const openButton = (page: import("playwright").Page) => page.getByRole("button", { name: "Mở bưu cục", exact: true });
const SUSPENDED = `${HA_DONG.name} đang tạm ngưng, không mở được bưu cục.`;

async function openFranchisePage(page: import("playwright").Page, id: string) {
  await page.goto(`/workspace/organizations/${id}/post-offices`);
  await page.getByRole("heading", { name: "Bưu cục", exact: true }).waitFor();
}

export default [
  directoryFlow({
    id: "quan-ly-nhuong-quyen", name: "05. QUẢN LÝ NHƯỢNG QUYỀN CHỈ THẤY BƯU CỤC CỦA MÌNH", setup: { viewer: "manager", canOpenPostOffice: true },
    async run({ page, shot, mock }) {
      await openDirectory(page);
      await expect(page.getByRole("tab")).toHaveCount(1);
      await expect(tab(page, "Bưu cục")).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("columnheader", { name: "Thuộc nhượng quyền" })).toHaveCount(0);
      await expect(openButton(page)).toBeEnabled();
      await nameCell(page, VAN_QUAN.name).waitFor();
      await shot("chi-the-buu-cuc", "Chỉ có thẻ Bưu cục của nhượng quyền mình, nút Mở bưu cục", { mode: "fullPage" });

      await advancedButton(page).click();
      await combo(page, "filter-operationModel").waitFor();
      await expect(combo(page, "filter-franchiseId")).toHaveCount(0);
      await shot("bo-loc-nang-cao", "Bộ lọc nâng cao: không có ô Thuộc nhượng quyền", { mode: "fullPage" });

      await openButton(page).click();
      await page.getByRole("heading", { name: `Mở bưu cục cho ${HA_DONG.name}`, exact: true }).waitFor();
      await shot("trang-mo-buu-cuc", "Bấm Mở bưu cục: nơi thuộc là nhượng quyền của mình");

      mock.canOpenPostOffice = false;
      await openDirectory(page);
      await expect(openButton(page)).toHaveCount(0);
      await shot("chua-duoc-cap-quyen", "Chưa được cấp quyền mở bưu cục: không có nút", { mode: "fullPage" });
    },
  }),
  directoryFlow({
    id: "nhuong-quyen-tam-ngung", name: "06. NHƯỢNG QUYỀN TẠM NGƯNG KHÔNG MỞ ĐƯỢC BƯU CỤC",
    setup: { viewer: "manager", canOpenPostOffice: true, haDongStatus: "SUSPENDED" },
    async run({ page, shot }) {
      await openDirectory(page);
      await expect(openButton(page)).toBeDisabled();
      await page.getByText(SUSPENDED, { exact: true }).waitFor();
      await shot("nut-mo-buu-cuc-tat", "Nút Mở bưu cục tắt, kèm lý do", { mode: "fullPage" });

      await scrollTableToEnd(page);
      await page.getByText(`Bị chặn vì ${HA_DONG.name} đang tạm ngưng`).first().waitFor();
      await shot("bi-chan", "Cuộn bảng: bưu cục giữ trạng thái riêng, kèm dòng Bị chặn vì…", { mode: "fullPage" });
    },
  }),
  directoryFlow({
    id: "trang-nhuong-quyen", name: "07. THẺ BƯU CỤC Ở TRANG NHƯỢNG QUYỀN",
    async run({ page, shot }) {
      await openFranchisePage(page, HA_DONG.id);
      await waitRows(page);
      await expect(openButton(page)).toBeEnabled();
      await expect(page.getByRole("columnheader", { name: "Thuộc nhượng quyền" })).toHaveCount(0);
      await shot("the-buu-cuc", "Thẻ Bưu cục của Nhượng quyền Hà Đông, nút Mở bưu cục", { mode: "fullPage" });

      await advancedButton(page).click();
      await combo(page, "po-filter-operationModel").waitFor();
      await shot("bo-loc-nang-cao", "Bộ lọc nâng cao: tỉnh, phường xã, loại hình", { mode: "fullPage" });

      // Each choice is written to the URL; the next one is read from it, so wait for it to land first.
      const landed = (key: string) => page.waitForURL(url => Boolean(new URL(url).searchParams.get(key)));
      await choose(page, "po-filter-provinceCode", "Thành phố Hà Nội");
      await landed("provinceCode");
      await choose(page, "po-filter-wardCode", "Phường Hà Đông");
      await landed("wardCode");
      await choose(page, "po-filter-operationModel", "Bưu cục giao nhận");
      await landed("operationModel");
      await expect(advancedButton(page)).toHaveText("Bộ lọc nâng cao (3)");
      await expect(rows(page)).toHaveCount(1);
      await nameCell(page, VAN_QUAN.name).waitFor();
      await shot("da-loc", "Đã lọc: Bộ lọc nâng cao (3)", { mode: "fullPage" });

      await openFranchisePage(page, HAI_PHONG.id);
      await page.getByRole("heading", { name: `${HAI_PHONG.name} chưa có bưu cục nào.`, exact: true }).waitFor();
      await expect(openButton(page)).toBeEnabled();
      await shot("chua-co-buu-cuc", "Nhượng quyền chưa có bưu cục nào", { mode: "fullPage" });
    },
  }),
];
