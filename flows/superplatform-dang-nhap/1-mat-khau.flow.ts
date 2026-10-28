import type { Page } from "playwright";
import {
  EMAIL, EMPLOYEE_CODE, MAX_ATTEMPTS, MESSAGES, PERSONAL_EMAIL, PHONE, WRONG_PASSWORD, chooseUnit, closeDialog, confirmMfa,
  enterUnit, fill, identifierField, lockedMessage, loginButton, openLogin, passwordFlow, pickerHeading, refusal, submit, verifyMfa,
  type LoginContext, type LoginSetup,
} from "../_helpers/superplatform-login";

/** From the filled form: MFA before the unit picker, the picker, then the workspace. */
async function signInThroughMfa(page: Page, shot: LoginContext["shot"]) {
  await submit(page);
  await page.getByRole("heading", { name: "Xác thực hai lớp" }).waitFor();
  await shot("mfa", "Nhập mã Authenticator trước khi chọn đơn vị");
  await verifyMfa(page);
  await shot("da-nhap-mfa", "Đã nhập mã Authenticator");
  await confirmMfa(page);
  await pickerHeading(page).waitFor();
  await shot("chon-don-vi", "Chọn đơn vị làm việc");
  await chooseUnit(page);
  await enterUnit(page);
  await shot("trang-chu", "Vào trang chủ của đơn vị");
}

/** The account refuses whatever the password: the one sentence of every refusal, nothing about why. */
async function refusedWithRightPassword(page: Page, shot: LoginContext["shot"], title: string, message: string = MESSAGES.invalid) {
  await openLogin(page);
  await fill(page, PHONE);
  await shot("da-nhap", "Nhập đúng số điện thoại và mật khẩu");
  await submit(page);
  await refusal(page, message);
  await shot("tu-choi", title);
}

/** A refusal said only once the password is right (LoginUseCase.admit, AccessContextEligibilityService). */
function afterPassword(status: number, code: string, message: string, extra: Record<string, unknown> = {}): LoginSetup {
  return { afterPassword: { status, message, data: { code, reason_code: code, ...extra } } };
}

/** The other person signing in from the same computer while the first one is locked. */
const OTHER_PHONE = "0903112233";

