import { defineFlow } from "../../capture";
import { CHANNELS, HOME_STEP, openHome, CHANNEL_NAME, finishWithOtp, goToOtpStep, groupName, mockPasswordReset, openDialog } from "../_helpers/supership-forgot-password";

// One resend per OTP session, available only after the three-minute countdown.
export default CHANNELS.map((channel) => defineFlow({
  id: `quen-mat-khau-${channel.toLowerCase()}-gui-lai-otp`,
  group: groupName(channel),
  name: "2. GỬI LẠI OTP",
  app: "supership",
  async run({ page, shot }) {
    const backend = await mockPasswordReset(page);
    await openHome(page);
    await shot(...HOME_STEP);

    await goToOtpStep(page, channel);
    await shot("dang-dem-nguoc", `Chờ mã OTP qua ${CHANNEL_NAME[channel]}, đang đếm ngược`);

    await backend.travel(181);
    const resend = page.getByRole("button", { name: "Gửi lại", exact: true });
    await resend.waitFor();
    await shot("co-the-gui-lai", "Hết đếm ngược, có thể gửi lại");

    await resend.click();
    await openDialog(page).getByText("Gửi lại mã OTP?").waitFor();
    await shot("xac-nhan-gui-lai", "Xác nhận gửi lại mã OTP");

    await openDialog(page).getByRole("button", { name: "Gửi lại", exact: true }).click();
    await page.getByRole("timer").waitFor();
    await shot("da-gui-lai", "Đã gửi lại mã OTP, hết lượt gửi lại");

    await finishWithOtp(page);
    await shot("thanh-cong", "Đặt lại mật khẩu thành công");
  },
}));
