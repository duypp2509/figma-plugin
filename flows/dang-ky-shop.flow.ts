import { defineFlow } from "../capture";
import { fillRegisterForm, openOtpChannelDialog, requestOtp, submitOtp } from "./_helpers/supership-register";
import { freezeTime } from "./_helpers/wait";

// Runs against the real dev backend: EVERY RUN CREATES A NEW ACCOUNT AND SHOP and uses one of the
// 50 OTPs the backend allows per day. For routine re-captures use dang-ky-shop.mock.flow.ts.
export default defineFlow({
  id: "dang-ky-shop",
  name: "Đăng ký Shop",
  app: "supership",
  caution: "chạy với backend thật: tạo một tài khoản và Shop mới, tốn 1 trong 50 OTP mỗi ngày, và phải tự bấm captcha (--headed)",
  async run({ page, shot, log }) {
    // The whole flow stays on /register: the form lives in memory, so never reload along the way.
    await page.goto("/register");
    await page.getByRole("heading", { name: "Đăng ký tài khoản" }).waitFor();
    await fillRegisterForm(page);
    // The form is taller than the viewport; capture all of it.
    await shot("form", "Form đăng ký", { mode: "fullPage" });

    // With a real Turnstile sitekey in the app's .env.local the captcha must be ticked by hand:
    // run with --headed and click it within three minutes.
    log("đang chờ captcha — nếu nó hỏi, hãy bấm xác minh trong cửa sổ trình duyệt (cần --headed).");
    await openOtpChannelDialog(page, 180_000);
    await shot("chon-kenh", "Chọn kênh nhận OTP");

    await requestOtp(page);
    // The screen shows a resend countdown; stop the clock so every run captures the same value.
    await freezeTime(page);
    await shot("nhap-otp", "Nhập mã OTP");

    // The dev profile always accepts 515060.
    await submitOtp(page);
    await shot("thanh-cong", "Đăng ký thành công");
  },
});
