import { defineFlow } from "../../capture";
import { CHANNELS, HOME_STEP, openHome, goToOtpStep, groupName, mockPasswordReset, openDialog, phoneInput, submitOtp } from "../_helpers/supership-forgot-password";

// Five wrong codes block the OTP session and send the user back to the start.
export default CHANNELS.map((channel) => defineFlow({
  id: `quen-mat-khau-${channel.toLowerCase()}-nhap-sai-qua-so-lan`,
  group: groupName(channel),
  name: "4. NHẬP SAI QUÁ SỐ LẦN QUY ĐỊNH",
  app: "supership",
  async run({ page, shot }) {
    await mockPasswordReset(page);
    await openHome(page);
    await shot(...HOME_STEP);

    await goToOtpStep(page, channel);

    await submitOtp(page, "111111");
    await page.getByText("Mã OTP không đúng. Bạn còn 4 lần nhập.").waitFor();
    await shot("otp-sai-lan-1", "Nhập sai mã OTP lần 1, còn 4 lần");

    for (const [index, code] of ["222222", "333333", "444444"].entries()) {
      await submitOtp(page, code);
      await page.getByText(`Mã OTP không đúng. Bạn còn ${3 - index} lần nhập.`).waitFor();
    }
    await shot("otp-sai-lan-4", "Nhập sai mã OTP lần 4, còn 1 lần");

    await submitOtp(page, "555555");
    await openDialog(page).getByRole("heading", { name: "Nhập sai quá số lần cho phép" }).waitFor();
    await shot("sai-qua-so-lan", "Nhập sai quá số lần cho phép");

    await openDialog(page).getByRole("button", { name: "Đã hiểu" }).click();
    await phoneInput(page).waitFor();
    await shot("quay-ve-dau", "Quay về bước nhập số điện thoại");
  },
}));
