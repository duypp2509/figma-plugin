import {
  contactDialog, contactFlow, editButton, expect, field, filterKind, historyDialog, openContactEdit, openHistory, openSection,
  pickDay, save,
} from "../../_helpers/superplatform-unit-contacts";
import {
  FRANCHISE_ID, MESSAGES, POST_OFFICE_ID, dismissError, openOverview, toast, waitError,
} from "../../_helpers/superplatform-unit-profile";

const HISTORY = "Lịch sử liên hệ";

export default [
  contactFlow({
    id: "xem", name: "01. XEM LIÊN HỆ, CÒN THIẾU SỐ ĐIỆN THOẠI",
    setup: units => { units[POST_OFFICE_ID]!.contacts.PHONE = null; },
    async run({ page, shot }) {
      await openSection(page, POST_OFFICE_ID, "contacts");
      await page.getByText(MESSAGES.missing, { exact: true }).waitFor();
      await shot("buu-cuc-thieu-so", "Bưu cục chưa có số điện thoại: Còn thiếu, cần cập nhật");

      await openSection(page, FRANCHISE_ID, "contacts");
      await page.getByText("https://vanchuyenhadong.vn", { exact: true }).waitFor();
      await shot("nhuong-quyen", "Nhượng quyền có thêm dòng Website");
    },
  }),
  contactFlow({
    id: "sua-thanh-cong", name: "02. SỬA LIÊN HỆ THÀNH CÔNG",
    async run({ page, shot, mock }) {
      await openSection(page, POST_OFFICE_ID, "contacts");
      await editButton(page).waitFor();
      await shot("lien-he", "Liên hệ của bưu cục");

      await openContactEdit(page);
      await expect(field(page, "contacts.PHONE")).toHaveValue("02433551234");
      await shot("hop-sua", "Hộp Sửa liên hệ, điền sẵn giá trị hiện tại");

      await field(page, "contacts.PHONE").fill("024 3355 9999");
      await field(page, "contacts.PHONE").blur();
      await shot("da-sua", "Đổi số tổng đài");

      await save(contactDialog(page));
      await toast(page, "Đã lưu liên hệ.").waitFor();
      await contactDialog(page).waitFor({ state: "hidden" });
      await page.getByText("02433559999", { exact: true }).waitFor();
      await shot("da-luu", "Đã lưu liên hệ");

      await openOverview(page, POST_OFFICE_ID);
      await page.getByText("02433559999", { exact: true }).waitFor();
      await shot("tong-quan", "Ô Liên hệ ở Tổng quan hiện số mới");
      expect(mock.writes).toBe(1);
    },
  }),
  contactFlow({
    id: "nhap-sai", name: "03. SỐ ĐIỆN THOẠI, EMAIL KHÔNG ĐÚNG",
    async run({ page, shot, mock }) {
      await openSection(page, POST_OFFICE_ID, "contacts");
      await openContactEdit(page);
      await field(page, "contacts.PHONE").fill("1900 636677");
      await save(contactDialog(page));
      await contactDialog(page).getByText(MESSAGES.phone, { exact: true }).waitFor();
      await shot("so-sai", "Số tổng đài 1900: báo dưới ô Số điện thoại");

      await field(page, "contacts.PHONE").fill("");
      await save(contactDialog(page));
      await contactDialog(page).getByText(MESSAGES.phoneRequired, { exact: true }).waitFor();
      await shot("xoa-trong-so", "Xóa trống số điện thoại");

      await field(page, "contacts.PHONE").fill("024 3355 1234");
      await field(page, "contacts.EMAIL").fill("buucucvanquan@supership");
      await save(contactDialog(page));
      await contactDialog(page).getByText(MESSAGES.email, { exact: true }).waitFor();
      await shot("email-sai", "Email thiếu tên miền");
      expect(mock.writes).toBe(0);
    },
  }),
  contactFlow({
    id: "khong-doi-bi-sua", name: "04. KHÔNG CÓ THAY ĐỔI, VỪA BỊ NGƯỜI KHÁC SỬA",
    async run({ page, shot, mock }) {
      await openSection(page, POST_OFFICE_ID, "contacts");
      await openContactEdit(page);
      await field(page, "contacts.PHONE").fill("024.3355.1234");
      await save(contactDialog(page));
      await waitError(page, MESSAGES.noChange);
      await shot("khong-co-thay-doi", "Cùng số, chỉ khác dấu chấm: Không có thay đổi");

      await dismissError(page);
      await field(page, "contacts.PHONE").fill("024 3355 9999");
      // Another manager changes the Email while this dialog is open.
      mock.beforeWrite = () => {
        const unit = mock.units[POST_OFFICE_ID]!;
        unit.contacts.EMAIL = "vanquan@supership.vn"; unit.contactsVersion++;
      };
      await save(contactDialog(page));
      await waitError(page, MESSAGES.contactsConflict);
      await shot("bi-nguoi-khac-sua", "Liên hệ vừa được người khác sửa");

      await dismissError(page);
      await contactDialog(page).getByRole("button", { name: "Tải lại", exact: true }).click();
      await contactDialog(page).waitFor({ state: "hidden" });
      await page.getByText("vanquan@supership.vn", { exact: true }).waitFor();
      await shot("da-tai-lai", "Tải lại: hiện Email người kia vừa lưu");
      expect(mock.writes).toBe(0);
    },
  }),
  contactFlow({
    id: "lich-su", name: "05. XEM LỊCH SỬ LIÊN HỆ",
    async run({ page, shot }) {
      await openSection(page, POST_OFFICE_ID, "contacts");
      await openHistory(page, HISTORY);
      const dialog = historyDialog(page, HISTORY);
      await expect(dialog.locator("ol li")).toHaveCount(4);
      await shot("tat-ca", "Lịch sử liên hệ, mới nhất trước");

      await filterKind(dialog, "Số điện thoại");
      await expect(dialog.locator("ol li")).toHaveCount(2);
      await shot("loc-so-dien-thoai", "Lọc theo loại: Số điện thoại");

      await pickDay(dialog, "Từ ngày", "2026-01-01");
      await expect(dialog.locator("ol li")).toHaveCount(1);
      await shot("loc-tu-ngay", "Thêm khoảng ngày: từ 01/01/2026");
    },
  }),
  contactFlow({
    id: "tam-ngung", name: "06. ĐƠN VỊ ĐANG TẠM NGƯNG",
    setup: units => { Object.assign(units[POST_OFFICE_ID]!, { status: "SUSPENDED", since: "2026-10-05T02:00:00Z" }); },
    async run({ page, shot }) {
      await openSection(page, POST_OFFICE_ID, "contacts");
      await expect(editButton(page)).toBeDisabled();
      await page.getByText(MESSAGES.contactsSuspended, { exact: true }).waitFor();
      await shot("nut-sua-tat", "Nút Sửa tắt, kèm lý do");

      await openHistory(page, HISTORY);
      await shot("van-xem-lich-su", "Vẫn xem được lịch sử");
    },
  }),
];
