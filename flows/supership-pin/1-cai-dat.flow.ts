import { shopPinFlow, openShopPin, fillPin, requestOtp, confirmOtp, verifySettings, PIN } from "../_helpers/supership-screen-lock";

export default [
  shopPinFlow("thiet-lap", "01. THIẾT LẬP PIN", async ({ page, shot }) => {
    await openShopPin(page); await shot("chua-bat", "Bảo mật — chưa bật khóa màn hình");
    await page.getByRole("button", { name: "Thiết lập PIN", exact: true }).click();
    await fillPin(page); await shot("nhap-pin", "Nhập PIN, xác nhận và chọn thời gian tự khóa");
    await page.getByRole("button", { name: "Bật khóa màn hình", exact: true }).click();
    await page.getByRole("button", { name: "Gửi mã OTP", exact: true }).waitFor(); await shot("chon-kenh", "Chọn kênh nhận OTP để xác nhận thiết lập");
    await requestOtp(page); await shot("nhap-otp", "Nhập OTP xác nhận bật khóa màn hình");
    await confirmOtp(page); await page.getByText("Đang bật", { exact: true }).waitFor(); await shot("thanh-cong", "Đã bật PIN — tự khóa sau 15 phút");
  }, false),
  shopPinFlow("nhap-pin-khong-hop-le", "02. PIN NHẬP CHƯA HỢP LỆ", async ({ page, shot }) => {
    await openShopPin(page); await page.getByRole("button", { name: "Thiết lập PIN", exact: true }).click();
    const save = page.getByRole("button", { name: "Bật khóa màn hình", exact: true });
    await fillPin(page, "123"); await save.click(); await page.getByText("Nhập đủ 6 chữ số.").waitFor(); await shot("thieu-pin", "PIN chưa đủ 6 chữ số");
    await fillPin(page, "123456"); await save.click(); await page.getByText("Tránh 6 số giống nhau hoặc dãy số liên tiếp.").waitFor(); await shot("pin-yeu", "PIN quá dễ đoán — cần chọn mã khác");
    await fillPin(page, PIN, "938472"); await save.click(); await page.getByText("Mã PIN nhập lại chưa khớp.").waitFor(); await shot("khong-khop", "PIN nhập lại chưa khớp");
  }, false),
  shopPinFlow("doi-pin", "03. ĐỔI PIN", async ({ page, shot }) => {
    await openShopPin(page); await page.getByRole("button", { name: "Đổi PIN", exact: true }).click(); await fillPin(page, "938472"); await shot("pin-moi", "Nhập và xác nhận mã PIN mới");
    await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click(); await requestOtp(page); await shot("xac-nhan-otp", "Xác nhận đổi PIN bằng OTP mới");
    await confirmOtp(page); await page.getByText("Mã PIN mới đã được lưu.", { exact: true }).waitFor(); await shot("thanh-cong", "Đã lưu PIN mới");
  }),
  shopPinFlow("doi-thoi-gian", "04. ĐỔI THỜI GIAN TỰ KHÓA", async ({ page, shot }) => {
    await openShopPin(page); await page.getByRole("button", { name: "Đổi thời gian", exact: true }).click(); await page.getByLabel("Tự khóa sau", { exact: true }).fill("5"); await shot("chon-thoi-gian", "Đổi tự khóa thành 5 phút không thao tác");
    await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click(); await verifySettings(page);
    await page.getByText("Sau 5 phút", { exact: true }).waitFor(); await shot("thanh-cong", "Đã xác nhận OTP và cập nhật thời gian");
  }),
  shopPinFlow("tat-pin", "05. TẮT KHÓA MÀN HÌNH", async ({ page, shot }) => {
    await openShopPin(page); await page.getByRole("button", { name: "Tắt khóa màn hình", exact: true }).click(); await shot("xac-nhan", "Xác nhận tắt khóa màn hình");
    await page.getByRole("button", { name: "Xác nhận tắt", exact: true }).click(); await requestOtp(page); await shot("xac-nhan-otp", "Nhập OTP trước khi tắt PIN");
    await confirmOtp(page); await page.getByText("Chưa bật", { exact: true }).waitFor(); await shot("thanh-cong", "Đã tắt khóa màn hình trên trình duyệt");
  }),
];
