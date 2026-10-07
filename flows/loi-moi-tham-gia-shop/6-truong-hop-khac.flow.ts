import { defineFlow } from "../../capture";
import {
  DEV_OTP, FAILURES, INVITATION_STEP, OTHER_FAILURES_NAME, confirmChannel, confirmPasswordInput, emailInput, fillSignupForm,
  dismissErrorNotice, goToCodeStep, mockMemberInvitation, openChannelDialog, openDialog, openInvitation, submitCode, waitErrorNotice,
} from "../_helpers/supership-member-invitation";

// What can go wrong, or go another way, regardless of the OTP channel: a link that is no longer valid,
// details the form or the server turns down, a code that cannot be sent, the invitation closing while
// the account is being created, and declining instead of joining.
export default defineFlow({
  id: "loi-moi-shop-truong-hop-khac",
  name: OTHER_FAILURES_NAME,
  app: "supership",
  async run({ page, shot }) {
    const backend = await mockMemberInvitation(page);

    backend.preview.status = "EXPIRED";
    await openInvitation(page);
    await page.getByRole("heading", { name: "Lời mời không còn hiệu lực" }).waitFor();
    await shot("loi-moi-het-hieu-luc", "Lời mời không còn hiệu lực");

    backend.preview.status = "PENDING";
    await openInvitation(page);
    await shot(...INVITATION_STEP, { mode: "fullPage" });

    // A field that is not valid is said under the field as it is typed.
    await fillSignupForm(page);
    await emailInput(page).fill("tranngochan@");
    await emailInput(page).blur();
    await page.getByText("Nhập đúng địa chỉ email.").waitFor();
    await shot("email-sai-dinh-dang", "Email sai định dạng");
    await emailInput(page).fill("daco@example.com");

    await confirmPasswordInput(page).fill("MatKhau@2025");
    await confirmPasswordInput(page).blur();
    // A mismatch is said under the field, not in a notice.
    await page.getByText("Mật khẩu nhập lại chưa khớp.").waitFor();
    await shot("mat-khau-nhap-lai-chua-khop", "Mật khẩu nhập lại chưa khớp");
    await confirmPasswordInput(page).fill("MatKhau@2026");

    // What the server turns down comes back to the form in the same kind of notice.
    const refused = [
      ["email-da-duoc-dung", "Email đã được dùng cho tài khoản khác", FAILURES.emailAlreadyUsed],
      ["chua-gui-duoc-ma", "Chưa gửi được mã xác thực", FAILURES.codeDeliveryFailed],
      ["vuot-gioi-han-otp", "Vượt giới hạn OTP trong ngày", FAILURES.dailyOtpLimit],
    ] as const;
    for (const [stepId, title, failure] of refused) {
      backend.failNext("signup", failure);
      await openChannelDialog(page);
      await confirmChannel(page);
      await waitErrorNotice(page, failure.message);
      await shot(stepId, title);
      await dismissErrorNotice(page, failure.message);
    }

    // The right code creates the account and its shop, but the invitation was withdrawn meanwhile.
    await openInvitation(page);
    await goToCodeStep(page, "SMS");
    backend.failNext("signup/complete", FAILURES.invitationClosedDuringSignup);
    await submitCode(page, DEV_OTP);
    await page.getByRole("heading", { name: "Tài khoản và cửa hàng của bạn đã được tạo" }).waitFor();
    await shot("loi-moi-dong-khi-dang-tao-tai-khoan", "Lời mời hết hiệu lực khi đang tạo tài khoản");

    await openInvitation(page);
    await page.getByRole("button", { name: "Không muốn tham gia? Từ chối lời mời" }).click();
    const confirmDecline = openDialog(page).getByRole("button", { name: "Xác nhận", exact: true });
    await confirmDecline.waitFor();
    await shot("xac-nhan-tu-choi", "Xác nhận từ chối lời mời");

    await confirmDecline.click();
    await page.getByRole("heading", { name: "Đã từ chối lời mời" }).waitFor();
    await shot("da-tu-choi", "Đã từ chối lời mời");
  },
});
