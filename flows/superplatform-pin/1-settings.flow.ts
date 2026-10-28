import { pinFlow, openSettings, fillPin, mfa, PIN } from "../_helpers/superplatform-screen-lock";
export default [
  pinFlow("thiet-lap", "THIẾT LẬP PIN VÀ XÁC THỰC MFA", async ({ page, shot }) => {
    await openSettings(page); await shot("chua-bat", "Chưa bật khóa màn hình");
    await page.getByRole("button", { name: "Thiết lập PIN", exact: true }).click(); await page.getByLabel("Mã PIN mới", { exact: true }).waitFor(); await shot("form", "Thiết lập PIN và thời gian tự khóa");
    await fillPin(page); await shot("da-nhap", "Nhập PIN 6 chữ số — giữ số 0 đầu");
    await page.getByRole("button", { name: "Hiện mã pin mới" }).click(); await shot("hien-pin", "Hiện mã PIN để kiểm tra");
    await page.getByRole("button", { name: "Ẩn mã pin mới" }).click();
    await page.getByRole("button", { name: "Bật khóa màn hình", exact: true }).click();
    await page.getByRole("textbox", { name: "Mã xác thực" }).waitFor(); await shot("mfa", "Xác thực MFA trước khi bật PIN");
    await page.getByRole("textbox", { name: "Mã xác thực" }).pressSequentially("999999"); await page.getByRole("button", { name: "Xác thực MFA và tiếp tục" }).click();
    await page.getByText("Mã xác thực không đúng hoặc đã được sử dụng.", { exact: true }).waitFor(); await shot("mfa-sai", "Mã MFA không đúng hoặc đã sử dụng");
    await page.getByRole("button", { name: "Không dùng được ứng dụng xác thực? Dùng mã dự phòng" }).click();
    await page.getByRole("textbox", { name: "Mã dự phòng" }).waitFor(); await shot("ma-du-phong", "Có thể xác thực bằng mã dự phòng");
    await page.getByRole("button", { name: "Dùng mã từ ứng dụng xác thực" }).click(); await mfa(page);
    await page.getByText("Đang bật", { exact: true }).waitFor(); await shot("thanh-cong", "Bật khóa màn hình thành công");
  }, false),
  pinFlow("kiem-tra-nhap-lieu", "KIỂM TRA PIN VÀ THỜI GIAN TỰ KHÓA", async ({ page, shot }) => {
    await openSettings(page); await shot("chua-bat", "Chưa bật khóa màn hình");
    await page.getByRole("button", { name: "Thiết lập PIN", exact: true }).click(); await page.getByLabel("Mã PIN mới", { exact: true }).waitFor(); await shot("form", "Mở form thiết lập PIN");
    const save = page.getByRole("button", { name: "Bật khóa màn hình", exact: true });
    await save.click(); await page.getByText("Nhập đủ 6 chữ số.").waitFor(); await shot("thieu-pin", "Chưa nhập PIN hoặc chưa đủ 6 chữ số");
    await fillPin(page, "111111"); await save.click(); await page.getByText("Tránh 6 số giống nhau hoặc dãy số liên tiếp.").waitFor(); await shot("pin-lap", "Từ chối PIN có 6 số giống nhau");
    await fillPin(page, "123456"); await save.click(); await page.getByText("Tránh 6 số giống nhau hoặc dãy số liên tiếp.").waitFor(); await shot("pin-lien-tiep", "Từ chối dãy số liên tiếp tăng hoặc giảm");
    await fillPin(page, PIN, "938472"); await save.click(); await page.getByText("Mã PIN nhập lại chưa khớp.").waitFor(); await shot("khong-khop", "PIN nhập lại không khớp");
    await fillPin(page); await page.getByLabel("Tự khóa sau", { exact: true }).fill("0"); await save.click(); await page.getByText("Từ 10 giây đến 15 phút.").waitFor(); await shot("qua-ngan", "Thời gian nhỏ hơn 10 giây");
    await page.getByLabel("Tự khóa sau", { exact: true }).fill("16"); await save.click(); await page.getByText("Từ 10 giây đến 15 phút.").waitFor(); await shot("qua-dai", "Thời gian lớn hơn 15 phút");
    await page.getByRole("button", { name: "Hủy", exact: true }).click(); await page.getByLabel("Mã PIN mới", { exact: true }).waitFor({ state: "hidden" }); await shot("huy", "Hủy thiết lập — chưa bật PIN");
  }, false),
  pinFlow("doi-pin", "ĐỔI PIN", async ({ page, shot }) => {
    await openSettings(page); await shot("dang-bat", "Cài đặt PIN đang bật");
    await page.getByRole("button", { name: "Đổi PIN", exact: true }).click(); await page.getByLabel("Mã PIN mới", { exact: true }).waitFor(); await shot("form", "Nhập và xác nhận PIN mới");
    await fillPin(page, "938472"); await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click(); await page.getByRole("textbox", { name: "Mã xác thực" }).waitFor(); await shot("mfa", "Đổi PIN cần xác thực MFA mới");
    await mfa(page); await page.getByText("Mã PIN mới đã được lưu.", { exact: true }).waitFor(); await shot("thanh-cong", "Đã lưu mã PIN mới");
  }),
  pinFlow("doi-thoi-gian", "ĐỔI THỜI GIAN TỰ KHÓA", async ({ page, shot, mock }) => {
    await openSettings(page); await shot("dang-bat", "Khóa màn hình đang bật — tự khóa sau 5 phút");
    await page.getByRole("button", { name: "Đổi thời gian", exact: true }).click(); await page.getByLabel("Tự khóa sau", { exact: true }).waitFor(); await shot("form", "Đổi thời gian tự khóa — đơn vị phút");
    const select = page.getByRole("combobox", { name: "Đơn vị thời gian" });
    if (await select.evaluate(el => el.tagName === "SELECT")) await select.selectOption("1");
    else { await select.click(); await page.getByRole("option", { name: "giây", exact: true }).click(); }
    await page.getByLabel("Tự khóa sau", { exact: true }).fill("45"); await shot("giay", "Đặt tự khóa sau 45 giây");
    await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click(); await page.getByRole("textbox", { name: "Mã xác thực" }).waitFor(); await shot("mfa", "Xác thực MFA trước khi lưu thời gian mới");
    await mfa(page); await page.getByText("Sau 45 giây", { exact: true }).waitFor(); await shot("thanh-cong", "Đã cập nhật thời gian tự khóa");
    mock.timeout = 900;
  }),
  pinFlow("tat-pin", "TẮT KHÓA MÀN HÌNH", async ({ page, shot }) => {
    await openSettings(page); await shot("dang-bat", "Khóa màn hình đang bật");
    await page.getByRole("button", { name: "Tắt khóa màn hình", exact: true }).click(); await page.getByRole("button", { name: "Xác nhận tắt", exact: true }).waitFor(); await shot("xac-nhan", "Xác nhận tắt tự khóa");
    await page.getByRole("button", { name: "Hủy", exact: true }).click(); await page.getByRole("button", { name: "Xác nhận tắt", exact: true }).waitFor({ state: "hidden" }); await shot("huy", "Hủy tắt — PIN vẫn bật");
    await page.getByRole("button", { name: "Tắt khóa màn hình", exact: true }).click(); await page.getByRole("button", { name: "Xác nhận tắt", exact: true }).click(); await page.getByRole("textbox", { name: "Mã xác thực" }).waitFor(); await shot("mfa", "Xác thực MFA trước khi tắt");
    await mfa(page); await page.getByText("Chưa bật", { exact: true }).waitFor(); await shot("thanh-cong", "Đã tắt khóa màn hình");
  }),
  pinFlow("chua-mo-tinh-nang", "HỆ THỐNG CHƯA CHO BẬT PIN", async ({ page, shot, mock }) => { mock.available = false; await openSettings(page); await page.getByText("Tính năng chưa được mở trên hệ thống này.").waitFor(); await shot("chua-mo", "Hệ thống chưa mở tính năng thiết lập PIN"); }, false),
  pinFlow("chua-co-mfa", "CHƯA THIẾT LẬP MFA VÀ HỦY XÁC THỰC", async ({ page, shot, mock }) => {
    mock.enrolled = false; await openSettings(page); await shot("chua-bat", "Chưa bật khóa màn hình");
    await page.getByRole("button", { name: "Thiết lập PIN", exact: true }).click(); await fillPin(page); await shot("da-nhap", "Nhập PIN và thời gian tự khóa");
    await page.getByRole("button", { name: "Bật khóa màn hình", exact: true }).click();
    await page.getByText("Tài khoản chưa bật MFA. Bạn cần liên kết ứng dụng xác thực trước khi tiếp tục.").waitFor(); await shot("chua-mfa", "Cần thiết lập MFA trước khi bật PIN");
    await page.keyboard.press("Escape"); await page.getByRole("button", { name: "Bật khóa màn hình", exact: true }).and(page.locator(":enabled")).waitFor(); await shot("huy-mfa", "Hủy xác thực — giữ form, chưa lưu PIN");
  }, false),
  pinFlow("loi-cai-dat-1", "CẦN ĐĂNG NHẬP LẠI ĐỂ ĐỔI PIN", async ({ page, shot, mock }) => {
    // The server refuses a browser it cannot recognise before asking for any code.
    mock.requireMfa = false; mock.settingsError = "DEVICE_REAUTHENTICATION_REQUIRED";
    await openSettings(page); await shot("dang-bat", "Cài đặt PIN đang bật");
    await page.getByRole("button", { name: "Đổi PIN", exact: true }).click(); await fillPin(page, "938472"); await shot("da-nhap", "Nhập và xác nhận PIN mới");
    await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
    await page.getByText("Vui lòng đăng nhập lại để nhận diện trình duyệt này.", { exact: true }).waitFor(); await shot("loi", "Cần đăng nhập lại để nhận diện trình duyệt");
  }),
];
