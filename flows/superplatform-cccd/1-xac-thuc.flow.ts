import {
  confirmCard, dialog, identityFlow, nextButton, openIdentity, readCardShown, sendFace, startButton, takeCard, takeFace, uploadCard,
  waitCamera,
} from "../_helpers/superplatform-identity-document";

export default [
  identityFlow("thanh-cong", "01. XÁC THỰC CĂN CƯỚC THÀNH CÔNG", async ({ page, shot }) => {
    await openIdentity(page); await startButton(page).waitFor();
    await shot("chua-xac-thuc", "Chưa xác thực căn cước");

    await startButton(page).click();
    await page.getByRole("checkbox", { name: "Tôi đã đọc và đồng ý" }).check();
    await shot("dong-y", "Đọc và đồng ý xác thực bằng căn cước và khuôn mặt");
    await page.getByRole("button", { name: "Đồng ý và tiếp tục", exact: true }).click();
    await page.getByText("Mặt trước căn cước", { exact: true }).waitFor(); await waitCamera(page);
    await shot("mat-truoc", "Bước 1 — Chụp mặt trước trong khung");

    await takeCard(page, "FRONT");
    await shot("mat-truoc-da-chup", "Đã chụp mặt trước — dùng ảnh hoặc chụp lại");
    await nextButton(page).click(); await page.getByText("Mặt sau căn cước", { exact: true }).waitFor();
    await takeCard(page, "BACK");
    await shot("mat-sau-da-chup", "Bước 2 — Đã chụp mặt sau");
    await nextButton(page).click(); await readCardShown(page);
    await shot("thong-tin", "Bước 3 — Kiểm tra thông tin đọc từ căn cước rồi xác nhận");
    await confirmCard(page); await waitCamera(page);
    await shot("khuon-mat", "Bước 4 — Đưa khuôn mặt vào khung");

    await takeFace(page);
    await shot("khuon-mat-da-chup", "Đã chụp khuôn mặt — gửi xác thực");
    await sendFace(page);
    await dialog(page).getByText("Thông tin dưới đây được đọc từ căn cước của bạn.").waitFor();
    await shot("ket-qua", "Đã xác thực — thông tin đọc từ căn cước");

    await page.getByRole("button", { name: "Xong", exact: true }).click();
    await page.getByText("Đã xác thực", { exact: true }).first().waitFor();
    await page.getByRole("button", { name: "Xác thực lại" }).waitFor();
    await shot("da-xac-thuc", "Trang giấy tờ định danh sau khi xác thực", { mode: "fullPage" });
  }),
  identityFlow("tai-anh", "02. CHỌN ẢNH TỪ MÁY VÀ KHÔNG MỞ ĐƯỢC CAMERA", async ({ page, shot }) => {
    await openIdentity(page);
    await page.evaluate(() => { (window as unknown as Record<string, unknown>).__ffcCamera = "denied"; });
    await startButton(page).click();
    await page.getByText("Mặt trước căn cước", { exact: true }).waitFor();
    await page.getByText("Trang chưa được phép dùng camera.").waitFor();
    await shot("khong-mo-duoc-camera", "Chưa cho phép camera — chuyển sang tải ảnh");

    await page.getByRole("button", { name: "Hướng dẫn chụp", exact: true }).click();
    await page.getByRole("button", { name: "Đã hiểu", exact: true }).waitFor();
    await shot("huong-dan-chup", "Hướng dẫn chụp căn cước");
    await page.getByRole("button", { name: "Đã hiểu", exact: true }).click();

    await page.getByRole("tab", { name: "Tải ảnh" }).click();
    await page.getByText("Chọn ảnh mặt trước", { exact: true }).waitFor();
    await shot("tai-anh", "Tải ảnh mặt trước từ máy (JPG hoặc PNG)");
    await uploadCard(page, "FRONT", true);
    await page.getByText("Ảnh quá nhỏ. Hãy chụp gần và rõ hơn.").waitFor();
    await shot("anh-qua-nho", "Ảnh quá nhỏ — chọn ảnh khác");
    await uploadCard(page, "FRONT");
    await page.getByRole("img", { name: "Ảnh mặt trước căn cước" }).waitFor();
    await shot("da-chon-anh", "Đã chọn ảnh mặt trước");
  }, { consent: true }),
];
