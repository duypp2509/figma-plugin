import type { Page } from "playwright";
import { UNITS, dialog, enterCode, expect, openUnit, showReason, toast, typeFlow, waitCode } from "../../_helpers/superplatform-unit-status";

const TITLE = "Đổi loại hình bưu cục";
const changeButton = (page: Page) => page.getByRole("button", { name: "Đổi loại hình", exact: true });
/** The "Loại hình bưu cục" card of the overview. */
const card = (page: Page) => page.locator(".organization-overview-card").filter({ has: page.getByRole("heading", { name: "Loại hình bưu cục", exact: true }) });

async function openChange(page: Page) {
  await changeButton(page).click();
  await dialog(page, TITLE).getByText("Loại hình hiện tại:", { exact: false }).waitFor();
}
async function choose(page: Page, name: string) {
  await dialog(page, TITLE).getByRole("radio", { name: new RegExp(`^${name}`) }).check();
}
/** "Lý do" (28/10/2026): a reason from the catalog, required before "Đổi". */
const reasonTrigger = (page: Page) => dialog(page, TITLE).locator('select[aria-label="Lý do"] + [role="combobox"]');
async function openReasons(page: Page, name: string) {
  await expect(reasonTrigger(page)).toBeEnabled();
  await reasonTrigger(page).click();
  await page.getByRole("option", { name, exact: true }).waitFor();
}
async function pickReason(page: Page, name: string) {
  await page.getByRole("option", { name, exact: true }).click();
  await expect(reasonTrigger(page)).toContainText(name);
}

export default [
  typeFlow({
    id: "thanh-cong", name: "ĐỔI LOẠI HÌNH THÀNH CÔNG",
    async run({ page, shot, mock }) {
      await openUnit(page, UNITS.duongNoi);
      await expect(changeButton(page)).toBeEnabled();
      await shot("ho-so", "Bưu cục lấy: nút Đổi loại hình ở ô Loại hình bưu cục");

      await openChange(page);
      await shot("hop-doi-loai-hinh", "Bấm Đổi loại hình: loại hình hiện tại, hai loại hình còn lại");

      await choose(page, "Bưu cục giao nhận");
      await expect(dialog(page, TITLE).getByRole("button", { name: "Đổi", exact: true })).toBeDisabled();
      await shot("chua-chon-ly-do", "Chọn Bưu cục giao nhận: nút Đổi còn khóa tới khi chọn lý do");

      await openReasons(page, "Nâng cấp lên bưu cục giao nhận");
      await shot("danh-sach-ly-do", "Bấm ô Lý do: danh sách lý do");

      await pickReason(page, "Nâng cấp lên bưu cục giao nhận");
      await expect(dialog(page, TITLE).getByRole("button", { name: "Đổi", exact: true })).toBeEnabled();
      await shot("chon-loai-hinh", "Chọn lý do Nâng cấp lên bưu cục giao nhận: nút Đổi bật");

      await dialog(page, TITLE).getByRole("button", { name: "Đổi", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Bấm Đổi: nhập mã xác thực cho đúng lần đổi loại hình");

      await enterCode(page);
      // The server's sentence (AdminOperationModelService), shown as it comes in the envelope.
      await toast(page, `Đã đổi loại hình ${UNITS.duongNoi.name} sang Bưu cục giao nhận.`).waitFor();
      await card(page).getByText("Bưu cục giao nhận", { exact: true }).waitFor();
      await shot("da-doi", "Bấm Xác nhận: hồ sơ hiện loại hình mới, áp dụng từ hôm nay");
      expect(mock.writes).toBe(1);
      expect(mock.unit(UNITS.duongNoi.id).model?.code).toBe("DELIVERY_PICKUP");
    },
  }),
  typeFlow({
    id: "buu-cuc-tam-ngung", name: "BƯU CỤC ĐANG TẠM NGƯNG",
    start: { [UNITS.duongNoi.id]: { status: "SUSPENDED", since: "2026-09-28T03:00:00.000Z" } },
    async run({ page, shot }) {
      await openUnit(page, UNITS.duongNoi);
      await expect(changeButton(page)).toBeDisabled();
      await shot("nut-tat", "Bưu cục đang tạm ngưng: nút Đổi loại hình tắt");

      await showReason(page, changeButton(page), "Bưu cục đang tạm ngưng, kích hoạt lại rồi mới đổi được loại hình.");
      await shot("ly-do", "Trỏ vào nút Đổi loại hình: lý do không đổi được");
    },
  }),
  typeFlow({
    id: "khong-co-quyen", name: "KHÔNG CÓ QUYỀN", role: "manager",
    async run({ page, shot }) {
      await openUnit(page, UNITS.duongNoi);
      await card(page).getByText("Bưu cục lấy", { exact: true }).waitFor();
      await expect(changeButton(page)).toHaveCount(0);
      await shot("khong-co-nut", "Quản lý nhượng quyền: xem loại hình, không có nút Đổi loại hình");
    },
  }),
];
