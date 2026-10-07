import { defineFlow } from "../../capture";
import {
  CHANNELS, CHANNEL_NAME, DEV_OTP, INVITATION_STEP, continueButton, goToCodeStep, groupName, joinButton, mockMemberInvitation,
  openDialog, openInvitation, typeCode,
} from "../_helpers/supership-member-invitation";
import { waitEnabled } from "../_helpers/wait";

// An OTP session lasts five minutes; a code entered after that is turned down.
export default CHANNELS.map((channel) => defineFlow({
  id: `loi-moi-shop-${channel.toLowerCase()}-het-phien-otp`,
  group: groupName(channel),
  name: "5. HẾT PHIÊN OTP",
  app: "supership",
  async run({ page, shot }) {
    const backend = await mockMemberInvitation(page);
    await openInvitation(page);
    await shot(...INVITATION_STEP, { mode: "fullPage" });

    await goToCodeStep(page, channel);
    await shot("dang-cho-ma", `Chờ mã OTP qua ${CHANNEL_NAME[channel]}`, { mode: "fullPage" });

    await backend.travel(301);
    await page.getByRole("button", { name: "Gửi lại", exact: true }).waitFor();
    await shot("het-phien", "Phiên OTP đã hết hạn", { mode: "fullPage" });

    await typeCode(page, DEV_OTP);
    await waitEnabled(joinButton(page));
    await shot("nhap-ma-sau-khi-het-phien", "Nhập mã sau khi hết phiên", { mode: "fullPage" });

    await joinButton(page).click();
    await openDialog(page).getByRole("heading", { name: "Mã OTP đã hết hạn" }).waitFor();
    await shot("phien-da-ket-thuc", "Thông báo mã OTP đã hết hạn");

    await openDialog(page).getByRole("button", { name: "Đã hiểu" }).click();
    await continueButton(page).waitFor();
    await shot("quay-ve-buoc-thong-tin", "Quay về bước thông tin tài khoản", { mode: "fullPage" });
  },
}));
