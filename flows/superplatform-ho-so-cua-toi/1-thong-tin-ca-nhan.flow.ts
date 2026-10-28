import type { Page } from "playwright";
import {
  MESSAGES, contactInput, fullNameInput, openProfile, profileFlow, result, saveButton, type Contact, type ProfileContext, type ProfileSetup,
} from "../_helpers/superplatform-my-profile";

/** A page taller than the screen: the save button sits below the fold. */
const FULL = { mode: "fullPage" } as const;
const SECTION = "THÔNG TIN CÁ NHÂN VÀ LIÊN HỆ KHẨN CẤP";
const flow = (id: string, name: string, run: (ctx: ProfileContext) => Promise<void>, setup?: ProfileSetup) =>
  profileFlow(SECTION, id, name, run, setup);

const MOTHER: Contact = { name: "Trần Thị Lan", relationship: "Mẹ", phone_number: "0912345678", updated_at: "2026-10-01T02:00:00.000Z" };

/** Hovers an info icon or a lock and waits for its tooltip. */
async function hint(page: Page, label: string, text: string) {
  await page.getByLabel(label, { exact: true }).first().hover();
  await page.getByRole("tooltip").getByText(text, { exact: false }).waitFor();
}
async function save(page: Page) {
  await saveButton(page).click();
  await page.mouse.move(0, 0);
}
async function closeResult(page: Page) {
  await page.getByRole("button", { name: "Đóng", exact: true }).or(page.getByRole("button", { name: "Đã hiểu", exact: true })).last().click();
}

export default [
  flow("xem", "XEM THÔNG TIN TÀI KHOẢN", async ({ page, shot }) => {
    await openProfile(page);
    await shot("thong-tin-tai-khoan", "Thông tin tài khoản", FULL);
    await hint(page, "Giải thích: Mã nhân viên", "Do công ty quản lý; muốn đổi, liên hệ bộ phận nhân sự.");
    await shot("do-cong-ty-quan-ly", "Mã nhân viên, Email công ty do công ty quản lý");
    await hint(page, "Giải thích: Liên hệ khẩn cấp", "Quản lý của bạn xem được thông tin này.");
    await shot("quan-ly-xem-duoc", "Quản lý xem được liên hệ khẩn cấp");
  }, { contact: MOTHER }),
  flow("sua-thanh-cong", "SỬA THÔNG TIN CÁ NHÂN", async ({ page, shot }) => {
    await openProfile(page);
    await shot("thong-tin-tai-khoan", "Thông tin tài khoản: chưa sửa gì, nút Cập nhật thông tin mờ", FULL);
    await fullNameInput(page).fill("Nguyễn Thị Minh Anh");
    await saveButton(page).and(page.locator(":enabled")).waitFor();
    await shot("da-sua", "Sửa họ tên: nút Cập nhật thông tin sáng lên", FULL);
    await save(page);
    await result(page, MESSAGES.saved);
    await shot("thanh-cong", "Cập nhật thông tin thành công");
  }),
  flow("theo-can-cuoc", "HỌ TÊN, NGÀY SINH, GIỚI TÍNH THEO CĂN CƯỚC ĐÃ XÁC THỰC", async ({ page, shot }) => {
    await openProfile(page);
    await page.getByText("Đã xác thực", { exact: true }).first().waitFor();
    await hint(page, MESSAGES.cardLock, MESSAGES.cardLock);
    await shot("khoa-theo-can-cuoc", "Căn cước đã xác thực: họ tên, ngày sinh, giới tính bị khóa");
  }, { documentStatus: "VERIFIED", fullName: "NGUYỄN MINH ANH", contact: MOTHER }),
  flow("nhap-lieu", "LỖI NHẬP LIỆU", async ({ page, shot }) => {
    await openProfile(page);
    await shot("thong-tin-tai-khoan", "Thông tin tài khoản", FULL);
    await page.getByRole("button", { name: "Xóa họ tên", exact: true }).click();
    await page.getByText(MESSAGES.nameEmpty, { exact: true }).waitFor();
    await shot("ho-ten-trong", "Xóa họ tên: báo phải nhập họ và tên", FULL);
    await fullNameInput(page).fill("Nguyễn Minh Anh");
    await contactInput(page, "name").fill("Trần Thị Lan");
    await saveButton(page).and(page.locator(":enabled")).waitFor();
    await page.mouse.move(0, 0);
    await shot("nhap-thieu-lien-he", "Nhập lại họ tên, liên hệ khẩn cấp chỉ nhập họ tên", FULL);
    await save(page);
    await page.getByText(MESSAGES.contactIncomplete, { exact: true }).waitFor();
    await shot("lien-he-thieu", "Liên hệ khẩn cấp nhập thiếu", FULL);
  }),
  flow("lien-he-khan-cap", "THÊM, SỬA, GỠ LIÊN HỆ KHẨN CẤP", async ({ page, shot, mock }) => {
    await openProfile(page);
    await shot("thong-tin-tai-khoan", "Thông tin tài khoản: chưa có liên hệ khẩn cấp", FULL);
    await contactInput(page, "name").fill("Trần Thị Lan");
    await contactInput(page, "relationship").fill("Mẹ");
    await contactInput(page, "phoneNumber").fill("0912 345 67");
    await page.mouse.move(0, 0);
    await shot("nhap-so-thieu", "Nhập liên hệ khẩn cấp, số điện thoại thiếu một chữ số", FULL);
    await save(page);
    await result(page, MESSAGES.contactPhoneInvalid);
    await shot("so-khong-hop-le", "Số điện thoại người liên hệ không hợp lệ");
    await closeResult(page);
    await contactInput(page, "phoneNumber").fill("0912 345 678");
    await shot("da-nhap", "Nhập đủ họ tên, quan hệ, số điện thoại", FULL);
    await save(page);
    await result(page, MESSAGES.saved);
    await shot("da-luu", "Đã lưu liên hệ khẩn cấp");
    await closeResult(page);
    for (const key of ["name", "relationship", "phoneNumber"] as const) await contactInput(page, key).fill("");
    await shot("xoa-het", "Xóa hết ba ô để gỡ liên hệ khẩn cấp", FULL);
    await save(page);
    await result(page, MESSAGES.saved);
    if (mock.contact) throw new Error("Liên hệ khẩn cấp chưa được gỡ");
    await shot("da-go", "Đã gỡ liên hệ khẩn cấp");
  }),
];
