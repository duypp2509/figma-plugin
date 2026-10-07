import {
  SAVED, VIEW_ONLY_PERMISSIONS, addressLine, openDialog, openRegionDialog, openShopInfo, pickRegionOption, saveButton, shopInfoFlow,
  shopName,
} from "../_helpers/supership-shop-info";

// "Thông tin cửa hàng": looking at the shop's information, changing its name and its one address, and
// what the form says when something required is left empty. The backend is a stand-in (see mockShopInfo).
export default [
  shopInfoFlow({
    id: "xem",
    name: "XEM THÔNG TIN CỬA HÀNG",
    async run({ page, shot, backend }) {
      await openShopInfo(page);
      await shot("thong-tin-cua-hang", "Thông tin cửa hàng");

      // Someone who may only look: the same form, nothing to edit and no button to save.
      backend.setPermissions(VIEW_ONLY_PERMISSIONS);
      await openShopInfo(page);
      await saveButton(page).waitFor({ state: "detached" });
      await shot("chi-xem", "Thành viên chỉ có quyền xem thông tin cửa hàng");
    },
  }),

  shopInfoFlow({
    id: "cap-nhat",
    name: "CẬP NHẬT THÔNG TIN CỬA HÀNG",
    async run({ page, shot }) {
      await openShopInfo(page);
      await shot("thong-tin-cua-hang", "Thông tin cửa hàng");

      await shopName(page).fill("Khả Ái Store");
      await addressLine(page).fill("12 Lê Văn Hiến");
      await shot("da-sua-ten-va-dia-chi", "Đã sửa tên và địa chỉ chi tiết");

      await openRegionDialog(page, "Phường Ngũ Hành Sơn, Thành phố Đà Nẵng");
      await shot("chon-tinh-thanh", "Chọn Tỉnh/Thành phố");

      await pickRegionOption(page, "Hồ Chí Minh");
      await openDialog(page).getByText("Chọn Phường/Xã").waitFor();
      await openDialog(page).locator("li button").first().waitFor();
      await shot("chon-phuong-xa", "Chọn Phường/Xã");

      await pickRegionOption(page, "");
      await page.locator("dialog[open]").waitFor({ state: "detached" });
      await saveButton(page).isEnabled();
      await shot("da-chon-khu-vuc", "Đã chọn khu vực mới");

      await saveButton(page).click();
      await openDialog(page).getByText(SAVED).waitFor();
      await shot("cap-nhat-thanh-cong", "Cập nhật thông tin cửa hàng thành công");

      await openDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
      await page.locator("dialog[open]").waitFor({ state: "detached" });
      await shot("sau-khi-cap-nhat", "Thông tin cửa hàng sau khi cập nhật");
    },
  }),

  shopInfoFlow({
    id: "nhap-thieu",
    name: "CẬP NHẬT THẤT BẠI DO NHẬP THIẾU THÔNG TIN",
    async run({ page, shot }) {
      await openShopInfo(page);
      await shot("thong-tin-cua-hang", "Thông tin cửa hàng");

      // What is missing is said under its field as it is typed, and the form cannot be saved meanwhile.
      await shopName(page).fill("");
      await page.getByText("Vui lòng nhập tên cửa hàng.").waitFor();
      await shot("thieu-ten-cua-hang", "Thiếu tên cửa hàng");

      await shopName(page).fill("Khả Ái");
      await addressLine(page).fill("");
      await page.getByText("Vui lòng nhập địa chỉ chi tiết.").waitFor();
      await shot("thieu-dia-chi-chi-tiet", "Thiếu địa chỉ chi tiết");

      await shopName(page).fill("");
      await page.getByText("Vui lòng nhập tên cửa hàng.").waitFor();
      await saveButton(page).and(page.locator(":disabled")).waitFor();
      await shot("thieu-ca-hai", "Thiếu cả tên cửa hàng và địa chỉ chi tiết, nút cập nhật bị khóa");
    },
  }),
];
