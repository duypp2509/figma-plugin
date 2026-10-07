import { defineFlow } from "../../capture";
import {
  CHANNELS, CHANNEL_NAME, INVITATION_STEP, finishWithCode, goToCodeStep, groupName, mockMemberInvitation, openDialog, openInvitation,
  otherChannel, waitCodeStepFor,
} from "../_helpers/supership-member-invitation";
import { waitEnabled } from "../_helpers/wait";

// One channel change per OTP session, available only after the three-minute countdown.
export default CHANNELS.map((channel) => {
  const target = otherChannel(channel);
  return defineFlow({
    id: `loi-moi-shop-${channel.toLowerCase()}-doi-kenh-nhan-otp`,
    group: groupName(channel),
    name: "3. ĐỔI KÊNH NHẬN OTP",
    app: "supership",
    async run({ page, shot }) {
      const backend = await mockMemberInvitation(page);
      await openInvitation(page);
      await shot(...INVITATION_STEP, { mode: "fullPage" });

      await goToCodeStep(page, channel);
      await shot("dang-dem-nguoc", `Chờ mã OTP qua ${CHANNEL_NAME[channel]}, chưa đổi kênh được`, { mode: "fullPage" });

      await backend.travel(181);
      const changeChannel = page.getByRole("button", { name: "Đổi kênh nhận OTP", exact: true });
      await waitEnabled(changeChannel);
      await shot("co-the-doi-kenh", "Hết đếm ngược, có thể đổi kênh", { mode: "fullPage" });

      await changeChannel.click();
      const confirmChange = openDialog(page).getByRole("button", { name: /^Đổi sang/ });
      await confirmChange.waitFor();
      await shot("xac-nhan-doi-kenh", `Xác nhận đổi sang ${CHANNEL_NAME[target]}`);

      await confirmChange.click();
      await waitCodeStepFor(page, target);
      await page.getByRole("timer").waitFor();
      await shot("da-doi-kenh", `Đã đổi sang ${CHANNEL_NAME[target]}, hết lượt đổi kênh`, { mode: "fullPage" });

      await finishWithCode(page);
      await shot("thanh-cong", "Tham gia cửa hàng thành công", { mode: "fullPage" });
    },
  });
});
