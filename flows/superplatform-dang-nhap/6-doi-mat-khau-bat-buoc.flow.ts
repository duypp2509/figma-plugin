import type { Page } from "playwright";
import { expect } from "playwright/test";
import {
  EMPLOYEE_CODE, PASSWORD, PHONE, WRONG_PASSWORD, type LoginContext, chooseUnit, confirmMfa, enterUnit, fill, loginReady, openLogin, pickerHeading, submit, verifyMfa,
} from "../_helpers/superplatform-login";
import {
  BREACHED_PASSWORD, DEV_OTP, LONG_PASSWORD, MASKED_PHONE, MESSAGES, NEW_PASSWORD, OTP_DESTINATION, RECENT_PASSWORD,
  changeButton, changeFlow, changePage, changeRefused, closeNotice, continueButton, fillChange, fillNewPassword,
  forcedResetFlow, newPasswordStep, proveMfaByFace, submitChange, type Reason,
} from "../_helpers/superplatform-login-password";
import { consentBox, sendFace, startFace, takeFace } from "../_helpers/superplatform-internal-reset";

const mfaHeading = "Xác thực hai lớp";
/** The dev "Khuôn mặt mẫu" button next to the camera (features/dev-tools). */
const devFace = { hide: ['[aria-label="Khuôn mặt mẫu"]'] };

/** "Đăng nhập tài khoản khác" under the form: the session ends and the login page opens, filled in again. */
async function signInAgain(page: Page) {
  await page.getByRole("button", { name: "Đăng nhập tài khoản khác", exact: true }).click();
  await loginReady(page);
  await fill(page, PHONE);
}

/** The login page filled in, then "Đăng nhập" through to /change-password for {@code reason}. */
async function signInToChange(page: Page, shot: LoginContext["shot"], reason: Reason) {
  await openLogin(page);
  await fill(page, PHONE);
  await shot("da-nhap", "Đăng nhập bằng số điện thoại và mật khẩu");
  await submit(page);
  await changePage(page, reason);
  await shot("doi-mat-khau", "Phải đổi mật khẩu trước khi tiếp tục");
}

/** The login page filled in, then "Đăng nhập" through to step 1 of /forced-password-reset. */
async function signInToReset(page: Page, shot: LoginContext["shot"]) {
  await openLogin(page);
  await fill(page, PHONE);
  await shot("da-nhap", "Đăng nhập bằng số điện thoại và mật khẩu");
  await submit(page);
  await newPasswordStep(page);
  await shot("dat-mat-khau-moi", "Quản trị viên yêu cầu đặt mật khẩu mới");
}

