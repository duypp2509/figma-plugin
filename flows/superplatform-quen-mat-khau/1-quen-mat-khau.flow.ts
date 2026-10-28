import { expect } from "playwright/test";
import {
  CARD_NUMBER, FULL_NAME, closeNotice, MASKED_PHONE, MESSAGES, OTP_DESTINATION, PASSWORD, confirmButton, confirmOtp, consentBox,
  continueButton, dialog, fillIdentity, fillPasswords, heading, identify, openQrScanner, openReset, photographCardFront,
  reachFace, reachNewPassword, readQr, resetFlow, sendCodeButton, sendFace, sendOtp, setPasswordButton, startFace,
  submitIdentity, takeFace, typeOtp, useCardPhoto, waitCamera,
} from "../_helpers/superplatform-internal-reset";

export default [
  resetFlow("thanh-cong", "01. ĐẶT LẠI MẬT KHẨU THÀNH CÔNG", async ({ page, shot, mock }) => {
    await openReset(page);
    await shot("nhap-thong-tin", "Nhập số điện thoại/Email công ty và số căn cước");
    await fillIdentity(page);
    await shot("da-nhap-thong-tin", "Đã nhập thông tin");
    await continueButton(page).click();
    await heading(page, "Xác nhận thông tin");
    await page.getByText(FULL_NAME, { exact: true }).waitFor();
    await shot("xac-nhan-thong-tin", "Xác nhận thông tin: họ tên, số điện thoại và CCCD đã che");
    await confirmButton(page).click();
    await consentBox(page).waitFor();
    await shot("dong-y", "Công ty yêu cầu xác thực khuôn mặt: đồng ý rồi bắt đầu");
    await startFace(page);
    await shot("chup-khuon-mat", "Chụp khuôn mặt");
    await takeFace(page);
    await shot("da-chup", "Xem lại ảnh vừa chụp");
    await sendFace(page);
    await heading(page, "Nhận mã OTP");
    await page.getByText(MESSAGES.passed).waitFor();
    await shot("xac-minh-thanh-cong", "Xác minh thành công, chọn kênh nhận mã OTP");
    await sendCodeButton(page).click();
    await heading(page, "Nhập mã OTP");
    await shot("nhap-otp", `Nhập mã OTP gửi tới số ${OTP_DESTINATION}`);
    await typeOtp(page);
    await shot("da-nhap-otp", "Đã nhập mã OTP");
    await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await heading(page, "Đặt mật khẩu mới");
    await shot("dat-mat-khau", "Đặt mật khẩu mới ngay trên trang");
    await fillPasswords(page);
    await shot("da-nhap-mat-khau", "Đã nhập mật khẩu mới");
    await setPasswordButton(page).click();
    await page.getByText(MESSAGES.passwordSet).waitFor();
    await shot("hoan-tat", "Đặt mật khẩu mới thành công: mọi phiên bị đăng xuất, đăng nhập lại");
    expect(mock.password).toBe(PASSWORD);
  }),
  resetFlow("khong-xac-minh-khuon-mat", "02. KHÔNG CÔNG TY NÀO YÊU CẦU XÁC MINH KHUÔN MẶT", async ({ page, shot }) => {
    await openReset(page); await submitIdentity(page);
    await page.getByText(FULL_NAME, { exact: true }).waitFor();
    await shot("xac-nhan-thong-tin", "Không có bước khuôn mặt: còn 4 bước");
    await confirmButton(page).click();
    await heading(page, "Nhận mã OTP");
    await page.getByText(`Nhận mã qua số ${MASKED_PHONE}`).waitFor();
    await shot("chon-kenh", "Xác nhận xong là chọn kênh nhận mã OTP");
    await sendOtp(page, "Zalo");
    await confirmOtp(page);
    await heading(page, "Đặt mật khẩu mới");
    await shot("dat-mat-khau", "Đúng mã OTP: đặt mật khẩu mới");
  }, { faceRequired: false }),
  resetFlow("thong-tin-khong-hop-le", "03. THÔNG TIN KHÔNG HỢP LỆ", async ({ page, shot }) => {
    await openReset(page);
    await fillIdentity(page, "00119400");
    await page.locator("#identifier").click();
    await page.getByText(MESSAGES.citizenId).waitFor();
    await shot("so-can-cuoc-thieu", "Số căn cước chưa đủ 12 chữ số");
    await fillIdentity(page);
    await continueButton(page).click();
    await dialog(page).getByText(MESSAGES.mismatch).waitFor();
    await shot("khong-khop", "Thông tin không khớp, không nói sai ở đâu");
  }, { startRefusal: { status: 400, code: "INTERNAL_RESET_MISMATCH", message: MESSAGES.mismatch } }),
  resetFlow("chua-xac-thuc-can-cuoc", "04. CHƯA CÓ GIẤY TỜ ĐỊNH DANH ĐƯỢC DUYỆT", async ({ page, shot }) => {
    await openReset(page); await fillIdentity(page); await continueButton(page).click();
    await dialog(page).getByText(MESSAGES.noDocument).waitFor();
    await shot("chua-xac-thuc", "Chưa có giấy tờ định danh được duyệt");
  }, { startRefusal: { status: 409, code: "INTERNAL_RESET_NO_VERIFIED_DOCUMENT", message: MESSAGES.noDocument } }),
  resetFlow("nhap-sai-otp", "05. NHẬP SAI MÃ OTP", async ({ page, shot }) => {
    await identify(page); await sendOtp(page);
    for (let i = 1; i <= 3; i++) {
      await confirmOtp(page, `13579${i}`);
      await dialog(page).getByText(MESSAGES.otpWrong(5 - i)).waitFor();
      if (i < 3) await closeNotice(page);
    }
    await shot("sai-ma", "Mã OTP không đúng, còn 2 lần nhập");
    for (let i = 4; i <= 5; i++) { await closeNotice(page); await confirmOtp(page, `13579${i}`); }
    await page.getByText(MESSAGES.otpBlocked).waitFor();
    await shot("qua-so-lan", "Sai 5 lần: mã bị khóa, phải nhận mã mới");
  }, { faceRequired: false }),
  resetFlow("chup-lai", "06. KHUÔN MẶT CHƯA RÕ, CHỤP LẠI", async ({ page, shot }) => {
    await reachFace(page); await takeFace(page); await sendFace(page);
    await page.getByText(MESSAGES.retry).waitFor();
    await shot("chua-ro", "Chưa thấy rõ khuôn mặt (không tính lần thử)");
    await page.getByRole("button", { name: "Chụp lại", exact: true }).click();
    await waitCamera(page);
    await shot("chup-lai", "Chụp lại khuôn mặt");
  }, { consent: true, faces: ["RETRY"] }),
  resetFlow("khuon-mat-khong-khop", "07. KHUÔN MẶT KHÔNG KHỚP 3 LẦN", async ({ page, shot }) => {
    await reachFace(page);
    await shot("con-2-lan", "Đã sai 1 lần, còn 2 lần thử");
    await takeFace(page); await sendFace(page);
    await page.getByText(MESSAGES.faceMismatch(1)).waitFor();
    await shot("khong-khop", "Khuôn mặt không khớp, còn 1 lần thử");
    await page.getByRole("button", { name: "Chụp lại", exact: true }).click();
    await takeFace(page); await sendFace(page);
    await heading(page, "Không thể tiếp tục");
    await shot("dung-lai", "Không khớp lần thứ 3: dừng, liên hệ Quản trị hệ thống của công ty");
  }, { consent: true, failures: 1, faces: ["FAILED", "FAILED"] }),
  resetFlow("khong-the-xac-minh", "08. KHÔNG THỂ XÁC MINH KHUÔN MẶT", async ({ page, shot, mock }) => {
    for (const [id, title, closed] of [
      ["chua-san-sang", "Xác minh khuôn mặt chưa sẵn sàng", { reason: "EKYC_NOT_AVAILABLE", message: MESSAGES.unavailable }],
      ["tam-khoa", "Xác minh khuôn mặt đang tạm khóa", { reason: "EKYC_LOCKED", message: MESSAGES.locked }],
      ["xac-thuc-lai-can-cuoc", "Cần xác thực lại căn cước", { reason: "EKYC_NO_DOCUMENT_IMAGE", message: MESSAGES.reverify }],
    ] as const) {
      mock.closed = closed;
      await identify(page);
      await page.getByText(closed.message).waitFor();
      await shot(id, title);
    }
  }),
  resetFlow("mat-khau-chua-dat", "09. MẬT KHẨU MỚI CHƯA ĐẠT", async ({ page, shot }) => {
    await reachNewPassword(page);
    await fillPasswords(page, "supership", "");
    await shot("chua-dat-yeu-cau", "Mật khẩu chưa đạt yêu cầu");
    await fillPasswords(page, PASSWORD, "SuperShip@2025");
    await page.locator("#new-password").click();
    await expect(setPasswordButton(page)).toBeDisabled();
    await shot("khong-khop", "Mật khẩu nhập lại không khớp");
  }, { faceRequired: false }),
  resetFlow("anh-can-cuoc", "10. NHẬN DIỆN BẰNG ẢNH CĂN CƯỚC", async ({ page, shot }) => {
    await openReset(page);
    await page.locator("#identifier").fill("0938274516");
    await openQrScanner(page);
    await shot("quet-qr", "Quét mã QR trên căn cước bằng camera sau");
    await readQr(page);
    await expect(page.locator("#citizen-id")).toHaveValue(CARD_NUMBER);
    await shot("qr-da-dien-so", "Đọc được mã QR: số căn cước tự điền");

    await page.locator("#citizen-id").fill("");
    await photographCardFront(page);
    await shot("chup-mat-truoc", "Chụp mặt trước thẻ");
    await useCardPhoto(page);
    await dialog(page).getByText(MESSAGES.cardUnread).waitFor();
    await shot("chua-doc-duoc", "Chưa đọc được số trên thẻ: chụp lại hoặc nhập tay");
    await photographCardFront(page, false);
    await useCardPhoto(page);
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await expect(page.locator("#citizen-id")).toHaveValue(CARD_NUMBER);
    await shot("anh-da-dien-so", "Đọc được số trên ảnh thẻ: số căn cước tự điền");
    await continueButton(page).click();
    await heading(page, "Xác nhận thông tin");
    await shot("xac-nhan-thong-tin", "Tiếp tục như nhập tay: xác nhận thông tin");
  }, { cardReads: [false] }),
  resetFlow("nhap-lai-thong-tin", "11. KHÔNG PHẢI THÔNG TIN CỦA BẠN", async ({ page, shot }) => {
    await openReset(page); await submitIdentity(page);
    await page.getByRole("button", { name: "Nhập lại thông tin", exact: true }).click();
    await heading(page, "Quên mật khẩu");
    await expect(page.locator("#citizen-id")).not.toBeEmpty();
    await shot("nhap-lai", "Nhập lại thông tin: quay về bước 1, giữ chữ đã nhập");
  }),
];
