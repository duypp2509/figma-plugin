import type { Page } from "playwright";
import {
  AREA, THU, VIET, errorNotice, memberFlow, openDialog, openMemberTab, showHistory, successNotice, waitLoaded,
} from "../_helpers/supership-shop-members";

// The "Quyền bổ sung" tab: permissions given straight to a member, on top of their roles. The list with
// its history, one permission's details, the page that gives more (which the backend refuses for a
// permission the giver does not hold) and taking one back.
const group = AREA.granted;

const detailButton = (page: Page, permission: string) => page.getByRole("button", { name: `Xem chi tiết quyền ${permission}` });

async function openGrantedTab(page: Page) {
  await openMemberTab(page, VIET, "Quyền bổ sung");
  await detailButton(page, "Xuất báo cáo").waitFor();
}

/** From the tab to the page that gives permissions, with every group of permissions open. */
async function openGrantPage(page: Page) {
  await page.getByRole("button", { name: "Cấp thêm quyền" }).click();
  await page.getByRole("heading", { level: 1, name: "Cấp thêm quyền" }).waitFor();
  await waitLoaded(page);
  await page.getByRole("button", { name: "Mở tất cả" }).click();
}

export default [
  memberFlow({
    id: "quyen-bo-sung-xem",
    group,
    name: "XEM DANH SÁCH QUYỀN ĐƯỢC CẤP TRỰC TIẾP",
    async run({ page, shot }) {
      await openGrantedTab(page);
      await shot("quyen-hien-tai", "Quyền được cấp trực tiếp hiện có");

      await showHistory(page);
      await page.getByText("Đối soát COD").waitFor();
      await shot("lich-su", "Lịch sử cấp và thu hồi quyền trực tiếp");

      await openMemberTab(page, THU, "Quyền bổ sung");
      await page.getByText("Chưa có quyền được cấp thêm").waitFor();
      await shot("chua-co-quyen", "Thành viên chưa có quyền được cấp trực tiếp");
    },
  }),

  memberFlow({
    id: "quyen-bo-sung-chi-tiet",
    group,
    name: "XEM CHI TIẾT THÔNG TIN CỦA 1 QUYỀN ĐƯỢC CẤP",
    async run({ page, shot }) {
      await openGrantedTab(page);
      await shot("quyen-hien-tai", "Quyền được cấp trực tiếp hiện có");

      await detailButton(page, "Xuất báo cáo").click();
      await openDialog(page).getByText("Tên quyền").waitFor();
      await shot("chi-tiet-quyen", "Chi tiết thông tin của quyền được cấp");
    },
  }),

  memberFlow({
    id: "quyen-bo-sung-cap-thanh-cong",
    group,
    name: "CẤP QUYỀN TRỰC TIẾP CHO THÀNH VIÊN",
    async run({ page, shot }) {
      await openGrantedTab(page);
      await shot("quyen-hien-tai", "Quyền được cấp trực tiếp hiện có");

      await openGrantPage(page);
      await shot("trang-cap-quyen", "Trang cấp thêm quyền", { mode: "fullPage" });

      await page.getByRole("checkbox", { name: /^Đối soát COD/ }).check();
      await page.getByRole("checkbox", { name: /^Xem vai trò/ }).check();
      await page.getByRole("button", { name: "Cấp 2 quyền" }).first().waitFor();
      await shot("da-chon-quyen", "Đã chọn quyền cần cấp", { mode: "fullPage" });

      await page.getByRole("button", { name: "Đặt ngày kết thúc" }).click();
      await page.getByRole("button", { name: "Bỏ thời hạn" }).waitFor();
      await shot("dat-thoi-han", "Đặt thời hạn cho quyền được cấp", { mode: "fullPage" });
      await page.getByRole("button", { name: "Bỏ thời hạn" }).click();

      await page.getByRole("button", { name: "Cấp 2 quyền" }).first().click();
      const granted = await successNotice(page, "Đã cấp thêm 2 quyền cho thành viên.");
      await shot("cap-quyen-thanh-cong", "Cấp quyền thành công");
      await granted.close();

      await detailButton(page, "Đối soát COD").waitFor();
      await shot("quyen-sau-khi-cap", "Danh sách quyền sau khi cấp");
    },
  }),

  memberFlow({
    id: "quyen-bo-sung-cap-that-bai",
    group,
    name: "CẤP QUYỀN TRỰC TIẾP CHO THÀNH VIÊN THẤT BẠI DO NGƯỜI CẤP KHÔNG CÓ QUYỀN ĐÓ",
    async run({ page, shot, backend }) {
      // The giver lost this permission after the page listed it; the backend only lets a member give what they hold.
      backend.on("POST", /\/memberships\/[^/]+\/direct-permission-assignments$/, () => ({ status: 403, code: "FORBIDDEN", message: "Bạn không có quyền thực hiện thao tác này." }));

      await openGrantedTab(page);
      await shot("quyen-hien-tai", "Quyền được cấp trực tiếp hiện có");

      await openGrantPage(page);
      await page.getByRole("checkbox", { name: /^Đối soát COD/ }).check();
      await page.getByRole("button", { name: "Cấp quyền", exact: true }).first().waitFor();
      await shot("da-chon-quyen", "Đã chọn quyền cần cấp", { mode: "fullPage" });

      await page.getByRole("button", { name: "Cấp quyền", exact: true }).first().click();
      await errorNotice(page, "Không cấp được quyền “Đối soát COD”: bạn không có quyền này nên không thể cấp cho người khác.");
      await shot("khong-cap-duoc-quyen", "Không cấp được quyền");
    },
  }),

  memberFlow({
    id: "quyen-bo-sung-thu-hoi",
    group,
    name: "THU HỒI QUYỀN TRỰC TIẾP CỦA THÀNH VIÊN",
    async run({ page, shot }) {
      await openGrantedTab(page);
      await shot("quyen-hien-tai", "Quyền được cấp trực tiếp hiện có");

      await detailButton(page, "Xuất báo cáo").click();
      await openDialog(page).getByRole("button", { name: "Thu hồi", exact: true }).waitFor();
      await shot("chi-tiet-quyen", "Chi tiết quyền cần thu hồi");

      await openDialog(page).getByRole("button", { name: "Thu hồi", exact: true }).click();
      await openDialog(page).getByText("Thu hồi quyền bổ sung này?").waitFor();
      await shot("xac-nhan-thu-hoi", "Xác nhận thu hồi quyền trực tiếp");

      await openDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
      const revoked = await successNotice(page, "Đã thu hồi quyền bổ sung của thành viên.");
      await shot("thu-hoi-thanh-cong", "Thu hồi quyền trực tiếp thành công");
      await revoked.close();

      await openDialog(page).getByRole("button", { name: "Đóng hộp thoại" }).click();
      await page.getByText("Chưa có quyền được cấp thêm").waitFor();
      await shot("quyen-sau-khi-thu-hoi", "Danh sách quyền sau khi thu hồi");
    },
  }),
];
