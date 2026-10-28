import { shopPinFlow, openShopPin, lockNow, unlock, loginReady, PIN } from "../_helpers/supership-screen-lock";

export default [
  shopPinFlow("khoa-mo", "06. KHÓA VÀ MỞ KHÓA", async ({ page, shot }) => {
    await openShopPin(page); await shot("dang-lam-viec", "Cài đặt khóa màn hình đang bật");
    await lockNow(page); await shot("da-khoa", "Khóa ngay — che nội dung làm việc");
    await page.getByLabel("Mã PIN", { exact: true }).fill(PIN); await shot("nhap-pin", "Nhập mã PIN để tiếp tục");
    await unlock(page); await page.getByRole("button", { name: "Khóa ngay", exact: true }).waitFor(); await shot("da-mo", "PIN đúng — trở lại màn hình làm việc");
  }),
  shopPinFlow("sai-pin", "07. NHẬP SAI PIN", async ({ page, shot }) => {
    await openShopPin(page); await lockNow(page);
    for (let i = 1; i <= 5; i++) {
      await unlock(page, "938472");
      if (i < 5) await page.getByText(`Còn ${5-i} lần thử${i === 4 ? " trước khi đăng xuất" : ""}.`, { exact: true }).waitFor();
      if (i === 1) await shot("sai-pin", "PIN chưa đúng — còn 4 lần thử");
      if (i === 4) await shot("lan-cuoi", "Còn 1 lần thử trước khi đăng xuất");
    }
    await loginReady(page); await shot("dang-nhap-lai", "Sai lần thứ 5 — cần đăng nhập lại");
  }),
  shopPinFlow("quen-pin", "08. QUÊN PIN", async ({ page, shot }) => {
    await openShopPin(page); await lockNow(page); await page.getByRole("button", { name: "Quên PIN", exact: true }).click();
    await page.getByRole("heading", { name: "Đặt lại mã PIN", exact: true }).waitFor(); await shot("xac-nhan", "Quên PIN — đăng nhập lại để đặt mã mới");
    await page.getByRole("button", { name: "Đăng nhập lại", exact: true }).click(); await loginReady(page); await shot("dang-nhap", "Kết thúc phiên và chuyển đến đăng nhập");
  }),
  shopPinFlow("tu-khoa", "09. TỰ KHÓA KHI RỜI MÁY", async ({ page, shot, mock }) => {
    mock.timeout = 10; await openShopPin(page); await page.getByText("Sau 10 giây", { exact: true }).waitFor();
    await page.getByRole("heading", { name: "Màn hình đã khóa" }).waitFor(); await shot("tu-khoa", "Không thao tác đến hạn — tự khóa màn hình");
    if (!mock.reasons.includes("IDLE")) throw new Error("Expected idle lock");
    await unlock(page); await page.getByRole("button", { name: "Khóa ngay", exact: true }).waitFor(); await shot("mo-lai", "Nhập PIN để tiếp tục làm việc");
  }),
];
