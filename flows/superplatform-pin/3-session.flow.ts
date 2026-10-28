import { pinFlow, openSettings, lockNow, unlock, SECURITY_URL } from "../_helpers/superplatform-screen-lock";
export default [
  pinFlow("menu-tai-khoan", "18. KHÓA TỪ MENU TÀI KHOẢN", async ({ page, shot }) => {
    await openSettings(page); await page.locator("summary").filter({ hasText: "Nguyễn Minh Anh" }).click(); await page.getByRole("button", { name: "Khóa màn hình", exact: true }).waitFor(); await shot("menu", "Mục khóa màn hình trong menu tài khoản");
    await page.getByRole("button", { name: "Khóa màn hình", exact: true }).click(); await page.getByRole("heading", { name: "Màn hình đã khóa" }).waitFor(); await shot("da-khoa", "Khóa từ menu tài khoản");
  }),
  pinFlow("menu-chua-pin", "19. CHỌN KHÓA KHI CHƯA THIẾT LẬP PIN", async ({ page, shot }) => {
    await openSettings(page); await page.locator("summary").filter({ hasText: "Nguyễn Minh Anh" }).click(); await shot("menu", "Menu khóa màn hình khi chưa có PIN");
    await page.getByRole("button", { name: "Khóa màn hình", exact: true }).click(); await page.getByRole("button", { name: "Thiết lập PIN", exact: true }).waitFor(); await shot("den-thiet-lap", "Chuyển đến bảo mật để thiết lập PIN trước");
  }, false),
  pinFlow("dong-bo-tab-giu-nhap", "20. ĐỒNG BỘ HAI TAB VÀ GIỮ FORM CHƯA LƯU", async ({ page, context, shot, mock }) => {
    await openSettings(page); await page.getByRole("button", { name: "Đổi thời gian", exact: true }).click(); await page.getByLabel("Tự khóa sau", { exact: true }).fill("7"); await shot("ban-nhap", "Form đổi thời gian đang nhập, chưa lưu");
    const other = await context.newPage(); await openSettings(other); await lockNow(other);
    await page.getByRole("heading", { name: "Màn hình đã khóa" }).waitFor(); await shot("tab-khoa", "Khóa ở tab khác — tab hiện tại cũng khóa");
    await unlock(other); await page.getByLabel("Tự khóa sau", { exact: true }).waitFor();
    if (await page.getByLabel("Tự khóa sau", { exact: true }).inputValue() !== "7") throw new Error("Draft must survive unlock");
    await shot("tab-mo", "Mở ở tab khác — phục hồi form và giá trị chưa lưu"); await other.close();
  }),
  pinFlow("mo-tab-dang-khoa", "21. TAB MỚI KHI PHIÊN ĐANG KHÓA", async ({ page, shot, mock }) => {
    mock.locked = true; await page.goto(SECURITY_URL); await page.getByRole("heading", { name: "Màn hình đã khóa" }).waitFor(); await shot("tab-moi", "Tab chưa có bản chụp nền vẫn yêu cầu PIN");
    await unlock(page); await page.getByRole("button", { name: "Khóa ngay", exact: true }).waitFor(); await shot("da-mo", "Máy chủ xác nhận PIN — tải nội dung làm việc");
  }),
  pinFlow("kiem-tra-phien-loi-mang", "22. KHÔNG THỂ KIỂM TRA PHIÊN KHI MỞ TRANG", async ({ page, shot, mock }) => {
    mock.offline = "/screen-lock"; await page.goto(SECURITY_URL); await page.getByText("Không thể kiểm tra phiên. Vui lòng kết nối mạng và thử lại.").waitFor(); await shot("loi-khoi-dong", "Chưa kiểm tra được phiên — che nội dung");
    mock.offline = ""; await page.getByRole("button", { name: "Thử lại", exact: true }).click(); await page.getByRole("button", { name: "Khóa ngay", exact: true }).waitFor(); await shot("ket-noi-lai", "Kết nối lại và kiểm tra phiên thành công");
  }),
  pinFlow("dang-xac-minh", "23. CÁC TRẠNG THÁI ĐANG KHÓA VÀ ĐANG XÁC MINH", async ({ page, shot, mock }) => {
    await openSettings(page); mock.lockDelay = true; await page.getByRole("button", { name: "Khóa ngay", exact: true }).click(); await page.getByRole("heading", { name: "Đang khóa màn hình…", exact: true }).waitFor(); await shot("dang-khoa", "Đang chờ máy chủ xác nhận khóa");
    mock.lockDelay = false; mock.release(); await page.getByRole("heading", { name: "Màn hình đã khóa" }).waitFor();
    mock.unlockDelay = true; await unlock(page); await page.getByRole("button", { name: "Đang xác minh…", exact: true }).waitFor(); await shot("dang-xac-minh", "Đang xác minh PIN — khóa thao tác gửi trùng");
    mock.unlockDelay = false; mock.release(); await page.getByRole("button", { name: "Khóa ngay", exact: true }).waitFor(); await shot("hoan-tat", "Xác minh xong — phục hồi màn hình");
  }),
  pinFlow("mfa-sau-mo-khoa", "24. PHIÊN YÊU CẦU MFA SAU KHI MỞ KHÓA", async ({ page, shot, mock }) => {
    await openSettings(page); await lockNow(page); await shot("da-khoa", "Phiên đang khóa bằng PIN");
    mock.nextAction = "MFA_VERIFICATION_REQUIRED"; await unlock(page); await page.waitForURL(url => url.pathname === "/mfa/verify"); await page.locator("h1").waitFor(); await page.getByRole("textbox", { name: "Mã xác thực" }).waitFor(); await shot("yeu-cau-mfa", "PIN đúng — vẫn phải hoàn tất MFA của phiên");
  }),
];
