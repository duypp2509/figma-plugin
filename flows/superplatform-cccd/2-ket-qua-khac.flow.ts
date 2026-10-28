import type { Page } from "playwright";
import { expect } from "playwright/test";
import {
  confirmCard, dialog, filmSide, identityFlow, MESSAGES, nextButton, openIdentity, readCardShown, refusedDialog, sendFace,
  startButton, STEP_UP_CODE, stepUpCode, takeCard, takeFace, verified, verifyFace,
} from "../_helpers/superplatform-identity-document";

/** The starting screen: Giấy tờ định danh with no verified card, "Xác thực căn cước" ready. */
async function openEmpty(page: Page) {
  await openIdentity(page);
  await startButton(page).waitFor();
}
/** Both sides taken from the front step, stopping before "Tiếp tục" reads the card. */
async function takeBothSides(page: Page) {
  await page.getByText("Mặt trước căn cước", { exact: true }).waitFor();
  await takeCard(page, "FRONT"); await nextButton(page).click();
  await page.getByText("Mặt sau căn cước", { exact: true }).waitFor();
  await takeCard(page, "BACK");
}
/** "Đã hiểu" on the error dialog: the wizard stays, back on the front side with no photo. */
async function backToFront(page: Page) {
  await refusedDialog(page).getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await refusedDialog(page).waitFor({ state: "hidden" });
  await page.getByText("Mặt trước căn cước", { exact: true }).waitFor();
  await filmSide(page, "FRONT");
}
/** From the starting screen through both sides and what was read, to the face step with a face taken. */
async function faceTaken(page: Page, shot: (stepId: string, title: string) => Promise<void>) {
  await startButton(page).click();
  await takeBothSides(page); await nextButton(page).click(); await readCardShown(page);
  await shot("thong-tin", "Kiểm tra thông tin đọc từ căn cước rồi xác nhận");
  await confirmCard(page); await takeFace(page);
  await shot("khuon-mat-da-chup", "Đã chụp khuôn mặt — gửi xác thực");
}

