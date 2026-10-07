import {
  DEV_OTP, dialogSaying, emailVerificationFlow, leaveFocus, openProfile, openUnverifiedNotice, startVerification, typeCode,
  verifyButton,
} from "../_helpers/supership-profile";

// Verifying the account's email on "Thông tin tài khoản", for an account that registered with an email
// it has not verified yet: the mark beside the email, the code sent to it, a wrong code, and a resend.
// The backend is a stand-in (see mockUnverifiedEmail).
export default [
  emailVerificationFlow({
    id: "thanh-cong",
    name: "XÁC THỰC EMAIL THÀNH CÔNG",
    async run({ page, shot }) {
      await openProfile(page);
      await shot("email-chua-xac-thuc", "Thông tin tài khoản có email chưa xác thực", { mode: "fullPage" });

      await openUnverifiedNotice(page);
      await shot("thong-bao-chua-xac-minh", "Thông báo email chưa được xác minh");

      await startVerification(page);
      await shot("nhap-ma-xac-thuc", "Nhập mã xác thực đã gửi đến email");

      await typeCode(page, DEV_OTP);
      await shot("da-nhap-ma", "Đã nhập mã xác thực");

      await verifyButton(page).click();
      await page.getByText("Đã xác thực email.").waitFor();
      await page.getByLabel("Email đã được xác thực").waitFor();
      await leaveFocus(page);
      await shot("xac-thuc-thanh-cong", "Xác thực email thành công", { mode: "fullPage" });
    },
  }),

  emailVerificationFlow({
    id: "nhap-sai-ma",
    name: "XÁC THỰC EMAIL THẤT BẠI DO NHẬP SAI MÃ",
    async run({ page, shot }) {
      await openProfile(page);
      await shot("email-chua-xac-thuc", "Thông tin tài khoản có email chưa xác thực", { mode: "fullPage" });

      await openUnverifiedNotice(page);
      await startVerification(page);
      await typeCode(page, "111111");
      await shot("da-nhap-ma-sai", "Đã nhập mã xác thực sai");

      await verifyButton(page).click();
      const wrong = "Mã OTP không đúng. Bạn còn 4 lần nhập.";
      await page.getByText(wrong).first().waitFor();
      await shot("ma-khong-dung", "Mã xác thực không đúng, còn 4 lần nhập");
    },
  }),

  emailVerificationFlow({
    id: "gui-lai-ma",
    name: "GỬI LẠI MÃ XÁC THỰC EMAIL",
    async run({ page, shot, profile }) {
      await openProfile(page);
      await shot("email-chua-xac-thuc", "Thông tin tài khoản có email chưa xác thực", { mode: "fullPage" });

      await openUnverifiedNotice(page);
      await startVerification(page);
      await shot("dang-dem-nguoc", "Chờ mã xác thực, đang đếm ngược");

      await profile.travel(181);
      const resend = page.getByRole("button", { name: "Gửi lại", exact: true });
      await resend.waitFor();
      await shot("co-the-gui-lai", "Hết đếm ngược, có thể gửi lại mã");

      await resend.click();
      await dialogSaying(page, "Gửi lại mã OTP?").getByRole("button", { name: "Xác nhận", exact: true }).waitFor();
      await shot("xac-nhan-gui-lai", "Xác nhận gửi lại mã");

      await dialogSaying(page, "Gửi lại mã OTP?").getByRole("button", { name: "Xác nhận", exact: true }).click();
      await dialogSaying(page, "Gửi lại mã OTP?").waitFor({ state: "detached" });
      await page.waitForTimeout(600);
      await shot("da-gui-lai", "Đã gửi lại mã, hết lượt gửi lại");

      await typeCode(page, DEV_OTP);
      await verifyButton(page).click();
      await page.getByLabel("Email đã được xác thực").waitFor();
      await leaveFocus(page);
      await shot("xac-thuc-thanh-cong", "Xác thực email thành công", { mode: "fullPage" });
    },
  }),
];
