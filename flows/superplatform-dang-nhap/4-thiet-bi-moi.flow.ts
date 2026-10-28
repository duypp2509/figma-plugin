import type { Page } from "playwright";
import {
  MAX_CODE_FAILURES, MESSAGES, PAGE_TITLE, WRONG_CODE, closeNotice, confirmButton, deviceApprovalFlow, heading, matchNumber,
  notice, signInOnNewDevice, submitOnNewDevice, typeAuthenticatorCode, typeRecoveryCode, type ApprovalContext, type ApprovalStatus,
} from "../_helpers/superplatform-device-approval";
import {
  PHONE, at, chooseUnit, enterUnit, fill, openLogin, pickerHeading, refusal, submit,
} from "../_helpers/superplatform-login";

const signInHeading = (page: Page) => page.getByRole("heading", { name: "Đăng nhập", exact: true });

/** The waiting page with the number to pick, then the request ends on the trusted device. */
async function endedOnTrustedDevice({ page, shot, approval }: ApprovalContext, status: ApprovalStatus, title: string,
                                    endedTitle: string) {
  await signInOnNewDevice(page);
  await matchNumber(page, approval.matchNumber).waitFor();
  await shot("cho-cho-phep", "Chờ thiết bị tin cậy cho phép");
  approval.status = status;
  await notice(page, title).waitFor();
  await shot("ket-thuc", endedTitle);
  await notice(page, title).getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await signInHeading(page).waitFor();
  await shot("ve-dang-nhap", "Quay lại trang đăng nhập");
}

