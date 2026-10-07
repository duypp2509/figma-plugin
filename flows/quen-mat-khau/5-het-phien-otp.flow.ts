import { defineFlow } from "../../capture";
import {
  CHANNELS, HOME_STEP, openHome, CHANNEL_NAME, DEV_OTP, confirmOtpButton, goToOtpStep, groupName, mockPasswordReset, openDialog, otpInput, phoneInput,
} from "../_helpers/supership-forgot-password";
import { waitEnabled } from "../_helpers/wait";

// An OTP session lasts five minutes; a code entered after that is turned down.
export default CHANNELS.map((channel) => defineFlow({
  id: `quen-mat-khau-${channel.toLowerCase()}-het-phien-otp`,
  group: groupName(channel),
  name: "5. HẾT PHIÊN OTP",
  app: "supership",
  async run({ page, shot }) {
    const backend = await mockPasswordReset(page);
    await openHome(page);
    await shot(...HOME_STEP);

    await goToOtpStep(page, channel);
    await shot("dang-cho-ma", `Chờ mã OTP qua ${CHANNEL_NAME[channel]}`);

    await backend.travel(301);
    await page.getByRole("button", { name: "Gửi lại", exact: true }).waitFor();
    await shot("het-phien", "Phiên OTP đã hết hạn");

    await otpInput(page).fill(DEV_OTP);
    await waitEnabled(confirmOtpButton(page));
    await shot("nhap-ma-sau-khi-het-phien", "Nhập mã sau khi hết phiên");

    await confirmOtpButton(page).click();
    await openDialog(page).getByRole("heading", { name: "Phiên nhận mã đã kết thúc" }).waitFor();
    await shot("phien-da-ket-thuc", "Thông báo phiên nhận mã đã kết thúc");

    await openDialog(page).getByRole("button", { name: "Đã hiểu" }).click();
    await phoneInput(page).waitFor();
    await shot("quay-ve-dau", "Quay về bước nhập số điện thoại");
  },
}));
