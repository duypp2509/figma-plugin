import type { Page } from "playwright";
import { MEMBERS_URL, ROOT, YEN, memberFlow, openMembers, waitLoaded } from "../_helpers/supership-shop-members";
import { SHOP_ACCOUNTANT } from "../_helpers/supership-shop-roles";

// The members list of a multi-user shop, in one row of frames: the list, searching it by name, and
// narrowing it by role and by status. The backend is a stand-in (see mockShopMembers).
const filters = (page: Page) => page.getByRole("region", { name: "Bộ lọc thành viên" }).getByRole("combobox");

/** The list again with no search and no filter. */
async function reopen(page: Page) {
  await page.goto(MEMBERS_URL);
  await page.getByRole("link", { name: YEN.fullName, exact: true }).waitFor();
}

export default memberFlow({
  id: "danh-sach",
  group: [ROOT],
  name: "XEM DANH SÁCH VÀ TÌM KIẾM/LỌC THÀNH VIÊN",
  async run({ page, shot }) {
    await openMembers(page);
    await shot("danh-sach", "Danh sách thành viên", { mode: "fullPage" });

    const search = page.getByPlaceholder("Tên hoặc thông tin thành viên…");
    await search.fill("Trần");
    await page.waitForURL(/search=/);
    await page.getByRole("link", { name: YEN.fullName, exact: true }).waitFor({ state: "detached" });
    await shot("tim-theo-ten", "Tìm thành viên theo tên");

    await search.fill("khong co ai");
    await page.getByText("Không có thành viên phù hợp").waitFor();
    await shot("khong-co-ket-qua", "Không có thành viên phù hợp");

    await reopen(page);
    await filters(page).nth(0).click();
    await page.getByRole("option", { name: SHOP_ACCOUNTANT.name, exact: true }).waitFor();
    await shot("mo-bo-loc-vai-tro", "Mở bộ lọc vai trò");

    await page.getByRole("option", { name: SHOP_ACCOUNTANT.name, exact: true }).click();
    await page.waitForURL(/roleId=/);
    await waitLoaded(page);
    await shot("loc-theo-vai-tro", "Lọc thành viên theo vai trò Kế toán");

    await reopen(page);
    await filters(page).nth(1).click();
    await page.getByRole("option", { name: "Đã ngừng hoạt động", exact: true }).waitFor();
    await shot("mo-bo-loc-trang-thai", "Mở bộ lọc trạng thái");

    await page.getByRole("option", { name: "Đã ngừng hoạt động", exact: true }).click();
    await page.waitForURL(/status=TERMINATED/);
    await waitLoaded(page);
    await shot("loc-theo-trang-thai", "Lọc thành viên theo trạng thái Đã ngừng hoạt động");
  },
});
