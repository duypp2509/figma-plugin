import type { Page } from "playwright";
import { expect } from "playwright/test";
import type { FlowContext } from "../../capture";
import {
  CARD_NUMBER, FULL_NAME, closeNotice, MASKED_PHONE, MESSAGES, OTP_DESTINATION, PASSWORD, clickForgot, confirmButton, confirmOtp,
  consentBox, continueButton, dialog, fillIdentity, fillPasswords, heading, openQrScanner, openSignIn, photographCardFront,
  readQr, resetFlow, sendCodeButton, sendFace, sendOtp, setPasswordButton, startFace, startFaceButton, takeFace, typeOtp,
  useCardPhoto, waitCamera,
} from "../_helpers/superplatform-internal-reset";

type Shot = FlowContext["shot"];

/* Every flow walks from the sign-in page: "Quên mật khẩu?", the empty first step, then what the person types. */
async function signIn(page: Page, shot: Shot) {
  await openSignIn(page);
  await shot("dang-nhap", "Trang đăng nhập — bấm Quên mật khẩu?");
  await clickForgot(page);
  await shot("nhap-thong-tin", "Nhập số điện thoại/Email công ty và số căn cước");
}
async function typed(page: Page, shot: Shot) {
  await fillIdentity(page);
  await shot("da-nhap-thong-tin", "Đã nhập thông tin");
}
/** "Tiếp tục" up to the identity found. */
async function found(page: Page, shot: Shot, title = "Xác nhận thông tin: họ tên, số điện thoại và CCCD đã che") {
  await continueButton(page).click();
  await heading(page, "Xác nhận thông tin");
  await page.getByText(FULL_NAME, { exact: true }).waitFor();
  await shot("xac-nhan-thong-tin", title);
}
/** No face step: "Đúng thông tin, tiếp tục", the channel, the code sent and typed, up to "Đặt mật khẩu mới". */
async function otpRoad(page: Page, shot: Shot) {
  await confirmButton(page).click();
  await heading(page, "Nhận mã OTP");
  await page.getByText(`Nhận mã qua số ${MASKED_PHONE}`).waitFor();
  await shot("chon-kenh", "Xác nhận xong là chọn kênh nhận mã OTP");
  await sendCodeButton(page).click();
  await heading(page, "Nhập mã OTP");
  await shot("nhap-otp", `Nhập mã OTP gửi tới số ${OTP_DESTINATION}`);
}
/** Face step: "Đúng thông tin, tiếp tục", then "Bắt đầu xác thực" up to the camera. */
async function faceRoad(page: Page, shot: Shot) {
  await confirmButton(page).click();
  await heading(page, "Xác thực khuôn mặt");
  await startFaceButton(page).waitFor();
  await shot("bat-dau", "Công ty yêu cầu xác thực khuôn mặt — bấm Bắt đầu xác thực");
  await startFace(page);
  await shot("chup-khuon-mat", "Chụp khuôn mặt");
}

