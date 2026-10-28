import { expect } from "playwright/test";
import {
  EDIT, HA_DONG, MESSAGES, TERMINATE, dialog, enterCode, field, historyToggle, openRepresentatives, openRowMenu, pick, pickDate, press, reminder,
  representativeFlow, row, rowAction, scrollTop, toast, waitCode,
} from "../../_helpers/superplatform-representatives";

export default [
  representativeFlow({
    id: "sua-thong-tin", name: "SỬA THÔNG TIN NGƯỜI ĐẠI DIỆN",
    async run({ page, shot, mock }) {
      await openRepresentatives(page, HA_DONG);
      await reminder(page, "Ủy quyền của Lê Hoàng Phúc sắp hết hạn ngày 31/10/2026.").waitFor();
      await scrollTop(page);
      await shot("danh-sach", "Danh sách người đại diện: ủy quyền của Lê Hoàng Phúc sắp hết hạn", { mode: "fullPage" });

      await openRowMenu(page, "Lê Hoàng Phúc");
      await shot("mo-menu", "Bấm ⋯ ở dòng Lê Hoàng Phúc: Xem chi tiết, Sửa, Kết thúc nhiệm kỳ");

      await (await rowAction(page, "Lê Hoàng Phúc", "Sửa")).click();
      const box = dialog(page, EDIT);
      await expect(field(page, "rep-full_name")).toHaveValue("Lê Hoàng Phúc");
      await shot("hop-sua", "Chọn Sửa: hộp sửa điền sẵn, khóa loại và ngày bắt đầu");

      // Gia hạn ủy quyền theo giấy ủy quyền mới.
      await pickDate(page, "rep-end_date", "2027-06-30");
      await field(page, "rep-basis_document_number").fill("11/2026/UQ");
      await pickDate(page, "rep-basis_document_date", "2026-10-09");
      await shot("da-sua", "Gia hạn ủy quyền đến 30/06/2027 theo giấy ủy quyền mới");

      await press(box.getByRole("button", { name: "Lưu", exact: true }));
      const confirm = dialog(page, "Lưu thông tin người đại diện?");
      await confirm.waitFor();
      await shot("xac-nhan", "Bấm Lưu: kiểm tra lại trước khi lưu");
      await confirm.getByRole("button", { name: "Lưu", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");

      await enterCode(page);
      await toast(page, MESSAGES.repSaved).waitFor();
      await row(page, "Lê Hoàng Phúc").filter({ hasText: "30/06/2027" }).waitFor();
      await expect(reminder(page, "Ủy quyền của Lê Hoàng Phúc sắp hết hạn ngày 31/10/2026.")).toHaveCount(0);
      await scrollTop(page);
      await shot("da-luu", "Đã lưu: hết nhắc ủy quyền sắp hết hạn", { mode: "fullPage" });
      expect(mock.input).toMatchObject({ end_date: "2027-06-30", basis_document_number: "11/2026/UQ" });
    },
  }),
  representativeFlow({
    id: "ket-thuc-nhiem-ky", name: "KẾT THÚC NHIỆM KỲ",
    async run({ page, shot, mock }) {
      await openRepresentatives(page, HA_DONG);
      await row(page, "Trần Thị Mai").waitFor();
      await scrollTop(page);
      await shot("danh-sach", "Danh sách người đại diện đang hiệu lực", { mode: "fullPage" });

      await openRowMenu(page, "Trần Thị Mai");
      await shot("mo-menu", "Bấm ⋯ ở dòng Trần Thị Mai: có Kết thúc nhiệm kỳ");

      await (await rowAction(page, "Trần Thị Mai", "Kết thúc nhiệm kỳ")).click();
      const box = dialog(page, TERMINATE);
      await field(page, "rep-end_date").waitFor();
      await shot("hop-ket-thuc", "Chọn Kết thúc nhiệm kỳ: ngày kết thúc mặc định hôm nay");

      await press(box.getByRole("button", { name: "Kết thúc", exact: true }));
      await box.getByText("Hãy nhập căn cứ kết thúc.", { exact: true }).waitFor();
      await shot("thieu-can-cu", "Bấm Kết thúc khi chưa nhập căn cứ: căn cứ kết thúc bắt buộc");

      await pickDate(page, "rep-end_date", "2026-10-10");
      await pick(page, "rep-basis_document_type", "Giấy chứng nhận đăng ký thay đổi");
      await field(page, "rep-basis_document_number").fill("0109876543");
      await pickDate(page, "rep-basis_document_date", "2026-10-09");
      await shot("da-nhap", "Đã nhập ngày kết thúc và giấy chứng nhận đăng ký thay đổi");

      await press(box.getByRole("button", { name: "Kết thúc", exact: true }));
      const confirm = dialog(page, "Kết thúc nhiệm kỳ người đại diện?");
      await confirm.waitFor();
      await shot("xac-nhan", "Bấm Kết thúc: kiểm tra lại trước khi kết thúc");
      await confirm.getByRole("button", { name: "Kết thúc", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");

      await enterCode(page);
      await toast(page, MESSAGES.repEnded).waitFor();
      await expect(row(page, "Trần Thị Mai")).toHaveCount(0);
      await scrollTop(page);
      await shot("roi-danh-sach", "Đã kết thúc: Trần Thị Mai rời danh sách đang hiệu lực", { mode: "fullPage" });

      await historyToggle(page).check();
      await row(page, "Trần Thị Mai").filter({ hasText: "Đã kết thúc" }).waitFor();
      await scrollTop(page);
      await shot("da-ket-thuc", "Bật Hiện cả nhiệm kỳ đã kết thúc: dòng Đã kết thúc, kèm ngày kết thúc", { mode: "fullPage" });
      expect(mock.input).toMatchObject({ end_date: "2026-10-10", basis_document_type: "AMENDED_REGISTRATION_CERTIFICATE" });
    },
  }),
];
