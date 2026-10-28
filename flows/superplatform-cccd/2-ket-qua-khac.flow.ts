import type { Page } from "playwright";
import { expect } from "playwright/test";
import {
  confirmCard, confirmCode, dialog, filmSide, identityFlow, MESSAGES, nextButton, openIdentity, reachFace, readCardShown, refusedDialog, sendFace,
  startButton, takeCard, takeFace, verified, verifyFace,
} from "../_helpers/superplatform-identity-document";

/** Both sides from the first step, then "Tiếp tục": the card is read before any face. */
async function sendCard(page: Page) {
  await page.getByText("Mặt trước căn cước", { exact: true }).waitFor();
  await takeCard(page, "FRONT"); await nextButton(page).click();
  await page.getByText("Mặt sau căn cước", { exact: true }).waitFor();
  await takeCard(page, "BACK"); await nextButton(page).click();
}
/** "Đã hiểu" on the error dialog: the wizard stays, back on the front side with no photo. */
async function backToFront(page: Page) {
  await refusedDialog(page).getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await refusedDialog(page).waitFor({ state: "hidden" });
  await page.getByText("Mặt trước căn cước", { exact: true }).waitFor();
  await filmSide(page, "FRONT");
}

export default [
  identityFlow("chup-lai", "03. CHƯA ĐỌC RÕ THẺ HOẶC KHUÔN MẶT — CHỤP LẠI", async ({ page, shot }) => {
    await openIdentity(page); await startButton(page).click(); await sendCard(page);
    await page.getByRole("alert").getByText(`${MESSAGES.retakeFront} Còn 4 lần thử.`).waitFor();
    await filmSide(page, "FRONT");
    await expect(page.getByRole("button", { name: "Chụp mặt trước", exact: true })).toBeEnabled();
    await shot("chua-doc-ro-mat-truoc", "Chưa đọc rõ mặt trước — quay về bước 1 để chụp lại, trước khi chụp khuôn mặt");

    await takeCard(page, "FRONT"); await nextButton(page).click();
    await page.getByText("Mặt sau căn cước", { exact: true }).waitFor(); await nextButton(page).click();
    await readCardShown(page); await confirmCard(page); await verifyFace(page);
    await page.getByRole("alert").getByText(MESSAGES.retakeFace).waitFor();
    await shot("chua-thay-ro-khuon-mat", "Chưa thấy rõ khuôn mặt — chụp lại nơi đủ sáng");
  }, { consent: true,
    cardOutcomes: [{ result: "RETAKE", retake: "FRONT", message: MESSAGES.retakeFront }],
    outcomes: [{ result: "RETAKE", retake: "FACE", message: MESSAGES.retakeFace }] }),

  identityFlow("khuon-mat-khong-dat", "04. KHUÔN MẶT KHÔNG KHỚP HOẶC KHÔNG PHẢI NGƯỜI THẬT", async ({ page, shot }) => {
    await openIdentity(page); await reachFace(page, false); await verifyFace(page);
    await page.getByRole("alert").getByText(`${MESSAGES.notMatched} Còn 4 lần thử.`).waitFor();
    await shot("khong-khop", "Khuôn mặt không khớp ảnh trên căn cước — còn 4 lần thử");
    await page.getByRole("button", { name: "Chụp lại", exact: true }).click(); await verifyFace(page);
    await page.getByRole("alert").getByText(MESSAGES.notLive).waitFor();
    await shot("khong-phai-nguoi-that", "Không xác minh được khuôn mặt — phải chụp trực tiếp");
  }, { consent: true, outcomes: [
    { result: "NOT_MATCHED", message: MESSAGES.notMatched },
    { result: "NOT_LIVE", message: MESSAGES.notLive },
  ] }),

  identityFlow("tam-khoa", "05. SAI QUÁ SỐ LẦN — TẠM KHÓA XÁC THỰC", async ({ page, shot }) => {
    await openIdentity(page); await reachFace(page, false); await verifyFace(page);
    await dialog(page).getByText("Tạm khóa xác thực tới 09:00 13/10.").waitFor();
    await shot("ket-qua-tam-khoa", "Lần sai cuối — tạm khóa xác thực");
    await page.getByRole("button", { name: "Đóng", exact: true }).click();
    await page.getByRole("status").getByText("Tạm khóa xác thực tới").waitFor();
    await expect(startButton(page)).toHaveCount(0);
    await shot("trang-tam-khoa", "Đang tạm khóa — chưa xác thực lại được");
  }, { consent: true, remaining: 1, outcomes: [{ result: "NOT_MATCHED", message: MESSAGES.notMatched }] }),

  identityFlow("tu-choi", "06. CĂN CƯỚC HẾT HẠN HOẶC SỐ ĐÃ ĐƯỢC DÙNG", async ({ page, shot }) => {
    await openIdentity(page); await startButton(page).click(); await sendCard(page);
    await refusedDialog(page).getByText(`${MESSAGES.expired} Còn 4 lần thử.`).waitFor();
    await shot("the-het-han", "Căn cước đã hết hạn — hộp báo lỗi hiện ngay sau bước mặt sau");
    await backToFront(page);
    await sendCard(page);
    await refusedDialog(page).getByText(`${MESSAGES.inUse} Còn 3 lần thử.`).waitFor();
    await shot("so-da-dung", "Số căn cước đã gắn với người khác");
  }, { consent: true, cardOutcomes: [
    { result: "REFUSED", message: MESSAGES.expired },
    { result: "REFUSED", message: MESSAGES.inUse },
  ] }),

  identityFlow("xac-thuc-lai", "07. XÁC THỰC LẠI CĂN CƯỚC", async ({ page, shot }) => {
    await openIdentity(page);
    await page.getByRole("button", { name: "Xác thực lại" }).click();
    await page.getByText("Xác thực lại căn cước?").waitFor();
    await shot("xac-nhan", "Xác nhận xác thực lại — thẻ mới thay thẻ hiện tại");
    await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await sendCard(page);
    await refusedDialog(page).getByText(`${MESSAGES.otherNumber} Còn 4 lần thử.`).waitFor();
    await shot("khac-so", "Thẻ khác số đã xác thực — hộp báo lỗi chung hiện trên hộp xác thực");
    await backToFront(page);
    await shot("chon-lai-anh", "Đóng hộp báo — hộp xác thực ở lại, về bước 1 để chọn lại ảnh");

    await sendCard(page); await readCardShown(page);
    await shot("thong-tin", "Đúng thẻ — kiểm tra thông tin đọc từ căn cước rồi xác nhận");
    await confirmCard(page); await verifyFace(page);
    await dialog(page).getByText("Thông tin dưới đây được đọc từ căn cước của bạn.").waitFor();
    await shot("da-xac-thuc-lai", "Đã xác thực lại — thông tin đọc từ căn cước");
  }, { ...verified(), cardOutcomes: [{ result: "REFUSED", message: MESSAGES.otherNumber }] }),

  identityFlow("het-han", "08. CĂN CƯỚC SẮP HẾT HẠN VÀ ĐÃ HẾT HẠN", async ({ page, shot, mock }) => {
    await openIdentity(page); await page.getByText("Căn cước hết hạn ngày 02/11/2026.").waitFor();
    await shot("sap-het-han", "Sắp hết hạn — xác thực thẻ mới");
    mock.status = "EXPIRED"; mock.card!.valid_until = "2026-09-30";
    await openIdentity(page); await page.getByText("Căn cước đã hết hạn.").waitFor();
    await shot("da-het-han", "Đã hết hạn — xác thực thẻ mới");
  }, verified("EXPIRING")),

  identityFlow("noi-o", "09. CẬP NHẬT NƠI Ở HIỆN TẠI", async ({ page, shot }) => {
    await openIdentity(page);
    await page.getByRole("button", { name: "Thêm", exact: true }).click();
    await page.getByRole("checkbox", { name: /Giống nơi thường trú/ }).waitFor();
    await shot("giong-thuong-tru", "Mặc định giống nơi thường trú trên căn cước");
    await page.getByRole("checkbox", { name: /Giống nơi thường trú/ }).uncheck();
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await page.getByText("Nhập đủ khu vực, số nhà, đường.").waitFor();
    await shot("thieu-thong-tin", "Nơi khác — chưa nhập đủ địa chỉ");
    await page.getByRole("button", { name: "Chọn khu vực" }).click();
    await page.getByRole("button", { name: "Thành phố Hồ Chí Minh" }).click();
    await page.getByRole("button", { name: "Phường Tân Bình" }).click();
    await page.getByPlaceholder("Ví dụ: 45 Nguyễn Trãi").fill("128 Hoàng Văn Thụ");
    await page.getByText("Nhập đủ khu vực, số nhà, đường.").waitFor({ state: "hidden" });
    await shot("da-nhap", "Đã chọn khu vực và nhập số nhà, đường");
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await page.getByRole("textbox", { name: "Mã xác thực" }).waitFor();
    await shot("ma-xac-thuc", "Nhập mã xác thực để cập nhật nơi ở");
    await confirmCode(page);
    await page.getByText("128 Hoàng Văn Thụ, Phường Tân Bình, Thành phố Hồ Chí Minh").waitFor();
    await shot("da-cap-nhat", "Đã cập nhật nơi ở hiện tại", { mode: "fullPage" });
  }, { ...verified(), sameAsPermanent: null }),

  identityFlow("rut-dong-y", "10. NGỪNG CHO PHÉP DÙNG ẢNH — XÓA ẢNH CĂN CƯỚC VÀ KHUÔN MẶT", async ({ page, shot }) => {
    await openIdentity(page); await page.getByText("Cho phép dùng ảnh căn cước và khuôn mặt từ").waitFor();
    await page.getByRole("button", { name: "Ngừng cho phép", exact: true }).click();
    await page.getByText("Ngừng cho phép dùng ảnh?").waitFor();
    await shot("xac-nhan", "Xác nhận ngừng cho phép và xóa ảnh");
    await dialog(page).getByRole("button", { name: /Ngừng và xóa ảnh/ }).click();
    await page.getByText("Ảnh đã xóa", { exact: false }).first().waitFor();
    await shot("da-rut", "Đã ngừng cho phép — ảnh đã xóa, thông tin thẻ vẫn giữ", { mode: "fullPage" });
  }, verified()),

  identityFlow("loi-he-thong", "11. CHƯA SẴN SÀNG VÀ LỖI HỆ THỐNG", async ({ page, shot, mock }) => {
    mock.available = false;
    await openIdentity(page); await page.getByText("Chức năng chưa sẵn sàng.").waitFor();
    await shot("chua-san-sang", "Chức năng chưa sẵn sàng — không có nút xác thực");
    mock.available = true; mock.loadError = true;
    await page.goto("/workspace/account/identity-document");
    await page.getByRole("button", { name: "Tải lại", exact: true }).waitFor();
    await shot("loi-tai-trang", "Không tải được trang — tải lại");
    mock.loadError = false;
    await page.getByRole("button", { name: "Tải lại", exact: true }).click();
    await reachFace(page, false); await takeFace(page); await sendFace(page);
    await page.getByRole("alert").getByText(MESSAGES.busy).waitFor();
    await shot("he-thong-ban", "Hệ thống xác thực đang bận — giữ ảnh để thử lại");
  }, { consent: true, outcomes: [{ result: "ERROR", status: 503, code: "EKYC_PROVIDER_UNAVAILABLE", message: MESSAGES.busy }] }),
];
