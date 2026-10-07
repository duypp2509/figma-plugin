import type { Page } from "playwright";
import {
  AREA, THU, VIET, choose, errorNotice, memberFlow, openDialog, openMemberTab, showHistory, successNotice,
} from "../_helpers/supership-shop-members";
import { SHOP_ACCOUNTANT, SHOP_OPERATOR } from "../_helpers/supership-shop-roles";

// The "Vai trò" tab of a member's page: the roles held now, what one of them allows, the history, giving
// a role (which the backend refuses when the member already holds it) and taking one back.
const group = AREA.roles;

const detailButton = (page: Page, role: string) => page.getByRole("button", { name: `Xem chi tiết vai trò ${role}` });

async function openRolesTab(page: Page) {
  await openMemberTab(page, VIET, "Vai trò");
  await detailButton(page, SHOP_OPERATOR.name).waitFor();
}

/** The "Cấp vai trò" dialog with a role chosen. */
async function chooseRoleToGrant(page: Page, shot: (id: string, title: string) => Promise<void>, role: string, chosenTitle: string) {
  await page.getByRole("button", { name: "Cấp vai trò" }).click();
  const form = openDialog(page);
  await form.getByRole("combobox").first().waitFor();
  await shot("cap-vai-tro", "Cấp vai trò");

  await choose(page, form.getByRole("combobox").first(), role);
  await shot("da-chon-vai-tro", chosenTitle);
  return form;
}

export default [
  memberFlow({
    id: "vai-tro-xem",
    group,
    name: "XEM VAI TRÒ",
    async run({ page, shot }) {
      await openRolesTab(page);
      await shot("vai-tro-hien-tai", "Vai trò hiện có của thành viên");

      // A member who has just joined, with nothing given yet.
      await openMemberTab(page, THU, "Vai trò");
      await page.getByText("Chưa được cấp vai trò").waitFor();
      await shot("chua-co-vai-tro", "Thành viên chưa được cấp vai trò");
    },
  }),

  memberFlow({
    id: "vai-tro-chi-tiet",
    group,
    name: "XEM CHI TIẾT QUYỀN TRONG VAI TRÒ ĐƯỢC CẤP",
    async run({ page, shot }) {
      await openRolesTab(page);
      await shot("vai-tro-hien-tai", "Vai trò hiện có của thành viên");

      await detailButton(page, SHOP_OPERATOR.name).click();
      await openDialog(page).getByText(/^Quyền trong vai trò/).waitFor();
      await shot("chi-tiet-vai-tro", "Chi tiết quyền trong vai trò được cấp");
    },
  }),

  memberFlow({
    id: "vai-tro-lich-su",
    group,
    name: "XEM LỊCH SỬ CẤP VAI TRÒ CỦA THÀNH VIÊN",
    async run({ page, shot }) {
      await openRolesTab(page);
      await shot("vai-tro-hien-tai", "Vai trò hiện có của thành viên");

      await showHistory(page);
      await page.getByText("Đã thu hồi").first().waitFor();
      await shot("lich-su-vai-tro", "Lịch sử cấp và thu hồi vai trò");

      await detailButton(page, SHOP_ACCOUNTANT.name).click();
      await openDialog(page).getByText(/^Quyền trong vai trò/).waitFor();
      await shot("chi-tiet-vai-tro-da-thu-hoi", "Chi tiết vai trò đã thu hồi");
    },
  }),

  memberFlow({
    id: "vai-tro-them-thanh-cong",
    group,
    name: "THÊM VAI TRÒ CHO THÀNH VIÊN",
    async run({ page, shot }) {
      await openRolesTab(page);
      await shot("vai-tro-hien-tai", "Vai trò hiện có của thành viên");

      const form = await chooseRoleToGrant(page, shot, SHOP_ACCOUNTANT.name, "Đã chọn vai trò cần cấp");
      await form.getByRole("button", { name: "Cấp vai trò" }).click();
      const granted = await successNotice(page, "Đã cấp vai trò cho thành viên.");
      await shot("cap-vai-tro-thanh-cong", "Cấp vai trò thành công");
      await granted.close();

      await detailButton(page, SHOP_ACCOUNTANT.name).waitFor();
      await shot("vai-tro-sau-khi-cap", "Danh sách vai trò sau khi cấp");
    },
  }),

  memberFlow({
    id: "vai-tro-them-that-bai",
    group,
    name: "THÊM VAI TRÒ CHO THÀNH VIÊN THẤT BẠI DO VAI TRÒ ĐÃ ĐƯỢC GÁN CHO THÀNH VIÊN ĐÓ RỒI",
    async run({ page, shot }) {
      await openRolesTab(page);
      await shot("vai-tro-hien-tai", "Vai trò hiện có của thành viên");

      // The list offers every role of the shop, the ones already held included.
      const form = await chooseRoleToGrant(page, shot, SHOP_OPERATOR.name, "Chọn vai trò thành viên đang có");
      await form.getByRole("button", { name: "Cấp vai trò" }).click();
      await errorNotice(page, "Thành viên đã có vai trò này và vai trò vẫn đang hiệu lực.");
      await shot("khong-cap-duoc-vai-tro", "Không cấp được vai trò");
    },
  }),

  memberFlow({
    id: "vai-tro-thu-hoi",
    group,
    name: "THU HỒI VAI TRÒ KHỎI THÀNH VIÊN",
    async run({ page, shot }) {
      await openRolesTab(page);
      await shot("vai-tro-hien-tai", "Vai trò hiện có của thành viên");

      await detailButton(page, SHOP_OPERATOR.name).click();
      await openDialog(page).getByRole("button", { name: "Thu hồi", exact: true }).waitFor();
      await shot("chi-tiet-vai-tro", "Chi tiết vai trò cần thu hồi");

      await openDialog(page).getByRole("button", { name: "Thu hồi", exact: true }).click();
      await openDialog(page).getByText("Thu hồi vai trò này?").waitFor();
      await shot("xac-nhan-thu-hoi", "Xác nhận thu hồi vai trò");

      await openDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
      const revoked = await successNotice(page, "Đã thu hồi vai trò của thành viên.");
      await shot("thu-hoi-thanh-cong", "Thu hồi vai trò thành công");
      await revoked.close();

      await openDialog(page).getByRole("button", { name: "Đóng hộp thoại" }).click();
      await page.getByText("Chưa được cấp vai trò").waitFor();
      await shot("vai-tro-sau-khi-thu-hoi", "Danh sách vai trò sau khi thu hồi");
    },
  }),
];
