import {
  MESSAGES, UNITS, button, codeDialog, dialog, enterCode, expect, field, openDialog, openList, openPostOffices, openRowMenu, openUnit, pickDate,
  showReason, statusFlow, toast, waitCode,
} from "../../_helpers/superplatform-unit-status";

const SUSPENDED_SINCE = "2026-10-05T03:00:00.000Z";
/** The notice on the page; the same sentence also describes the greyed buttons for screen readers. */
const blockedNotice = (page: import("playwright").Page) =>
  page.getByRole("status").getByText(`Đang bị chặn vì ${UNITS.hadong.name} đang tạm ngưng.`, { exact: true });

export default [
  statusFlow({
    id: "tam-ngung-nhuong-quyen", name: "TẠM NGƯNG NHƯỢNG QUYỀN",
    async run({ page, shot, mock }) {
      await openUnit(page, UNITS.hadong);
      await expect(button(page, "Tạm ngưng")).toBeEnabled();
      await shot("dang-hoat-dong", "Nhượng quyền đang hoạt động: nút Tạm ngưng, Ngừng hoạt động");

      await openDialog(page, "Tạm ngưng", "Tạm ngưng đơn vị");
      await dialog(page, "Tạm ngưng đơn vị").getByText("35 người đang làm việc", { exact: false }).waitFor();
      await shot("anh-huong", "Bấm Tạm ngưng: nhượng quyền, bưu cục trực thuộc và số người bị ảnh hưởng");

      await dialog(page, "Tạm ngưng đơn vị").getByRole("button", { name: "Tạm ngưng", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Bấm Tạm ngưng trong hộp: nhập mã xác thực cho đúng lần tạm ngưng");

      await enterCode(page, "111111");
      await codeDialog(page).getByText(MESSAGES.wrongCode).waitFor();
      await shot("ma-sai", "Nhập sai mã, bấm Xác nhận: nhập lại");

      await enterCode(page);
      await toast(page, `Đã tạm ngưng ${UNITS.hadong.name}.`).waitFor();
      await button(page, "Kích hoạt lại").waitFor();
      await shot("da-tam-ngung", "Nhập đúng mã, bấm Xác nhận: trạng thái Tạm ngưng, nút Kích hoạt lại");
      expect(mock.writes).toBe(1);
      expect(mock.unit(UNITS.hadong.id).status).toBe("SUSPENDED");
    },
  }),
  statusFlow({
    id: "kich-hoat-lai-nhuong-quyen", name: "KÍCH HOẠT LẠI NHƯỢNG QUYỀN",
    start: { [UNITS.hadong.id]: { status: "SUSPENDED", since: SUSPENDED_SINCE } },
    async run({ page, shot, mock }) {
      await openUnit(page, UNITS.hadong);
      await expect(button(page, "Kích hoạt lại")).toBeEnabled();
      await shot("dang-tam-ngung", "Nhượng quyền đang tạm ngưng: không sửa được hồ sơ, nút Kích hoạt lại");

      await openDialog(page, "Kích hoạt lại", "Kích hoạt lại đơn vị");
      await dialog(page, "Kích hoạt lại đơn vị").getByText("Đang tạm ngưng từ", { exact: false }).waitFor();
      await shot("anh-huong", "Bấm Kích hoạt lại: tạm ngưng từ ngày nào, đơn vị làm việc lại");

      await dialog(page, "Kích hoạt lại đơn vị").getByRole("button", { name: "Kích hoạt lại", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Bấm Kích hoạt lại trong hộp: nhập mã xác thực cho đúng lần kích hoạt lại");

      await enterCode(page);
      await toast(page, `Đã kích hoạt lại ${UNITS.hadong.name}.`).waitFor();
      await button(page, "Tạm ngưng").waitFor();
      await shot("da-kich-hoat-lai", "Bấm Xác nhận: trạng thái Đang hoạt động");
      expect(mock.writes).toBe(1);
    },
  }),
  statusFlow({
    id: "buu-cuc-bi-chan", name: "BƯU CỤC BỊ CHẶN VÌ NHƯỢNG QUYỀN TẠM NGƯNG",
    start: {
      [UNITS.duongNoi.id]: { status: "SUSPENDED", since: "2026-09-28T03:00:00.000Z" },
      [UNITS.hadong.id]: { status: "SUSPENDED", since: SUSPENDED_SINCE },
    },
    async run({ page, shot, mock }) {
      await openUnit(page, UNITS.yenNghia);
      await blockedNotice(page).waitFor();
      await shot("buu-cuc-dang-hoat-dong", "Bưu cục vẫn Đang hoạt động nhưng bị chặn vì nhượng quyền tạm ngưng");

      await openUnit(page, UNITS.duongNoi);
      await blockedNotice(page).waitFor();
      await expect(button(page, "Kích hoạt lại")).toBeDisabled();
      await shot("buu-cuc-tam-ngung", "Bưu cục tự đang tạm ngưng: nút Kích hoạt lại tắt");

      await openPostOffices(page);
      await page.getByText(`Bị chặn vì ${UNITS.hadong.name} đang tạm ngưng`, { exact: true }).first().waitFor();
      await shot("danh-sach-buu-cuc", "Thẻ Bưu cục của nhượng quyền: các bưu cục bị chặn vì nhượng quyền");

      await openRowMenu(page, UNITS.duongNoi.name);
      await shot("menu-danh-sach", "Bấm ⋯ ở bưu cục tạm ngưng: menu thao tác");

      // A greyed item says why in its tooltip on hover or focus; focus keeps it whatever the pointer does.
      const reactivate = page.getByRole("menuitem", { name: "Kích hoạt lại" });
      await expect(reactivate).toHaveAttribute("aria-disabled", "true");
      await reactivate.focus();
      await page.getByRole("tooltip").filter({ hasText: `${UNITS.hadong.name} đang tạm ngưng, kích hoạt lại nhượng quyền trước.` }).waitFor();
      await shot("ly-do-khong-kich-hoat", "Trỏ vào Kích hoạt lại: phải kích hoạt lại nhượng quyền trước");
      expect(mock.writes).toBe(0);
    },
  }),
  statusFlow({
    id: "ngung-hoat-dong-thieu-dieu-kien", name: "NGỪNG HOẠT ĐỘNG CÒN THIẾU ĐIỀU KIỆN",
    async run({ page, shot }) {
      await openUnit(page, UNITS.hadong);
      await expect(button(page, "Ngừng hoạt động")).toBeDisabled();
      await shot("nhuong-quyen-con-buu-cuc", "Nhượng quyền còn bưu cục trực thuộc: nút Ngừng hoạt động tắt");

      await showReason(page, button(page, "Ngừng hoạt động"),
        "Còn 2 bưu cục trực thuộc chưa ngừng hoạt động. Ngừng hoạt động các bưu cục đó trước.");
      await shot("ly-do-nhuong-quyen", "Trỏ vào nút Ngừng hoạt động: còn bưu cục chưa ngừng hoạt động");

      await openUnit(page, UNITS.yenNghia);
      await expect(button(page, "Ngừng hoạt động")).toBeDisabled();
      await shot("buu-cuc-con-nguoi", "Bưu cục còn người đang làm việc: nút Ngừng hoạt động tắt");

      await showReason(page, button(page, "Ngừng hoạt động"),
        `Còn 17 người đang làm việc ở ${UNITS.yenNghia.name}. Điều chuyển hoặc cho nghỉ việc trước.`);
      await shot("ly-do-buu-cuc", "Trỏ vào nút Ngừng hoạt động: còn người đang làm việc");
    },
  }),
  statusFlow({
    id: "ngung-hoat-dong", name: "NGỪNG HOẠT ĐỘNG VĨNH VIỄN",
    async run({ page, shot, mock }) {
      await openUnit(page, UNITS.pleiku);
      await expect(button(page, "Ngừng hoạt động")).toBeEnabled();
      await shot("buu-cuc", "Bưu cục không còn người đang làm việc: nút Ngừng hoạt động bật");

      await openDialog(page, "Ngừng hoạt động", "Ngừng hoạt động vĩnh viễn");
      const close = dialog(page, "Ngừng hoạt động vĩnh viễn");
      await field(page, "confirm_name").waitFor();
      await shot("hop-ngung-hoat-dong", "Bấm Ngừng hoạt động: chọn ngày, gõ lại tên đơn vị");

      await pickDate(page, "closed_on", "2026-10-10", () => shot("chon-ngay", "Bấm ô ngày, chọn 10/10/2026 trên lịch"));
      await field(page, "confirm_name").fill(UNITS.pleiku.name);
      await expect(close.getByRole("button", { name: "Ngừng hoạt động", exact: true })).toBeEnabled();
      await shot("da-nhap", "Bấm Áp dụng, gõ đúng tên đơn vị");

      await close.getByRole("button", { name: "Ngừng hoạt động", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Bấm Ngừng hoạt động trong hộp: nhập mã xác thực cho đúng lần ngừng hoạt động");

      await enterCode(page);
      await toast(page, `${UNITS.pleiku.name} đã ngừng hoạt động từ 10/10/2026.`).waitFor();
      // The profile's "Ngày ngừng hoạt động" row (closed_on, as the server words it).
      await page.locator(".organization-overview-fields > div").filter({ hasText: "Ngày ngừng hoạt động" })
        .getByText("10/10/2026", { exact: true }).waitFor();
      await expect(button(page, "Tạm ngưng")).toHaveCount(0);
      await shot("da-ngung-hoat-dong", "Bấm Xác nhận: đã ngừng hoạt động, không còn nút đổi trạng thái");
      expect(mock.writes).toBe(1);
    },
  }),
  statusFlow({
    id: "go-sai-ten", name: "GÕ SAI TÊN KHI NGỪNG HOẠT ĐỘNG",
    async run({ page, shot, mock }) {
      await openUnit(page, UNITS.pleiku);
      await expect(button(page, "Ngừng hoạt động")).toBeEnabled();
      await shot("buu-cuc", "Bưu cục không còn người đang làm việc: nút Ngừng hoạt động bật");

      await openDialog(page, "Ngừng hoạt động", "Ngừng hoạt động vĩnh viễn");
      const close = dialog(page, "Ngừng hoạt động vĩnh viễn");
      await field(page, "confirm_name").waitFor();
      await shot("hop-ngung-hoat-dong", "Bấm Ngừng hoạt động: hộp Ngừng hoạt động vĩnh viễn");

      await field(page, "confirm_name").fill("BƯU CỤC PLEI KU");
      await close.getByRole("button", { name: "Ngừng hoạt động", exact: true }).click();
      await close.getByText(MESSAGES.wrongName, { exact: true }).waitFor();
      await shot("sai-ten", "Gõ sai tên, bấm Ngừng hoạt động: báo dưới ô, chưa hỏi mã xác thực");
      expect(mock.writes).toBe(0);
    },
  }),
  statusFlow({
    id: "tam-ngung-tu-danh-sach", name: "TẠM NGƯNG TỪ DANH SÁCH",
    async run({ page, shot, mock }) {
      await openList(page);
      await shot("danh-sach", "Danh sách nhượng quyền");

      await openRowMenu(page, UNITS.hadong.name);
      await shot("menu", "Bấm ⋯ ở nhượng quyền: menu thao tác");

      await page.getByRole("menuitem", { name: "Tạm ngưng" }).click();
      await dialog(page, "Tạm ngưng đơn vị").getByText("35 người đang làm việc", { exact: false }).waitFor();
      await shot("anh-huong", "Bấm Tạm ngưng: hộp Tạm ngưng đơn vị mở ngay trên danh sách");

      await dialog(page, "Tạm ngưng đơn vị").getByRole("button", { name: "Tạm ngưng", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Bấm Tạm ngưng trong hộp: nhập mã xác thực");

      await enterCode(page);
      await toast(page, `Đã tạm ngưng ${UNITS.hadong.name}.`).waitFor();
      await page.getByRole("row", { name: new RegExp(UNITS.hadong.name) }).getByText("Tạm ngưng", { exact: true }).waitFor();
      await shot("da-tam-ngung", "Bấm Xác nhận: dòng nhượng quyền chuyển sang Tạm ngưng");
      expect(mock.writes).toBe(1);
    },
  }),
  statusFlow({
    id: "khong-co-quyen", name: "KHÔNG CÓ QUYỀN", role: "manager",
    async run({ page, shot }) {
      await openUnit(page, UNITS.hadong);
      await expect(button(page, "Tạm ngưng")).toHaveCount(0);
      await expect(button(page, "Ngừng hoạt động")).toHaveCount(0);
      await shot("nhuong-quyen", "Quản lý nhượng quyền: không có nút Tạm ngưng, Ngừng hoạt động");

      await openUnit(page, UNITS.yenNghia);
      await expect(button(page, "Tạm ngưng")).toHaveCount(0);
      await shot("buu-cuc", "Bưu cục trực thuộc: không có nút đổi trạng thái");

      await openList(page, "POST_OFFICE");
      await shot("danh-sach", "Danh sách bưu cục");

      await openRowMenu(page, UNITS.yenNghia.name);
      await expect(page.getByRole("menuitem", { name: "Tạm ngưng" })).toHaveCount(0);
      await shot("menu-danh-sach", "Bấm ⋯ ở bưu cục: menu chỉ có Xem chi tiết");
    },
  }),
];