export default [
  resetFlow("thanh-cong", "ĐẶT LẠI MẬT KHẨU THÀNH CÔNG", async ({ page, shot, mock }) => {
    await signIn(page, shot);
    await typed(page, shot);
    await found(page, shot);
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
  resetFlow("khong-xac-minh-khuon-mat", "KHÔNG CÔNG TY NÀO YÊU CẦU XÁC MINH KHUÔN MẶT", async ({ page, shot }) => {
    await signIn(page, shot); await typed(page, shot);
    await found(page, shot, "Không có bước khuôn mặt: còn 4 bước");
    await confirmButton(page).click();
    await heading(page, "Nhận mã OTP");
    await page.getByText(`Nhận mã qua số ${MASKED_PHONE}`).waitFor();
    await shot("chon-kenh", "Xác nhận xong là chọn kênh nhận mã OTP");
    await sendOtp(page, "Zalo");
    await typeOtp(page);
    await shot("da-nhap-otp", "Nhập mã OTP nhận qua Zalo");
    await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await heading(page, "Đặt mật khẩu mới");
    await shot("dat-mat-khau", "Đúng mã OTP: đặt mật khẩu mới");
  }, { faceRequired: false }),
  resetFlow("thong-tin-khong-hop-le", "THÔNG TIN KHÔNG HỢP LỆ", async ({ page, shot }) => {
    await signIn(page, shot);
    await fillIdentity(page, "00119400");
    await page.locator("#identifier").click();
    await page.getByText(MESSAGES.citizenId).waitFor();
    await shot("so-can-cuoc-thieu", "Số căn cước chưa đủ 12 chữ số");
    await typed(page, shot);
    await continueButton(page).click();
    await dialog(page).getByText(MESSAGES.mismatch).waitFor();
    await shot("khong-khop", "Thông tin không khớp, không nói sai ở đâu");
  }, { startRefusal: { status: 400, code: "INTERNAL_RESET_MISMATCH", message: MESSAGES.mismatch } }),
  resetFlow("chua-xac-thuc-can-cuoc", "CHƯA CÓ GIẤY TỜ ĐỊNH DANH ĐƯỢC DUYỆT", async ({ page, shot }) => {
    await signIn(page, shot); await typed(page, shot);
    await continueButton(page).click();
    await dialog(page).getByText(MESSAGES.noDocument).waitFor();
    await shot("chua-xac-thuc", "Chưa có giấy tờ định danh được duyệt");
  }, { startRefusal: { status: 409, code: "INTERNAL_RESET_NO_VERIFIED_DOCUMENT", message: MESSAGES.noDocument } }),
  resetFlow("nhap-sai-otp", "NHẬP SAI MÃ OTP", async ({ page, shot }) => {
    await signIn(page, shot); await typed(page, shot); await found(page, shot);
    await otpRoad(page, shot);
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
  resetFlow("chup-lai", "KHUÔN MẶT CHƯA RÕ, CHỤP LẠI", async ({ page, shot }) => {
    await signIn(page, shot); await typed(page, shot); await found(page, shot);
    await faceRoad(page, shot);
    await takeFace(page);
    await shot("da-chup", "Xem lại ảnh vừa chụp rồi gửi");
    await sendFace(page);
    await page.getByText(MESSAGES.retry).waitFor();
    await shot("chua-ro", "Chưa thấy rõ khuôn mặt (không tính lần thử)");
    await page.getByRole("button", { name: "Chụp lại", exact: true }).click();
    await waitCamera(page);
    await shot("chup-lai", "Chụp lại khuôn mặt");
  }, { consent: true, faces: ["RETRY"] }),
  resetFlow("khuon-mat-khong-khop", "KHUÔN MẶT KHÔNG KHỚP 3 LẦN", async ({ page, shot }) => {
    await signIn(page, shot); await typed(page, shot); await found(page, shot);
    await faceRoad(page, shot);
    await takeFace(page); await sendFace(page);
    await page.getByText(MESSAGES.faceMismatch(2)).waitFor();
    await shot("con-2-lan", "Khuôn mặt không khớp, còn 2 lần thử");
    await page.getByRole("button", { name: "Chụp lại", exact: true }).click();
    await takeFace(page); await sendFace(page);
    await page.getByText(MESSAGES.faceMismatch(1)).waitFor();
    await shot("khong-khop", "Không khớp lần thứ 2, còn 1 lần thử");
    await page.getByRole("button", { name: "Chụp lại", exact: true }).click();
    await takeFace(page); await sendFace(page);
    // The stop is told in the shared error dialog, over the page that keeps its own "Không thể tiếp tục" title.
    await dialog(page).getByRole("heading", { name: "Không thể tiếp tục", exact: true }).waitFor();
    await shot("dung-lai", "Không khớp lần thứ 3: dừng, liên hệ Quản trị hệ thống của công ty");
  }, { consent: true, faces: ["FAILED", "FAILED", "FAILED"] }),
  resetFlow("khong-the-xac-minh", "XÁC MINH KHUÔN MẶT ĐANG TẠM KHÓA", async ({ page, shot }) => {
    await signIn(page, shot); await typed(page, shot); await found(page, shot);
    await confirmButton(page).click();
    await dialog(page).getByRole("heading", { name: "Tạm khóa xác thực", exact: true }).waitFor();
    await dialog(page).getByText(MESSAGES.locked).waitFor();
    await shot("tam-khoa", "Xác minh khuôn mặt đang tạm khóa — liên hệ Quản trị hệ thống");
  }, { closed: { reason: "EKYC_LOCKED", message: MESSAGES.locked } }),
  resetFlow("can-xac-thuc-lai-can-cuoc", "CẦN XÁC THỰC LẠI CĂN CƯỚC", async ({ page, shot }) => {
    await signIn(page, shot); await typed(page, shot); await found(page, shot);
    await confirmButton(page).click();
    await dialog(page).getByText(MESSAGES.reverify).waitFor();
    await shot("xac-thuc-lai-can-cuoc", "Cần xác thực lại căn cước — liên hệ Quản trị hệ thống");
  }, { closed: { reason: "EKYC_NO_DOCUMENT_IMAGE", message: MESSAGES.reverify } }),
  resetFlow("mat-khau-chua-dat", "MẬT KHẨU MỚI CHƯA ĐẠT", async ({ page, shot }) => {
    await signIn(page, shot); await typed(page, shot); await found(page, shot);
    await otpRoad(page, shot);
    await confirmOtp(page);
    await heading(page, "Đặt mật khẩu mới");
    await shot("dat-mat-khau", "Đúng mã OTP: đặt mật khẩu mới");
    await fillPasswords(page, "supership", "");
    await shot("chua-dat-yeu-cau", "Mật khẩu chưa đạt yêu cầu");
    await fillPasswords(page, PASSWORD, "SuperShip@2025");
    await page.locator("#new-password").click();
    await expect(setPasswordButton(page)).toBeDisabled();
    await shot("khong-khop", "Mật khẩu nhập lại không khớp");
  }, { faceRequired: false }),
  resetFlow("anh-can-cuoc", "NHẬN DIỆN BẰNG ẢNH CĂN CƯỚC", async ({ page, shot }) => {
    await signIn(page, shot);
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
    await page.getByText(FULL_NAME, { exact: true }).waitFor();
    // The camera dialogs leave the page scrolled down; the next step is read from its top.
    await page.evaluate(() => { for (const element of [document.scrollingElement, ...Array.from(document.querySelectorAll("*"))]) if (element && element.scrollTop > 0) element.scrollTop = 0; });
    await shot("xac-nhan-thong-tin", "Tiếp tục như nhập tay: xác nhận thông tin");
  }, { cardReads: [false] }),
  resetFlow("nhap-lai-thong-tin", "KHÔNG PHẢI THÔNG TIN CỦA BẠN", async ({ page, shot }) => {
    await signIn(page, shot); await typed(page, shot); await found(page, shot, "Thông tin tìm được không phải của mình");
    await page.getByRole("button", { name: "Nhập lại thông tin", exact: true }).click();
    await heading(page, "Quên mật khẩu");
    await expect(page.locator("#citizen-id")).not.toBeEmpty();
    await shot("nhap-lai", "Nhập lại thông tin: quay về bước 1, giữ chữ đã nhập");
  }),
];
