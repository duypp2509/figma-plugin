import { defineFlow } from "../../capture";
import {
  CHANNELS, CHANNEL_NAME, DEV_OTP, INVITATION_STEP, confirmChannel, fillSignupForm, groupName, joinButton, mockMemberInvitation,
  openChannelDialog, openInvitation, selectChannel, typeCode, waitCodeStepFor,
} from "../_helpers/supership-member-invitation";
import { waitEnabled } from "../_helpers/wait";

// Someone without an account opens a Shop member invitation, creates the account and a shop of their
// own, confirms the phone number with an OTP and joins the inviting shop. Once per OTP channel.
// The backend is a stand-in (see mockMemberInvitation): nothing is created and no OTP is sent.
export default CHANNELS.map((channel) => defineFlow({
  id: `loi-moi-shop-${channel.toLowerCase()}-thanh-cong`,
  group: groupName(channel),
  name: "1. THAM GIA THÀNH CÔNG",
  app: "supership",
  async run({ page, shot }) {
    await mockMemberInvitation(page);

    await openInvitation(page);
    await shot(...INVITATION_STEP, { mode: "fullPage" });

    await fillSignupForm(page);
    await shot("da-nhap-thong-tin", "Đã nhập thông tin tài khoản và cửa hàng", { mode: "fullPage" });

    await openChannelDialog(page);
    await selectChannel(page, channel);
    await shot("chon-kenh", `Chọn kênh nhận OTP qua ${CHANNEL_NAME[channel]}`);

    await confirmChannel(page);
    await waitCodeStepFor(page, channel);
    await page.getByRole("timer").waitFor();
    await shot("nhap-ma", `Nhập mã xác thực gửi qua ${CHANNEL_NAME[channel]}`, { mode: "fullPage" });

    await typeCode(page, DEV_OTP);
    await waitEnabled(joinButton(page));
    await shot("da-nhap-ma", "Đã nhập mã xác thực", { mode: "fullPage" });

    await joinButton(page).click();
    await page.getByRole("heading", { name: /^Bạn đã tham gia/ }).waitFor();
    await shot("thanh-cong", "Tham gia cửa hàng thành công", { mode: "fullPage" });
  },
}));
