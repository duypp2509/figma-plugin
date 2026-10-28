import type { Page } from "playwright";
import { EMAIL, openProfile, PHONE, profileFlow, type ProfileContext, type ProfileSetup } from "../_helpers/superplatform-my-profile";
import {
  backToProfile, BLOCKED_PHONE, changeDialog, codeInput, confirmStepUp, dialogImages, fillForm, MESSAGES, mockIdentifierChange, NEW_EMAIL,
  NEW_PHONE, openChange, PASSWORD, passwordInput, sendButton, sendForCode, stepUpDialog, stepUpInput, submitCode, success, TAKEN_EMAIL,
  TAKEN_PHONE, typeStepUp, typeValue, waitCodeStep, type IdentifierChangeMock,
} from "../_helpers/superplatform-my-profile-identifiers";
import { waitEnabled } from "../_helpers/wait";

const SECTION = "ĐỔI SỐ ĐIỆN THOẠI VÀ EMAIL";
type Context = ProfileContext & { change: IdentifierChangeMock };
const flow = (id: string, name: string, run: (ctx: Context) => Promise<void>, setup?: ProfileSetup) =>
  profileFlow(SECTION, `dinh-danh-${id}`, name, async (ctx) => run({ ...ctx, change: await mockIdentifierChange(ctx.page, ctx.mock) }), setup);

const ONLY_PHONE: ProfileSetup = { identifiers: [{ id: "id-phone", type: "PHONE", value: PHONE, verified: true }] };
const ONLY_EMAIL: ProfileSetup = { identifiers: [{ id: "id-email", type: "EMAIL", value: EMAIL, verified: true }] };
const MINUTE = 60_000;

/** From the filled form to the code step: "Gửi mã OTP", then the step-up code. */
async function throughStepUp(page: Page) {
  await sendForCode(page);
  await typeStepUp(page);
  await confirmStepUp(page);
}
/** A refusal after a submit: the form keeps what was typed and the sentence opens in a dialog of its own. */
const refusalDialog = (page: Page) => page.getByRole("alertdialog", { name: "Không thể hoàn tất thao tác" });
async function refused(page: Page, text: string) {
  await refusalDialog(page).getByText(text, { exact: true }).waitFor();
  await page.mouse.move(0, 0);
}
async function acknowledge(page: Page) {
  await refusalDialog(page).getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await refusalDialog(page).waitFor({ state: "hidden" });
}
const notice = (page: Page, title: string) => page.getByRole("alertdialog", { name: title });

