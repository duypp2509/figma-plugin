import { expect } from "playwright/test";
import {
  APPOINT, attachBasis, EDIT, HA_DONG, ME_LINH, MESSAGES, appointButton, dialog, field, openRepresentatives, pick, pickDate, press,
  representativeFlow, row, rowAction, scrollTop,
} from "../../_helpers/superplatform-representatives";

async function confirmAppoint(page: import("playwright").Page) {
  await press(dialog(page, APPOINT).getByRole("button", { name: "Bổ nhiệm", exact: true }));
  await dialog(page, `${APPOINT}?`).getByRole("button", { name: /^(Bổ nhiệm|Xác nhận)$/ }).click();
}

export default [
  representativeFlow({
    id: "nhap-thieu", name: "07. NHẬP THIẾU THÔNG TIN",
    async run({ page, shot, mock }) {
      await openRepresentatives(page, HA_DONG);
      await appointButton(page).click();
      const box = dialog(page, APPOINT);
      await press(box.getByRole("button", { name: "Bổ nhiệm", exact: true }));
      await box.getByText("Hãy chọn loại người đại diện.", { exact: true }).waitFor();
      await shot("bo-trong", "Bấm Bổ nhiệm khi chưa nhập: báo dưới từng ô");

      await pick(page, "rep-representative_type", "Theo ủy quyền");
      await field(page, "rep-full_name").fill("Vũ Thị Lan");
      await field(page, "rep-position_title").fill("Kế toán trưởng");
      await press(box.getByRole("button", { name: "Bổ nhiệm", exact: true }));
      await box.getByText("Hãy nhập phạm vi ủy quyền.", { exact: true }).waitFor();
      await shot("thieu-pham-vi", "Theo ủy quyền: bắt buộc phạm vi ủy quyền");

      await box.getByRole("button", { name: "Hủy", exact: true }).click();
      await dialog(page, "Bỏ những gì đã nhập?").waitFor();
      await shot("bo-nhap", "Đóng hộp khi đang nhập dở: hỏi bỏ những gì đã nhập");
      expect(mock.writes).toBe(0);
    },
  }),
  representativeFlow({
    id: "may-chu-tu-choi", name: "08. MÁY CHỦ TỪ CHỐI",
    async run({ page, shot, mock }) {
      // Bổ nhiệm lại người đang là người đại diện theo ủy quyền.
      await openRepresentatives(page, HA_DONG);
      await appointButton(page).click();
      await pick(page, "rep-representative_type", "Theo ủy quyền");
      await field(page, "rep-full_name").fill("Lê Hoàng Phúc");
      await field(page, "rep-position_title").fill("Trưởng phòng kinh doanh");
      await field(page, "rep-scope_of_authority").fill("Ký hợp đồng nhượng quyền với SuperShip");
      await pickDate(page, "rep-start_date", "2026-10-01");
      await pickDate(page, "rep-end_date", "2027-09-30");
      await pick(page, "rep-basis_document_type", "Giấy ủy quyền");
      await attachBasis(page, "giay-uy-quyen.pdf");
      await field(page, "rep-basis_document_number").fill("10/2026/UQ");
      await pickDate(page, "rep-basis_document_date", "2026-09-30");
      await confirmAppoint(page);
      await page.getByText(MESSAGES.repDuplicate("Theo ủy quyền"), { exact: true }).waitFor();
      await shot("trung-nguoi", "Người này đang là người đại diện theo ủy quyền của đơn vị");

      // Mở Sửa nhưng chưa đổi gì.
      await openRepresentatives(page, HA_DONG);
      await (await rowAction(page, "Nguyễn Văn An", "Sửa")).click();
      const box = dialog(page, EDIT);
      await field(page, "rep-full_name").waitFor();
      // Since 27/10 "Lưu" stays greyed until something changes, instead of the server answering "Không có thay đổi".
      await expect(box.getByRole("button", { name: "Lưu", exact: true })).toBeDisabled();
      await shot("khong-co-thay-doi", "Chưa đổi gì: nút Lưu bị khóa");
      expect(mock.writes).toBe(0);
    },
  }),
  representativeFlow({
    id: "ho-kinh-doanh", name: "09. HỘ KINH DOANH CHỈ CÓ MỘT NGƯỜI THEO PHÁP LUẬT",
    async run({ page, shot, mock }) {
      await openRepresentatives(page, ME_LINH);
      await row(page, "Phạm Văn Hùng").waitFor();
      await scrollTop(page);
      await shot("danh-sach", "Hộ kinh doanh: người đại diện theo pháp luật là chủ hộ", { mode: "fullPage" });

      await appointButton(page).click();
      await pick(page, "rep-representative_type", "Theo pháp luật");
      await expect(field(page, "rep-position_title")).toHaveValue("Chủ hộ kinh doanh");
      await pickDate(page, "rep-start_date", "2026-10-01");
      await pick(page, "rep-basis_document_type", "Giấy chứng nhận đăng ký hộ kinh doanh");
      await attachBasis(page, "giay-chung-nhan-ho-kinh-doanh.pdf");
      await field(page, "rep-basis_document_number").fill("01H8012345");
      await pickDate(page, "rep-basis_document_date", "2025-12-15");
      await shot("ho-ten-chu-ho", "Theo pháp luật: họ tên chủ hộ điền sẵn, không sửa");

      await confirmAppoint(page);
      await page.getByText(MESSAGES.householdSingle, { exact: true }).waitFor();
      await shot("chi-mot-nguoi", "Đã có chủ hộ đang hiệu lực: kết thúc nhiệm kỳ người cũ trước");
      expect(mock.writes).toBe(0);
    },
  }),
  representativeFlow({
    id: "don-vi-tam-ngung", name: "10. ĐƠN VỊ TẠM NGƯNG", setup: { suspended: [HA_DONG.id] },
    async run({ page, shot }) {
      await openRepresentatives(page, HA_DONG);
      await expect(appointButton(page)).toBeDisabled();
      await expect(appointButton(page)).toHaveAttribute("title", MESSAGES.repSuspended);
      await expect(await rowAction(page, "Nguyễn Văn An", "Sửa")).toBeDisabled();
      await expect(await rowAction(page, "Nguyễn Văn An", "Kết thúc nhiệm kỳ")).toBeDisabled();
      await scrollTop(page);
      await shot("nut-bi-khoa", "Đơn vị tạm ngưng: nút Bổ nhiệm, Sửa, Kết thúc nhiệm kỳ bị khóa", { mode: "fullPage" });
    },
  }),
];