export default [
  identityFlow("chup-lai", "CHƯA ĐỌC RÕ THẺ HOẶC KHUÔN MẶT — CHỤP LẠI", async ({ page, shot }) => {
    await openEmpty(page);
    await shot("chua-xac-thuc", "Chưa xác thực căn cước");

    await startButton(page).click(); await takeBothSides(page);
    await shot("mat-sau-da-chup", "Đã chụp hai mặt — bấm Tiếp tục để đọc thẻ");
    await nextButton(page).click();
    await page.getByRole("alert").getByText(`${MESSAGES.retakeFront} Còn 4 lần thử.`).waitFor();
    await filmSide(page, "FRONT");
    await expect(page.getByRole("button", { name: "Chụp mặt trước", exact: true })).toBeEnabled();
    await shot("chua-doc-ro-mat-truoc", "Chưa đọc rõ mặt trước — quay về bước 1 để chụp lại, trước khi chụp khuôn mặt");

    await takeCard(page, "FRONT"); await nextButton(page).click();
    await page.getByText("Mặt sau căn cước", { exact: true }).waitFor(); await nextButton(page).click();
    await readCardShown(page);
    await shot("thong-tin", "Chụp lại mặt trước — đọc được thẻ, kiểm tra rồi xác nhận");
    await confirmCard(page); await takeFace(page);
    await shot("khuon-mat-da-chup", "Đã chụp khuôn mặt — gửi xác thực");
    await sendFace(page);
    await page.getByRole("alert").getByText(MESSAGES.retakeFace).waitFor();
    await shot("chua-thay-ro-khuon-mat", "Chưa thấy rõ khuôn mặt — chụp lại nơi đủ sáng");
  }, { consent: true,
    cardOutcomes: [{ result: "RETAKE", retake: "FRONT", message: MESSAGES.retakeFront }],
    outcomes: [{ result: "RETAKE", retake: "FACE", message: MESSAGES.retakeFace }] }),

  identityFlow("khuon-mat-khong-dat", "KHUÔN MẶT KHÔNG KHỚP HOẶC KHÔNG PHẢI NGƯỜI THẬT", async ({ page, shot }) => {
    await openEmpty(page);
    await shot("chua-xac-thuc", "Chưa xác thực căn cước");
    await faceTaken(page, shot);
    await sendFace(page);
    await page.getByRole("alert").getByText(`${MESSAGES.notMatched} Còn 4 lần thử.`).waitFor();
    await shot("khong-khop", "Khuôn mặt không khớp ảnh trên căn cước — còn 4 lần thử");
    await page.getByRole("button", { name: "Chụp lại", exact: true }).click(); await verifyFace(page);
    await page.getByRole("alert").getByText(MESSAGES.notLive).waitFor();
    await shot("khong-phai-nguoi-that", "Chụp lại và gửi — không xác minh được khuôn mặt, phải chụp trực tiếp");
  }, { consent: true, outcomes: [
    { result: "NOT_MATCHED", message: MESSAGES.notMatched },
    { result: "NOT_LIVE", message: MESSAGES.notLive },
  ] }),

  identityFlow("tam-khoa", "SAI QUÁ SỐ LẦN — TẠM KHÓA XÁC THỰC", async ({ page, shot }) => {
    await openEmpty(page);
    await shot("chua-xac-thuc", "Chưa xác thực căn cước");
    await faceTaken(page, shot);
    await sendFace(page);
    // Since 28/10 a lock closes the wizard and shows only the shared error dialog.
    const locked = page.getByRole("alertdialog", { name: "Tạm khóa xác thực" });
    await locked.getByText("Tạm khóa xác thực tới 09:00 13/10.").waitFor();
    await shot("ket-qua-tam-khoa", "Lần sai cuối — hộp lỗi Tạm khóa xác thực");
    await locked.getByRole("button", { name: "Đã hiểu", exact: true }).click();
    await locked.waitFor({ state: "hidden" });
    await page.getByRole("status").getByText("Tạm khóa xác thực tới").waitFor();
    await expect(startButton(page)).toHaveCount(0);
    await shot("trang-tam-khoa", "Đang tạm khóa — chưa xác thực lại được");
  }, { consent: true, remaining: 1, outcomes: [{ result: "NOT_MATCHED", message: MESSAGES.notMatched }] }),

  identityFlow("tu-choi", "CĂN CƯỚC HẾT HẠN HOẶC SỐ ĐÃ ĐƯỢC DÙNG", async ({ page, shot }) => {
    await openEmpty(page);
    await shot("chua-xac-thuc", "Chưa xác thực căn cước");

    await startButton(page).click(); await takeBothSides(page);
    await shot("mat-sau-da-chup", "Đã chụp hai mặt — bấm Tiếp tục để đọc thẻ");
    await nextButton(page).click();
    await refusedDialog(page).getByText(`${MESSAGES.expired} Còn 4 lần thử.`).waitFor();
    await shot("the-het-han", "Căn cước đã hết hạn — hộp báo lỗi hiện ngay sau bước mặt sau");

    await backToFront(page);
    await shot("chon-lai-anh", "Đóng hộp báo — về bước 1 để chụp thẻ khác");
    await takeBothSides(page); await nextButton(page).click();
    await refusedDialog(page).getByText(`${MESSAGES.inUse} Còn 3 lần thử.`).waitFor();
    await shot("so-da-dung", "Chụp thẻ khác — số căn cước đã gắn với người khác");
  }, { consent: true, cardOutcomes: [
    { result: "REFUSED", message: MESSAGES.expired },
    { result: "REFUSED", message: MESSAGES.inUse },
  ] }),

  identityFlow("xac-thuc-lai", "XÁC THỰC LẠI CĂN CƯỚC", async ({ page, shot }) => {
    await openIdentity(page);
    await page.getByRole("button", { name: "Xác thực lại" }).waitFor();
    await shot("da-xac-thuc", "Căn cước đã xác thực");

    await page.getByRole("button", { name: "Xác thực lại" }).click();
    await page.getByText("Xác thực lại căn cước?").waitFor();
    await shot("xac-nhan", "Xác nhận xác thực lại — thẻ mới thay thẻ hiện tại");
    await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await takeBothSides(page);
    await shot("mat-sau-da-chup", "Đã chụp hai mặt thẻ mới — bấm Tiếp tục để đọc thẻ");
    await nextButton(page).click();
    await refusedDialog(page).getByText(`${MESSAGES.otherNumber} Còn 4 lần thử.`).waitFor();
    await shot("khac-so", "Thẻ khác số đã xác thực — hộp báo lỗi chung hiện trên hộp xác thực");
    await backToFront(page);
    await shot("chon-lai-anh", "Đóng hộp báo — hộp xác thực ở lại, về bước 1 để chọn lại ảnh");

    await takeBothSides(page); await nextButton(page).click(); await readCardShown(page);
    await shot("thong-tin", "Đúng thẻ — kiểm tra thông tin đọc từ căn cước rồi xác nhận");
    await confirmCard(page); await takeFace(page);
    await shot("khuon-mat-da-chup", "Đã chụp khuôn mặt — gửi xác thực");
    await sendFace(page);
    await dialog(page).getByText("Thông tin dưới đây được đọc từ căn cước của bạn.").waitFor();
    await shot("da-xac-thuc-lai", "Đã xác thực lại — thông tin đọc từ căn cước");
  }, { ...verified(), cardOutcomes: [{ result: "REFUSED", message: MESSAGES.otherNumber }] }),

  identityFlow("het-han", "CĂN CƯỚC SẮP HẾT HẠN VÀ ĐÃ HẾT HẠN", async ({ page, shot, mock }) => {
    await openIdentity(page); await page.getByText("Căn cước hết hạn ngày 02/11/2026.").waitFor();
    await shot("sap-het-han", "Sắp hết hạn — xác thực thẻ mới");
    mock.status = "EXPIRED"; mock.card!.valid_until = "2026-09-30";
    await openIdentity(page); await page.getByText("Căn cước đã hết hạn.").waitFor();
    await shot("da-het-han", "Đã hết hạn — xác thực thẻ mới");
  }, verified("EXPIRING")),

  identityFlow("noi-o", "CẬP NHẬT NƠI Ở HIỆN TẠI", async ({ page, shot }) => {
    await openIdentity(page);
    const add = page.getByRole("button", { name: "Thêm", exact: true });
    await add.waitFor();
    await shot("trang-giay-to", "Giấy tờ định danh — nơi ở hiện tại chưa có");

    await add.click();
    await page.getByRole("checkbox", { name: /Giống nơi thường trú/ }).waitFor();
    await shot("giong-thuong-tru", "Mặc định giống nơi thường trú trên căn cước");
    await page.getByRole("checkbox", { name: /Giống nơi thường trú/ }).uncheck();
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await page.getByText("Nhập đủ khu vực, số nhà, đường.").waitFor();
    await shot("thieu-thong-tin", "Nơi khác — chưa nhập đủ địa chỉ");
    await page.getByRole("button", { name: "Chọn khu vực" }).click();
    await page.getByRole("button", { name: "Thành phố Hồ Chí Minh" }).waitFor();
    await shot("chon-tinh", "Chọn tỉnh, thành phố");
    await page.getByRole("button", { name: "Thành phố Hồ Chí Minh" }).click();
    await page.getByRole("button", { name: "Phường Tân Bình" }).waitFor();
    await shot("chon-phuong", "Chọn phường, xã");
    await page.getByRole("button", { name: "Phường Tân Bình" }).click();
    await page.getByPlaceholder("Ví dụ: 45 Nguyễn Trãi").fill("128 Hoàng Văn Thụ");
    await page.getByText("Nhập đủ khu vực, số nhà, đường.").waitFor({ state: "hidden" });
    await shot("da-nhap", "Đã chọn khu vực và nhập số nhà, đường");
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await stepUpCode(page).waitFor();
    await stepUpCode(page).pressSequentially(STEP_UP_CODE);
    await shot("ma-xac-thuc", "Nhập mã xác thực để cập nhật nơi ở");
    await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await stepUpCode(page).waitFor({ state: "hidden" });
    await page.getByText("128 Hoàng Văn Thụ, Phường Tân Bình, Thành phố Hồ Chí Minh").waitFor();
    await shot("da-cap-nhat", "Đã cập nhật nơi ở hiện tại", { mode: "fullPage" });
  }, { ...verified(), sameAsPermanent: null }),

  identityFlow("rut-dong-y", "NGỪNG CHO PHÉP DÙNG ẢNH — XÓA ẢNH CĂN CƯỚC VÀ KHUÔN MẶT", async ({ page, shot }) => {
    await openIdentity(page); await page.getByText("Cho phép dùng ảnh căn cước và khuôn mặt từ").waitFor();
    await shot("trang-giay-to", "Giấy tờ định danh — đang cho phép dùng ảnh", { mode: "fullPage" });
    await page.getByRole("button", { name: "Ngừng cho phép", exact: true }).click();
    await page.getByText("Ngừng cho phép dùng ảnh?").waitFor();
    await shot("xac-nhan", "Xác nhận ngừng cho phép và xóa ảnh");
    await dialog(page).getByRole("button", { name: /Ngừng và xóa ảnh/ }).click();
    await page.getByText("Ảnh đã xóa", { exact: false }).first().waitFor();
    await shot("da-rut", "Đã ngừng cho phép — ảnh đã xóa, thông tin thẻ vẫn giữ", { mode: "fullPage" });
  }, verified()),
];
