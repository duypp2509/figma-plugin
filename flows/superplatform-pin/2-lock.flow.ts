import { pinFlow, openSettings, lockNow, unlock, PIN, SECURITY_URL } from "../_helpers/superplatform-screen-lock";
export default [
  pinFlow("khoa-mo-thu-cong", "09. KHÓA THỦ CÔNG VÀ MỞ KHÓA", async ({ page, shot }) => {
    await openSettings(page); await shot("dang-lam-viec", "Màn hình làm việc trước khi khóa"); await lockNow(page); await shot("da-khoa", "Khóa ngay — nội dung làm việc được che");
    await page.getByLabel("Mã PIN", { exact: true }).fill("028"); await shot("chua-du-pin", "Chưa đủ 6 số — nút mở khóa bị vô hiệu hóa");
    await page.getByLabel("Mã PIN", { exact: true }).fill(PIN); await shot("du-pin", "Nhập đủ PIN để mở khóa"); await unlock(page); await page.getByRole("button", { name: "Khóa ngay", exact: true }).waitFor(); await shot("da-mo", "Mở khóa thành công và trở lại công việc");
  }),
  pinFlow("sai-pin-nam-lan", "10. NHẬP SAI PIN VÀ KẾT THÚC PHIÊN", async ({ page, shot, mock }) => {
    await openSettings(page); await lockNow(page);
    for (let i = 1; i <= 5; i++) { await unlock(page, "938472"); if (i < 5) { await page.getByText(`Còn ${5-i} lần thử${i === 4 ? " trước khi đăng xuất" : ""}.`, { exact: true }).waitFor(); await shot(`sai-${i}`, `Sai PIN lần ${i} — còn ${5-i} lần thử`); } }
    await page.waitForURL(url => url.pathname === "/"); await page.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor(); await shot("sai-lan-5", "Sai lần 5 — phiên bị thu hồi, phải đăng nhập lại");
    if (!mock.ended) throw new Error("Fifth failure must end the session");
  }),
  ...["PIN_RATE_LIMITED", "LOCK_STATE_CHANGED", "SCREEN_LOCK_UNAVAILABLE"].map((error, i) => pinFlow(`loi-mo-khoa-${i + 1}`, `11.${i+1}. MỞ KHÓA — ${error}`, async ({ page, shot, mock }) => {
    await openSettings(page); await lockNow(page); mock.unlockError = error; await unlock(page);
    const message = error === "PIN_RATE_LIMITED" ? "Vui lòng chờ rồi thử lại." : error === "LOCK_STATE_CHANGED" ? "Trạng thái đã thay đổi. Vui lòng thử lại." : "Chưa thể xác minh PIN. Vui lòng thử lại sau.";
    await page.getByText(message, { exact: true }).waitFor(); await shot("loi", error === "PIN_RATE_LIMITED" ? "Giới hạn thử PIN — chờ trước khi thử lại" : error === "LOCK_STATE_CHANGED" ? "Trạng thái thay đổi — đọc lại từ máy chủ" : "Dịch vụ xác minh PIN chưa khả dụng");
  })),
  pinFlow("mat-mang-mo-khoa", "12. MẤT KẾT NỐI VÀ THỬ LẠI CÙNG LẦN NHẬP", async ({ page, shot, mock }) => {
    await openSettings(page); await lockNow(page); mock.offline = "/unlock"; await unlock(page); await page.getByText("Mất kết nối. Thử lại để kiểm tra kết quả của lần nhập này.").waitFor(); await shot("mat-mang", "Mất kết nối — giữ màn khóa và cho thử lại");
    mock.offline = ""; await unlock(page); await page.getByRole("button", { name: "Khóa ngay", exact: true }).waitFor(); await shot("ket-noi-lai", "Kết nối lại và mở khóa thành công");
    if (mock.attempts.length !== 2 || mock.attempts[0] !== mock.attempts[1]) throw new Error("Network retry must keep attempt_id");
  }),
  pinFlow("mat-mang-khi-khoa", "13. CHỜ KHÓA TRÊN MÁY CHỦ VÀ LỖI MẠNG", async ({ page, shot, mock }) => {
    await openSettings(page); mock.offline = "/lock"; await page.getByRole("button", { name: "Khóa ngay", exact: true }).click(); await page.getByText("Không thể kiểm tra phiên. Vui lòng kết nối mạng và thử lại.").waitFor(); await shot("cho-khoa", "Che nội dung khi chưa xác nhận khóa do mất mạng");
    mock.offline = ""; await page.getByRole("button", { name: "Thử lại", exact: true }).click(); await page.getByRole("heading", { name: "Màn hình đã khóa" }).waitFor(); await shot("da-khoa", "Kết nối lại — máy chủ xác nhận đã khóa");
  }),
  pinFlow("quen-pin", "14. QUÊN PIN VÀ ĐĂNG NHẬP LẠI", async ({ page, shot }) => {
    await openSettings(page); await lockNow(page); await page.getByRole("button", { name: "Quên PIN", exact: true }).click(); await page.getByRole("heading", { name: "Đặt lại mã PIN" }).waitFor(); await shot("xac-nhan", "Quên PIN — đăng nhập lại, cảnh báo mất bản nháp");
    await page.getByRole("button", { name: "Quay lại", exact: true }).click(); await page.getByRole("heading", { name: "Màn hình đã khóa" }).waitFor(); await shot("quay-lai", "Quay lại nhập PIN");
    await page.getByRole("button", { name: "Quên PIN", exact: true }).click(); await page.getByRole("button", { name: "Đăng nhập lại", exact: true }).click(); await page.waitForURL(url => url.pathname === "/"); await page.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor(); await shot("dang-nhap", "Kết thúc phiên để đăng nhập lại và đặt PIN mới");
  }),
  pinFlow("dang-xuat", "15. ĐĂNG XUẤT KHI ĐANG KHÓA", async ({ page, shot, mock }) => {
    await openSettings(page); await lockNow(page); await page.getByRole("button", { name: "Đăng xuất", exact: true }).click(); await page.getByRole("heading", { name: "Đăng xuất?", exact: true }).waitFor(); await shot("xac-nhan", "Xác nhận đăng xuất — cảnh báo bản nháp");
    mock.logoutFail = true; await page.getByRole("button", { name: "Xác nhận đăng xuất", exact: true }).click(); await page.getByText("Chưa thể đăng xuất trên máy chủ. Vui lòng kết nối lại và thử tiếp.").waitFor(); await shot("loi-mang", "Đăng xuất lỗi mạng — giữ màn khóa");
    mock.logoutFail = false; await page.getByRole("button", { name: "Xác nhận đăng xuất", exact: true }).click(); await page.waitForURL(url => url.pathname === "/"); await page.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor(); await shot("thanh-cong", "Máy chủ xác nhận đăng xuất — trở về đăng nhập");
  }),
  pinFlow("tai-lai-khi-khoa", "16. TẢI LẠI TRANG VÀ MỞ TAB KHI ĐANG KHÓA", async ({ page, shot, mock }) => {
    await openSettings(page); await lockNow(page); await page.reload(); await page.getByRole("heading", { name: "Màn hình đã khóa" }).waitFor(); await shot("reload", "Tải lại trang vẫn yêu cầu PIN");
    await page.evaluate(() => sessionStorage.removeItem("screen-lock:superplatform-admin:backdrop")); await page.reload(); await page.getByRole("heading", { name: "Màn hình đã khóa" }).waitFor(); await shot("khong-ban-chup-cu", "Tải lại khi không có bản chụp nền cũ");
    mock.ended = true; await page.evaluate(() => window.dispatchEvent(new Event("screen-lock:required"))); await page.waitForURL(url => url.pathname === "/"); await page.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor(); await shot("het-phien", "Phiên hết hạn hoặc bị thu hồi — đăng nhập lại");
  }),
  pinFlow("tu-khoa", "17. TỰ KHÓA KHI KHÔNG THAO TÁC", async ({ page, shot, mock }) => {
    mock.timeout = 10; await openSettings(page); await page.getByText("Sau 10 giây", { exact: true }).waitFor(); await shot("thoi-gian", "Tự khóa sau 10 giây không thao tác");
    await page.getByRole("heading", { name: "Màn hình đã khóa" }).waitFor(); await shot("tu-khoa", "Đến hạn không thao tác — màn hình tự khóa");
    if (!mock.reasons.includes("IDLE")) throw new Error("Expected IDLE lock");
    await unlock(page); await page.getByRole("button", { name: "Khóa ngay", exact: true }).waitFor(); await shot("mo-lai", "Nhập PIN để tiếp tục sau khi tự khóa");
  }),
];

