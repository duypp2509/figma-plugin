import { defineFlow } from "../../capture";
import {
  CHANNELS, CHANNEL_NAME, DEV_OTP, HOME_STEP, SAMPLE_PHONE, confirmOtpButton, continueButton, fillNewPassword, groupName,
  mockPasswordReset, newPasswordInput, openForgotPassword, openHome, otpInput, phoneInput, requestOtp, savePassword,
  selectChannel, waitChannelDialog,
} from "../_helpers/supership-forgot-password";
import { waitEnabled } from "../_helpers/wait";

// The whole journey when nothing goes wrong, once per OTP channel.
// The backend is a stand-in (see mockPasswordReset): no password is changed and no OTP is sent.
export default CHANNELS.map((channel) => defineFlow({
  id: `quen-mat-khau-${channel.toLowerCase()}-thanh-cong`,
  group: groupName(channel),
  name: "1. ĐẶT LẠI MẬT KHẨU THÀNH CÔNG",
  app: "supership",
  async run({ page, shot }) {
    await mockPasswordReset(page);

    await openHome(page);
    await shot(...HOME_STEP);

    await openForgotPassword(page);
    await shot("nhap-sdt", "Nhập số điện thoại");

    await phoneInput(page).fill(SAMPLE_PHONE);
    await waitEnabled(continueButton(page));
    await shot("da-nhap-sdt", "Đã nhập số điện thoại");

    await continueButton(page).click();
    await newPasswordInput(page).waitFor();
    await shot("mat-khau-moi", "Đặt mật khẩu mới");

    await fillNewPassword(page);
    await shot("mat-khau-dat-yeu-cau", "Mật khẩu mới đạt yêu cầu");

    await savePassword(page);
    await waitChannelDialog(page);
    await selectChannel(page, channel);
    await shot("chon-kenh", `Chọn kênh nhận OTP qua ${CHANNEL_NAME[channel]}`);

    await requestOtp(page, channel);
    await shot("nhap-otp", `Nhập mã OTP gửi qua ${CHANNEL_NAME[channel]}`);

    await otpInput(page).fill(DEV_OTP);
    await waitEnabled(confirmOtpButton(page));
    await shot("da-nhap-otp", "Đã nhập mã OTP");

    await confirmOtpButton(page).click();
    await page.getByRole("heading", { name: "Đặt lại mật khẩu thành công" }).waitFor();
    await shot("thanh-cong", "Đặt lại mật khẩu thành công");
  },
}));
