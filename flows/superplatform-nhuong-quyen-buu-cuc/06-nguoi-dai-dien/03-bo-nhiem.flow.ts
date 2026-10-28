import { expect } from "playwright/test";
import {
  APPOINT, attachBasis, DONG_ANH, HA_DONG, MESSAGES, appointButton, dialog, enterCode, field, openRepresentatives, pick, pickDate, press, reminder,
  representativeFlow, row, scrollTop, toast, waitCode,
} from "../../_helpers/superplatform-representatives";

async function confirmAppoint(page: import("playwright").Page) {
  await press(dialog(page, APPOINT).getByRole("button", { name: "Bổ nhiệm", exact: true }));
  await dialog(page, `${APPOINT}?`).waitFor();
}

export default [
  representativeFlow({
    id: "bo-nhiem-theo-phap-luat", name: "03. BỔ NHIỆM THEO PHÁP LUẬT",
    async run({ page, shot, mock }) {
      await openRepresentatives(page, DONG_ANH);
      await reminder(page, "Chưa có người đại diện theo pháp luật, cần cập nhật.").waitFor();
      await shot("thieu-nguoi-theo-phap-luat", "Nhắc: chưa có người đại diện theo pháp luật");

      await appointButton(page).click();
      const box = dialog(page, APPOINT);
      await field(page, "rep-full_name").waitFor();
      await shot("hop-bo-nhiem", "Hộp bổ nhiệm người đại diện");

      // Giám đốc cũ thôi việc 30/09/2026; Hội đồng quản trị bổ nhiệm giám đốc mới từ 01/10/2026.
      await pick(page, "rep-representative_type", "Theo pháp luật");
      await field(page, "rep-full_name").fill("Đặng Quốc Bảo");
      await field(page, "rep-position_title").fill("Giám đốc");
      await pick(page, "rep-person_id", "Đặng Quốc Bảo");
      await pickDate(page, "rep-start_date", "2026-10-01");
      await pick(page, "rep-basis_document_type", "Quyết định bổ nhiệm");
      await attachBasis(page, "quyet-dinh-bo-nhiem-09-2026.pdf");
      await field(page, "rep-basis_document_number").fill("09/2026/QĐ-HĐQT");
      await pickDate(page, "rep-basis_document_date", "2026-09-30");
      await box.getByText("Căn cứ", { exact: true }).waitFor();
      await shot("da-nhap", "Đã nhập: loại, họ tên, chức danh, tài khoản liên kết, ngày bắt đầu, căn cứ");

      await confirmAppoint(page);
      await shot("xac-nhan", "Kiểm tra lại trước khi bổ nhiệm");
      await dialog(page, `${APPOINT}?`).getByRole("button", { name: /^(Bổ nhiệm|Xác nhận)$/ }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");

      await enterCode(page);
      await toast(page, MESSAGES.appointed).waitFor();
      await row(page, "Đặng Quốc Bảo").waitFor();
      await expect(reminder(page, "Chưa có người đại diện theo pháp luật, cần cập nhật.")).toHaveCount(0);
      await scrollTop(page);
      await shot("da-bo-nhiem", "Đã bổ nhiệm: hết nhắc thiếu người đại diện theo pháp luật", { mode: "fullPage" });
      expect(mock.input).toMatchObject({ representative_type: "LEGAL_REPRESENTATIVE", person_id: "person-bao", start_date: "2026-10-01" });
    },
  }),
  representativeFlow({
    id: "bo-nhiem-theo-uy-quyen", name: "04. BỔ NHIỆM THEO ỦY QUYỀN",
    async run({ page, shot, mock }) {
      await openRepresentatives(page, HA_DONG);
      await appointButton(page).click();
      await pick(page, "rep-representative_type", "Theo ủy quyền");
      await field(page, "rep-scope_of_authority").waitFor();
      await shot("chon-theo-uy-quyen", "Theo ủy quyền: thêm phạm vi ủy quyền và ngày kết thúc");

      await field(page, "rep-full_name").fill("Vũ Thị Lan");
      await field(page, "rep-position_title").fill("Kế toán trưởng");
      await pick(page, "rep-person_id", "Vũ Thị Lan");
      await field(page, "rep-scope_of_authority").fill("Ký biên bản đối soát, xác nhận công nợ với SuperShip");
      await pickDate(page, "rep-start_date", "2026-10-01");
      await pickDate(page, "rep-end_date", "2026-12-31");
      await pick(page, "rep-basis_document_type", "Giấy ủy quyền");
      await attachBasis(page, "giay-uy-quyen-09-2026.pdf");
      await field(page, "rep-basis_document_number").fill("09/2026/UQ");
      await pickDate(page, "rep-basis_document_date", "2026-09-30");
      await shot("da-nhap", "Đã nhập phạm vi ủy quyền, thời hạn đến 31/12/2026 và giấy ủy quyền");

      await confirmAppoint(page);
      await shot("xac-nhan", "Kiểm tra lại trước khi bổ nhiệm");
      await dialog(page, `${APPOINT}?`).getByRole("button", { name: /^(Bổ nhiệm|Xác nhận)$/ }).click();
      await waitCode(page);
      await enterCode(page);
      await toast(page, MESSAGES.appointed).waitFor();
      await row(page, "Vũ Thị Lan").waitFor();
      await scrollTop(page);
      await shot("da-bo-nhiem", "Đã bổ nhiệm người đại diện theo ủy quyền", { mode: "fullPage" });
      expect(mock.input).toMatchObject({ representative_type: "AUTHORIZED_REPRESENTATIVE", end_date: "2026-12-31" });
    },
  }),
];
