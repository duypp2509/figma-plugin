import { loginFlow, openLogin } from "../_helpers/superplatform-login";

// The web only shows a fixed QR picture for now (AlternativeLoginMethods): nothing is asked of the server.
export default [
  loginFlow("ma-qr-hien-ma", ["SUPERPLATFORM", "ĐĂNG NHẬP", "ĐĂNG NHẬP BẰNG MÃ QR"], "01. HIỆN MÃ QR ĐĂNG NHẬP", async ({ page, shot }) => {
    await openLogin(page);
    await page.getByRole("button", { name: "Đăng nhập bằng mã QR", exact: true }).and(page.locator(":enabled")).click();
    await page.getByRole("img", { name: "Mã QR đăng nhập SuperPlatform" }).waitFor();
    await page.getByText("Đang chờ xác nhận").waitFor();
    await page.waitForFunction(() => Array.from(document.images).every(image => image.complete && image.naturalWidth > 0));
    await shot("ma-qr", "Mã QR để quét bằng ứng dụng SuperShip, chờ xác nhận trên điện thoại");
  }),
];
