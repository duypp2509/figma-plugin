import type { Page } from "playwright";
import {
  applyDay, contactDialog, contactFlow, editButton, expect, field, filterKind, historyRows, openContactEdit, openHistory,
  openKindFilter, openSection, save, typeDay,
} from "../../_helpers/superplatform-unit-contacts";
import { FRANCHISE_ID, MESSAGES, POST_OFFICE_ID, closeToasts, sideLink, toast, waitOverview } from "../../_helpers/superplatform-unit-profile";

const HISTORY = "Lịch sử liên hệ";
const saveButton = (page: Page) => contactDialog(page).getByRole("button", { name: "Lưu", exact: true });

/** "Liên hệ" of Bưu cục Văn Quán, the screen every change starts from. */
async function start(page: Page, shot: (stepId: string, title: string) => Promise<void>) {
  await openSection(page, POST_OFFICE_ID, "contacts");
  await expect(editButton(page)).toBeEnabled();
  await shot("lien-he", "Liên hệ của bưu cục: nút Sửa");
}

export default [
  contactFlow({
    id: "xem", name: "XEM LIÊN HỆ, CÒN THIẾU SỐ ĐIỆN THOẠI",
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
    id: "sua-thanh-cong", name: "SỬA LIÊN HỆ THÀNH CÔNG",
    async run({ page, shot, mock }) {
      await start(page, shot);

      await openContactEdit(page);
      await expect(field(page, "contacts.PHONE")).toHaveValue("02433551234");
      await shot("hop-sua", "Bấm Sửa: hộp Sửa liên hệ, điền sẵn giá trị hiện tại");

      await field(page, "contacts.PHONE").fill("024 3355 9999");
      await field(page, "contacts.PHONE").blur();
      await expect(saveButton(page)).toBeEnabled();
      await shot("da-sua", "Nhập số tổng đài mới");

      await save(contactDialog(page));
      await toast(page, "Đã lưu liên hệ.").waitFor();
      await contactDialog(page).waitFor({ state: "hidden" });
      await page.getByText("02433559999", { exact: true }).waitFor();
      await shot("da-luu", "Bấm Lưu: đã lưu liên hệ");

      await closeToasts(page);
      await sideLink(page, "Tổng quan");
      await waitOverview(page);
      await page.getByText("02433559999", { exact: true }).waitFor();
      await shot("tong-quan", "Bấm Tổng quan: ô Liên hệ hiện số mới");
      expect(mock.writes).toBe(1);
    },
  }),
  contactFlow({
    id: "nhap-sai", name: "SỐ ĐIỆN THOẠI, EMAIL KHÔNG ĐÚNG",
    async run({ page, shot, mock }) {
      await start(page, shot);

      await openContactEdit(page);
      await shot("hop-sua", "Bấm Sửa: hộp Sửa liên hệ");

      await field(page, "contacts.PHONE").fill("1900 636677");
      await save(contactDialog(page));
      await contactDialog(page).getByText(MESSAGES.phone, { exact: true }).waitFor();
      await shot("so-sai", "Nhập số tổng đài 1900, bấm Lưu: báo dưới ô Số điện thoại");

      await field(page, "contacts.PHONE").fill("");
      await save(contactDialog(page));
      await contactDialog(page).getByText(MESSAGES.phoneRequired, { exact: true }).waitFor();
      await shot("xoa-trong-so", "Xóa trống số điện thoại, bấm Lưu");

      await field(page, "contacts.PHONE").fill("024 3355 1234");
      await field(page, "contacts.EMAIL").fill("buucucvanquan@supership");
      await save(contactDialog(page));
      await contactDialog(page).getByText(MESSAGES.email, { exact: true }).waitFor();
      await shot("email-sai", "Email thiếu tên miền, bấm Lưu");
      expect(mock.writes).toBe(0);
    },
  }),
  contactFlow({
    id: "khong-doi-bi-sua", name: "KHÔNG CÓ THAY ĐỔI",
    async run({ page, shot, mock }) {
      await start(page, shot);

      await openContactEdit(page);
      await expect(saveButton(page)).toBeDisabled();
      await shot("hop-sua", "Bấm Sửa, chưa sửa gì: nút Lưu bị khóa");

      await field(page, "contacts.PHONE").fill("024.3355.1234");
      // The web compares as the server does (a phone by its digits): "Lưu" stays greyed.
      await expect(saveButton(page)).toBeDisabled();
      await shot("khong-co-thay-doi", "Cùng số, chỉ khác dấu chấm: nút Lưu vẫn khóa");
      expect(mock.writes).toBe(0);
    },
  }),
  contactFlow({
    id: "lich-su", name: "XEM LỊCH SỬ LIÊN HỆ",
    async run({ page, shot }) {
      await openSection(page, POST_OFFICE_ID, "contacts");
      await shot("lien-he", "Liên hệ của bưu cục: nút Xem lịch sử");

      await openHistory(page, HISTORY);
      await expect(historyRows(page)).toHaveCount(4);
      await shot("tat-ca", "Bấm Xem lịch sử: lịch sử liên hệ, mới nhất trước");

      await openKindFilter(page, "Loại liên hệ", "Số điện thoại");
      await shot("mo-loai", "Bấm ô Loại liên hệ: danh sách loại");

      await filterKind(page, "Loại liên hệ", "Số điện thoại", true);
      await expect(historyRows(page)).toHaveCount(2);
      await shot("loc-so-dien-thoai", "Chọn Số điện thoại: chỉ còn thay đổi số điện thoại");

      const calendar = await typeDay(page, "Từ ngày", "2026-01-01");
      await shot("chon-tu-ngay", "Bấm ô Từ ngày, nhập 01/01/2026");

      await applyDay(calendar);
      await expect(historyRows(page)).toHaveCount(1);
      await shot("loc-tu-ngay", "Bấm Áp dụng: thay đổi từ 01/01/2026");
    },
  }),
  contactFlow({
    id: "tam-ngung", name: "ĐƠN VỊ ĐANG TẠM NGƯNG",
    setup: units => { Object.assign(units[POST_OFFICE_ID]!, { status: "SUSPENDED", since: "2026-10-05T02:00:00Z" }); },
    async run({ page, shot }) {
      await openSection(page, POST_OFFICE_ID, "contacts");
      await expect(editButton(page)).toBeDisabled();
      await page.getByText(MESSAGES.contactsSuspended, { exact: true }).waitFor();
      await shot("nut-sua-tat", "Bưu cục đang tạm ngưng: nút Sửa tắt, kèm lý do");

      await openHistory(page, HISTORY);
      await shot("van-xem-lich-su", "Bấm Xem lịch sử: vẫn xem được lịch sử");
    },
  }),
];