export default [
  deviceApprovalFlow("cho-phep", "01. THIẾT BỊ TIN CẬY CHO PHÉP ĐĂNG NHẬP", async ({ page, shot, approval }) => {
    await openLogin(page);
    await fill(page, PHONE);
    await shot("da-nhap", "Nhập số điện thoại và mật khẩu trên máy mới");
    await submitOnNewDevice(page);
    await matchNumber(page, approval.matchNumber).waitFor();
    await shot("cho-cho-phep", "Chờ thiết bị tin cậy cho phép, số cần chọn và thời hạn");
    // The trusted device picks the right number from a session with MFA: no code asked here.
    approval.status = "APPROVED";
    await pickerHeading(page).waitFor();
    await shot("chon-don-vi", "Được cho phép, chọn đơn vị làm việc");
    await chooseUnit(page);
    await enterUnit(page);
    await shot("trang-chu", "Vào trang chủ của đơn vị");
  }),
  deviceApprovalFlow("ma-xac-thuc", "02. KHÔNG CÓ THIẾT BỊ TIN CẬY, XÁC NHẬN BẰNG MÃ XÁC THỰC", async ({ page, shot }) => {
    await signInOnNewDevice(page, PAGE_TITLE.code);
    await shot("nhap-ma", "Không có thiết bị tin cậy trực tuyến, nhập mã Authenticator");
    await typeAuthenticatorCode(page);
    await shot("da-nhap-ma", "Đã nhập mã Authenticator");
    await confirmButton(page).click();
    await pickerHeading(page).waitFor();
    await shot("chon-don-vi", "Đã xác nhận, chọn đơn vị làm việc");
  }, { approverAvailable: false }),
  deviceApprovalFlow("ma-du-phong", "03. XÁC NHẬN BẰNG MÃ DỰ PHÒNG", async ({ page, shot, approval }) => {
    await signInOnNewDevice(page);
    await matchNumber(page, approval.matchNumber).waitFor();
    await shot("cho-cho-phep", "Chờ thiết bị tin cậy cho phép");
    await page.getByRole("button", { name: "Xác nhận bằng mã dự phòng", exact: true }).click();
    await heading(page, PAGE_TITLE.recovery).waitFor();
    // The pointer would leave the button now under it in its hover colour.
    await page.mouse.move(0, 0);
    await shot("nhap-ma-du-phong", "Nhập mã dự phòng");
    await typeRecoveryCode(page);
    await shot("da-nhap-ma-du-phong", "Đã nhập mã dự phòng");
    await confirmButton(page).click();
    await pickerHeading(page).waitFor();
    await shot("chon-don-vi", "Đã xác nhận, chọn đơn vị làm việc");
  }),
  deviceApprovalFlow("sai-ma", "04. NHẬP SAI MÃ XÁC THỰC", async ({ page, shot }) => {
    await signInOnNewDevice(page);
    await page.getByRole("button", { name: "Xác nhận bằng ứng dụng xác thực", exact: true }).click();
    await heading(page, PAGE_TITLE.code).waitFor();
    // The pointer would leave the button now under it in its hover colour.
    await page.mouse.move(0, 0);
    await typeAuthenticatorCode(page, WRONG_CODE);
    await shot("da-nhap-ma", "Nhập mã Authenticator");
    await confirmButton(page).click();
    await page.getByRole("alertdialog").getByText(MESSAGES.wrongCode, { exact: true }).waitFor();
    await shot("sai-ma", "Mã xác thực không đúng");
  }),
  deviceApprovalFlow("sai-qua-so-lan", "05. NHẬP SAI MÃ QUÁ SỐ LẦN", async ({ page, shot, approval }) => {
    await signInOnNewDevice(page, PAGE_TITLE.code);
    await typeAuthenticatorCode(page, WRONG_CODE);
    while (approval.failures < MAX_CODE_FAILURES - 1) {
      await confirmButton(page).click();
      await page.getByRole("alertdialog").getByText(MESSAGES.wrongCode, { exact: true }).waitFor();
      await page.getByRole("alertdialog").getByRole("button", { name: "Đã hiểu", exact: true }).click();
      await page.getByRole("alertdialog").waitFor({ state: "hidden" });
    }
    await typeAuthenticatorCode(page, "730291");
    await shot("nhap-lan-cuoi", `Sai ${MAX_CODE_FAILURES - 1} lần, nhập lại mã`);
    await confirmButton(page).click();
    await notice(page, "Chưa xác minh được").waitFor();
    await shot("da-huy", "Sai quá số lần, lần đăng nhập bị hủy");
    await closeNotice(page, "Chưa xác minh được");
    await signInHeading(page).waitFor();
    await shot("ve-dang-nhap", "Quay lại trang đăng nhập");
  }, { approverAvailable: false }),
  deviceApprovalFlow("tu-choi", "06. BỊ TỪ CHỐI TRÊN THIẾT BỊ TIN CẬY", async ctx => {
    await endedOnTrustedDevice(ctx, "REJECTED", "Đăng nhập chưa được chấp nhận", "Bị từ chối trên thiết bị tin cậy");
  }),
  deviceApprovalFlow("chon-sai-so", "07. CHỌN SAI SỐ TRÊN THIẾT BỊ TIN CẬY", async ctx => {
    await endedOnTrustedDevice(ctx, "MISMATCHED", "Số không khớp", "Thiết bị tin cậy chọn sai số");
  }),
  deviceApprovalFlow("het-han", "08. YÊU CẦU HẾT HẠN HOẶC ĐÃ BỊ HỦY", async ctx => {
    await endedOnTrustedDevice(ctx, "EXPIRED", "Bạn cần đăng nhập lại", "Yêu cầu hết hạn hoặc bị hủy nơi khác");
  }, { expiresAt: at(5) }),
  deviceApprovalFlow("huy", "09. HỦY ĐĂNG NHẬP", async ({ page, shot, approval }) => {
    await signInOnNewDevice(page);
    await matchNumber(page, approval.matchNumber).waitFor();
    await page.getByRole("button", { name: "Hủy đăng nhập", exact: true }).click();
    await notice(page, "Hủy yêu cầu đăng nhập?").waitFor();
    await shot("hoi-huy", "Hỏi lại trước khi hủy yêu cầu");
    await page.getByRole("button", { name: "Hủy yêu cầu", exact: true }).click();
    await signInHeading(page).waitFor();
    await shot("ve-dang-nhap", "Đã hủy, quay lại trang đăng nhập");
  }),
  deviceApprovalFlow("xac-minh-danh-tinh", "10. CHƯA CÓ AUTHENTICATOR, XÁC MINH DANH TÍNH", async ({ page, shot }) => {
    await signInOnNewDevice(page, PAGE_TITLE.identity);
    await shot("xac-minh-danh-tinh", "Chưa có Authenticator, xác minh danh tính để tiếp tục");
    await page.getByRole("button", { name: "Xác minh danh tính", exact: true }).click();
    await heading(page, "Xác minh khuôn mặt").waitFor();
    await shot("xac-minh-khuon-mat", "Đồng ý xác minh khuôn mặt");
  }, { approverAvailable: false, authenticator: false, recoveryCodes: 0 }),
  deviceApprovalFlow("qua-nhanh", "11. GỬI YÊU CẦU QUÁ NHANH", async ({ page, shot, mock }) => {
    mock.on("POST", "/v1/sessions", () => ({ status: 429, message: MESSAGES.rateLimited, data: { code: "DEVICE_LOGIN_RATE_LIMITED" } }));
    await openLogin(page);
    await fill(page, PHONE);
    await submit(page);
    await refusal(page, MESSAGES.rateLimited);
    await shot("qua-nhanh", "Đăng nhập liên tục trên máy mới, phải chờ một phút");
  }),
];