export default [
  flow("doi-so-dien-thoai", "01. ĐỔI SỐ ĐIỆN THOẠI", async ({ page, shot }) => {
    await openProfile(page);
    await shot("thong-tin-tai-khoan", "Thông tin tài khoản");

    await openChange(page, "PHONE");
    await shot("hop-doi-so-dien-thoai", "Hộp đổi số điện thoại");

    await fillForm(page, NEW_PHONE);
    await shot("da-nhap-thong-tin", "Đã nhập số mới và mật khẩu");

    await sendForCode(page);
    await typeStepUp(page);
    await shot("xac-nhan-thao-tac", "Xác nhận bằng mã xác thực");

    await confirmStepUp(page);
    await shot("nhap-ma-otp", "Nhập mã OTP gửi tới số mới");

    await submitCode(page);
    await success(page, MESSAGES.phoneChanged);
    await shot("doi-thanh-cong", "Đổi số điện thoại thành công");

    await backToProfile(page, NEW_PHONE);
    await shot("so-dien-thoai-moi", "Hồ sơ hiện số điện thoại mới");
  }),

  flow("doi-email", "02. ĐỔI EMAIL", async ({ page, shot }) => {
    await openChange(page, "EMAIL");
    await shot("hop-doi-email", "Hộp đổi email");

    await fillForm(page, NEW_EMAIL);
    await shot("da-nhap-thong-tin", "Đã nhập email mới và mật khẩu");

    await sendForCode(page);
    await typeStepUp(page);
    await shot("xac-nhan-thao-tac", "Xác nhận bằng mã xác thực");

    await confirmStepUp(page);
    await shot("nhap-ma-otp", "Nhập mã OTP gửi tới email mới");

    await submitCode(page);
    await success(page, MESSAGES.emailChanged);
    await shot("doi-thanh-cong", "Đổi email thành công");

    await backToProfile(page, NEW_EMAIL);
    await shot("email-moi", "Hồ sơ hiện email mới");
  }),

  flow("them-email", "03. THÊM EMAIL", async ({ page, shot }) => {
    await openProfile(page);
    await shot("chua-co-email", "Tài khoản chưa có email");

    await openChange(page, "EMAIL", "add");
    await shot("hop-them-email", "Hộp thêm email");

    await fillForm(page, NEW_EMAIL);
    await throughStepUp(page);
    await shot("nhap-ma-otp", "Nhập mã OTP gửi tới email");

    await submitCode(page);
    await success(page, MESSAGES.emailAdded);
    await shot("them-thanh-cong", "Thêm email thành công");

    await backToProfile(page, NEW_EMAIL);
    await shot("da-co-email", "Hồ sơ đã có email");
  }, ONLY_PHONE),

  flow("them-so-dien-thoai", "04. THÊM SỐ ĐIỆN THOẠI", async ({ page, shot }) => {
    await openProfile(page);
    await shot("chua-co-so-dien-thoai", "Tài khoản chưa có số điện thoại");

    await openChange(page, "PHONE", "add");
    await shot("hop-them-so-dien-thoai", "Hộp thêm số điện thoại");

    await fillForm(page, NEW_PHONE);
    await throughStepUp(page);
    await shot("nhap-ma-otp", "Nhập mã OTP gửi tới số điện thoại");

    await submitCode(page);
    await success(page, MESSAGES.phoneAdded);
    await shot("them-thanh-cong", "Thêm số điện thoại thành công");

    await backToProfile(page, NEW_PHONE);
    await shot("da-co-so-dien-thoai", "Hồ sơ đã có số điện thoại");
  }, ONLY_EMAIL),

  flow("xac-minh-so-dien-thoai", "05. XÁC MINH SỐ ĐIỆN THOẠI", async ({ page, shot }) => {
    await openProfile(page);
    await shot("so-chua-xac-minh", "Số điện thoại chưa xác minh");

    await page.getByRole("button", { name: "Số điện thoại chưa được xác minh", exact: true }).click();
    const prompt = page.getByRole("dialog", { name: "Số điện thoại chưa được xác minh" });
    await prompt.waitFor();
    await page.mouse.move(0, 0);
    await shot("hop-chua-xac-minh", "Hộp số điện thoại chưa xác minh");

    await prompt.getByRole("button", { name: "Đổi và xác minh số điện thoại", exact: true }).click();
    await changeDialog(page, "PHONE").waitFor();
    await dialogImages(page);
    await page.mouse.move(0, 0);
    await shot("hop-doi-so-dien-thoai", "Hộp đổi số điện thoại");

    // The number in use cannot be sent a code again: the check refuses it.
    await typeValue(page, PHONE, MESSAGES.phoneUnchanged);
    await shot("nhap-lai-so-dang-dung", "Nhập lại số đang dùng");

    await fillForm(page, NEW_PHONE);
    await throughStepUp(page);
    await submitCode(page);
    await success(page, MESSAGES.phoneChanged);
    await shot("doi-thanh-cong", "Đổi số điện thoại thành công");

    await backToProfile(page, NEW_PHONE);
    await shot("so-da-xac-minh", "Số điện thoại đã xác minh");
  }, { identifiers: [{ id: "id-phone", type: "PHONE", value: PHONE, verified: false },
    { id: "id-email", type: "EMAIL", value: EMAIL, verified: true }] }),

  flow("xac-minh-email", "06. XÁC MINH EMAIL", async ({ page, shot }) => {
    await openProfile(page);
    await shot("email-chua-xac-minh", "Email chưa xác minh");

    await page.getByRole("button", { name: "Email chưa được xác minh", exact: true }).click();
    const prompt = page.getByRole("dialog", { name: "Email chưa được xác minh" });
    await prompt.waitFor();
    await page.mouse.move(0, 0);
    await shot("hop-chua-xac-minh", "Hộp email chưa xác minh");

    await prompt.getByRole("button", { name: "Xác minh ngay", exact: true }).click();
    await changeDialog(page, "EMAIL", "add").waitFor();
    await waitEnabled(passwordInput(page));
    await passwordInput(page).fill(PASSWORD);
    await waitEnabled(sendButton(page));
    await page.mouse.move(0, 0);
    await shot("hop-them-email", "Email điền sẵn để xác minh");

    await throughStepUp(page);
    await shot("nhap-ma-otp", "Nhập mã OTP gửi tới email");

    await submitCode(page);
    await success(page, MESSAGES.emailAdded);
    await shot("xac-minh-thanh-cong", "Xác minh email thành công");

    await backToProfile(page, EMAIL);
    await shot("email-da-xac-minh", "Email đã xác minh");
  }, { identifiers: [{ id: "id-phone", type: "PHONE", value: PHONE, verified: true },
    { id: "id-email", type: "EMAIL", value: EMAIL, verified: false }] }),

  flow("loi-so-dien-thoai", "07. SỐ ĐIỆN THOẠI MỚI KHÔNG HỢP LỆ", async ({ page, shot }) => {
    await openChange(page, "PHONE");

    await typeValue(page, "0123456789", MESSAGES.phoneHead);
    await shot("sai-dau-so", "Sai đầu số di động");

    await typeValue(page, "093851726", MESSAGES.phoneLength);
    await shot("thieu-chu-so", "Thiếu chữ số");

    await typeValue(page, PHONE, MESSAGES.phoneUnchanged);
    await shot("so-dang-dung", "Số đang dùng");

    await typeValue(page, TAKEN_PHONE, MESSAGES.phoneInUse);
    await shot("so-da-duoc-dung", "Số đã được tài khoản khác dùng");

    await typeValue(page, BLOCKED_PHONE, MESSAGES.phoneBlocked);
    await shot("so-khong-dung-duoc", "Số không dùng được");
  }),

  flow("loi-email", "08. EMAIL MỚI KHÔNG HỢP LỆ", async ({ page, shot }) => {
    await openChange(page, "EMAIL");

    await typeValue(page, "minhanh.nguyen@gmail", MESSAGES.emailShape);
    await shot("sai-dinh-dang", "Email sai định dạng");

    await typeValue(page, EMAIL, MESSAGES.emailUnchanged);
    await shot("email-dang-dung", "Email đang dùng");

    await typeValue(page, TAKEN_EMAIL, MESSAGES.emailInUse);
    await shot("email-da-duoc-dung", "Email đã được tài khoản khác dùng");

    await typeValue(page, "anh.nm@supership.vn", MESSAGES.companyEmail);
    await shot("email-cong-ty", "Nhập email công ty");
  }),

  flow("sai-mat-khau", "09. SAI MẬT KHẨU HIỆN TẠI", async ({ page, shot }) => {
    await openChange(page, "PHONE");
    await fillForm(page, NEW_PHONE, "MinhAnh@2025");
    await sendButton(page).click();
    await refused(page, MESSAGES.passwordWrong);
    await shot("sai-mat-khau", "Sai mật khẩu hiện tại");

    await acknowledge(page);
    await page.mouse.move(0, 0);
    await shot("nhap-lai-mat-khau", "Nhập lại mật khẩu");

    // Five wrong passwords in 15 minutes: the next try is refused whatever is typed.
    for (let attempt = 0; attempt < 5; attempt++) {
      await passwordInput(page).fill(`MinhAnh@202${attempt}`);
      await waitEnabled(sendButton(page));
      await sendButton(page).click();
      await refused(page, attempt < 4 ? MESSAGES.passwordWrong : MESSAGES.passwordLocked);
      if (attempt < 4) await acknowledge(page);
    }
    await shot("sai-qua-so-lan", "Sai mật khẩu quá số lần");
  }),

  flow("tu-choi-gui-ma", "10. BỊ TỪ CHỐI KHI GỬI MÃ", async ({ page, shot, change }) => {
    change.refusals.PHONE = { status: 429, code: "IDENTIFIER_CHANGE_LIMIT", message: MESSAGES.phoneLimit };
    change.refusals.EMAIL = { status: 409, code: "IDENTIFIER_CHANGE_TOO_SOON", message: MESSAGES.emailTooSoon };

    await openChange(page, "PHONE");
    await fillForm(page, NEW_PHONE);
    await sendButton(page).click();
    await refused(page, MESSAGES.phoneLimit);
    await shot("qua-so-lan-trong-ngay", "Đổi quá số lần trong ngày");

    await acknowledge(page);
    await changeDialog(page, "PHONE").getByRole("button", { name: "Đóng", exact: true }).click();
    await changeDialog(page, "PHONE").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Đổi email", exact: true }).click();
    await changeDialog(page, "EMAIL").waitFor();
    await fillForm(page, NEW_EMAIL);
    await sendButton(page).click();
    await refused(page, MESSAGES.emailTooSoon);
    await shot("vua-doi-so-dien-thoai", "Vừa đổi số điện thoại");
  }),

  flow("khong-co-mat-khau", "11. TÀI KHOẢN KHÔNG CÓ MẬT KHẨU", async ({ page, shot }) => {
    await openChange(page, "PHONE");
    await fillForm(page, NEW_PHONE, null);
    await shot("khong-hoi-mat-khau", "Không hỏi mật khẩu");

    await sendForCode(page);
    await typeStepUp(page);
    await shot("xac-nhan-thao-tac", "Xác nhận bằng mã xác thực");

    await confirmStepUp(page);
    await submitCode(page);
    await success(page, MESSAGES.phoneChanged);
    await shot("doi-thanh-cong", "Đổi số điện thoại thành công");
  }, { hasPassword: false }),

  flow("xac-nhan-that-bai", "12. MÃ XÁC THỰC SAI HOẶC HỦY XÁC NHẬN", async ({ page, shot }) => {
    await openChange(page, "PHONE");
    await fillForm(page, NEW_PHONE);
    await sendForCode(page);
    await typeStepUp(page, "246810");
    await stepUpDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
    await stepUpDialog(page).getByRole("alert").waitFor();
    await page.mouse.move(0, 0);
    await shot("sai-ma-xac-thuc", "Sai mã xác thực");

    await stepUpDialog(page).getByRole("button", { name: "Đóng hộp thoại" }).click();
    await stepUpInput(page).waitFor({ state: "hidden" });
    await refused(page, MESSAGES.stepUpCancelled);
    await shot("da-huy-xac-nhan", "Đã hủy xác nhận");
  }),

  flow("sai-ma-otp", "13. NHẬP SAI MÃ OTP", async ({ page, shot, change }) => {
    await openChange(page, "PHONE");
    await fillForm(page, NEW_PHONE);
    await throughStepUp(page);
    await submitCode(page, "246810");
    await refused(page, MESSAGES.otpWrong);
    await shot("sai-ma-otp", "Sai mã OTP");

    for (let attempt = 0; attempt < 4; attempt++) {
      await acknowledge(page);
      await codeInput(page).fill("");
      await submitCode(page, `24681${attempt + 1}`);
      if (attempt < 3) await refused(page, `Mã OTP không đúng. Bạn còn ${3 - attempt} lần nhập.`);
    }
    await notice(page, MESSAGES.attemptsTitle).waitFor();
    await page.mouse.move(0, 0);
    await shot("sai-qua-so-lan", "Nhập sai mã quá số lần");

    await notice(page, MESSAGES.attemptsTitle).getByRole("button", { name: "Đã hiểu", exact: true }).click();
    await changeDialog(page, "PHONE").waitFor({ state: "hidden" });
    await page.locator(`input[readonly][value="${PHONE}"]`).waitFor();
    if (!change.cancelled.length) throw new Error("Đóng hộp mà không hủy yêu cầu đổi số điện thoại.");
    await page.mouse.move(0, 0);
    await shot("giu-so-cu", "Giữ số điện thoại cũ");
  }),

  flow("ma-het-han", "14. MÃ OTP HẾT HẠN", async ({ page, shot, change }) => {
    await openChange(page, "PHONE");
    await fillForm(page, NEW_PHONE);
    await throughStepUp(page);

    await change.advance(5 * MINUTE);
    await page.getByText("Chưa nhận được mã?").waitFor();
    await shot("ma-da-het-han", "Mã đã hết hạn");

    await page.getByRole("button", { name: "Gửi lại", exact: true }).click();
    await waitCodeStep(page);
    await page.getByRole("timer").waitFor();
    await shot("nhan-ma-moi", "Đã gửi mã mới");

    // The new code runs out too; this time the code is sent anyway.
    await change.advance(5 * MINUTE);
    await page.getByRole("timer").waitFor({ state: "hidden" });
    await submitCode(page);
    await notice(page, MESSAGES.expiredTitle).waitFor();
    await page.mouse.move(0, 0);
    await shot("thong-bao-het-han", "Thông báo mã hết hạn");

    await notice(page, MESSAGES.expiredTitle).getByRole("button", { name: "Đã hiểu", exact: true }).click();
    await changeDialog(page, "PHONE").waitFor({ state: "hidden" });
    await page.locator(`input[readonly][value="${PHONE}"]`).waitFor();
    await page.mouse.move(0, 0);
    await shot("giu-so-cu", "Giữ số điện thoại cũ");
  }),

  flow("gui-lai-doi-kenh", "15. GỬI LẠI MÃ VÀ ĐỔI KÊNH NHẬN", async ({ page, shot, change }) => {
    await openChange(page, "PHONE");
    await fillForm(page, NEW_PHONE);
    await throughStepUp(page);
    await shot("dem-nguoc-gui-lai", "Đếm ngược gửi lại");

    await change.advance(3 * MINUTE);
    await page.getByRole("button", { name: "Gửi lại", exact: true }).waitFor();
    await shot("co-the-gui-lai", "Có thể gửi lại mã");

    await page.getByRole("button", { name: "Gửi lại", exact: true }).click();
    await page.getByRole("timer").waitFor();
    await page.mouse.move(0, 0);
    await shot("da-gui-lai", "Đã gửi lại mã");

    await change.advance(3 * MINUTE);
    await waitEnabled(page.getByRole("button", { name: "Đổi kênh nhận OTP", exact: true }));
    await page.getByRole("button", { name: "Đổi kênh nhận OTP", exact: true }).click();
    const switchTo = page.getByRole("button", { name: "Đổi sang Zalo", exact: true });
    await switchTo.waitFor();
    await dialogImages(page);
    await page.mouse.move(0, 0);
    await shot("chon-kenh-moi", "Chọn kênh nhận mã mới");

    await switchTo.click();
    await switchTo.waitFor({ state: "hidden" });
    await page.getByRole("heading", { name: "Ứng dụng Zalo" }).waitFor();
    await page.getByRole("timer").waitFor();
    await page.mouse.move(0, 0);
    await shot("nhan-ma-qua-zalo", "Nhận mã qua Zalo");
  }),

  flow("dong-giua-chung", "16. ĐÓNG HỘP GIỮA CHỪNG", async ({ page, shot, change }) => {
    await openChange(page, "PHONE");
    await fillForm(page, NEW_PHONE);
    await throughStepUp(page);
    await shot("dang-nhap-ma", "Đang chờ nhập mã");

    // No question before closing: the request is cancelled and the number in use stays.
    await changeDialog(page, "PHONE").getByRole("button", { name: "Đóng hộp thoại" }).click();
    await changeDialog(page, "PHONE").waitFor({ state: "hidden" });
    await page.locator(`input[readonly][value="${PHONE}"]`).waitFor();
    if (!change.cancelled.length) throw new Error("Đóng hộp mà không hủy yêu cầu đổi số điện thoại.");
    await page.mouse.move(0, 0);
    await shot("da-dong-hop", "Đã đóng, giữ số cũ");
  }),
];
