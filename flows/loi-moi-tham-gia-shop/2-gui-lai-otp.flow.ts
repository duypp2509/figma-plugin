import { defineFlow } from "../../capture";
import {
  CHANNELS, CHANNEL_NAME, INVITATION_STEP, finishWithCode, goToCodeStep, groupName, mockMemberInvitation, openDialog, openInvitation,
} from "../_helpers/supership-member-invitation";

// One resend per OTP session, available only after the three-minute countdown.
export default CHANNELS.map((channel) => defineFlow({
  id: `loi-moi-shop-${channel.toLowerCase()}-gui-lai-otp`,
  group: groupName(channel),
  name: "2. GỬI LẠI OTP",
  app: "supership",
  async run({ page, shot }) {
    const backend = await mockMemberInvitation(page);
    await openInvitation(page);
    await shot(...INVITATION_STEP, { mode: "fullPage" });

    await goToCodeStep(page, channel);
    await shot("dang-dem-nguoc", `Chờ mã OTP qua ${CHANNEL_NAME[channel]}, đang đếm ngược`, { mode: "fullPage" });

    await backend.travel(181);
    const resend = page.getByRole("button", { name: "Gửi lại", exact: true });
    await resend.waitFor();
    await shot("co-the-gui-lai", "Hết đếm ngược, có thể gửi lại", { mode: "fullPage" });

    await resend.click();
    await openDialog(page).getByText("Gửi lại mã OTP?").waitFor();
    await shot("xac-nhan-gui-lai", "Xác nhận gửi lại mã OTP");

    await openDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
    await page.getByRole("timer").waitFor();
    await shot("da-gui-lai", "Đã gửi lại mã OTP, hết lượt gửi lại", { mode: "fullPage" });

    await finishWithCode(page);
    await shot("thanh-cong", "Tham gia cửa hàng thành công", { mode: "fullPage" });
  },
}));
