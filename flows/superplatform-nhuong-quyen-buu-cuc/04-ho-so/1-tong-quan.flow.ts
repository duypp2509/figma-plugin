import { FRANCHISE_ID, POST_OFFICE_ID, editProfileButton, openOverview, profileFlow, scrollTop } from "../../_helpers/superplatform-unit-profile";

export default [
  profileFlow({
    id: "tong-quan-nhuong-quyen", name: "01. TỔNG QUAN NHƯỢNG QUYỀN",
    async run({ page, shot }) {
      await openOverview(page, FRANCHISE_ID);
      await page.getByText("CÔNG TY TNHH VẬN CHUYỂN HÀ ĐÔNG", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Tạm ngưng", exact: true }).waitFor();
      await editProfileButton(page).waitFor();
      await shot("tong-quan", "Tổng quan nhượng quyền");
      await scrollTop(page);
      await shot("ca-trang", "Cả trang: pháp lý, người đại diện, bưu cục trực thuộc, liên hệ, địa chỉ", { mode: "fullPage" });
    },
  }),
  profileFlow({
    id: "tong-quan-buu-cuc", name: "02. TỔNG QUAN BƯU CỤC",
    async run({ page, shot }) {
      await openOverview(page, POST_OFFICE_ID);
      await page.getByRole("heading", { name: "Pháp lý của nhượng quyền", exact: true }).waitFor();
      await page.getByRole("button", { name: "Đổi loại hình", exact: true }).waitFor();
      await page.getByRole("button", { name: "Tạm ngưng", exact: true }).waitFor();
      await shot("tong-quan", "Tổng quan bưu cục: pháp lý của nhượng quyền, loại hình bưu cục");
      await scrollTop(page);
      await shot("ca-trang", "Cả trang bưu cục", { mode: "fullPage" });
    },
  }),
];
