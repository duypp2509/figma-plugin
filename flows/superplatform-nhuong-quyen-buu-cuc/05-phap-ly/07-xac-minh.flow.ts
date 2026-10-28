import { expect } from "playwright/test";
import {
  HA_DONG, MESSAGES, dialog, enterCode, legalButton, legalFlow, openHistory, openLegal, pick, pickIn, scrollTop, toast, waitCode,
} from "../../_helpers/superplatform-legal-profile";

const SUBJECT = "CÔNG TY TNHH VẬN CHUYỂN HÀ ĐÔNG";

export default [
  legalFlow({
    id: "xac-minh", name: "XÁC MINH THÔNG TIN PHÁP LÝ",
    async run({ page, shot, mock }) {
      await openLegal(page, HA_DONG);
      await legalButton(page, "Xác minh").waitFor();
      await scrollTop(page);
      await shot("phap-ly", "Thông tin pháp lý chờ xác minh: nút Xác minh, Từ chối", { mode: "fullPage" });

      await legalButton(page, "Xác minh").click();
      const box = dialog(page, `Xác minh ${SUBJECT}?`);
      await box.getByText("Nguồn đối chiếu").first().waitFor();
      await shot("hop-xac-minh", "Bấm Xác minh: chọn nguồn đối chiếu, ngày đối chiếu mặc định hôm nay");

      await pick(page, "verification-source", "Cổng thông tin quốc gia về đăng ký doanh nghiệp");
      await shot("da-chon-nguon", "Đã chọn nguồn đối chiếu");
      await box.getByRole("button", { name: "Xác minh", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Bấm Xác minh: nhập mã xác thực");

      await enterCode(page);
      await toast(page, MESSAGES.verified).waitFor();
      const aside = page.locator(".legal-page aside");
      await aside.getByText("Đã xác minh", { exact: true }).waitFor();
      await aside.getByText("Cổng thông tin quốc gia về đăng ký doanh nghiệp", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("da-xac-minh", "Đã xác minh: ghi người, ngày và nguồn đối chiếu", { mode: "fullPage" });
      expect(mock.input).toMatchObject({ status: "VERIFIED", source: "NATIONAL_BUSINESS_REGISTRY", checked_on: "2026-10-12" });
    },
  }),
  legalFlow({
    id: "tu-choi-xac-minh", name: "TỪ CHỐI XÁC MINH",
    async run({ page, shot, mock }) {
      await openLegal(page, HA_DONG);
      await legalButton(page, "Từ chối").waitFor();
      await scrollTop(page);
      await shot("phap-ly", "Thông tin pháp lý chờ xác minh: nút Xác minh, Từ chối", { mode: "fullPage" });

      await legalButton(page, "Từ chối").click();
      const box = dialog(page, `Từ chối xác minh ${SUBJECT}?`);
      await box.getByRole("combobox").filter({ hasText: "Chọn lý do" }).waitFor();
      await shot("hop-tu-choi", "Bấm Từ chối: hộp từ chối xác minh, chọn lý do");

      // A reason is chosen from the catalog "Lý do thao tác" before "Từ chối" unlocks.
      await pickIn(page, box, "Thông tin không khớp giấy tờ");
      await expect(box.getByRole("button", { name: "Từ chối", exact: true })).toBeEnabled();
      await shot("da-chon-ly-do", "Đã chọn lý do: Thông tin không khớp giấy tờ");
      await box.getByRole("button", { name: "Từ chối", exact: true }).click();
      await waitCode(page);
      await shot("ma-xac-thuc", "Bấm Từ chối: nhập mã xác thực");

      await enterCode(page);
      await toast(page, MESSAGES.rejected).waitFor();
      await page.getByText("Lý do: Thông tin không khớp giấy tờ", { exact: true }).waitFor();
      await scrollTop(page);
      await shot("bi-tu-choi", "Từ chối xác minh: ghi lý do, chờ đơn vị sửa lại thông tin", { mode: "fullPage" });
      expect(mock.input).toMatchObject({ status: "REJECTED", reason_code: "THONG_TIN_KHONG_KHOP_GIAY_TO" });
    },
  }),
  legalFlow({
    id: "lich-su", name: "XEM LỊCH SỬ", setup: { haDong: "VERIFIED" },
    async run({ page, shot }) {
      await openLegal(page, HA_DONG);
      await legalButton(page, "Lịch sử").waitFor();
      await scrollTop(page);
      await shot("phap-ly", "Thông tin pháp lý: bấm Lịch sử", { mode: "fullPage" });

      await openHistory(page);
      await page.getByRole("heading", { name: "Khai báo", exact: true }).waitFor();
      await page.getByRole("heading", { name: "Thông tin thay đổi", exact: true }).waitFor();
      await scrollTop(page);
      await shot("lich-su", "Lịch sử: lần khai báo và lần sửa, kèm ô đã đổi", { mode: "fullPage" });
    },
  }),
];
