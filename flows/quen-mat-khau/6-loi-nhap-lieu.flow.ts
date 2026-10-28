import { defineFlow } from "../../capture";
import {
  DEV_OTP, FAILURES, HOME_STEP, SAMPLE_PASSWORD, confirmPasswordInput, dismissNotice, fillNewPassword, mockPasswordReset,
  newPasswordInput, openForgotPassword, openHome, phoneInput, requestOtp, savePassword, submitOtp, submitPhone, waitChannelDialog,
} from "../_helpers/supership-forgot-password";
import { waitEnabled } from "../_helpers/wait";

// Every way the phone number and the new password can be turned down. A number is never said to have no account
// (every well-formed number goes on), and "the same as the current password" is told only after the OTP, when the
// reset is confirmed. These screens are the same for both OTP channels, so this flow belongs to neither channel group.
export default defineFlow({
  id: "quen-mat-khau-loi-nhap-lieu",
  name: "QUÊN MẬT KHẨU - LỖI NHẬP LIỆU",
  app: "supership",
  async run({ page, shot }) {
    const backend = await mockPasswordReset(page);
    await openHome(page);
    await shot(...HOME_STEP);

    await openForgotPassword(page);

    await phoneInput(page).fill("09123");
    await page.getByText("Vui lòng nhập số điện thoại hợp lệ.").waitFor();
    await shot("sdt-sai-dinh-dang", "Số điện thoại sai định dạng");

    await submitPhone(page);
    await newPasswordInput(page).waitFor();
    await newPasswordInput(page).fill("matkhau");
    await page.getByText(/^Mật khẩu cần có/).waitFor();
    await shot("mat-khau-chua-dat", "Mật khẩu chưa đạt yêu cầu");

    await fillNewPassword(page, SAMPLE_PASSWORD, "MatKhau@2025");
    await confirmPasswordInput(page).and(page.locator('[aria-invalid="true"]')).waitFor();
    await shot("xac-nhan-khong-khop", "Mật khẩu xác nhận không khớp");

    // The password is accepted, but the account has used up its OTPs for the day.
    await fillNewPassword(page);
    backend.failNext("request", FAILURES.dailyOtpLimit);
    await savePassword(page);
    await waitChannelDialog(page);
    await page.getByRole("button", { name: "Nhận mã OTP", exact: true }).click();
    await page.getByText(FAILURES.dailyOtpLimit.message).waitFor();
    await shot("vuot-gioi-han-otp", "Vượt giới hạn OTP trong ngày");
    await dismissNotice(page);

    // Next try: the code is right, but the new password is the current one; the reset stays verified.
    await savePassword(page);
    await waitChannelDialog(page);
    await requestOtp(page);
    backend.failNext("confirm", FAILURES.sameAsCurrentPassword);
    await submitOtp(page, DEV_OTP);
    await page.getByText(FAILURES.sameAsCurrentPassword.message).waitFor();
    await shot("trung-mat-khau-hien-tai", "Sau OTP: mật khẩu mới trùng mật khẩu hiện tại");
    await dismissNotice(page);

    await fillNewPassword(page, "SieuShip#2026");
    const change = page.getByRole("button", { name: "Đổi mật khẩu", exact: true });
    await waitEnabled(change);
    await shot("doi-mat-khau-khac", "Số điện thoại đã xác thực: nhập mật khẩu khác rồi đổi");
    await change.click();
    await page.getByRole("heading", { name: "Đặt lại mật khẩu thành công" }).waitFor();
    await shot("thanh-cong", "Đặt lại mật khẩu thành công");
  },
});
