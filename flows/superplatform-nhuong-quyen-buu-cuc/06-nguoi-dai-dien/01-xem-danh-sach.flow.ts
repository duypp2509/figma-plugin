import { HA_DONG, LONG_BIEN, historyToggle, openRepresentatives, reminder, representativeFlow, row, scrollTop } from "../../_helpers/superplatform-representatives";

export default [
  representativeFlow({
    id: "xem-danh-sach", name: "01. XEM DANH SÁCH NGƯỜI ĐẠI DIỆN",
    async run({ page, shot }) {
      await openRepresentatives(page, HA_DONG);
      await reminder(page, "Ủy quyền của Lê Hoàng Phúc sắp hết hạn ngày 31/10/2026.").waitFor();
      await scrollTop(page);
      await shot("danh-sach", "Người đang hiệu lực, theo pháp luật đứng trước; nhắc ủy quyền sắp hết hạn", { mode: "fullPage" });

      await historyToggle(page).check();
      await row(page, "Phạm Đức Thắng").waitFor();
      await scrollTop(page);
      await shot("ca-nguoi-da-ket-thuc", "Xem cả người đã kết thúc nhiệm kỳ: kèm ngày kết thúc", { mode: "fullPage" });
    },
  }),
  representativeFlow({
    id: "chua-khai-bao-phap-ly", name: "02. ĐƠN VỊ CHƯA KHAI BÁO THÔNG TIN PHÁP LÝ",
    async run({ page, shot }) {
      await openRepresentatives(page, LONG_BIEN);
      await reminder(page, "Chưa khai báo thông tin pháp lý, chưa xác định được người đại diện theo pháp luật.").waitFor();
      await shot("nhac-khai-bao", "Chưa khai báo thông tin pháp lý: chưa xác định được người đại diện theo pháp luật");
    },
  }),
];
