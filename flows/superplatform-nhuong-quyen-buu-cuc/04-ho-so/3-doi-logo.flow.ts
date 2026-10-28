import {
  FRANCHISE_ID, chooseLogo, defaultLogoUrl, expect, logoButton, overviewLogo, openOverview, profileFlow,
} from "../../_helpers/superplatform-unit-profile";

export default [
  profileFlow({
    id: "huy-cat-anh", name: "HỦY KHI CẮT ẢNH LOGO",
    async run({ page, shot, mock }) {
      await openOverview(page, FRANCHISE_ID);
      await logoButton(page).waitFor();
      await shot("tong-quan", "Tổng quan nhượng quyền: nút bút chì ở góc logo");

      const crop = await chooseLogo(page);
      await shot("cat-anh", "Bấm nút bút chì, chọn ảnh: hộp cắt ảnh");

      await crop.getByRole("button", { name: "Đóng hộp thoại", exact: true }).click();
      await crop.waitFor({ state: "hidden" });
      await expect(overviewLogo(page, "NHƯỢNG QUYỀN HÀ ĐÔNG")).toHaveAttribute("src", defaultLogoUrl(FRANCHISE_ID));
      await shot("da-huy", "Đóng hộp cắt ảnh: giữ nguyên logo cũ");
      expect(mock.writes).toBe(0);
    },
  }),
];
