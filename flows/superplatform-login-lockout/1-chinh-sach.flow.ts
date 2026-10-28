import { attempts, codeDialog, codeField, dialog, editButton, enterCode, expect, fillPolicy, lockoutFlow, MESSAGES, minutes, openEdit,
  openPolicy, reason, save } from "../_helpers/superplatform-login-lockout";

export default [
  lockoutFlow("sua", "XEM VÀ SỬA KHÓA ĐĂNG NHẬP", async ({ page, shot }) => {
    await openPolicy(page); await page.getByText("Đang dùng mặc định của hệ thống.", { exact: true }).waitFor();
    await shot("mac-dinh", "Mặc định: sai 5 lần thì khóa đăng nhập từ IP đó 15 phút");
    await openEdit(page); await shot("form", "Sửa số lần nhập sai và thời gian khóa");
    await fillPolicy(page, "10", "90"); await expect(save(page)).toBeEnabled();
    await shot("da-nhap", "Nhập 10 lần, 90 phút và lý do thay đổi");
    await save(page).click(); await codeField(page).waitFor();
    await shot("xac-nhan", "Nhập mã xác thực để xác nhận thay đổi");
    await enterCode(page); await page.getByText(MESSAGES.saved, { exact: true }).first().waitFor();
    await page.getByText("1 giờ 30 phút", { exact: true }).waitFor();
    await shot("thanh-cong", "Đã lưu: 10 lần, khóa 1 giờ 30 phút — ghi người sửa và phiên bản");
  }),
  lockoutFlow("gioi-han", "KIỂM TRA GIỚI HẠN NHẬP", async ({ page, shot }) => {
    await openPolicy(page); await page.getByText("Đang dùng mặc định của hệ thống.", { exact: true }).waitFor();
    await shot("mac-dinh", "Mặc định: sai 5 lần thì khóa đăng nhập từ IP đó 15 phút");
    await openEdit(page); await shot("form", "Bấm Sửa — mở hộp Sửa khóa đăng nhập");
    await reason(page).fill("Rà soát lại chính sách khóa đăng nhập.");
    for (const [id, tries, lock, hint, title] of [
      ["it-lan", "2", "15", MESSAGES.attempts, "Dưới 3 lần — nút Lưu bị khóa"],
      ["nhieu-lan", "21", "15", MESSAGES.attempts, "Trên 20 lần — nút Lưu bị khóa"],
      ["it-phut", "5", "0", MESSAGES.minutes, "Dưới 1 phút — nút Lưu bị khóa"],
      ["nhieu-phut", "5", "1441", MESSAGES.minutes, "Trên 1440 phút (1 ngày) — nút Lưu bị khóa"],
    ] as const) {
      await attempts(page).fill(tries); await minutes(page).fill(lock);
      await dialog(page).getByText(hint, { exact: true }).waitFor(); await expect(save(page)).toBeDisabled();
      await shot(id, title);
    }
    await attempts(page).fill("3"); await minutes(page).fill("1440"); await reason(page).fill("");
    await expect(save(page)).toBeDisabled(); await shot("thieu-ly-do", "Số liệu hợp lệ nhưng chưa nhập lý do");
    await reason(page).fill("Rà soát lại chính sách khóa đăng nhập."); await expect(save(page)).toBeEnabled();
    await shot("hop-le", "3 lần và 1440 phút — giới hạn hợp lệ, nút Lưu bật");
  }),
  lockoutFlow("huy-xac-nhan", "NHẬP SAI MÃ VÀ HỦY XÁC NHẬN", async ({ page, shot, mock }) => {
    await openPolicy(page); await page.getByText("Đang dùng mặc định của hệ thống.", { exact: true }).waitFor();
    await shot("mac-dinh", "Mặc định: sai 5 lần thì khóa đăng nhập từ IP đó 15 phút");
    await openEdit(page); await shot("form", "Bấm Sửa — mở hộp Sửa khóa đăng nhập");
    await fillPolicy(page, "6", "30"); await expect(save(page)).toBeEnabled(); await shot("da-nhap", "Nhập 6 lần, 30 phút và lý do thay đổi");
    await save(page).click(); await codeField(page).waitFor(); await shot("xac-nhan", "Bấm Lưu — nhập mã xác thực để xác nhận");
    await enterCode(page, "111111"); await page.getByText(MESSAGES.wrongCode).first().waitFor();
    await shot("sai-ma", "Mã xác thực sai — báo ngay dưới ô mã, chưa lưu");
    // The code dialog has no "Hủy": closing it (X or Esc) cancels the save.
    await page.keyboard.press("Escape"); await codeDialog(page).waitFor({ state: "hidden" }); await expect(attempts(page)).toHaveValue("6");
    await shot("huy", "Hủy xác nhận — giữ số liệu đã nhập, chính sách chưa đổi");
    expect(mock.writes).toBe(0);
  }),
  lockoutFlow("chi-xem", "NGƯỜI DÙNG CHỈ CÓ QUYỀN XEM", async ({ page, shot }) => {
    await openPolicy(page); await page.getByText("Sửa lần cuối:", { exact: false }).waitFor();
    await expect(editButton(page)).toHaveCount(0);
    await shot("chi-xem", "Chỉ xem số lần sai và thời gian khóa — không có nút Sửa");
  }, { canUpdate: false, start: { max_attempts: 8, lockout_seconds: 1800, set_by_name: "Nguyễn Minh Anh", set_at: "2026-10-12T02:00:00.000Z", version: 2 } }),
];
