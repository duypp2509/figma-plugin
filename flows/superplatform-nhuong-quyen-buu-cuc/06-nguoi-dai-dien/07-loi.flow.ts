import { expect } from "playwright/test";
import type { FlowContext } from "../../../capture";
import {
  APPOINT, attachBasis, EDIT, HA_DONG, ME_LINH, MESSAGES, appointButton, dialog, field, openRepresentatives, openRowMenu, pick, pickDate, press,
  representativeFlow, row, rowAction, scrollTop,
} from "../../_helpers/superplatform-representatives";

/** "Danh sách người đại diện" of Hà Đông, the screen every action here starts from, as a full-page picture. */
async function listShot(page: import("playwright").Page, shot: FlowContext["shot"], stepId: string, title: string) {
  await openRepresentatives(page, HA_DONG);
  await row(page, "Nguyễn Văn An").waitFor();
  await scrollTop(page);
  await shot(stepId, title, { mode: "fullPage" });
}

export default [
  representativeFlow({
    id: "nhap-thieu", name: "NHẬP THIẾU THÔNG TIN",
    async run({ page, shot, mock }) {
      await listShot(page, shot, "danh-sach", "Danh sách người đại diện");
      await appointButton(page).click();
      const box = dialog(page, APPOINT);
      await field(page, "rep-full_name").waitFor();
      await shot("hop-bo-nhiem", "Bấm Bổ nhiệm người đại diện: hộp bổ nhiệm");

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
      await shot("bo-nhap", "Bấm Hủy khi đang nhập dở: hỏi bỏ những gì đã nhập");
      expect(mock.writes).toBe(0);
    },
  }),
  representativeFlow({
    id: "may-chu-tu-choi", name: "BỔ NHIỆM TRÙNG NGƯỜI, SỬA KHI CHƯA ĐỔI GÌ",
    async run({ page, shot, mock }) {
      // Bổ nhiệm lại người đang là người đại diện theo ủy quyền.
      await listShot(page, shot, "danh-sach", "Danh sách người đại diện: Lê Hoàng Phúc đang đại diện theo ủy quyền");
      await appointButton(page).click();
      const appoint = dialog(page, APPOINT);
      await field(page, "rep-full_name").waitFor();
      await shot("hop-bo-nhiem", "Bấm Bổ nhiệm người đại diện: hộp bổ nhiệm");
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
      await appoint.getByText("Căn cứ", { exact: true }).waitFor();
      await shot("da-nhap", "Nhập lại Lê Hoàng Phúc, người đang đại diện theo ủy quyền");

      await press(appoint.getByRole("button", { name: "Bổ nhiệm", exact: true }));
      const confirm = dialog(page, `${APPOINT}?`);
      await confirm.waitFor();
      await shot("xac-nhan", "Bấm Bổ nhiệm: kiểm tra lại trước khi bổ nhiệm");
      await confirm.getByRole("button", { name: /^(Bổ nhiệm|Xác nhận)$/ }).click();
      await page.getByText(MESSAGES.repDuplicate("Theo ủy quyền"), { exact: true }).waitFor();
      await shot("trung-nguoi", "Người này đang là người đại diện theo ủy quyền của đơn vị");

      // Mở Sửa nhưng chưa đổi gì.
      await openRepresentatives(page, HA_DONG);
      await openRowMenu(page, "Nguyễn Văn An");
      await shot("mo-menu", "Danh sách người đại diện, bấm ⋯ ở dòng Nguyễn Văn An");
      await (await rowAction(page, "Nguyễn Văn An", "Sửa")).click();
      const box = dialog(page, EDIT);
      await expect(field(page, "rep-full_name")).toHaveValue("Nguyễn Văn An");
      // Since 27/10 "Lưu" stays greyed until something changes, instead of the server answering "Không có thay đổi".
      await expect(box.getByRole("button", { name: "Lưu", exact: true })).toBeDisabled();
      await shot("khong-co-thay-doi", "Chọn Sửa, chưa đổi gì: nút Lưu bị khóa");
      expect(mock.writes).toBe(0);
    },
  }),
  representativeFlow({
    id: "ho-kinh-doanh", name: "HỘ KINH DOANH CHỈ CÓ MỘT NGƯỜI THEO PHÁP LUẬT",
    async run({ page, shot, mock }) {
      await openRepresentatives(page, ME_LINH);
      await row(page, "Phạm Văn Hùng").waitFor();
      await scrollTop(page);
      await shot("danh-sach", "Hộ kinh doanh: người đại diện theo pháp luật là chủ hộ", { mode: "fullPage" });

      await appointButton(page).click();
      const appoint = dialog(page, APPOINT);
      await field(page, "rep-full_name").waitFor();
      await shot("hop-bo-nhiem", "Bấm Bổ nhiệm người đại diện: hộp bổ nhiệm");

      await pick(page, "rep-representative_type", "Theo pháp luật");
      await expect(field(page, "rep-position_title")).toHaveValue("Chủ hộ kinh doanh");
      await pickDate(page, "rep-start_date", "2026-10-01");
      await pick(page, "rep-basis_document_type", "Giấy chứng nhận đăng ký hộ kinh doanh");
      await attachBasis(page, "giay-chung-nhan-ho-kinh-doanh.pdf");
      await field(page, "rep-basis_document_number").fill("01H8012345");
      await pickDate(page, "rep-basis_document_date", "2025-12-15");
      await shot("ho-ten-chu-ho", "Chọn Theo pháp luật: họ tên chủ hộ điền sẵn, không sửa");

      await press(appoint.getByRole("button", { name: "Bổ nhiệm", exact: true }));
      const confirm = dialog(page, `${APPOINT}?`);
      await confirm.waitFor();
      await shot("xac-nhan", "Bấm Bổ nhiệm: kiểm tra lại trước khi bổ nhiệm");
      await confirm.getByRole("button", { name: /^(Bổ nhiệm|Xác nhận)$/ }).click();
      await page.getByText(MESSAGES.householdSingle, { exact: true }).waitFor();
      await shot("chi-mot-nguoi", "Đã có chủ hộ đang hiệu lực: kết thúc nhiệm kỳ người cũ trước");
      expect(mock.writes).toBe(0);
    },
  }),
  representativeFlow({
    id: "don-vi-tam-ngung", name: "ĐƠN VỊ TẠM NGƯNG", setup: { suspended: [HA_DONG.id] },
    async run({ page, shot }) {
      await openRepresentatives(page, HA_DONG);
      await row(page, "Nguyễn Văn An").waitFor();
      await expect(appointButton(page)).toBeDisabled();
      await expect(appointButton(page)).toHaveAttribute("title", MESSAGES.repSuspended);
      await scrollTop(page);
      await shot("nut-bi-khoa", "Đơn vị tạm ngưng: nút Bổ nhiệm người đại diện bị khóa", { mode: "fullPage" });

      await openRowMenu(page, "Nguyễn Văn An");
      await expect(await rowAction(page, "Nguyễn Văn An", "Sửa")).toBeDisabled();
      await expect(await rowAction(page, "Nguyễn Văn An", "Kết thúc nhiệm kỳ")).toBeDisabled();
      await shot("menu-bi-khoa", "Bấm ⋯ ở dòng Nguyễn Văn An: Sửa, Kết thúc nhiệm kỳ bị khóa, kèm lý do");
    },
  }),
];
