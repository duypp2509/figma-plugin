import type { Page } from "playwright";
import { MESSAGES, UNITS, dialog, enterCode, expect, openUnit, toast, typeFlow, waitCode } from "../../_helpers/superplatform-unit-status";

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

export default [
  typeFlow({
    id: "thanh-cong", name: "01. ĐỔI LOẠI HÌNH THÀNH CÔNG",
    async run({ page, shot, mock }) {
      await openUnit(page, UNITS.duongNoi);
      await expect(changeButton(page)).toBeEnabled();
      await shot("ho-so", "Bưu cục lấy: nút Đổi loại hình ở ô Loại hình bưu cục");

      await openChange(page);
      await shot("hop-doi-loai-hinh", "Hộp Đổi loại hình bưu cục: loại hình hiện tại, hai loại hình còn lại");

      await choose(page, "Bưu cục giao nhận");
      await expect(dialog(page, TITLE).getByRole("button", { name: "Đổi", exact: true })).toBeEnabled();
      await shot("chon-loai-hinh", "Chọn Bưu cục giao nhận");

      await dialog(page, TITLE).getByRole("button", { name: "Đổi", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực cho đúng lần đổi loại hình");

      await enterCode(page);
      // The server's sentence (AdminOperationModelService), shown as it comes in the envelope.
      await toast(page, `Đã đổi loại hình ${UNITS.duongNoi.name} sang Bưu cục giao nhận.`).waitFor();
      await card(page).getByText("Bưu cục giao nhận", { exact: true }).waitFor();
      await shot("da-doi", "Đã đổi: hồ sơ hiện loại hình mới, áp dụng từ hôm nay");
      expect(mock.writes).toBe(1);
      expect(mock.unit(UNITS.duongNoi.id).model?.code).toBe("DELIVERY_PICKUP");
    },
  }),
  typeFlow({
    id: "buu-cuc-tam-ngung", name: "02. BƯU CỤC ĐANG TẠM NGƯNG",
    start: { [UNITS.duongNoi.id]: { status: "SUSPENDED", since: "2026-09-28T03:00:00.000Z" } },
    async run({ page, shot }) {
      await openUnit(page, UNITS.duongNoi);
      await expect(changeButton(page)).toBeDisabled();
      await shot("nut-tat", "Bưu cục đang tạm ngưng: nút Đổi loại hình tắt");
    },
  }),
  typeFlow({
    id: "nguoi-khac-vua-doi", name: "03. VỪA BỊ NGƯỜI KHÁC ĐỔI",
    async run({ page, shot, mock }) {
      await openUnit(page, UNITS.duongNoi);
      await openChange(page);
      await choose(page, "Bưu cục giao nhận");
      // Another administrator changes Bưu cục Dương Nội to "Bưu cục giao" while this dialog is open.
      mock.changeElsewhere(UNITS.duongNoi.id, "DELIVERY");
      await dialog(page, TITLE).getByRole("button", { name: "Đổi", exact: true }).click();
      await page.getByText(MESSAGES.modelConflict, { exact: true }).first().waitFor();
      await shot("vua-bi-doi", "Loại hình vừa được người khác đổi");

      await page.getByRole("button", { name: "Đã hiểu", exact: true }).click();
      const reload = dialog(page, TITLE).getByRole("button", { name: "Tải lại", exact: true });
      await page.getByRole("button", { name: "Đã hiểu", exact: true }).waitFor({ state: "hidden" });
      await reload.waitFor();
      await shot("nut-tai-lai", "Hộp đổi loại hình giữ lựa chọn, có nút Tải lại");

      await reload.click();
      await dialog(page, TITLE).waitFor({ state: "hidden" });
      await card(page).getByText("Bưu cục giao", { exact: true }).waitFor();
      await shot("da-tai-lai", "Tải lại: hồ sơ hiện loại hình người khác vừa đổi");
      expect(mock.writes).toBe(0);
    },
  }),
  typeFlow({
    id: "khong-co-quyen", name: "04. KHÔNG CÓ QUYỀN", role: "manager",
    async run({ page, shot }) {
      await openUnit(page, UNITS.duongNoi);
      await card(page).getByText("Bưu cục lấy", { exact: true }).waitFor();
      await expect(changeButton(page)).toHaveCount(0);
      await shot("khong-co-nut", "Quản lý nhượng quyền: xem loại hình, không có nút Đổi loại hình");
    },
  }),
];
