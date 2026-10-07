import { defineFlow } from "../../capture";
import { KHA_AI_SHOP, mockSignedInShop, type ShopFixture } from "../_helpers/supership-session";
import { GROUP, OWNER_PERMISSIONS, SHOP_ACCOUNTANT, SHOP_ROLES, mockShopRoles, openRole, openRoles } from "../_helpers/supership-shop-roles";

// What the roles pages show when there is nothing to list, and when the member or
// the shop may not use them at all.
export default defineFlow({
  id: "vai-tro-shop-trang-thai-khac",
  group: GROUP,
  name: "2. CÁC TRẠNG THÁI KHÁC",
  app: "supership",
  async run({ page, shot, log }) {
    const shop: ShopFixture = { ...KHA_AI_SHOP };
    const backend = await mockSignedInShop(page, shop, OWNER_PERMISSIONS, log);

    mockShopRoles(backend, shop, []);
    await openRoles(page);
    await page.getByText("Chưa có vai trò", { exact: true }).waitFor();
    await shot("chua-co-vai-tro", "Cửa hàng chưa có vai trò");

    // A role the platform has not given any permission yet.
    mockShopRoles(backend, shop, SHOP_ROLES.map((role) => role === SHOP_ACCOUNTANT ? { ...role, permissions: [] } : role));
    await openRoles(page);
    await openRole(page, SHOP_ACCOUNTANT);
    await page.getByText("Vai trò chưa có quyền").waitFor();
    await shot("vai-tro-chua-co-quyen", "Vai trò chưa có quyền");

    // A member whose role does not include viewing roles opens the address directly.
    mockShopRoles(backend, shop);
    backend.setPermissions(OWNER_PERMISSIONS.filter((key) => key !== "role.view" && key !== "role.assign"));
    await openRoles(page);
    await page.getByText("Không có quyền truy cập").waitFor();
    await shot("khong-co-quyen-xem", "Thành viên không có quyền xem vai trò");

    // A single-user shop has no members to give roles to, so it has no roles section.
    backend.setPermissions(OWNER_PERMISSIONS);
    shop.userModel = "SINGLE_USER";
    await openRoles(page);
    await page.getByText("Chỉ dành cho cửa hàng nhiều người dùng").waitFor();
    await shot("shop-mot-nguoi-dung", "Cửa hàng một người dùng không có mục Vai trò");
  },
});
