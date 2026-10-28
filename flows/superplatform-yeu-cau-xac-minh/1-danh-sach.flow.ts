import { expect } from "playwright/test";
import {
  MESSAGES, SUBJECT, listLoaded, navEntry, openFromMenu, openHome, rest, row, searchBox, typeTab, verificationFlow,
} from "../_helpers/superplatform-verification-requests";

export default [
  verificationFlow({
    id: "danh-sach", name: "XEM DANH SÁCH YÊU CẦU",
    async run({ page, shot }) {
      await openHome(page);
      await expect(navEntry(page)).toContainText("7");
      await rest(page);
      await shot("trang-chu", "Trang chủ: mục Yêu cầu xác minh ở nhóm Tổ chức, có 7 yêu cầu đang chờ");

      await openFromMenu(page);
      await row(page, SUBJECT.household).waitFor();
      await rest(page);
      await shot("danh-sach", "Danh sách yêu cầu chờ xác minh: pháp lý, người đại diện, giấy phép kinh doanh", { mode: "fullPage" });

      await typeTab(page, "Người đại diện").click();
      await expect(typeTab(page, "Người đại diện")).toHaveAttribute("aria-pressed", "true");
      await row(page, SUBJECT.amendment).waitFor({ state: "detached" });
      await listLoaded(page);
      await rest(page);
      await shot("loc-nguoi-dai-dien", "Lọc theo loại yêu cầu: Người đại diện");

      await typeTab(page, "Tất cả").click();
      await row(page, SUBJECT.amendment).waitFor();
      await searchBox(page).fill("Hà Đông");
      await row(page, SUBJECT.shop).waitFor({ state: "detached" });
      await listLoaded(page);
      await rest(page);
      await shot("tim-kiem", "Tìm theo tên đơn vị: Hà Đông");

      await searchBox(page).fill("Hải Phòng");
      await page.getByText(MESSAGES.noMatch, { exact: true }).waitFor();
      await rest(page);
      await shot("khong-phu-hop", "Không có yêu cầu phù hợp");
    },
  }),
  verificationFlow({
    id: "khong-con-yeu-cau", name: "KHÔNG CÒN YÊU CẦU CHỜ XÁC MINH", setup: { empty: true },
    async run({ page, shot }) {
      await openHome(page);
      await rest(page);
      await shot("trang-chu", "Trang chủ: mục Yêu cầu xác minh ở nhóm Tổ chức");

      await openFromMenu(page);
      await page.getByText(MESSAGES.empty, { exact: true }).waitFor();
      await rest(page);
      await shot("danh-sach-trong", "Không có yêu cầu chờ xác minh");
    },
  }),
];
