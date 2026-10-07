import type { Page } from "playwright";
import {
  AREA, THU, VIET, memberFlow, openDialog, openMemberTab, showHistory, successNotice, waitLoaded,
} from "../_helpers/supership-shop-members";

// The "Quyền bị thu hồi" tab: permissions a member's roles would give but that were taken away from
// them. The list with its history, the page that takes more away, and giving one back.
const group = AREA.revoked;

async function openRevokedTab(page: Page) {
  await openMemberTab(page, VIET, "Quyền bị thu hồi");
  await page.getByRole("button", { name: "Khôi phục" }).waitFor();
}

export default [
  memberFlow({
    id: "quyen-bi-thu-hoi-xem",
    group,
    name: "XEM DANH SÁCH QUYỀN BỊ THU HỒI",
    async run({ page, shot }) {
      await openRevokedTab(page);
      await shot("quyen-bi-thu-hoi-hien-tai", "Quyền đang bị thu hồi của thành viên");

      await showHistory(page);
      await page.getByText("Đã khôi phục").first().waitFor();
      await shot("lich-su", "Lịch sử thu hồi và khôi phục quyền");

      await openMemberTab(page, THU, "Quyền bị thu hồi");
      await page.getByText("Chưa có quyền bị thu hồi").waitFor();
      await shot("chua-co-quyen-bi-thu-hoi", "Thành viên chưa có quyền bị thu hồi");
    },
  }),

  memberFlow({
    id: "quyen-bi-thu-hoi-thu-hoi",
    group,
    name: "THU HỒI QUYỀN CỦA THÀNH VIÊN",
    async run({ page, shot }) {
      await openRevokedTab(page);
      await shot("quyen-bi-thu-hoi-hien-tai", "Quyền đang bị thu hồi của thành viên");

      await page.getByRole("button", { name: "Thu hồi quyền" }).click();
      await page.getByRole("heading", { level: 1, name: "Thu hồi quyền" }).waitFor();
      await waitLoaded(page);
      await page.getByRole("button", { name: "Mở tất cả" }).click();
      await shot("trang-thu-hoi-quyen", "Trang thu hồi quyền", { mode: "fullPage" });

      await page.getByRole("checkbox", { name: /^Tạo đơn hàng/ }).check();
      await page.getByRole("button", { name: "Thu hồi quyền", exact: true }).first().waitFor();
      await shot("da-chon-quyen", "Đã chọn quyền cần thu hồi", { mode: "fullPage" });

      await page.getByRole("button", { name: "Thu hồi quyền", exact: true }).first().click();
      const revoked = await successNotice(page, "Đã thu hồi 1 quyền của thành viên.");
      await shot("thu-hoi-thanh-cong", "Thu hồi quyền thành công");
      await revoked.close();

      await page.getByText("Tạo đơn hàng").waitFor();
      await shot("quyen-bi-thu-hoi-sau-khi-thu-hoi", "Danh sách quyền bị thu hồi sau khi thu hồi");
    },
  }),

  memberFlow({
    id: "quyen-bi-thu-hoi-khoi-phuc",
    group,
    name: "KHÔI PHỤC QUYỀN ĐÃ THU HỒI",
    async run({ page, shot }) {
      await openRevokedTab(page);
      await shot("quyen-bi-thu-hoi-hien-tai", "Quyền đang bị thu hồi của thành viên");

      await page.getByRole("button", { name: "Khôi phục" }).first().click();
      await openDialog(page).getByText("Khôi phục quyền này?").waitFor();
      await shot("xac-nhan-khoi-phuc", "Xác nhận khôi phục quyền");

      await openDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
      const restored = await successNotice(page, "Đã khôi phục quyền cho thành viên.");
      await shot("khoi-phuc-thanh-cong", "Khôi phục quyền thành công");
      await restored.close();

      await page.getByText("Chưa có quyền bị thu hồi").waitFor();
      await shot("quyen-bi-thu-hoi-sau-khi-khoi-phuc", "Danh sách quyền bị thu hồi sau khi khôi phục");
    },
  }),
];
