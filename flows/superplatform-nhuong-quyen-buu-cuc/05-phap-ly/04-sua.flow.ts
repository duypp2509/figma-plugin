import { expect } from "playwright/test";
import type { FlowContext } from "../../../capture";
import {
  HA_DONG, MESSAGES, confirmButton, dialog, editPageLoaded, enterCode, field, formButton, legalButton, legalFlow, legalLoaded, openLegal,
  pick, pickDate, press, scrollTop, toast, waitCode,
} from "../../_helpers/superplatform-legal-profile";

const CONFIRM = "Lưu thông tin pháp lý?";

async function save(page: import("playwright").Page) {
  await press(formButton(page, "Lưu thay đổi"));
  await dialog(page, CONFIRM).waitFor();
}

/** "Thông tin pháp lý" of Hà Đông (verified), the screen "Sửa" starts from; then "Sửa" opens its page. */
async function openEdit(page: import("playwright").Page, shot: FlowContext["shot"]) {
  await openLegal(page, HA_DONG);
  await page.locator(".legal-page aside").getByText("Đã xác minh", { exact: true }).waitFor();
  await scrollTop(page);
  await shot("phap-ly", "Thông tin pháp lý đã xác minh: bấm Sửa", { mode: "fullPage" });
  await legalButton(page, "Sửa").click();
  await page.waitForURL("**/legal/edit");
  await editPageLoaded(page, "edit");
  await expect(field(page, "legal.invoice_email")).toHaveValue("ketoan@vanchuyenhadong.vn");
}

export default [
  legalFlow({
    id: "sua-email-hoa-don", name: "SỬA EMAIL NHẬN HÓA ĐƠN", setup: { haDong: "VERIFIED" },
    async run({ page, shot, mock }) {
      await openEdit(page, shot);
      await scrollTop(page);
      await shot("trang-sua", "Trang sửa: điền sẵn thông tin hiện tại, khóa hình thức, mã số và số giấy", { mode: "fullPage" });

      await field(page, "legal.invoice_email").fill("hoadon@vanchuyenhadong.vn");
      await expect(formButton(page, "Lưu thay đổi")).toBeEnabled();
      await scrollTop(page);
      await shot("da-sua", "Đổi Email nhận hóa đơn thành hoadon@vanchuyenhadong.vn", { mode: "fullPage" });

      await save(page);
      await shot("xac-nhan", "Bấm Lưu thay đổi: kiểm tra lại trước khi lưu");
      await confirmButton(dialog(page, CONFIRM), "Lưu").click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");

      await enterCode(page);
      await page.waitForURL("**section=legal-entities");
      await toast(page, MESSAGES.saved).waitFor();
      await legalLoaded(page);
      await page.getByText("hoadon@vanchuyenhadong.vn", { exact: true }).waitFor();
      await page.locator(".legal-page aside").getByText("Đã xác minh", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("da-luu", "Đã lưu: đổi Email nhận hóa đơn vẫn giữ Đã xác minh", { mode: "fullPage" });
      expect(mock.input.legal.invoice_email).toBe("hoadon@vanchuyenhadong.vn");
    },
  }),
  legalFlow({
    // Quản lý nhượng quyền: a change of verified registered details waits for the verification (P12).
    id: "doi-tru-so", name: "ĐỔI ĐỊA CHỈ TRỤ SỞ", setup: { haDong: "VERIFIED", role: "manager" },
    async run({ page, shot, mock }) {
      await openEdit(page, shot);
      await scrollTop(page);
      await shot("trang-sua", "Trang sửa: điền sẵn trụ sở hiện tại", { mode: "fullPage" });

      await pick(page, "legal.address.ward_code", "Phường Dương Nội");
      await field(page, "legal.address.address_line").fill("Số 12 đường Lê Trọng Tấn");
      // A new registered address is an "đăng ký thay đổi": its number and day show at once, required.
      await field(page, "legal.latest_amendment_number").fill("3");
      await pickDate(page, "legal.latest_amendment_on", "2026-10-08");
      await scrollTop(page);
      await shot("da-sua", "Đổi trụ sở: bắt buộc nhập lần và ngày đăng ký thay đổi", { mode: "fullPage" });

      await save(page);
      await shot("xac-nhan", "Bấm Lưu thay đổi: kiểm tra lại trước khi lưu");
      await confirmButton(dialog(page, CONFIRM), "Lưu").click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");

      await enterCode(page);
      await page.waitForURL("**section=legal-entities");
      await toast(page, MESSAGES.amendmentSent).waitFor();
      await legalLoaded(page);
      const request = page.locator('section[aria-labelledby="legal-pending-title"]');
      await request.getByText("Sửa đang chờ xác minh", { exact: true }).waitFor();
      await request.getByText("Số 12 đường Lê Trọng Tấn, Phường Dương Nội, Thành phố Hà Nội", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("da-luu", "Đã gửi yêu cầu sửa: trụ sở cũ vẫn áp dụng đến khi được xác minh", { mode: "fullPage" });
      expect(mock.requests[HA_DONG.id]!.at(-1)!.status).toBe("PENDING");
      expect(mock.legal[HA_DONG.id]!.at(-1)!.verification.status).toBe("VERIFIED");
    },
  }),
];