export default [
  passwordFlow("email", "01. ĐĂNG NHẬP BẰNG EMAIL", async ({ page, shot }) => {
    await openLogin(page);
    await shot("form", "Màn đăng nhập");
    await loginButton(page).click();
    await page.getByText(MESSAGES.emptyIdentifier).waitFor();
    await shot("de-trong", "Chưa nhập Email và mật khẩu");
    await fill(page, PERSONAL_EMAIL);
    await submit(page);
    await page.getByText(MESSAGES.personalEmail).waitFor();
    await shot("email-ca-nhan", "Email cá nhân bị từ chối ngay");
    await fill(page, EMAIL);
    await shot("da-nhap", "Nhập Email công ty và mật khẩu");
    await signInThroughMfa(page, shot);
  }),
  passwordFlow("so-dien-thoai", "02. ĐĂNG NHẬP BẰNG SỐ ĐIỆN THOẠI", async ({ page, shot }) => {
    await openLogin(page);
    await fill(page, PHONE);
    await shot("da-nhap", "Nhập số điện thoại và mật khẩu");
    await page.getByRole("button", { name: "Hiện mật khẩu", exact: true }).click();
    await page.getByRole("button", { name: "Ẩn mật khẩu", exact: true }).waitFor();
    await shot("hien-mat-khau", "Bấm biểu tượng mắt: hiện mật khẩu đã nhập");
    await signInThroughMfa(page, shot);
  }),
  passwordFlow("ma-nhan-vien", "03. ĐĂNG NHẬP BẰNG MÃ NHÂN VIÊN", async ({ page, shot }) => {
    await openLogin(page);
    await fill(page, EMPLOYEE_CODE);
    await shot("da-nhap", "Nhập mã nhân viên và mật khẩu");
    await signInThroughMfa(page, shot);
  }),
  passwordFlow("khoa-tam-thoi", "04. KHÓA TẠM THỜI KHI NHẬP SAI MẬT KHẨU NHIỀU LẦN", async ({ page, shot, mock }) => {
    await openLogin(page);
    await fill(page, PHONE, WRONG_PASSWORD);
    await shot("sai-mat-khau", "Nhập sai mật khẩu");
    await submit(page);
    await refusal(page, MESSAGES.invalid);
    await shot("sai-lan-1", "Sai lần 1: thông tin đăng nhập không hợp lệ");
    await closeDialog(page);
    while (mock.failures < MAX_ATTEMPTS - 1) {
      await fill(page, PHONE, WRONG_PASSWORD);
      await submit(page);
      await refusal(page, MESSAGES.invalid);
      await closeDialog(page);
    }
    await fill(page, PHONE, WRONG_PASSWORD);
    await submit(page);
    await refusal(page, lockedMessage());
    await shot("sai-lan-5", "Sai lần 5: tạm khóa đăng nhập 15 phút");
    await closeDialog(page);
    await page.getByRole("button", { name: "Thử lại sau 15:00", exact: true }).waitFor();
    await shot("dem-nguoc", "Nút Đăng nhập bị khóa, đếm ngược thời gian chờ");
    // The lock is for the identifier typed: another one may sign in from this computer meanwhile.
    await identifierField(page).fill(OTHER_PHONE);
    await loginButton(page).and(page.locator(":enabled")).waitFor();
    await shot("tai-khoan-khac", "Nhập tài khoản khác: nút Đăng nhập mở lại");
    await openLogin(page);
    await fill(page, PHONE);
    await shot("dung-mat-khau", "Mở lại trang, nhập đúng mật khẩu");
    await submit(page);
    await refusal(page, lockedMessage());
    await shot("dang-khoa", "Đang khóa: mật khẩu đúng cũng bị từ chối");
  }),
  passwordFlow("tai-khoan-bi-khoa", "05. TỪ CHỐI ĐĂNG NHẬP KHI TÀI KHOẢN BỊ KHÓA", async ({ page, shot }) => {
    await refusedWithRightPassword(page, shot, "Tài khoản bị khóa: báo chung, không nói lý do");
  }, { account: "LOCKED" }),
  passwordFlow("tai-khoan-vo-hieu-hoa", "06. TỪ CHỐI ĐĂNG NHẬP KHI TÀI KHOẢN BỊ VÔ HIỆU HÓA", async ({ page, shot }) => {
    await refusedWithRightPassword(page, shot, "Tài khoản bị vô hiệu hóa: báo chung, không nói lý do");
  }, { account: "DISABLED" }),
  passwordFlow("tai-khoan-chua-kich-hoat", "07. TỪ CHỐI ĐĂNG NHẬP KHI TÀI KHOẢN CHƯA KÍCH HOẠT", async ({ page, shot }) => {
    await refusedWithRightPassword(page, shot, "Tài khoản chưa kích hoạt: báo chung, không nói lý do");
  }, { account: "PENDING" }),
  passwordFlow("khoa-khong-hoat-dong", "08. TÀI KHOẢN BỊ TẠM KHÓA VÌ LÂU KHÔNG HOẠT ĐỘNG", async ({ page, shot }) => {
    await refusedWithRightPassword(page, shot, "Đúng mật khẩu mới báo tài khoản bị tạm khóa vì lâu không hoạt động",
      MESSAGES.inactivityLocked);
  }, afterPassword(403, "INACTIVITY_LOCKED", MESSAGES.inactivityLocked, { title: "Tài khoản đã bị tạm khóa" })),
  passwordFlow("can-khoi-phuc", "09. TÀI KHOẢN CẦN KHÔI PHỤC", async ({ page, shot }) => {
    await refusedWithRightPassword(page, shot, "Tài khoản chờ khôi phục: dùng Quên mật khẩu trước", MESSAGES.recoveryRequired);
  }, afterPassword(403, "ACCOUNT_RECOVERY_REQUIRED", MESSAGES.recoveryRequired)),
  passwordFlow("quyen-tam-dung", "10. QUYỀN LÀM VIỆC Ở MỌI ĐƠN VỊ ĐANG BỊ TẠM DỪNG", async ({ page, shot }) => {
    await refusedWithRightPassword(page, shot, "Mọi đơn vị đều đang tạm dừng quyền: chưa vào được đơn vị nào", MESSAGES.accessHeld);
  }, afterPassword(403, "ACCESS_HELD", MESSAGES.accessHeld, { suggested_action: "Liên hệ bộ phận nhân sự để biết thêm." })),
  passwordFlow("chua-den-ngay-lam-viec", "11. CHƯA ĐẾN NGÀY BẮT ĐẦU LÀM VIỆC", async ({ page, shot }) => {
    await refusedWithRightPassword(page, shot, "Chưa đến ngày bắt đầu làm việc ở đơn vị", MESSAGES.employmentNotStarted);
  }, afterPassword(403, "EMPLOYMENT_NOT_STARTED", MESSAGES.employmentNotStarted,
    { suggested_action: "Liên hệ người quản lý đơn vị nếu ngày bắt đầu chưa đúng." })),
  passwordFlow("chua-duoc-cap-quyen", "12. TÀI KHOẢN CHƯA ĐƯỢC CẤP QUYỀN VÀO SUPERPLATFORM", async ({ page, shot }) => {
    await refusedWithRightPassword(page, shot, "Tài khoản không thuộc đơn vị nội bộ nào", MESSAGES.notGranted);
  }, afterPassword(403, "USER_CLASSIFICATION_INVALID", MESSAGES.notGranted, { suggested_action: "Liên hệ người quản lý đơn vị." })),
  passwordFlow("ung-dung-bao-tri", "13. ỨNG DỤNG ĐANG BẢO TRÌ", async ({ page, shot }) => {
    await refusedWithRightPassword(page, shot, "App SuperPlatform đang bảo trì: không ai vào được", MESSAGES.maintenance);
  }, afterPassword(403, "APPLICATION_UNAVAILABLE", MESSAGES.maintenance, { suggested_action: "Thử lại sau." })),
  passwordFlow("mat-ket-noi", "14. MẤT KẾT NỐI KHI ĐĂNG NHẬP", async ({ page, shot, mock }) => {
    mock.on("POST", "/v1/sessions", () => ({ abort: true }));
    await refusedWithRightPassword(page, shot, "Không gửi được yêu cầu tới máy chủ", MESSAGES.network);
  }),
];
