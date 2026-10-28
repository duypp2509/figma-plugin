import { pinFlow, openSettings, lockNow, unlock, PIN } from "../_helpers/superplatform-screen-lock";
export default [
  pinFlow("khoa-mo-thu-cong", "KHÓA THỦ CÔNG VÀ MỞ KHÓA", async ({ page, shot }) => {
    await openSettings(page); await shot("dang-lam-viec", "Màn hình làm việc trước khi khóa"); await lockNow(page); await shot("da-khoa", "Khóa ngay — nội dung làm việc được che");
    await page.getByLabel("Mã PIN", { exact: true }).fill("028"); await shot("chua-du-pin", "Chưa đủ 6 số — nút mở khóa bị vô hiệu hóa");
    await page.getByLabel("Mã PIN", { exact: true }).fill(PIN); await shot("du-pin", "Nhập đủ PIN để mở khóa"); await unlock(page); await page.getByRole("button", { name: "Khóa ngay", exact: true }).waitFor(); await shot("da-mo", "Mở khóa thành công và trở lại công việc");
  }),
  pinFlow("sai-pin-nam-lan", "NHẬP SAI PIN VÀ KẾT THÚC PHIÊN", async ({ page, shot, mock }) => {
    await openSettings(page); await shot("dang-lam-viec", "Màn hình làm việc trước khi khóa");
    await lockNow(page); await shot("da-khoa", "Khóa ngay — phải nhập PIN để tiếp tục");
    for (let i = 1; i <= 5; i++) { await unlock(page, "938472"); if (i < 5) { await page.getByText(`Còn ${5-i} lần thử${i === 4 ? " trước khi đăng xuất" : ""}.`, { exact: true }).waitFor(); await shot(`sai-${i}`, `Sai PIN lần ${i} — còn ${5-i} lần thử`); } }
    await page.waitForURL(url => url.pathname === "/"); await page.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor(); await shot("sai-lan-5", "Sai lần 5 — phiên bị thu hồi, phải đăng nhập lại");
    if (!mock.ended) throw new Error("Fifth failure must end the session");
  }),
  pinFlow("loi-mo-khoa-1", "NHẬP PIN QUÁ NHANH — TẠM KHÓA NHẬP PIN", async ({ page, shot, mock }) => {
    await openSettings(page); await shot("dang-lam-viec", "Màn hình làm việc trước khi khóa");
    await lockNow(page); await shot("da-khoa", "Khóa ngay — phải nhập PIN để tiếp tục");
    await unlock(page, "938472"); await page.getByText("Còn 4 lần thử.", { exact: true }).waitFor(); await shot("sai-pin", "Sai PIN — còn 4 lần thử");
    // The server spaces out the guesses: an attempt right after a wrong one is refused with a wait.
    mock.unlockError = "PIN_RATE_LIMITED"; await unlock(page);
    const notice = page.getByRole("alertdialog", { name: "Tạm khóa nhập PIN" });
    await notice.getByText("Vui lòng chờ rồi thử lại.", { exact: true }).waitFor(); await shot("loi", "Thử lại quá nhanh — tạm khóa nhập PIN");
    await notice.getByRole("button", { name: "Đã hiểu", exact: true }).click(); await notice.waitFor({ state: "hidden" });
    await page.getByRole("button", { name: /^Thử lại sau \d+ giây$/ }).waitFor(); await shot("dem-nguoc", "Đếm ngược trên nút — chờ hết thời gian rồi nhập lại");
  }),
  pinFlow("quen-pin", "QUÊN PIN VÀ ĐĂNG NHẬP LẠI", async ({ page, shot }) => {
    await openSettings(page); await shot("dang-lam-viec", "Màn hình làm việc trước khi khóa");
    await lockNow(page); await shot("da-khoa", "Màn hình đã khóa — chọn Quên PIN");
    await page.getByRole("button", { name: "Quên PIN", exact: true }).click(); await page.getByRole("heading", { name: "Đặt lại mã PIN" }).waitFor(); await shot("xac-nhan", "Quên PIN — đăng nhập lại, cảnh báo mất bản nháp");
    await page.getByRole("button", { name: "Quay lại", exact: true }).click(); await page.getByRole("heading", { name: "Màn hình đã khóa" }).waitFor(); await shot("quay-lai", "Quay lại nhập PIN");
    await page.getByRole("button", { name: "Quên PIN", exact: true }).click(); await page.getByRole("button", { name: "Đăng nhập lại", exact: true }).click(); await page.waitForURL(url => url.pathname === "/"); await page.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor(); await shot("dang-nhap", "Kết thúc phiên để đăng nhập lại và đặt PIN mới");
  }),
  pinFlow("dang-xuat", "ĐĂNG XUẤT KHI ĐANG KHÓA", async ({ page, shot }) => {
    await openSettings(page); await shot("dang-lam-viec", "Màn hình làm việc trước khi khóa");
    await lockNow(page); await shot("da-khoa", "Màn hình đã khóa — chọn Đăng xuất");
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click(); await page.getByRole("heading", { name: "Đăng xuất?", exact: true }).waitFor(); await shot("xac-nhan", "Xác nhận đăng xuất — cảnh báo bản nháp");
    await page.getByRole("button", { name: "Xác nhận đăng xuất", exact: true }).click(); await page.waitForURL(url => url.pathname === "/"); await page.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor(); await shot("thanh-cong", "Máy chủ xác nhận đăng xuất — trở về đăng nhập");
  }),
  pinFlow("tai-lai-khi-khoa", "TẢI LẠI TRANG KHI ĐANG KHÓA", async ({ page, shot, mock }) => {
    await openSettings(page); await shot("dang-lam-viec", "Màn hình làm việc trước khi khóa");
    await lockNow(page); await shot("da-khoa", "Khóa ngay — nội dung làm việc được che");
    await page.reload(); await page.getByRole("heading", { name: "Màn hình đã khóa" }).waitFor(); await shot("reload", "Tải lại trang vẫn yêu cầu PIN");
    // The session ends elsewhere (signed out on another device, or expired) while this tab waits on the lock.
    mock.ended = true; await page.evaluate(() => window.dispatchEvent(new Event("screen-lock:required"))); await page.waitForURL(url => url.pathname === "/"); await page.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor(); await shot("het-phien", "Phiên hết hạn hoặc bị thu hồi — đăng nhập lại");
  }),
  pinFlow("tu-khoa", "TỰ KHÓA KHI KHÔNG THAO TÁC", async ({ page, shot, mock }) => {
    mock.timeout = 10; await openSettings(page); await page.getByText("Sau 10 giây", { exact: true }).waitFor(); await shot("thoi-gian", "Tự khóa sau 10 giây không thao tác");
    await page.getByRole("heading", { name: "Màn hình đã khóa" }).waitFor(); await shot("tu-khoa", "Đến hạn không thao tác — màn hình tự khóa");
    if (!mock.reasons.includes("IDLE")) throw new Error("Expected IDLE lock");
    await unlock(page); await page.getByRole("button", { name: "Khóa ngay", exact: true }).waitFor(); await shot("mo-lai", "Nhập PIN để tiếp tục sau khi tự khóa");
  }),
];
