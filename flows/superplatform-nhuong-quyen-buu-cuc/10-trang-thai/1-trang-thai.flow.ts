import {
  MESSAGES, UNITS, button, codeDialog, dialog, enterCode, expect, field, openDialog, openList, openPostOffices, openRowMenu, openUnit, pickDate,
  statusFlow, toast, waitCode,
} from "../../_helpers/superplatform-unit-status";

const SUSPENDED_SINCE = "2026-10-05T03:00:00.000Z";

export default [
  statusFlow({
    id: "tam-ngung-nhuong-quyen", name: "01. TẠM NGƯNG NHƯỢNG QUYỀN",
    async run({ page, shot, mock }) {
      await openUnit(page, UNITS.hadong);
      await expect(button(page, "Tạm ngưng")).toBeEnabled();
      await shot("dang-hoat-dong", "Nhượng quyền đang hoạt động: nút Tạm ngưng, Ngừng hoạt động");

      await openDialog(page, "Tạm ngưng", "Tạm ngưng đơn vị");
      await dialog(page, "Tạm ngưng đơn vị").getByText("35 người đang làm việc", { exact: false }).waitFor();
      await shot("anh-huong", "Hộp Tạm ngưng đơn vị: nhượng quyền, bưu cục trực thuộc và số người bị ảnh hưởng");

      await dialog(page, "Tạm ngưng đơn vị").getByRole("button", { name: "Tạm ngưng", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực cho đúng lần tạm ngưng");

      await enterCode(page, "111111");
      await codeDialog(page).getByText(MESSAGES.wrongCode).waitFor();
      await shot("ma-sai", "Mã xác thực sai: nhập lại");

      await enterCode(page);
      await toast(page, `Đã tạm ngưng ${UNITS.hadong.name}.`).waitFor();
      await button(page, "Kích hoạt lại").waitFor();
      await shot("da-tam-ngung", "Đã tạm ngưng: trạng thái Tạm ngưng, nút Kích hoạt lại");
      expect(mock.writes).toBe(1);
      expect(mock.unit(UNITS.hadong.id).status).toBe("SUSPENDED");
    },
  }),
  statusFlow({
    id: "kich-hoat-lai-nhuong-quyen", name: "02. KÍCH HOẠT LẠI NHƯỢNG QUYỀN",
    start: { [UNITS.hadong.id]: { status: "SUSPENDED", since: SUSPENDED_SINCE } },
    async run({ page, shot, mock }) {
      await openUnit(page, UNITS.hadong);
      await expect(button(page, "Kích hoạt lại")).toBeEnabled();
      await shot("dang-tam-ngung", "Nhượng quyền đang tạm ngưng: không sửa được hồ sơ, nút Kích hoạt lại");

      await openDialog(page, "Kích hoạt lại", "Kích hoạt lại đơn vị");
      await dialog(page, "Kích hoạt lại đơn vị").getByText("Đang tạm ngưng từ", { exact: false }).waitFor();
      await shot("anh-huong", "Hộp Kích hoạt lại đơn vị: tạm ngưng từ ngày nào, đơn vị làm việc lại");

      await dialog(page, "Kích hoạt lại đơn vị").getByRole("button", { name: "Kích hoạt lại", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực cho đúng lần kích hoạt lại");

      await enterCode(page);
      await toast(page, `Đã kích hoạt lại ${UNITS.hadong.name}.`).waitFor();
      await button(page, "Tạm ngưng").waitFor();
      await shot("da-kich-hoat-lai", "Đã kích hoạt lại: trạng thái Đang hoạt động");
      expect(mock.writes).toBe(1);
    },
  }),
  statusFlow({
    id: "buu-cuc-bi-chan", name: "03. BƯU CỤC BỊ CHẶN VÌ NHƯỢNG QUYỀN TẠM NGƯNG",
    start: {
      [UNITS.duongNoi.id]: { status: "SUSPENDED", since: "2026-09-28T03:00:00.000Z" },
      [UNITS.hadong.id]: { status: "SUSPENDED", since: SUSPENDED_SINCE },
    },
    async run({ page, shot, mock }) {
      await openUnit(page, UNITS.yenNghia);
      await page.getByText(`Đang bị chặn vì ${UNITS.hadong.name} đang tạm ngưng.`, { exact: true }).waitFor();
      await shot("buu-cuc-dang-hoat-dong", "Bưu cục vẫn Đang hoạt động nhưng bị chặn vì nhượng quyền tạm ngưng");

      await openUnit(page, UNITS.duongNoi);
      await page.getByText(`Đang bị chặn vì ${UNITS.hadong.name} đang tạm ngưng.`, { exact: true }).waitFor();
      await expect(button(page, "Kích hoạt lại")).toBeDisabled();
      await shot("buu-cuc-tam-ngung", "Bưu cục tự đang tạm ngưng: nút Kích hoạt lại tắt");

      await openPostOffices(page);
      await page.getByText(`Bị chặn vì ${UNITS.hadong.name} đang tạm ngưng`, { exact: true }).first().waitFor();
      await openRowMenu(page, UNITS.duongNoi.name);
      await shot("menu-danh-sach", "Thẻ Bưu cục của nhượng quyền: bị chặn vì nhượng quyền, menu của bưu cục tạm ngưng");

      await page.getByRole("menuitem", { name: "Kích hoạt lại" }).click();
      await toast(page, `${UNITS.hadong.name} đang tạm ngưng, kích hoạt lại nhượng quyền trước.`).waitFor();
      await shot("ly-do-khong-kich-hoat", "Bấm Kích hoạt lại: phải kích hoạt lại nhượng quyền trước");
      expect(mock.writes).toBe(0);
    },
  }),
  statusFlow({
    id: "ngung-hoat-dong-thieu-dieu-kien", name: "04. NGỪNG HOẠT ĐỘNG CÒN THIẾU ĐIỀU KIỆN",
    async run({ page, shot }) {
      await openUnit(page, UNITS.hadong);
      await expect(button(page, "Ngừng hoạt động")).toBeDisabled();
      await shot("nhuong-quyen-con-buu-cuc", "Nhượng quyền còn bưu cục và người đang làm việc: nút Ngừng hoạt động tắt");

      await openUnit(page, UNITS.yenNghia);
      await expect(button(page, "Ngừng hoạt động")).toBeDisabled();
      await shot("buu-cuc-con-nguoi", "Bưu cục còn người đang làm việc: nút Ngừng hoạt động tắt");
    },
  }),
  statusFlow({
    id: "ngung-hoat-dong", name: "05. NGỪNG HOẠT ĐỘNG VĨNH VIỄN",
    async run({ page, shot, mock }) {
      await openUnit(page, UNITS.pleiku);
      await expect(button(page, "Ngừng hoạt động")).toBeEnabled();
      await shot("buu-cuc", "Bưu cục không còn người đang làm việc: nút Ngừng hoạt động bật");

      await openDialog(page, "Ngừng hoạt động", "Ngừng hoạt động vĩnh viễn");
      const close = dialog(page, "Ngừng hoạt động vĩnh viễn");
      await field(page, "confirm_name").waitFor();
      await shot("hop-ngung-hoat-dong", "Hộp Ngừng hoạt động vĩnh viễn: ngày, gõ lại tên đơn vị");

      await pickDate(page, "closed_on", "2026-10-10");
      await field(page, "confirm_name").fill(UNITS.pleiku.name);
      await expect(close.getByRole("button", { name: "Ngừng hoạt động", exact: true })).toBeEnabled();
      await shot("da-nhap", "Đã chọn ngày và gõ đúng tên");

      await close.getByRole("button", { name: "Ngừng hoạt động", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực cho đúng lần ngừng hoạt động");

      await enterCode(page);
      await toast(page, `${UNITS.pleiku.name} đã ngừng hoạt động từ 10/10/2026.`).waitFor();
      // The profile's "Ngày ngừng hoạt động" row (closed_on, as the server words it).
      await page.locator(".organization-overview-fields > div").filter({ hasText: "Ngày ngừng hoạt động" })
        .getByText("10/10/2026", { exact: true }).waitFor();
      await expect(button(page, "Tạm ngưng")).toHaveCount(0);
      await shot("da-ngung-hoat-dong", "Đã ngừng hoạt động: không còn nút đổi trạng thái");
      expect(mock.writes).toBe(1);
    },
  }),
  statusFlow({
    id: "go-sai-ten", name: "06. GÕ SAI TÊN KHI NGỪNG HOẠT ĐỘNG",
    async run({ page, shot, mock }) {
      await openUnit(page, UNITS.pleiku);
      await openDialog(page, "Ngừng hoạt động", "Ngừng hoạt động vĩnh viễn");
      const close = dialog(page, "Ngừng hoạt động vĩnh viễn");
      await field(page, "confirm_name").fill("BƯU CỤC PLEI KU");
      await close.getByRole("button", { name: "Ngừng hoạt động", exact: true }).click();
      await close.getByText(MESSAGES.wrongName, { exact: true }).waitFor();
      await shot("sai-ten", "Gõ sai tên: báo dưới ô, chưa hỏi mã xác thực");
      expect(mock.writes).toBe(0);
    },
  }),
  statusFlow({
    id: "tam-ngung-tu-danh-sach", name: "07. TẠM NGƯNG TỪ DANH SÁCH",
    async run({ page, shot, mock }) {
      await openList(page);
      await openRowMenu(page, UNITS.hadong.name);
      await shot("menu", "Danh sách nhượng quyền: menu ⋯ của nhượng quyền");

      await page.getByRole("menuitem", { name: "Tạm ngưng" }).click();
      await dialog(page, "Tạm ngưng đơn vị").getByText("35 người đang làm việc", { exact: false }).waitFor();
      await shot("anh-huong", "Hộp Tạm ngưng đơn vị mở ngay trên danh sách");

      await dialog(page, "Tạm ngưng đơn vị").getByRole("button", { name: "Tạm ngưng", exact: true }).click();
      await waitCode(page);
      await enterCode(page);
      await toast(page, `Đã tạm ngưng ${UNITS.hadong.name}.`).waitFor();
      await page.getByRole("row", { name: new RegExp(UNITS.hadong.name) }).getByText("Tạm ngưng", { exact: true }).waitFor();
      await shot("da-tam-ngung", "Đã tạm ngưng: dòng nhượng quyền chuyển sang Tạm ngưng");
      expect(mock.writes).toBe(1);
    },
  }),
  statusFlow({
    id: "khong-co-quyen", name: "08. KHÔNG CÓ QUYỀN", role: "manager",
    async run({ page, shot }) {
      await openUnit(page, UNITS.hadong);
      await expect(button(page, "Tạm ngưng")).toHaveCount(0);
      await expect(button(page, "Ngừng hoạt động")).toHaveCount(0);
      await shot("nhuong-quyen", "Quản lý nhượng quyền: không có nút Tạm ngưng, Ngừng hoạt động");

      await openUnit(page, UNITS.yenNghia);
      await expect(button(page, "Tạm ngưng")).toHaveCount(0);
      await shot("buu-cuc", "Bưu cục trực thuộc: không có nút đổi trạng thái");

      await openList(page, "POST_OFFICE");
      await openRowMenu(page, UNITS.yenNghia.name);
      await expect(page.getByRole("menuitem", { name: "Tạm ngưng" })).toHaveCount(0);
      await shot("menu-danh-sach", "Danh sách bưu cục: menu ⋯ chỉ có Xem chi tiết");
    },
  }),
];
