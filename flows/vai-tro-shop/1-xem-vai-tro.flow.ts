import { defineFlow } from "../../capture";
import { KHA_AI_SHOP, mockSignedInShop } from "../_helpers/supership-session";
import {
  GROUP, OWNER_PERMISSIONS, SHOP_ACCOUNTANT, SHOP_OPERATOR, SHOP_OWNER, backToRoles, mockShopRoles, openRole, openRoles,
} from "../_helpers/supership-shop-roles";

// The owner of a multi-user shop looks through the shop's roles: the list, each role with what it
// allows, and the search inside a role. A shop's roles are the platform's system roles, so everything
// here is read-only. The backend is a stand-in (see mockSignedInShop and mockShopRoles).
export default defineFlow({
  id: "vai-tro-shop-xem-vai-tro",
  group: GROUP,
  name: "1. XEM DANH SÁCH VÀ CHI TIẾT VAI TRÒ",
  app: "supership",
  async run({ page, shot, log }) {
    const backend = await mockSignedInShop(page, KHA_AI_SHOP, OWNER_PERMISSIONS, log);
    mockShopRoles(backend, KHA_AI_SHOP);

    await openRoles(page);
    await page.getByRole("link", { name: SHOP_OWNER.name, exact: true }).waitFor();
    await shot("danh-sach-vai-tro", "Danh sách vai trò của cửa hàng");

    await openRole(page, SHOP_OWNER);
    await shot("vai-tro-chu-cua-hang", "Chi tiết vai trò Chủ cửa hàng", { mode: "fullPage" });

    const search = page.getByRole("searchbox", { name: "Tìm quyền" });
    await search.fill("đơn hàng");
    await page.getByText("Xem đơn hàng").waitFor();
    await shot("tim-quyen", "Tìm quyền trong vai trò", { mode: "fullPage" });

    await search.fill("kho hàng");
    await page.getByText("Không tìm thấy quyền phù hợp").waitFor();
    await shot("tim-quyen-khong-co-ket-qua", "Tìm quyền không có kết quả");

    await backToRoles(page);
    await openRole(page, SHOP_OPERATOR);
    await shot("vai-tro-nhan-vien-van-hanh", "Chi tiết vai trò Nhân viên vận hành", { mode: "fullPage" });

    await backToRoles(page);
    await openRole(page, SHOP_ACCOUNTANT);
    await shot("vai-tro-ke-toan", "Chi tiết vai trò Kế toán", { mode: "fullPage" });
  },
});
