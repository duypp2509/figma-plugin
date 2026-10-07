import { defineFlow } from "../capture";
import { fillRegisterForm, mockRegisterApi, openOtpChannelDialog, requestOtp, submitOtp } from "./_helpers/supership-register";
import { mockTurnstile } from "./_helpers/turnstile";
import { freezeTime } from "./_helpers/wait";

// Same screens as dang-ky-shop.flow.ts, with the registration endpoints answered in the browser:
// no account is created and no OTP is sent. Use this one for routine re-captures.
export default defineFlow({
  id: "dang-ky-shop-mock",
  name: "Đăng ký Shop (mock)",
  app: "supership",
  async run({ page, shot }) {
    await mockRegisterApi(page);
    // The local app runs with a real Turnstile sitekey, which an automated browser cannot pass.
    await mockTurnstile(page);

    // The whole flow stays on /register: the form lives in memory, so never reload along the way.
    await page.goto("/register");
    await page.getByRole("heading", { name: "Đăng ký tài khoản" }).waitFor();
    await fillRegisterForm(page);
    // The form is taller than the viewport; capture all of it.
    await shot("form", "Form đăng ký", { mode: "fullPage" });

    await openOtpChannelDialog(page);
    await shot("chon-kenh", "Chọn kênh nhận OTP");

    await requestOtp(page);
    // The screen shows a resend countdown; stop the clock so every run captures the same value.
    await freezeTime(page);
    await shot("nhap-otp", "Nhập mã OTP");

    await submitOtp(page);
    await shot("thanh-cong", "Đăng ký thành công");
  },
});
