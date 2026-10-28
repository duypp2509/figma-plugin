import type { Page } from "playwright";
import {
  FRANCHISE_ID, MESSAGES, POST_OFFICE_ID, calendar, chooseLogo, defaultLogoUrl, editProfileButton, expect, logoButton,
  openOverview, openProfileEdit, overviewLogo, profileDialog, profileFlow, saveProfile, showDisabledReason, startDateButton, toast,
  typeStartDate, waitError,
} from "../../_helpers/superplatform-unit-profile";

const saveButton = (page: Page) => profileDialog(page).getByRole("button", { name: "Lưu thay đổi", exact: true });

export default [
  profileFlow({
    id: "sua-ten-ngay", name: "SỬA TÊN VÀ NGÀY BẮT ĐẦU HOẠT ĐỘNG",
    async run({ page, shot, mock }) {
      await openOverview(page, POST_OFFICE_ID);
      await editProfileButton(page).waitFor();
      await shot("tong-quan", "Tổng quan bưu cục: nút Sửa hồ sơ");

      await openProfileEdit(page);
      const dialog = profileDialog(page);
      await expect(dialog.getByLabel("Tên hiển thị")).toHaveValue("BƯU CỤC VĂN QUÁN");
      await expect(startDateButton(page)).toContainText("20/03/2025");
      await shot("hop-sua", "Bấm Sửa hồ sơ: hộp Sửa hồ sơ tổ chức, điền sẵn giá trị hiện tại");

      await dialog.getByLabel("Tên hiển thị").fill("Bưu cục Văn Quán - Hà Đông");
      await expect(dialog.getByLabel("Tên hiển thị")).toHaveValue("BƯU CỤC VĂN QUÁN - HÀ ĐÔNG");
      await shot("nhap-ten", "Nhập tên mới, tự viết hoa");

      await startDateButton(page).click();
      await calendar(page).getByRole("gridcell", { name: "18/03/2025", exact: true }).click();
      await expect(calendar(page).getByLabel("Ngày", { exact: true })).toHaveValue("18/03/2025");
      await shot("chon-ngay", "Bấm ô Ngày bắt đầu hoạt động, chọn ngày trên lịch");

      await calendar(page).getByRole("button", { name: "Áp dụng", exact: true }).click();
      await calendar(page).waitFor({ state: "hidden" });
      await expect(startDateButton(page)).toContainText("18/03/2025");
      await shot("da-sua", "Bấm Áp dụng: đã sửa tên và ngày bắt đầu hoạt động");

      await saveProfile(page);
      await toast(page, "Đã lưu hồ sơ BƯU CỤC VĂN QUÁN - HÀ ĐÔNG.").waitFor();
      await page.locator(".organization-overview-name").getByText("BƯU CỤC VĂN QUÁN - HÀ ĐÔNG", { exact: true }).waitFor();
      await page.getByText("18/03/2025", { exact: true }).waitFor();
      await shot("da-luu", "Bấm Lưu thay đổi: đã lưu, tên in hoa, ngày mới");
      expect(mock.writes).toBe(1);
    },
  }),
  profileFlow({
    id: "doi-logo", name: "ĐỔI LOGO",
    async run({ page, shot, mock }) {
      await openOverview(page, FRANCHISE_ID);
      await logoButton(page).waitFor();
      await expect(overviewLogo(page, "NHƯỢNG QUYỀN HÀ ĐÔNG")).toHaveAttribute("src", defaultLogoUrl(FRANCHISE_ID));
      await shot("logo-mac-dinh", "Logo mặc định SuperShip, nút bút chì ở góc ảnh để đổi logo");

      const crop = await chooseLogo(page);
      await shot("cat-anh", "Bấm nút bút chì, chọn ảnh: hộp cắt ảnh vuông");

      await crop.getByRole("button", { name: "Xác nhận", exact: true }).click();
      await toast(page, "Đã đổi logo.").waitFor();
      await expect(overviewLogo(page, "NHƯỢNG QUYỀN HÀ ĐÔNG")).toHaveAttribute("src", /^data:image\/png/);
      await expect(page.locator(".organization-sidebar .organization-sidebar-identity img")).toHaveAttribute("src", /^data:image\/png/);
      await shot("da-doi", "Bấm Xác nhận: trang đơn vị và khung bên trái hiện logo mới");
      expect(mock.writes).toBe(1);
    },
  }),
  profileFlow({
    id: "khong-doi-bi-sua", name: "KHÔNG CÓ THAY ĐỔI",
    async run({ page, shot, mock }) {
      await openOverview(page, POST_OFFICE_ID);
      await editProfileButton(page).waitFor();
      await shot("tong-quan", "Tổng quan bưu cục: nút Sửa hồ sơ");

      await openProfileEdit(page);
      // Nothing changed yet: "Lưu thay đổi" stays greyed instead of the server answering "Không có thay đổi."
      await expect(saveButton(page)).toBeDisabled();
      await shot("khong-co-thay-doi", "Bấm Sửa hồ sơ, chưa sửa gì: nút Lưu thay đổi bị khóa");
      expect(mock.writes).toBe(0);
    },
  }),
  profileFlow({
    id: "chi-xem", name: "CHỈ XEM, KHÔNG CÓ QUYỀN SỬA", role: "viewer",
    async run({ page, shot }) {
      await openOverview(page, POST_OFFICE_ID);
      await page.getByRole("heading", { name: "Loại hình bưu cục", exact: true }).waitFor();
      await page.getByRole("heading", { name: "Trưởng bưu cục", exact: true }).waitFor();
      await expect(editProfileButton(page)).toHaveCount(0);
      await expect(logoButton(page)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Đổi loại hình", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Tạm ngưng", exact: true })).toHaveCount(0);
      await shot("tong-quan", "Không có nút Sửa hồ sơ, đổi logo, đổi loại hình, đổi trạng thái");
    },
  }),
  profileFlow({
    id: "tam-ngung", name: "ĐƠN VỊ ĐANG TẠM NGƯNG",
    setup: units => { Object.assign(units[POST_OFFICE_ID]!, { status: "SUSPENDED", since: "2026-10-05T02:00:00Z" }); },
    async run({ page, shot }) {
      await openOverview(page, POST_OFFICE_ID);
      await page.getByRole("button", { name: "Kích hoạt lại", exact: true }).waitFor();
      await expect(editProfileButton(page)).toBeDisabled();
      await expect(logoButton(page)).toBeDisabled();
      await shot("tong-quan", "Bưu cục đang tạm ngưng: nút Sửa hồ sơ và nút đổi logo tắt");

      await showDisabledReason(page, editProfileButton(page), MESSAGES.profileSuspended);
      await shot("nut-tat", "Trỏ vào nút Sửa hồ sơ: lý do không sửa được");
    },
  }),
  profileFlow({
    id: "nhap-lieu", name: "SỬA HỒ SƠ THIẾU HOẶC SAI DỮ LIỆU",
    async run({ page, shot, mock }) {
      await openOverview(page, POST_OFFICE_ID);
      await editProfileButton(page).waitFor();
      await shot("tong-quan", "Tổng quan bưu cục: nút Sửa hồ sơ");

      await openProfileEdit(page);
      await shot("hop-sua", "Bấm Sửa hồ sơ: hộp Sửa hồ sơ tổ chức");

      const dialog = profileDialog(page);
      await dialog.getByLabel("Tên hiển thị").fill("");
      await expect(saveButton(page)).toBeDisabled();
      await shot("xoa-ten", "Xóa trống tên: nút Lưu thay đổi bị khóa");

      await dialog.getByLabel("Tên hiển thị").fill("Bưu cục Văn Quán");
      await typeStartDate(page, "31/02/2025", false);
      await calendar(page).getByText(MESSAGES.dayInvalid, { exact: true }).waitFor();
      await expect(calendar(page).getByRole("button", { name: "Áp dụng", exact: true })).toBeDisabled();
      await shot("ngay-khong-hop-le", "Bấm ô ngày, gõ ngày không có thật: chưa hợp lệ, không áp dụng được");
      expect(mock.writes).toBe(0);
    },
  }),
];
