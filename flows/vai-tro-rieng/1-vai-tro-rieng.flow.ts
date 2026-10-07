import {
  ROLE_CREATOR_PERMISSIONS, acknowledge, openDialog, openOwnRole, openRoleList, ownRolesFlow, togglePermissions, waitRoleForm,
} from "../_helpers/supership-own-roles";
import { OWNER_PERMISSIONS } from "../_helpers/supership-shop-roles";

// A shop's own roles: creating one on a single page, looking at it, and changing it later; the members who
// hold it always get the change. The backend is a stand-in (see mockOwnRoles).
const submit = (page: Parameters<typeof waitRoleForm>[0], name: string) => page.getByRole("button", { name, exact: true }).first();

export default [
  ownRolesFlow({
    id: "tao",
    name: "TẠO VAI TRÒ RIÊNG",
    async run({ page, shot }) {
      await openRoleList(page);
      await shot("danh-sach-vai-tro", "Danh sách vai trò, chưa có vai trò riêng", { mode: "fullPage" });

      await page.getByRole("link", { name: "Tạo vai trò" }).click();
      await waitRoleForm(page, "Tạo vai trò");
      await shot("trang-tao-vai-tro", "Trang tạo vai trò", { mode: "fullPage" });

      await page.locator("#role-name").fill("Nhân viên kho");
      await page.locator("#role-description").fill("Soạn hàng và cập nhật đơn hàng.");
      await togglePermissions(page, ["Xem đơn hàng", "Cập nhật đơn hàng", "Xem thành viên"]);
      await shot("da-nhap-va-chon-quyen", "Đã nhập tên và chọn quyền", { mode: "fullPage" });

      await submit(page, "Tạo vai trò").click();
      await openDialog(page).getByText("Đã tạo vai trò.").waitFor();
      await shot("tao-thanh-cong", "Tạo vai trò thành công");
      await acknowledge(page, "Đã tạo vai trò.");

      await page.getByRole("heading", { level: 1, name: "Nhân viên kho" }).waitFor();
      await page.getByText(/^Đang tải/).first().waitFor({ state: "detached" }).catch(() => undefined);
      await shot("chi-tiet-vai-tro", "Chi tiết vai trò vừa tạo", { mode: "fullPage" });

      await openRoleList(page);
      await page.getByRole("link", { name: "Nhân viên kho", exact: true }).waitFor();
      await shot("danh-sach-sau-khi-tao", "Danh sách vai trò sau khi tạo", { mode: "fullPage" });
    },
  }),

  ownRolesFlow({
    id: "thieu-thong-tin",
    name: "TẠO VAI TRÒ RIÊNG THẤT BẠI DO THIẾU THÔNG TIN",
    async run({ page, shot }) {
      await openRoleList(page);
      await page.getByRole("link", { name: "Tạo vai trò" }).click();
      await waitRoleForm(page, "Tạo vai trò");
      await shot("trang-tao-vai-tro", "Trang tạo vai trò");

      // The name is typed and then removed: what is missing is said under the field, and nothing can be saved.
      await page.locator("#role-name").fill("Nhân viên kho");
      await page.locator("#role-name").fill("");
      await page.getByText("Vui lòng nhập tên vai trò.").waitFor();
      await shot("thieu-ten-vai-tro", "Thiếu tên vai trò");

      await page.locator("#role-name").fill("Nhân viên kho");
      await submit(page, "Tạo vai trò").and(page.locator(":disabled")).waitFor();
      await shot("chua-chon-quyen", "Chưa chọn quyền, nút tạo vai trò bị khóa");
    },
  }),

  ownRolesFlow({
    id: "chinh-sua",
    name: "CHỈNH SỬA VAI TRÒ RIÊNG",
    async run({ page, shot, roles, log }) {
      roles.seed("Nhân viên kho", "Soạn hàng và cập nhật đơn hàng.", ["order.view", "order.update", "membership.view"]);
      await openRoleList(page);
      await page.getByRole("link", { name: "Nhân viên kho", exact: true }).click();
      await page.getByRole("heading", { level: 1, name: "Nhân viên kho" }).waitFor();
      await page.getByText(/^Đang tải/).first().waitFor({ state: "detached" }).catch(() => undefined);
      await shot("chi-tiet-vai-tro", "Chi tiết vai trò", { mode: "fullPage" });

      await page.getByRole("link", { name: "Chỉnh sửa" }).click();
      await waitRoleForm(page, "Chỉnh sửa vai trò");
      await shot("trang-chinh-sua", "Trang chỉnh sửa vai trò", { mode: "fullPage" });

      await togglePermissions(page, ["Tạo đơn hàng", "Xem thành viên"]);
      await shot("da-doi-quyen", "Đã đổi quyền của vai trò", { mode: "fullPage" });

      await submit(page, "Lưu thay đổi").click();
      await openDialog(page).getByText("Đã cập nhật vai trò.").waitFor();
      log(`move_assignments gửi lên: ${roles.lastMoveAssignments()}`);
      await shot("cap-nhat-thanh-cong", "Cập nhật vai trò thành công");
      await acknowledge(page, "Đã cập nhật vai trò.");

      await page.getByRole("heading", { level: 1, name: "Nhân viên kho" }).waitFor();
      await page.getByText(/^Đang tải/).first().waitFor({ state: "detached" }).catch(() => undefined);
      await shot("chi-tiet-sau-khi-sua", "Chi tiết vai trò sau khi chỉnh sửa", { mode: "fullPage" });
    },
  }),
  ownRolesFlow({
    id: "doi-ten",
    name: "ĐỔI TÊN VÀ MÔ TẢ VAI TRÒ RIÊNG",
    async run({ page, shot, roles }) {
      roles.seed("Nhân viên kho", "Soạn hàng và cập nhật đơn hàng.", ["order.view", "order.update", "membership.view"]);
      await openRoleList(page);
      await openOwnRole(page, "Nhân viên kho");
      await shot("chi-tiet-vai-tro", "Chi tiết vai trò", { mode: "fullPage" });

      await page.getByRole("link", { name: "Chỉnh sửa" }).click();
      await waitRoleForm(page, "Chỉnh sửa vai trò");
      await page.locator("#role-name").fill("Thủ kho");
      await page.locator("#role-description").fill("Quản lý kho và soạn hàng theo đơn.");
      await shot("da-doi-ten-va-mo-ta", "Đã đổi tên và mô tả");

      await submit(page, "Lưu thay đổi").click();
      await openDialog(page).getByText("Đã cập nhật vai trò.").waitFor();
      await shot("cap-nhat-thanh-cong", "Cập nhật vai trò thành công");
      await acknowledge(page, "Đã cập nhật vai trò.");

      await page.getByRole("heading", { level: 1, name: "Thủ kho" }).waitFor();
      await page.getByText(/^Đang tải/).first().waitFor({ state: "detached" }).catch(() => undefined);
      await shot("chi-tiet-sau-khi-doi-ten", "Chi tiết vai trò sau khi đổi tên", { mode: "fullPage" });
    },
  }),

  ownRolesFlow({
    id: "trang-thai-khac",
    name: "CÁC TRẠNG THÁI KHÁC CỦA VAI TRÒ RIÊNG",
    async run({ page, shot, roles, backend }) {
      roles.seed("Nhân viên kho", "Soạn hàng và cập nhật đơn hàng.", ["order.view", "order.update", "membership.view"]);
      roles.seedUnfinished("Thu ngân");

      // A role whose creation stopped before its permissions were saved: it is finished from Chỉnh sửa.
      await openRoleList(page);
      await openOwnRole(page, "Thu ngân");
      await page.getByText("Vai trò chưa có quyền").waitFor();
      await shot("vai-tro-chua-co-quyen", "Vai trò chưa có quyền");

      // Someone who may choose a role's permissions but not rename it: the name and description are read-only.
      backend.setPermissions(ROLE_CREATOR_PERMISSIONS);
      await openRoleList(page);
      await openOwnRole(page, "Nhân viên kho");
      await page.getByRole("link", { name: "Chỉnh sửa" }).click();
      await waitRoleForm(page, "Chỉnh sửa vai trò");
      await shot("khong-duoc-doi-ten", "Chỉnh sửa vai trò khi không có quyền đổi tên");

      // Someone who may not create roles sees no own-role section at all, only the roles in use.
      backend.setPermissions(OWNER_PERMISSIONS);
      await openRoleList(page);
      await page.getByRole("heading", { level: 2, name: "Vai trò riêng", exact: true }).waitFor({ state: "detached" });
      await shot("khong-co-quyen-tao-vai-tro", "Thành viên không có quyền tạo vai trò riêng", { mode: "fullPage" });
    },
  }),
];
