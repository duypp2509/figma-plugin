import { expect } from "playwright/test";
import {
  HA_DONG, MESSAGES, dialog, enterCode, field, formButton, legalButton, legalFlow, openLegal, pick, pickDate, press, scrollTop,
  toast, waitCode,
} from "../../_helpers/superplatform-legal-profile";

const CONFIRM = "Sửa thông tin pháp lý?";

async function save(page: import("playwright").Page) {
  await press(formButton(page, "Lưu thay đổi"));
  await dialog(page, CONFIRM).waitFor();
}

export default [
  legalFlow({
    id: "sua-email-hoa-don", name: "04. SỬA EMAIL NHẬN HÓA ĐƠN", setup: { haDong: "VERIFIED" },
    async run({ page, shot, mock }) {
      await openLegal(page, HA_DONG);
      await page.getByText("Đã xác minh", { exact: true }).waitFor();
      await legalButton(page, "Sửa").click();
      await page.waitForURL("**/legal/edit");
      await page.getByRole("heading", { level: 1, name: "Sửa thông tin pháp lý", exact: true }).waitFor();
      await expect(field(page, "invoice_email")).toHaveValue("ketoan@vanchuyenhadong.vn");
      await scrollTop(page);
      await shot("trang-sua", "Trang sửa: điền sẵn thông tin hiện tại, khóa hình thức và mã số", { mode: "fullPage" });

      await field(page, "invoice_email").fill("hoadon@vanchuyenhadong.vn");
      await save(page);
      await shot("xac-nhan", "Kiểm tra lại trước khi lưu");
      await dialog(page, CONFIRM).getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");

      await enterCode(page);
      await page.waitForURL("**section=legal-entities");
      await toast(page, MESSAGES.saved).waitFor();
      await page.getByText("hoadon@vanchuyenhadong.vn", { exact: true }).waitFor();
      await page.getByText("Đã xác minh", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("da-luu", "Đã lưu: đổi Email nhận hóa đơn vẫn giữ Đã xác minh", { mode: "fullPage" });
      expect(mock.input.legal.invoice_email).toBe("hoadon@vanchuyenhadong.vn");
    },
  }),
  legalFlow({
    id: "doi-tru-so", name: "05. ĐỔI ĐỊA CHỈ TRỤ SỞ", setup: { haDong: "VERIFIED" },
    async run({ page, shot, mock }) {
      await openLegal(page, HA_DONG);
      await legalButton(page, "Sửa").click();
      await page.waitForURL("**/legal/edit");
      await field(page, "address.address_line").waitFor();

      await pick(page, "address.ward_code", "Phường Dương Nội");
      await field(page, "address.address_line").fill("Số 12 đường Lê Trọng Tấn");
      await field(page, "latest_amendment_number").fill("3");
      await pickDate(page, "latest_amendment_on", "2026-10-08");
      await page.getByText("Sau khi lưu sẽ chờ xác minh lại.", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("da-sua", "Đổi trụ sở: bắt buộc lần đăng ký thay đổi, báo sẽ chờ xác minh lại", { mode: "fullPage" });

      await save(page);
      await dialog(page, CONFIRM).getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
      await waitCode(page);
      await enterCode(page);
      await page.waitForURL("**section=legal-entities");
      await toast(page, MESSAGES.savedPending).waitFor();
      await page.getByText("Số 12 đường Lê Trọng Tấn, Phường Dương Nội, Thành phố Hà Nội", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("da-luu", "Đã lưu: thông tin về Chưa xác minh, chờ đối chiếu lại", { mode: "fullPage" });
      expect(mock.legal[HA_DONG.id]!.at(-1)!.verification.status).toBe("UNVERIFIED");
    },
  }),
];
