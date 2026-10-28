import { MFA_CODE, PHONE, answerPasskey, fill, openLogin, pickerHeading, submit } from "../_helpers/superplatform-login";
import {
  MAX_ATTEMPTS, MESSAGES, RECOVERY_CODES, WRONG_MFA_CODE, WRONG_RECOVERY_CODE, button, closeFailure, failure, mfaFlow, press,
  recoveryInput, signInToMfa, typeCode,
} from "../_helpers/superplatform-login-mfa";
import { DEV_OTP } from "../_helpers/otp-session";

export default [
  mfaFlow("sai-ma", "NHẬP SAI MÃ AUTHENTICATOR", async ({ page, shot }) => {
    await signInToMfa(page, shot);
    await typeCode(page, WRONG_MFA_CODE);
    await shot("nhap-sai", "Nhập sai mã Authenticator");
    await press(page, "Xác thực");
    await failure(page, "Mã xác thực không đúng", MESSAGES.invalidCode);
    await shot("sai-ma", "Mã xác thực không đúng");
    await closeFailure(page);
    await typeCode(page, MFA_CODE);
    await shot("nhap-lai", "Nhập lại đúng mã");
    await press(page, "Xác thực");
    await pickerHeading(page).waitFor();
    await shot("chon-don-vi", "Xác thực xong, chọn đơn vị làm việc");
  }),
  mfaFlow("tam-khoa", "NHẬP SAI MÃ QUÁ SỐ LẦN", async ({ page, shot, mfa }) => {
    await signInToMfa(page, shot);
    while (mfa.failures < MAX_ATTEMPTS - 1) {
      await typeCode(page, WRONG_MFA_CODE);
      await press(page, "Xác thực");
      await failure(page, "Mã xác thực không đúng", MESSAGES.invalidCode);
      await closeFailure(page);
    }
    await typeCode(page, WRONG_MFA_CODE);
    await shot("sai-lan-5", "Sai 4 lần, nhập sai lần thứ 5");
    await press(page, "Xác thực");
    await failure(page, "Tạm khóa xác thực", MESSAGES.locked());
    await shot("tam-khoa", "Tạm khóa xác thực 15 phút");
    await closeFailure(page);
    await button(page, "Thử lại sau 15:00").waitFor();
    await shot("cho-thu-lai", "Nút Xác thực đếm ngược thời gian khóa");
  }),
  mfaFlow("ma-du-phong", "XÁC THỰC BẰNG MÃ DỰ PHÒNG", async ({ page, shot }) => {
    await signInToMfa(page, shot);
    await press(page, "Dùng mã dự phòng");
    await recoveryInput(page).waitFor();
    await shot("nhap-ma-du-phong", "Chuyển sang nhập mã dự phòng");
    await recoveryInput(page).pressSequentially(RECOVERY_CODES[0]!);
    await shot("da-nhap", "Nhập một mã dự phòng đã lưu");
    await press(page, "Xác thực");
    await page.getByRole("heading", { name: "Xác thực thành công", exact: true }).waitFor();
    await page.getByText("Bạn còn 7 mã dự phòng.", { exact: true }).waitFor();
    await shot("thanh-cong", "Xác thực thành công, còn 7 mã dự phòng");
    await press(page, "Tiếp tục");
    await pickerHeading(page).waitFor();
    await shot("chon-don-vi", "Chọn đơn vị làm việc");
  }),
  mfaFlow("ma-du-phong-sai", "NHẬP SAI MÃ DỰ PHÒNG", async ({ page, shot }) => {
    await signInToMfa(page, shot);
    await press(page, "Dùng mã dự phòng");
    await recoveryInput(page).waitFor();
    await shot("nhap-ma-du-phong", "Chuyển sang nhập mã dự phòng");
    await recoveryInput(page).pressSequentially(WRONG_RECOVERY_CODE);
    await shot("da-nhap", "Nhập mã dự phòng không đúng");
    await press(page, "Xác thực");
    await failure(page, "Mã dự phòng không đúng", MESSAGES.invalidRecoveryCode);
    await shot("sai-ma", "Mã dự phòng không đúng hoặc đã dùng");
  }),
  mfaFlow("passkey", "XÁC THỰC BẰNG PASSKEY", async ({ page, shot }) => {
    await signInToMfa(page, shot);
    await press(page, "Xác thực bằng passkey");
    await button(page, "Đang chờ passkey…").waitFor();
    await shot("cho-passkey", "Xác nhận bằng vân tay, khuôn mặt hoặc PIN của máy");
    await answerPasskey(page);
    await pickerHeading(page).waitFor();
    await shot("chon-don-vi", "Xác thực xong, chọn đơn vị làm việc");
  }),
  mfaFlow("mat-dien-thoai", "MẤT ĐIỆN THOẠI, ĐẶT LẠI MFA BẰNG MÃ DỰ PHÒNG", async ({ page, shot }) => {
    await signInToMfa(page, shot);
    await press(page, "Mất điện thoại?");
    await page.getByRole("heading", { name: "Mất điện thoại?", exact: true }).waitFor();
    await shot("mat-dien-thoai", "Hướng dẫn khi mất điện thoại");
    await press(page, "Dùng mã dự phòng");
    await button(page, "Đặt lại MFA").waitFor();
    await shot("dung-ma-du-phong", "Nhập mã dự phòng, có lựa chọn Đặt lại MFA");
    await press(page, "Đặt lại MFA");
    await page.getByRole("heading", { name: "Đặt lại xác thực hai lớp", exact: true }).waitFor();
    await shot("dat-lai", "Đặt lại MFA bằng mã dự phòng");
    await recoveryInput(page).pressSequentially(RECOVERY_CODES[0]!);
    await shot("da-nhap", "Nhập một mã dự phòng đã lưu");
    await press(page, "Xác nhận");
    await page.getByRole("alertdialog").getByRole("heading", { name: "Đặt lại xác thực hai lớp?", exact: true }).waitFor();
    await shot("xac-nhan", "Xác nhận đặt lại xác thực hai lớp");
    await page.getByRole("alertdialog").getByRole("button", { name: "Đặt lại", exact: true }).click();
    await page.getByRole("heading", { name: "Thiết lập xác thực hai lớp", exact: true }).waitFor();
    await button(page, "Chọn kênh nhận mã OTP").waitFor();
    await shot("thiet-lap", "Đã đặt lại, thiết lập Authenticator mới");
  }),
  mfaFlow("quay-ve-dang-nhap", "QUAY VỀ TRANG ĐĂNG NHẬP", async ({ page, shot }) => {
    await signInToMfa(page, shot);
    await press(page, "Quay về trang đăng nhập");
    await page.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor();
    await page.locator("#identifier").waitFor();
    await shot("dang-nhap", "Hủy lần đăng nhập, về trang đăng nhập");
  }),
  mfaFlow("thiet-lap", "BẮT BUỘC THIẾT LẬP XÁC THỰC HAI LỚP", async ({ page, shot }) => {
    await openLogin(page);
    await fill(page, PHONE);
    await shot("da-nhap", "Nhập số điện thoại và mật khẩu");
    await submit(page);
    await page.getByRole("heading", { name: "Thiết lập xác thực hai lớp", exact: true }).waitFor();
    await button(page, "Chọn kênh nhận mã OTP").waitFor();
    await shot("thiet-lap", "Chưa có Authenticator: thiết lập trước khi chọn đơn vị");
    await press(page, "Chọn kênh nhận mã OTP");
    const channels = page.getByRole("dialog");
    await channels.getByRole("button", { name: "Nhận mã OTP", exact: true }).waitFor();
    await shot("chon-kenh", "Chọn kênh nhận mã OTP");
    await channels.getByRole("button", { name: "Nhận mã OTP", exact: true }).click();
    const otp = page.getByRole("textbox", { name: "Nhập mã xác thực OTP" });
    await otp.waitFor();
    await page.getByText("Có thể gửi lại sau", { exact: false }).waitFor();
    await otp.pressSequentially(DEV_OTP);
    await shot("nhap-otp", "Nhập mã OTP gửi qua SMS");
    await press(page, "Xác minh OTP");
    await page.getByRole("img", { name: "Mã QR thiết lập xác thực hai lớp" }).waitFor();
    await press(page, "Hiện mã thiết lập");
    await shot("quet-qr", "Quét mã QR hoặc nhập mã thiết lập");
    await typeCode(page, WRONG_MFA_CODE);
    await press(page, "Xác nhận");
    await failure(page, "Mã xác thực không đúng", MESSAGES.invalidCode);
    await shot("sai-ma", "Nhập sai mã từ ứng dụng");
    await closeFailure(page);
    await typeCode(page, MFA_CODE);
    await shot("nhap-ma", "Nhập mã 6 số hiện trên ứng dụng");
    await press(page, "Xác nhận");
    await page.getByRole("heading", { name: "Lưu mã dự phòng", exact: true }).waitFor();
    await shot("ma-du-phong", "Lưu 10 mã dự phòng", { mode: "fullPage" });
    await page.getByLabel("Tôi đã lưu các mã dự phòng này vào nơi an toàn.").check();
    await press(page, "Tiếp tục");
    await pickerHeading(page).waitFor();
    await shot("chon-don-vi", "Thiết lập xong, chọn đơn vị làm việc");
  }, { enrolled: false }),
];
