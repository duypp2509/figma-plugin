import { expect } from "playwright/test";
import {
  MESSAGES, answerPasskey, chooseUnit, enterUnit, openLogin, passkeyButton, passkeyFlow, pickerHeading, refusal, scrollToTop, startPasskey,
} from "../_helpers/superplatform-login";

const waiting = "Xác nhận trên thiết bị của bạn";

export default [
  passkeyFlow("thanh-cong", "01. ĐĂNG NHẬP BẰNG PASSKEY THÀNH CÔNG", async ({ page, shot }) => {
    await openLogin(page);
    await shot("form", "Màn đăng nhập");
    await startPasskey(page);
    await page.getByText(waiting).waitFor();
    await shot("cho-xac-nhan", "Xác nhận bằng vân tay, khuôn mặt hoặc PIN của máy");
    await answerPasskey(page);
    // A passkey proves MFA: no Authenticator code before the picker.
    await pickerHeading(page).waitFor();
    await shot("chon-don-vi", "Không hỏi mã Authenticator, chọn đơn vị làm việc");
    await chooseUnit(page);
    await enterUnit(page);
    await page.getByRole("dialog", { name: "Tin cậy thiết bị này?" }).waitFor();
    await shot("tin-cay-thiet-bi", "Vào trang chủ, mời tin cậy thiết bị này");
    await page.getByRole("button", { name: "Tin cậy thiết bị này", exact: true }).click();
    await page.getByText("Đã tin cậy thiết bị này.", { exact: false }).waitFor();
    await shot("da-tin-cay", "Đã tin cậy thiết bị");
  }),
  passkeyFlow("huy", "02. HỦY XÁC NHẬN TRÊN THIẾT BỊ", async ({ page, shot }) => {
    await openLogin(page);
    await startPasskey(page);
    await page.getByText(waiting).waitFor();
    await scrollToTop(page);
    await shot("cho-xac-nhan", "Hộp xác nhận vân tay, khuôn mặt hoặc PIN của máy hiện lên");
    await answerPasskey(page, true);
    await refusal(page, "Bạn chưa đăng nhập vào SuperPlatform.");
    await shot("da-huy", "Đóng hộp xác nhận của máy: đã hủy đăng nhập");
  }),
  passkeyFlow("khong-hop-le", "03. PASSKEY KHÔNG DÙNG ĐƯỢC", async ({ page, shot }) => {
    await openLogin(page);
    await startPasskey(page);
    await answerPasskey(page);
    await refusal(page, MESSAGES.passkeyRejected);
    await shot("tu-choi", "Passkey đã gỡ, tài khoản bị khóa hoặc vô hiệu hóa: báo chung");
  }, { passkey: "REJECTED" }),
  passkeyFlow("het-han", "04. YÊU CẦU ĐÃ HẾT HẠN", async ({ page, shot }) => {
    await openLogin(page);
    await startPasskey(page);
    await answerPasskey(page);
    await refusal(page, "Vui lòng đăng nhập lại.");
    await shot("het-han", "Để quá 5 phút mới xác nhận: yêu cầu đã hết hạn");
  }, { passkey: "EXPIRED" }),
  passkeyFlow("qua-nhieu-yeu-cau", "05. QUÁ NHIỀU YÊU CẦU", async ({ page, shot }) => {
    await openLogin(page);
    await startPasskey(page);
    await refusal(page, MESSAGES.passkeyRateLimited);
    await shot("qua-nhieu", "Bấm quá nhiều lần trong một phút");
  }, { passkey: "RATE_LIMITED" }),
  passkeyFlow("khong-ho-tro", "06. TRÌNH DUYỆT KHÔNG HỖ TRỢ PASSKEY", async ({ page, shot }) => {
    await openLogin(page);
    await expect(passkeyButton(page)).toBeDisabled();
    await shot("khong-ho-tro", "Nút Passkey bị khóa, dùng mật khẩu");
  }, {}, false),
  passkeyFlow("khoa-khong-hoat-dong", "07. TÀI KHOẢN BỊ TẠM KHÓA VÌ LÂU KHÔNG HOẠT ĐỘNG", async ({ page, shot, mock }) => {
    // Said once the passkey proved the owner, as for a right password (AccountInactivity).
    mock.on("POST", "/v1/auth/passkey/verify", () => ({ status: 403, message: MESSAGES.inactivityLocked,
      data: { code: "INACTIVITY_LOCKED", title: "Tài khoản đã bị tạm khóa" } }));
    await openLogin(page);
    await startPasskey(page);
    await answerPasskey(page);
    await refusal(page, MESSAGES.inactivityLocked);
    await shot("tu-choi", "Xác nhận passkey xong mới báo tài khoản bị tạm khóa");
  }),
];
