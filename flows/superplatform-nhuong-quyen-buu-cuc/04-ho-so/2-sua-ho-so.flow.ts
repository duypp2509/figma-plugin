import {
  FRANCHISE_ID, MESSAGES, POST_OFFICE_ID, dismissError, editProfileButton, expect, logoButton, logoFile, openOverview,
  openProfileEdit, profileDialog, profileFlow, saveProfile, toast, waitError,
} from "../../_helpers/superplatform-unit-profile";
import { waitEnabled } from "../../_helpers/wait";

export default [
  profileFlow({
    id: "sua-ten-ngay", name: "03. SỬA TÊN VÀ NGÀY BẮT ĐẦU HOẠT ĐỘNG",
    async run({ page, shot, mock }) {
      await openOverview(page, POST_OFFICE_ID);
      await editProfileButton(page).waitFor();
      await shot("tong-quan", "Tổng quan bưu cục");

      await openProfileEdit(page);
      const dialog = profileDialog(page);
      await expect(dialog.getByLabel("Tên hiển thị")).toHaveValue("BƯU CỤC VĂN QUÁN");
      await shot("hop-sua", "Hộp Sửa hồ sơ tổ chức, điền sẵn giá trị hiện tại");

      await dialog.getByLabel("Tên hiển thị").fill("Bưu cục Văn Quán - Hà Đông");
      await dialog.getByLabel("Ngày bắt đầu hoạt động").fill("2025-03-18");
      await dialog.getByLabel("Ngày bắt đầu hoạt động").blur();
      await shot("da-sua", "Đã sửa tên và ngày bắt đầu hoạt động");

      await saveProfile(page);
      await toast(page, "Đã lưu hồ sơ BƯU CỤC VĂN QUÁN - HÀ ĐÔNG.").waitFor();
      await page.getByRole("heading", { name: "BƯU CỤC VĂN QUÁN - HÀ ĐÔNG", exact: true }).waitFor();
      await page.getByText("18/03/2025", { exact: true }).waitFor();
      await shot("da-luu", "Đã lưu: tên in hoa, ngày mới");
      expect(mock.writes).toBe(1);
    },
  }),
  profileFlow({
    id: "doi-logo", name: "04. ĐỔI LOGO",
    async run({ page, shot, mock }) {
      await openOverview(page, FRANCHISE_ID);
      await logoButton(page).waitFor();
      await shot("chua-co-logo", "Chưa có logo: nút đổi logo ở góc ảnh mặc định");

      await page.locator('.organization-overview-card input[type="file"]').setInputFiles(await logoFile(page));
      const crop = page.getByRole("dialog", { name: "Thay đổi ảnh đại diện" });
      await waitEnabled(crop.getByRole("button", { name: "Xác nhận", exact: true }));
      await shot("cat-anh", "Cắt ảnh vuông");

      await crop.getByRole("button", { name: "Xác nhận", exact: true }).click();
      await toast(page, "Đã đổi logo.").waitFor();
      await page.getByRole("img", { name: "Logo NHƯỢNG QUYỀN HÀ ĐÔNG", exact: true }).waitFor();
      await page.locator(".organization-sidebar .organization-sidebar-identity img").waitFor();
      await shot("da-doi", "Đã đổi logo: trang đơn vị và khung bên trái hiện logo mới");
      expect(mock.writes).toBe(1);
    },
  }),
  profileFlow({
    id: "khong-doi-bi-sua", name: "05. KHÔNG CÓ THAY ĐỔI, VỪA BỊ NGƯỜI KHÁC SỬA",
    async run({ page, shot, mock }) {
      await openOverview(page, POST_OFFICE_ID);
      await openProfileEdit(page);
      await saveProfile(page);
      await waitError(page, MESSAGES.noChange);
      await shot("khong-co-thay-doi", "Bấm Lưu khi chưa sửa gì: Không có thay đổi");

      await dismissError(page);
      await profileDialog(page).getByRole("button", { name: "Hủy", exact: true }).click();
      await openProfileEdit(page);
      await profileDialog(page).getByLabel("Ngày bắt đầu hoạt động").fill("2025-03-18");
      // Another manager renames the post office while this dialog is open.
      mock.beforeWrite = () => { const unit = mock.units[POST_OFFICE_ID]!; unit.name = "BƯU CỤC VĂN QUÁN HÀ ĐÔNG"; unit.version++; };
      await saveProfile(page);
      await waitError(page, MESSAGES.profileConflict);
      await shot("bi-nguoi-khac-sua", "Hồ sơ vừa được người khác sửa");

      await dismissError(page);
      await profileDialog(page).getByRole("button", { name: "Tải dữ liệu mới nhất", exact: true }).waitFor();
      await shot("nut-tai-lai", "Nút Tải dữ liệu mới nhất trong hộp sửa");

      await profileDialog(page).getByRole("button", { name: "Tải dữ liệu mới nhất", exact: true }).click();
      await profileDialog(page).waitFor({ state: "hidden" });
      await page.getByRole("heading", { name: "BƯU CỤC VĂN QUÁN HÀ ĐÔNG", exact: true }).waitFor();
      await shot("da-tai-lai", "Đã tải lại: hiện tên người kia vừa lưu");
      expect(mock.writes).toBe(0);
    },
  }),
  profileFlow({
    id: "chi-xem", name: "06. CHỈ XEM, KHÔNG CÓ QUYỀN SỬA", role: "viewer",
    async run({ page, shot }) {
      await openOverview(page, POST_OFFICE_ID);
      await page.getByRole("heading", { name: "Loại hình bưu cục", exact: true }).waitFor();
      await expect(editProfileButton(page)).toHaveCount(0);
      await expect(logoButton(page)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Đổi loại hình", exact: true })).toHaveCount(0);
      await shot("tong-quan", "Không có nút Sửa hồ sơ, đổi logo, đổi loại hình, đổi trạng thái");
    },
  }),
  profileFlow({
    id: "tam-ngung", name: "07. ĐƠN VỊ ĐANG TẠM NGƯNG",
    setup: units => { Object.assign(units[POST_OFFICE_ID]!, { status: "SUSPENDED", since: "2026-10-05T02:00:00Z" }); },
    async run({ page, shot }) {
      await openOverview(page, POST_OFFICE_ID);
      await page.getByRole("button", { name: "Kích hoạt lại", exact: true }).waitFor();
      await expect(editProfileButton(page)).toBeDisabled();
      await expect(logoButton(page)).toBeDisabled();
      await page.getByText(MESSAGES.profileSuspended, { exact: true }).waitFor();
      await shot("nut-tat", "Nút Sửa hồ sơ, đổi logo tắt, kèm lý do");
    },
  }),
];
