import type { Locator, Page } from "playwright";
import { expect } from "playwright/test";
import {
  HUONG_GIANG, MESSAGES, SHOP_CHECK_NAMES, SUBJECT, decided, dialogNamed, listLoaded, openList, rest, row, scrollTo, sendCode,
  typeCode, typeTab, verificationFlow,
} from "../_helpers/superplatform-verification-requests";

/** "Xem hồ sơ" of a Shop's row: the review panel, its certificate drawn. */
async function openReview(page: Page, subject: string): Promise<Locator> {
  await row(page, subject).getByRole("button", { name: "Xem hồ sơ", exact: true }).click();
  const panel = page.getByRole("dialog", { name: subject, exact: true });
  await panel.getByRole("heading", { name: "Thông tin trên giấy", exact: true }).waitFor();
  await shown(panel, "Giấy chứng nhận");
  return panel;
}
async function shown(panel: Locator, title: string) {
  const picture = panel.getByRole("img", { name: title });
  await picture.waitFor();
  await picture.evaluate(node => (node as HTMLImageElement).decode());
}

export default [
  verificationFlow({
    id: "duyet-cua-hang", name: "DUYỆT GIẤY PHÉP KINH DOANH CỦA CỬA HÀNG",
    async run({ page, shot, mock }) {
      await openList(page);
      await rest(page);
      await shot("danh-sach", "Danh sách yêu cầu chờ xác minh");

      await typeTab(page, "Giấy phép kinh doanh").click();
      await row(page, SUBJECT.amendment).waitFor({ state: "detached" });
      await listLoaded(page);
      await rest(page);
      await shot("loc-giay-phep", "Lọc theo loại yêu cầu: Giấy phép kinh doanh");

      const panel = await openReview(page, SUBJECT.shop);
      await panel.getByText("Máy đọc: Số 16 đường Nguyễn Trãi", { exact: false }).waitFor();
      await rest(page);
      await shot("ho-so", "Bấm Xem hồ sơ: giấy chứng nhận bên trái, thông tin Shop gửi và cảnh báo bên phải");

      await panel.getByRole("button", { name: "Giấy ủy quyền", exact: true }).click();
      await shown(panel, "Giấy ủy quyền");
      await rest(page);
      await shot("giay-uy-quyen", "Xem giấy ủy quyền của người nộp");

      await scrollTo(panel.getByRole("heading", { name: "Điểm kiểm", exact: true }));
      await expect(panel.getByRole("button", { name: "Duyệt", exact: true })).toBeDisabled();
      await rest(page);
      await shot("diem-kiem", "Điểm kiểm, nguồn đã tra: chưa tích đủ thì nút Duyệt bị khóa");

      for (const check of SHOP_CHECK_NAMES) await panel.getByRole("checkbox", { name: check }).check();
      await panel.locator('select[id="shop-business-source"]').selectOption({ label: "Cổng thông tin quốc gia về đăng ký doanh nghiệp" });
      await expect(panel.getByRole("button", { name: "Duyệt", exact: true })).toBeEnabled();
      await rest(page);
      await shot("da-tich", "Đã tích đủ điểm kiểm và chọn nguồn đã tra");

      await panel.getByRole("button", { name: "Duyệt", exact: true }).click();
      await typeCode(page);
      await shot("ma-xac-thuc", "Bấm Duyệt: nhập mã xác thực");

      await sendCode(page);
      await decided(page, SUBJECT.shop, MESSAGES.shopApproved);
      await rest(page);
      await shot("da-duyet", "Đã duyệt giấy phép kinh doanh: hồ sơ rời khỏi danh sách");
      expect(mock.input).toMatchObject({ status: "VERIFIED", version: 1, source: "NATIONAL_BUSINESS_REGISTRY",
        checks: ["REGISTRY_MATCH", "TAX_ACTIVE", "DOCUMENT_GENUINE"], checked_on: "2026-10-12" });
    },
  }),
  verificationFlow({
    id: "tu-choi-cua-hang", name: "TỪ CHỐI GIẤY PHÉP KINH DOANH CỦA CỬA HÀNG",
    async run({ page, shot, mock }) {
      await openList(page);
      await rest(page);
      await shot("danh-sach", "Danh sách yêu cầu: giấy phép kinh doanh của Gốm sứ Hương Giang", { mode: "fullPage" });

      const panel = await openReview(page, SUBJECT.household);
      await rest(page);
      await shot("ho-so", "Bấm Xem hồ sơ: giấy chứng nhận hộ kinh doanh, thông tin nhập tay");

      await panel.getByRole("button", { name: "Từ chối", exact: true }).click();
      const box = dialogNamed(page, `Từ chối hồ sơ của ${HUONG_GIANG.name}?`);
      await box.locator('select[id="shop-business-reject-reason"]').waitFor();
      await expect(box.getByRole("button", { name: "Từ chối", exact: true })).toBeDisabled();
      await rest(page);
      await shot("hop-tu-choi", "Bấm Từ chối: chưa chọn lý do thì nút Từ chối bị khóa");

      await box.locator('select[id="shop-business-reject-reason"]').selectOption({ label: "Khác" });
      await box.locator('[id="shop-business-reject-text"]').waitFor();
      await expect(box.getByRole("button", { name: "Từ chối", exact: true })).toBeDisabled();
      await rest(page);
      await shot("chon-khac", "Chọn Khác: phải nhập Lý do khác, nút Từ chối còn khóa");

      await box.locator('[id="shop-business-reject-text"]').fill("Ảnh giấy chứng nhận bị mất góc dưới, không thấy chữ ký của cơ quan cấp");
      await expect(box.getByRole("button", { name: "Từ chối", exact: true })).toBeEnabled();
      await rest(page);
      await shot("nhap-ly-do", "Đã nhập lý do khác");

      await box.getByRole("button", { name: "Từ chối", exact: true }).click();
      await typeCode(page);
      await shot("ma-xac-thuc", "Bấm Từ chối: nhập mã xác thực");

      await sendCode(page);
      await decided(page, SUBJECT.household, MESSAGES.shopRejected);
      await rest(page);
      await shot("da-tu-choi", "Đã từ chối hồ sơ: yêu cầu rời khỏi danh sách", { mode: "fullPage" });
      expect(mock.input).toMatchObject({ status: "REJECTED", reason_code: "OTHER",
        reason_text: "Ảnh giấy chứng nhận bị mất góc dưới, không thấy chữ ký của cơ quan cấp" });
    },
  }),
];
