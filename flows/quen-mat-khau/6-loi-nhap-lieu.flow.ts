import { defineFlow } from "../../capture";
import {
  FAILURES, HOME_STEP, openHome, SAMPLE_PASSWORD, confirmPasswordInput, fillNewPassword, mockPasswordReset, newPasswordInput, openDialog,
  openForgotPassword, phoneInput, savePassword, submitPhone, waitChannelDialog,
} from "../_helpers/supership-forgot-password";

// Every way the phone number and the new password can be turned down before an OTP is sent.
// These screens are the same for both OTP channels, so this flow belongs to neither channel group.
export default defineFlow({
  id: "quen-mat-khau-loi-nhap-lieu",
  name: "QUÊN MẬT KHẨU - LỖI NHẬP LIỆU TRƯỚC KHI GỬI OTP",
  app: "supership",
  async run({ page, shot }) {
    const backend = await mockPasswordReset(page);
    await openHome(page);
    await shot(...HOME_STEP);

    await openForgotPassword(page);

    await phoneInput(page).fill("09123");
    await page.getByText("Vui lòng nhập số điện thoại hợp lệ.").waitFor();
    await shot("sdt-sai-dinh-dang", "Số điện thoại sai định dạng");

    backend.failNext("check", FAILURES.accountNotFound);
    await submitPhone(page, "0987654321");
    await openDialog(page).getByText(FAILURES.accountNotFound.message).waitFor();
    await shot("sdt-khong-ton-tai", "Số điện thoại không tồn tại");
    await openDialog(page).getByRole("button", { name: "Đã hiểu" }).click();

    await submitPhone(page);
    await newPasswordInput(page).waitFor();
    await newPasswordInput(page).fill("matkhau");
    await page.getByText(/^Mật khẩu cần có/).waitFor();
    await shot("mat-khau-chua-dat", "Mật khẩu chưa đạt yêu cầu");

    await fillNewPassword(page, SAMPLE_PASSWORD, "MatKhau@2025");
    await confirmPasswordInput(page).and(page.locator('[aria-invalid="true"]')).waitFor();
    await shot("xac-nhan-khong-khop", "Mật khẩu xác nhận không khớp");

    await fillNewPassword(page);
    backend.failNext("validate-password", FAILURES.sameAsCurrentPassword);
    await savePassword(page);
    await page.getByText(FAILURES.sameAsCurrentPassword.message).waitFor();
    await shot("trung-mat-khau-hien-tai", "Trùng mật khẩu hiện tại");

    // The password is accepted this time, but the account has used up its OTPs for the day.
    backend.failNext("request", FAILURES.dailyOtpLimit);
    await savePassword(page);
    await waitChannelDialog(page);
    await page.getByRole("button", { name: "Nhận mã OTP", exact: true }).click();
    await page.getByText(FAILURES.dailyOtpLimit.message).waitFor();
    await shot("vuot-gioi-han-otp", "Vượt giới hạn OTP trong ngày");
  },
});