export default [
  changeFlow("mat-khau-tam", "ĐỔI MẬT KHẨU TẠM KHI ĐĂNG NHẬP", async ({ page, shot }) => {
    await openLogin(page);
    await fill(page, EMPLOYEE_CODE);
    await shot("da-nhap", "Đăng nhập bằng mật khẩu tạm");
    await submit(page);
    await changePage(page, "TEMPORARY");
    await shot("doi-mat-khau", "Phải đổi mật khẩu tạm trước khi tiếp tục");
    await fillChange(page, PASSWORD, NEW_PASSWORD);
    await changeButton(page).and(page.locator(":enabled")).waitFor();
    await shot("da-nhap-mat-khau-moi", "Đã nhập mật khẩu hiện tại và mật khẩu mới");
    await submitChange(page);
    await page.getByRole("heading", { name: mfaHeading }).waitFor();
    await shot("mfa", "Đổi xong: nhập mã Authenticator");
    await verifyMfa(page);
    await confirmMfa(page);
    await pickerHeading(page).waitFor();
    await shot("chon-don-vi", "Chọn đơn vị làm việc");
    await chooseUnit(page);
    await enterUnit(page);
    await shot("trang-chu", "Vào trang chủ của đơn vị");
  }, "TEMPORARY"),
  changeFlow("ly-do-khac", "ĐỔI MẬT KHẨU HẾT HẠN, QUÁ NGẮN HOẶC BỊ LỘ", async ({ page, shot, setReason }) => {
    await openLogin(page);
    await fill(page, PHONE);
    await shot("da-nhap", "Đăng nhập bằng số điện thoại và mật khẩu");
    await submit(page);
    await changePage(page, "EXPIRED");
    await shot("het-han", "Mật khẩu đã quá 90 ngày");
    // Each reason is another sign-in: back to the login page with "Đăng nhập tài khoản khác", then in again.
    setReason("TOO_SHORT");
    await signInAgain(page);
    await shot("dang-nhap-lai-qua-ngan", "Lần đăng nhập khác, khi mật khẩu đang dùng ngắn hơn 16 ký tự");
    await submit(page);
    await changePage(page, "TOO_SHORT");
    await shot("qua-ngan", "Mật khẩu ngắn hơn mức tối thiểu 16 ký tự");
    await fillChange(page, PASSWORD, NEW_PASSWORD);
    await page.getByText("Mật khẩu cần có: ít nhất 16 ký tự.", { exact: true }).waitFor();
    await shot("chua-du-16-ky-tu", "Mật khẩu mới chưa đủ 16 ký tự");
    await fillChange(page, PASSWORD, LONG_PASSWORD);
    await changeButton(page).and(page.locator(":enabled")).waitFor();
    await shot("du-16-ky-tu", "Mật khẩu mới đủ 16 ký tự");
    setReason("BREACHED");
    await signInAgain(page);
    await shot("dang-nhap-lai-bi-lo", "Lần đăng nhập khác, khi mật khẩu đang dùng bị lộ ở nơi khác");
    await submit(page);
    await changePage(page, "BREACHED");
    await shot("bi-lo", "Mật khẩu đã bị lộ ở nơi khác");
  }, "EXPIRED"),
  changeFlow("mat-khau-moi-chua-hop-le", "MẬT KHẨU MỚI CHƯA HỢP LỆ", async ({ page, shot }) => {
    await signInToChange(page, shot, "TEMPORARY");
    await fillChange(page, PASSWORD, "supership");
    await expect(changeButton(page)).toBeDisabled();
    await shot("chua-dat", "Mật khẩu mới chưa đạt yêu cầu");
    await fillChange(page, PASSWORD, NEW_PASSWORD, "TanBinh#2025");
    await page.getByRole("alert").getByText(MESSAGES.mismatch, { exact: true }).waitFor();
    await shot("khong-khop", "Xác nhận mật khẩu không khớp");
    for (const [id, title, password, message] of [
      ["trung-hien-tai", "Mật khẩu mới trùng mật khẩu hiện tại", PASSWORD, MESSAGES.sameAsCurrent],
      ["da-dung-gan-day", "Mật khẩu mới trùng 5 mật khẩu gần nhất", RECENT_PASSWORD, MESSAGES.recentlyUsed],
      ["da-bi-lo", "Mật khẩu mới đã bị lộ", BREACHED_PASSWORD, MESSAGES.breached],
    ] as const) {
      await fillChange(page, PASSWORD, password);
      await submitChange(page);
      await changeRefused(page, message);
      await shot(id, title);
      await closeNotice(page);
    }
  }, "TEMPORARY"),
  changeFlow("sai-mat-khau-hien-tai", "NHẬP SAI MẬT KHẨU HIỆN TẠI", async ({ page, shot }) => {
    await signInToChange(page, shot, "EXPIRED");
    await fillChange(page, WRONG_PASSWORD, NEW_PASSWORD);
    await changeButton(page).and(page.locator(":enabled")).waitFor();
    await shot("nhap-sai", "Nhập sai mật khẩu hiện tại");
    await submitChange(page);
    await changeRefused(page, MESSAGES.currentWrong);
    await shot("sai-lan-1", "Mật khẩu hiện tại không đúng");
    await closeNotice(page);
    // The dialog shows a sentence once: the same refusal again is only answered, not shown.
    for (let attempt = 2; attempt <= 5; attempt++) await submitChange(page);
    await submitChange(page);
    await changeRefused(page, MESSAGES.tooManyWrong);
    await shot("sai-qua-nhieu-lan", "Sai 5 lần: tạm dừng đổi mật khẩu 15 phút");
  }, "EXPIRED"),
  forcedResetFlow("quan-tri-buoc-dat-lai", "QUẢN TRỊ VIÊN BUỘC ĐẶT LẠI MẬT KHẨU", async ({ page, shot }) => {
    await openLogin(page);
    await fill(page, PHONE);
    await shot("da-nhap", "Đăng nhập bằng số điện thoại và mật khẩu");
    await submit(page);
    await newPasswordStep(page);
    await shot("dat-mat-khau-moi", "Quản trị viên yêu cầu đặt mật khẩu mới");
    await fillNewPassword(page);
    await shot("da-nhap-mat-khau-moi", "Đã nhập mật khẩu mới");
    await continueButton(page).click();
    await page.getByRole("heading", { name: "Xác minh khuôn mặt", exact: true }).waitFor();
    await consentBox(page).check();
    await shot("dong-y", "Đồng ý xác minh khuôn mặt");
    await startFace(page);
    await shot("chup-khuon-mat", "Chụp khuôn mặt", devFace);
    await takeFace(page);
    await shot("da-chup", "Xem lại ảnh vừa chụp", devFace);
    await proveMfaByFace(page);
    await sendFace(page);
    // The face is the MFA proof: no Authenticator code before the picker.
    await pickerHeading(page).waitFor();
    await page.getByText("Đã đặt mật khẩu mới", { exact: true }).waitFor();
    await shot("chon-don-vi", "Đặt xong mật khẩu mới, chọn đơn vị làm việc");
  }),
  forcedResetFlow("xac-minh-otp", "BUỘC ĐẶT LẠI MẬT KHẨU, XÁC MINH BẰNG MÃ OTP", async ({ page, shot }) => {
    await signInToReset(page, shot);
    await fillNewPassword(page);
    await shot("da-nhap-mat-khau-moi", "Đã nhập mật khẩu mới");
    await continueButton(page).click();
    await page.getByRole("heading", { name: "Nhập mã OTP", exact: true }).waitFor();
    await page.getByText(`Mã sẽ gửi tới ${MASKED_PHONE}`, { exact: true }).waitFor();
    await shot("gui-ma", "Chưa có căn cước được duyệt: xác minh bằng mã OTP");
    await page.getByRole("button", { name: "Gửi mã", exact: true }).click();
    await page.getByText(`Đã gửi mã tới ${OTP_DESTINATION}`, { exact: true }).waitFor();
    await page.locator("#forced-reset-code").fill(DEV_OTP);
    await shot("da-nhap-otp", "Đã nhập mã OTP");
    await page.getByRole("button", { name: "Đặt mật khẩu mới", exact: true }).click();
    await page.getByRole("heading", { name: mfaHeading }).waitFor();
    await shot("mfa", "Đặt xong mật khẩu mới: nhập mã Authenticator");
  }, { method: "OTP" }),
  forcedResetFlow("khong-dat-duoc", "KHÔNG ĐẶT ĐƯỢC MẬT KHẨU MỚI", async ({ page, shot }) => {
    await signInToReset(page, shot);
    for (const [id, title, password, message] of [
      ["trung-mat-khau-cu", "Mật khẩu mới trùng mật khẩu cũ", PASSWORD, MESSAGES.sameAsOld],
      ["da-dung-gan-day", "Mật khẩu mới trùng 5 mật khẩu gần nhất", RECENT_PASSWORD, MESSAGES.recentlyUsed],
    ] as const) {
      await fillNewPassword(page, password);
      await continueButton(page).click();
      await page.getByText(message, { exact: true }).waitFor();
      await shot(id, title);
    }
    await fillNewPassword(page, NEW_PASSWORD, "TanBinh#2025");
    await page.getByText("Mật khẩu nhập lại không khớp.", { exact: true }).waitFor();
    await shot("khong-khop", "Mật khẩu nhập lại không khớp");
    await fillNewPassword(page);
    await shot("da-nhap-mat-khau-moi", "Nhập lại đúng mật khẩu mới");
    await continueButton(page).click();
    await page.getByRole("heading", { name: "Xác minh khuôn mặt", exact: true }).waitFor();
    await consentBox(page).check();
    await shot("dong-y", "Đồng ý xác minh khuôn mặt");
    await startFace(page);
    await takeFace(page);
    await shot("da-chup", "Xem lại ảnh vừa chụp", devFace);
    await sendFace(page);
    await page.getByText(MESSAGES.faceMismatch(2), { exact: true }).waitFor();
    await shot("khuon-mat-khong-khop", "Khuôn mặt không khớp, còn 2 lần thử", devFace);
    for (let attempt = 2; attempt <= 3; attempt++) {
      await page.getByRole("button", { name: "Chụp lại", exact: true }).click();
      await takeFace(page);
      await sendFace(page);
    }
    // Told in the shared error dialog, over the page that keeps its own "Không thể tiếp tục" title.
    await page.getByRole("alertdialog").getByRole("heading", { name: "Không thể tiếp tục", exact: true }).waitFor();
    await page.getByRole("alertdialog").getByText(MESSAGES.faceStopped, { exact: true }).waitFor();
    await shot("dung-xac-minh", "Không khớp lần thứ 3: dừng, liên hệ Quản trị hệ thống");
  }, { faces: ["FAILED", "FAILED", "FAILED"] }),
  forcedResetFlow("chua-co-cach-xac-minh", "TÀI KHOẢN CHƯA CÓ CÁCH XÁC MINH", async ({ page, shot }) => {
    await openLogin(page);
    await fill(page, PHONE);
    await shot("da-nhap", "Đăng nhập bằng số điện thoại và mật khẩu");
    await submit(page);
    // Told in the shared error dialog, over the page that keeps its own "Không thể tiếp tục" title.
    await page.getByRole("alertdialog").getByRole("heading", { name: "Không thể tiếp tục", exact: true }).waitFor();
    await page.getByRole("alertdialog").getByText(MESSAGES.noVerification, { exact: true }).waitFor();
    await shot("khong-the-tiep-tuc", "Chưa có căn cước được duyệt hay số điện thoại đã xác thực");
  }, { method: null }),
];
