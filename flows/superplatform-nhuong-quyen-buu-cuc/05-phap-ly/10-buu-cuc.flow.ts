import { HA_DONG, YEN_NGHIA, legalFlow, openLegal, openOverview } from "../../_helpers/superplatform-legal-profile";

export default [
  legalFlow({
    id: "buu-cuc", name: "10. BƯU CỤC DÙNG PHÁP LÝ CỦA NHƯỢNG QUYỀN",
    async run({ page, shot }) {
      await openOverview(page, YEN_NGHIA);
      await page.getByRole("heading", { name: "Pháp lý của nhượng quyền", exact: true }).waitFor();
      await page.getByText(`Thuộc ${HA_DONG.name}`, { exact: true }).waitFor();
      await shot("tong-quan-buu-cuc", "Tổng quan bưu cục: ô Pháp lý của nhượng quyền", { mode: "fullPage" });

      await page.getByRole("link", { name: "Xem chi tiết Pháp lý của nhượng quyền" }).click();
      await page.waitForURL(`**/${HA_DONG.id}?section=legal-entities`);
      await openLegal(page, HA_DONG);
      await shot("phap-ly-nhuong-quyen", "Xem chi tiết: mở thông tin pháp lý của nhượng quyền");
    },
  }),
];
