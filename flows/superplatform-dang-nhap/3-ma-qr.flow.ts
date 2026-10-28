import { FULL_NAME, at, chooseUnit, enterUnit, loginFlow, openLogin, pickerHeading } from "../_helpers/superplatform-login";

/*
 * Sign-in by QR code (QrLoginController): the computer shows a code, the signed-in SuperShip app scans it and the person
 * chooses "Đăng nhập" there. The flow plays the phone's part by moving the request on; the page polls it.
 */
const REQUEST_ID = "6b2f4d8e-1c3a-4e5f-9a7b-0d2c4e6f8a13";

export default [
  loginFlow("ma-qr-hien-ma", ["SUPERPLATFORM", "ĐĂNG NHẬP", "ĐĂNG NHẬP BẰNG MÃ QR"], "ĐĂNG NHẬP BẰNG MÃ QR", async ({ page, shot, mock }) => {
    let status: "PENDING" | "SCANNED" | "APPROVED" = "PENDING";
    const request = () => ({ id: REQUEST_ID, status, qr_payload: status === "PENDING" ? `SSQR1:${REQUEST_ID}` : undefined,
      expires_at: at(60), server_time: at(0), account: status === "PENDING" ? null : { display_name: FULL_NAME, has_avatar: false } });
    mock.on("GET", "/v1/auth/qr-login/settings", () => ({ data: { enabled: true, phone_approval: true, poll_interval_ms: 1000 } }));
    mock.on("POST", "/v1/auth/qr-login", () => ({ data: request() }));
    mock.on("GET", `/v1/auth/qr-login/${REQUEST_ID}`, () => ({ data: request() }));
    mock.on("DELETE", `/v1/auth/qr-login/${REQUEST_ID}`, () => ({ data: null }));

    await openLogin(page);
    const qrButton = page.getByRole("button", { name: "Đăng nhập bằng mã QR", exact: true });
    await qrButton.waitFor();
    await shot("form", "Màn đăng nhập");
    await qrButton.click();
    const dialog = page.getByRole("dialog", { name: "Đăng nhập bằng mã QR" });
    await dialog.getByText("Thời gian còn lại", { exact: false }).waitFor();
    await dialog.locator("svg").first().waitFor();
    await page.mouse.move(0, 0);
    await shot("ma-qr", "Mã QR để quét bằng ứng dụng SuperShip");
    // The phone scanned the code.
    status = "SCANNED";
    await dialog.getByText("Vui lòng chọn Đăng nhập trên ứng dụng để tiếp tục.", { exact: true }).waitFor();
    await dialog.getByText(FULL_NAME, { exact: true }).waitFor();
    await shot("da-quet", "Điện thoại đã quét mã, chờ chọn Đăng nhập trên ứng dụng");
    // "Đăng nhập" chosen on the phone: the computer gets its session, with the phone's MFA.
    status = "APPROVED";
    await pickerHeading(page).waitFor();
    await shot("chon-don-vi", "Đã đăng nhập, chọn đơn vị làm việc");
    await chooseUnit(page);
    await enterUnit(page);
    await shot("trang-chu", "Vào trang chủ của đơn vị");
  }),
];
