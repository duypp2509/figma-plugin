import { expect } from "playwright/test";
import { HA_DONG, MESSAGES, labelledButton, legalFlow, openLegal, scrollTop } from "../../_helpers/superplatform-legal-profile";

export default [
  legalFlow({
    id: "don-vi-tam-ngung", name: "13. ĐƠN VỊ TẠM NGƯNG", setup: { suspended: [HA_DONG.id] },
    async run({ page, shot }) {
      await openLegal(page, HA_DONG);
      for (const label of ["Sửa", "Thay chủ thể", "Xác minh", "Từ chối xác minh"]) await expect(labelledButton(page, label)).toBeDisabled();
      await expect(labelledButton(page, "Xem lịch sử")).toBeEnabled();
      await scrollTop(page);
      await shot("nut-bi-khoa", "Đơn vị tạm ngưng: nút cập nhật bị khóa, vẫn xem được", { mode: "fullPage" });

      await page.goto(`/workspace/organizations/${HA_DONG.id}/legal/edit`);
      await page.getByRole("status").filter({ hasText: MESSAGES.notActive(HA_DONG.name) }).waitFor();
      await shot("mo-thang-trang-sua", "Mở thẳng trang sửa: đơn vị đang tạm ngưng");
    },
  }),
];
