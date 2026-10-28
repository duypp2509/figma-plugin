import { expect } from "playwright/test";
import { HA_DONG, MESSAGES, labelledButton, legalFlow, openLegal, scrollTop } from "../../_helpers/superplatform-legal-profile";

export default [
  legalFlow({
    id: "don-vi-tam-ngung", name: "ĐƠN VỊ TẠM NGƯNG", setup: { suspended: [HA_DONG.id] },
    async run({ page, shot }) {
      await openLegal(page, HA_DONG);
      for (const label of ["Sửa", "Thay chủ thể", "Xác minh", "Từ chối"]) await expect(labelledButton(page, label)).toBeDisabled();
      await expect(labelledButton(page, "Lịch sử")).toBeEnabled();
      await scrollTop(page);
      await shot("nut-bi-khoa", "Đơn vị tạm ngưng: nút cập nhật bị khóa, vẫn xem được", { mode: "fullPage" });

      // A disabled button says why in the tooltip of the wrapper that takes the pointer.
      await labelledButton(page, "Sửa").locator("xpath=..").hover();
      await page.getByRole("tooltip").filter({ hasText: MESSAGES.notActive(HA_DONG.name) }).waitFor();
      await shot("ly-do-khoa", "Rê chuột lên nút Sửa: đơn vị đang tạm ngưng, kích hoạt lại rồi mới cập nhật được");
    },
  }),
];
