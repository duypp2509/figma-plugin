import { expect } from "playwright/test";
import { policyFlow, openPolicy, createPolicy, selectOrg, fillPolicy, minutes, save, waitMfa, mfaCode, verifyPolicy, saved, OFFICE, PARTNER } from "../_helpers/superplatform-idle-policy";

export default [
  policyFlow("dat-moi", "ĐẶT THỜI GIAN TỰ ĐĂNG XUẤT CHO TỔ CHỨC", async ({ page, shot }) => {
    await openPolicy(page); await page.getByText("Chưa có cấu hình riêng", { exact: true }).waitFor();
    await shot("mac-dinh", "Chưa đặt riêng — các tổ chức theo mặc định 30 phút");
    await createPolicy(page); await shot("form", "Chọn tổ chức và thời gian — mặc định áp cả đơn vị cấp dưới");
    await page.getByLabel("Tìm tổ chức", { exact: true }).fill("Bưu cục");
    await page.getByRole("button", { name: new RegExp(OFFICE) }).waitFor();
    await shot("tim-to-chuc", "Tìm tổ chức nội bộ theo tên hoặc mã");
    await fillPolicy(page); await shot("hop-le", "Chọn bưu cục và nhập 10 phút — nút Lưu đã bật");
    await save(page).click(); await waitMfa(page); await shot("mfa", "Xác thực MFA trước khi lưu chính sách");
    await verifyPolicy(page); await saved(page); await shot("thanh-cong", "Đã lưu 10 phút và áp cho cả đơn vị cấp dưới");
  }),
  policyFlow("chi-to-chuc", "CHỈ ÁP CHO TỔ CHỨC ĐƯỢC CHỌN", async ({ page, shot }) => {
    await openPolicy(page); await page.getByText("Chưa có cấu hình riêng", { exact: true }).waitFor(); await shot("mac-dinh", "Chưa đặt riêng — các tổ chức theo mặc định 30 phút");
    await createPolicy(page); await shot("form", "Bấm Thêm tổ chức — mở hộp Đặt cho tổ chức");
    await fillPolicy(page, "15", PARTNER);
    await page.getByRole("checkbox", { name: "Áp cho cả đơn vị cấp dưới" }).uncheck();
    await shot("khong-ap-cap-duoi", "Đặt 15 phút cho nhượng quyền — bỏ áp đơn vị cấp dưới");
    await save(page).click(); await waitMfa(page); await shot("mfa", "Xác thực thay đổi phạm vi áp dụng");
    await verifyPolicy(page); await saved(page); await shot("thanh-cong", "Đã lưu — phạm vi chỉ áp cho tổ chức này");
  }),
  policyFlow("nhap-lieu", "CHỌN TỔ CHỨC VÀ KIỂM TRA GIỚI HẠN THỜI GIAN", async ({ page, shot }) => {
    await openPolicy(page); await page.getByText("Chưa có cấu hình riêng", { exact: true }).waitFor(); await shot("mac-dinh", "Chưa đặt riêng — các tổ chức theo mặc định 30 phút");
    await createPolicy(page); await shot("form", "Bấm Thêm tổ chức — mở hộp Đặt cho tổ chức");
    await minutes(page).fill("10"); await expect(save(page)).toBeDisabled();
    await shot("chua-chon", "Đã nhập thời gian nhưng chưa chọn tổ chức — chưa được lưu");
    await page.getByLabel("Tìm tổ chức", { exact: true }).fill("Không tồn tại");
    await page.getByText("Không tìm thấy tổ chức phù hợp.", { exact: true }).waitFor();
    await shot("khong-tim-thay", "Không tìm thấy tổ chức khớp tên hoặc mã");
    await page.getByLabel("Tìm tổ chức", { exact: true }).fill("Shop");
    await page.getByText("Không tìm thấy tổ chức phù hợp.", { exact: true }).waitFor();
    await expect(page.getByRole("button", { name: /Shop Khả Ái/ })).toHaveCount(0);
    await shot("shop-khong-ap", "Shop không thuộc tổ chức được đặt chính sách web quản trị");
    await selectOrg(page); await minutes(page).fill(""); await expect(save(page)).toBeDisabled();
    await shot("thieu-thoi-gian", "Đã chọn tổ chức nhưng chưa nhập thời gian");
    for (const [id, value, title] of [
      ["qua-ngan", "4", "Dưới 5 phút — nút Lưu bị khóa"],
      ["qua-dai", "31", "Trên mặc định 30 phút — nút Lưu bị khóa"],
      ["so-le", "10.5", "Số phút phải là số nguyên"],
    ] as const) { await minutes(page).fill(value); await expect(save(page)).toBeDisabled(); await shot(id, title); }
    await minutes(page).fill("5"); await expect(save(page)).toBeEnabled(); await shot("toi-thieu", "5 phút — giới hạn tối thiểu hợp lệ");
    await minutes(page).fill("30"); await expect(save(page)).toBeEnabled(); await shot("toi-da", "30 phút — giới hạn tối đa hợp lệ");
    await page.getByRole("button", { name: "Đổi", exact: true }).click();
    await page.getByLabel("Tìm tổ chức", { exact: true }).waitFor(); await expect(save(page)).toBeDisabled();
    await shot("doi-to-chuc", "Đổi tổ chức — giữ số phút và yêu cầu chọn lại tổ chức");
  }),
  policyFlow("huy", "HỦY THIẾT LẬP VÀ HỦY XÁC THỰC", async ({ page, shot, mock }) => {
    await openPolicy(page); await page.getByText("Chưa có cấu hình riêng", { exact: true }).waitFor(); await shot("mac-dinh", "Chưa đặt riêng — các tổ chức theo mặc định 30 phút");
    await createPolicy(page); await shot("form", "Bấm Thêm tổ chức — mở hộp Đặt cho tổ chức");
    await fillPolicy(page);
    await shot("da-nhap", "Đã nhập đủ thông tin nhưng chưa lưu");
    await page.getByRole("button", { name: "Hủy", exact: true }).click();
    await page.getByLabel("Tìm tổ chức", { exact: true }).waitFor({ state: "hidden" });
    await shot("huy-form", "Hủy thiết lập — danh sách vẫn chưa có cấu hình riêng");
    await createPolicy(page); await fillPolicy(page); await save(page).click(); await waitMfa(page);
    await shot("mfa", "Có thể hủy xác thực trước khi chính sách được lưu");
    await page.keyboard.press("Escape"); await expect(save(page)).toBeEnabled();
    await shot("huy-mfa", "Hủy MFA — giữ tổ chức và thời gian, chưa lưu chính sách");
    expect(mock.writes).toBe(0);
  }),
  policyFlow("sua", "SỬA THỜI GIAN VÀ PHẠM VI ÁP DỤNG", async ({ page, shot, mock }) => {
    await openPolicy(page); await shot("danh-sach", "Tổ chức đã có cấu hình 10 phút, áp cấp dưới");
    await page.getByRole("button", { name: `Sửa thời gian tự đăng xuất của ${OFFICE}`, exact: true }).click();
    await expect(minutes(page)).toHaveValue("10"); await shot("form", "Sửa — điền sẵn tổ chức, số phút và phạm vi");
    await minutes(page).fill("5"); await page.getByRole("checkbox", { name: "Áp cho cả đơn vị cấp dưới" }).uncheck();
    await shot("thay-doi", "Đổi thành 5 phút và chỉ áp cho bưu cục này");
    await save(page).click(); await waitMfa(page); await shot("mfa", "Mỗi lần sửa chính sách cần xác thực MFA");
    await verifyPolicy(page); await saved(page); await shot("thanh-cong", "Đã thay cấu hình cũ — mỗi tổ chức vẫn chỉ một dòng");
    expect(mock.items).toHaveLength(1); expect(mock.items[0]!.idle_timeout_minutes).toBe(5);
  }, true),
  policyFlow("ma-du-phong", "MFA SAI VÀ XÁC THỰC BẰNG MÃ DỰ PHÒNG", async ({ page, shot }) => {
    await openPolicy(page); await page.getByText("Chưa có cấu hình riêng", { exact: true }).waitFor(); await shot("mac-dinh", "Chưa đặt riêng — các tổ chức theo mặc định 30 phút");
    await createPolicy(page); await shot("form", "Bấm Thêm tổ chức — mở hộp Đặt cho tổ chức");
    await fillPolicy(page); await shot("da-nhap", "Chọn bưu cục và nhập 10 phút");
    await save(page).click(); await waitMfa(page); await shot("mfa", "Bấm Lưu — xác thực MFA trước khi lưu");
    await mfaCode(page).fill("123");
    await expect(page.getByRole("button", { name: "Xác thực MFA và tiếp tục" })).toBeDisabled();
    await shot("thieu-ma", "Chưa đủ 6 số — chưa thể xác thực");
    await mfaCode(page).fill("999999");
    await page.getByRole("button", { name: "Xác thực MFA và tiếp tục", exact: true }).click();
    await page.getByText("Mã xác thực không đúng hoặc đã được sử dụng.", { exact: true }).waitFor();
    await shot("ma-sai", "Mã MFA sai hoặc đã sử dụng — chưa lưu chính sách");
    await page.getByRole("button", { name: "Không dùng được ứng dụng xác thực? Dùng mã dự phòng", exact: true }).click();
    await page.getByRole("textbox", { name: "Mã dự phòng", exact: true }).waitFor();
    await shot("du-phong", "Có thể dùng mã dự phòng một lần thay ứng dụng xác thực");
    await verifyPolicy(page, true); await saved(page); await shot("thanh-cong", "Xác thực bằng mã dự phòng và lưu thành công");
  }),
  policyFlow("go", "GỠ CẤU HÌNH RIÊNG VÀ TRỞ VỀ MẶC ĐỊNH", async ({ page, shot, mock }) => {
    await openPolicy(page); await shot("danh-sach", "Bưu cục đang có thời gian riêng 10 phút");
    const remove = page.getByRole("button", { name: `Gỡ thời gian tự đăng xuất của ${OFFICE}`, exact: true });
    await remove.click(); await page.getByRole("heading", { name: "Gỡ thời gian riêng", exact: true }).waitFor();
    await shot("xac-nhan", "Xác nhận gỡ cấu hình riêng của tổ chức");
    await page.getByRole("button", { name: "Hủy", exact: true }).click(); await expect(remove).toBeVisible();
    await shot("huy", "Hủy gỡ — cấu hình 10 phút vẫn được giữ");
    await remove.click(); await page.getByRole("button", { name: "Gỡ", exact: true }).click(); await waitMfa(page);
    await shot("mfa", "Gỡ cấu hình cũng cần xác thực MFA");
    await verifyPolicy(page); await page.getByText("Đã gỡ thời gian tự đăng xuất riêng.", { exact: true }).waitFor();
    await page.getByText("Chưa có cấu hình riêng", { exact: true }).waitFor();
    await shot("thanh-cong", "Đã gỡ — tổ chức trở về mặc định nền tảng 30 phút"); expect(mock.items).toHaveLength(0);
  }, true),
  policyFlow("chi-xem", "NGƯỜI DÙNG CHỈ CÓ QUYỀN XEM", async ({ page, shot, mock }) => {
    mock.update = false; await openPolicy(page);
    await expect(page.getByRole("button", { name: "Thêm tổ chức", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: `Sửa thời gian tự đăng xuất của ${OFFICE}`, exact: true })).toBeDisabled();
    await shot("chi-xem", "Có quyền xem — xem mặc định và danh sách, không được đặt, sửa, gỡ");
  }, true),
  policyFlow("chua-mfa", "CẦN THIẾT LẬP MFA TRƯỚC KHI LƯU", async ({ page, shot, mock }) => {
    mock.pin.enrolled = false; await openPolicy(page); await page.getByText("Chưa có cấu hình riêng", { exact: true }).waitFor(); await shot("mac-dinh", "Chưa đặt riêng — các tổ chức theo mặc định 30 phút");
    await createPolicy(page); await shot("form", "Bấm Thêm tổ chức — mở hộp Đặt cho tổ chức");
    await fillPolicy(page); await shot("da-nhap", "Chọn bưu cục và nhập 10 phút");
    await save(page).click();
    await page.getByText("Tài khoản chưa bật MFA. Bạn cần liên kết ứng dụng xác thực trước khi tiếp tục.", { exact: true }).waitFor();
    await shot("chua-mfa", "Chưa bật MFA — yêu cầu thiết lập trước khi lưu chính sách");
    await page.keyboard.press("Escape"); await expect(save(page)).toBeEnabled();
    await shot("quay-lai", "Đóng yêu cầu thiết lập MFA — giữ form và chưa lưu"); expect(mock.writes).toBe(0);
  }),
];
