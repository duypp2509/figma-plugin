import { defineFlow } from "../../capture";
import {
  CHANNELS, HOME_STEP, openHome, CHANNEL_NAME, finishWithOtp, goToOtpStep, groupName, mockPasswordReset, openDialog, otherChannel, waitOtpScreenFor,
} from "../_helpers/supership-forgot-password";
import { waitEnabled } from "../_helpers/wait";

// One channel change per OTP session, available only after the three-minute countdown.
export default CHANNELS.map((channel) => {
  const target = otherChannel(channel);
  return defineFlow({
    id: `quen-mat-khau-${channel.toLowerCase()}-doi-kenh-nhan-otp`,
    group: groupName(channel),
    name: "3. ĐỔI KÊNH NHẬN OTP",
    app: "supership",
    async run({ page, shot }) {
      const backend = await mockPasswordReset(page);
      await openHome(page);
      await shot(...HOME_STEP);

      await goToOtpStep(page, channel);
      await shot("dang-dem-nguoc", `Chờ mã OTP qua ${CHANNEL_NAME[channel]}, chưa đổi kênh được`);

      await backend.travel(181);
      const changeChannel = page.getByRole("button", { name: "Đổi kênh nhận OTP", exact: true });
      await waitEnabled(changeChannel);
      await shot("co-the-doi-kenh", "Hết đếm ngược, có thể đổi kênh");

      await changeChannel.click();
      const confirmChange = openDialog(page).getByRole("button", { name: /^Đổi sang/ });
      await confirmChange.waitFor();
      await shot("xac-nhan-doi-kenh", `Xác nhận đổi sang ${CHANNEL_NAME[target]}`);

      await confirmChange.click();
      await waitOtpScreenFor(page, target);
      await page.getByRole("timer").waitFor();
      await shot("da-doi-kenh", `Đã đổi sang ${CHANNEL_NAME[target]}, hết lượt đổi kênh`);

      await finishWithOtp(page);
      await shot("thanh-cong", "Đặt lại mật khẩu thành công");
    },
  });
});
