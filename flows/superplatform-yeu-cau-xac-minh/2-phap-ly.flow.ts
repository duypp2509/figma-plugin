import { expect } from "playwright/test";
import {
  MESSAGES, SUBJECT, decided, dialogNamed, openList, openRequest, pick, pickDate, rest, scrollTo, sendCode, typeCode, verificationFlow,
  viewerShown,
} from "../_helpers/superplatform-verification-requests";

/** "Xác minh" at the foot of the panel: the dialog with the source and the day of the check. */
async function openVerify(page: import("playwright").Page, panel: import("playwright").Locator, subject: string) {
  await panel.getByRole("button", { name: "Xác minh", exact: true }).click();
  const box = dialogNamed(page, `Xác minh ${subject}?`);
  await box.getByText("Nguồn đối chiếu").first().waitFor();
  return box;
}

export default [
  verificationFlow({
    id: "khai-bao", name: "XÁC MINH HỒ SƠ PHÁP LÝ MỚI KHAI BÁO",
    async run({ page, shot, mock }) {
      await openList(page);
      await rest(page);
      await shot("danh-sach", "Danh sách yêu cầu: hồ sơ pháp lý Khai báo của Nhượng quyền Thanh Xuân");

      const panel = await openRequest(page, SUBJECT.declaration);
      await panel.getByRole("heading", { name: "Thông tin khai báo", exact: true }).waitFor();
      await panel.getByRole("button", { name: "Xem giấy đăng ký", exact: true }).waitFor();
      await rest(page);
      await shot("chi-tiet", "Bấm vào yêu cầu: thông tin khai báo của đơn vị");

      await scrollTo(panel.getByRole("button", { name: "Xem giấy đăng ký", exact: true }));
      await shot("cuoi-khung", "Cuối khung: nút Xem giấy đăng ký, Xác minh, Từ chối");

      await panel.getByRole("button", { name: "Xem giấy đăng ký", exact: true }).click();
      await typeCode(page);
      await page.getByRole("dialog", { name: "Xác nhận thao tác" }).getByText("Lần xem này được ghi nhật ký.", { exact: false }).waitFor();
      await shot("ma-xem-giay", "Xem giấy đăng ký: nhập mã xác thực, lần xem được ghi nhật ký");

      await sendCode(page);
      const viewer = await viewerShown(page, "Giấy đăng ký");
      await shot("giay-dang-ky", "Giấy đăng ký mở trong trình xem để đối chiếu");
      await viewer.getByRole("button", { name: "Đóng", exact: true }).last().click();
      await viewer.waitFor({ state: "detached" });

      const box = await openVerify(page, panel, SUBJECT.declaration);
      await rest(page);
      await shot("hop-xac-minh", "Bấm Xác minh: chọn nguồn đối chiếu, ngày đối chiếu mặc định hôm nay");

      await pick(page, "verification-source", "Cổng thông tin quốc gia về đăng ký doanh nghiệp");
      await shot("da-chon-nguon", "Đã chọn nguồn đối chiếu");

      await box.getByRole("button", { name: "Xác minh", exact: true }).click();
      await typeCode(page);
      await shot("ma-xac-thuc", "Bấm Xác minh: nhập mã xác thực");

      await sendCode(page);
      await decided(page, SUBJECT.declaration, MESSAGES.legalVerified);
      await rest(page);
      await shot("da-xac-minh", "Đã xác minh thông tin pháp lý: yêu cầu rời khỏi danh sách");
      expect(mock.input).toMatchObject({ status: "VERIFIED", version: 1, source: "NATIONAL_BUSINESS_REGISTRY", checked_on: "2026-10-12" });
    },
  }),
  verificationFlow({
    id: "sua-thong-tin", name: "XÁC MINH YÊU CẦU SỬA THÔNG TIN PHÁP LÝ",
    async run({ page, shot, mock }) {
      await openList(page);
      await rest(page);
      await shot("danh-sach", "Danh sách yêu cầu: yêu cầu Sửa thông tin pháp lý của Nhượng quyền Hà Đông");

      const panel = await openRequest(page, SUBJECT.amendment);
      await panel.getByRole("columnheader", { name: "Đã xác minh" }).waitFor();
      await panel.getByRole("button", { name: "Xem giấy đăng ký", exact: true }).waitFor();
      await rest(page);
      await shot("chi-tiet", "Bấm vào yêu cầu: thông tin đã xác minh và thông tin yêu cầu sửa");

      const box = await openVerify(page, panel, SUBJECT.amendment);
      await rest(page);
      await shot("hop-xac-minh", "Bấm Xác minh: hộp chọn nguồn và ngày đối chiếu");

      await pick(page, "verification-source", "Tệp giấy đăng ký");
      await pickDate(page, "verification-checked-on", "2026-10-09");
      await expect(page.locator('[id="verification-checked-on"]')).toContainText("09/10/2026");
      await shot("da-chon-nguon-ngay", "Đối chiếu với tệp giấy đăng ký ngày 09/10/2026");

      await box.getByRole("button", { name: "Xác minh", exact: true }).click();
      await typeCode(page);
      await shot("ma-xac-thuc", "Bấm Xác minh: nhập mã xác thực");

      await sendCode(page);
      await decided(page, SUBJECT.amendment, MESSAGES.legalVerified);
      await rest(page);
      await shot("da-xac-minh", "Đã xác minh: yêu cầu sửa rời khỏi danh sách");
      expect(mock.input).toMatchObject({ status: "VERIFIED", source: "REGISTRATION_DOCUMENT", checked_on: "2026-10-09" });
    },
  }),
  verificationFlow({
    id: "thay-chu-the", name: "XÁC MINH THAY CHỦ THỂ PHÁP LÝ",
    async run({ page, shot, mock }) {
      await openList(page);
      await rest(page);
      await shot("danh-sach", "Danh sách yêu cầu: yêu cầu Thay chủ thể của Nhượng quyền Long Biên");

      const panel = await openRequest(page, SUBJECT.replacement);
      await panel.getByRole("columnheader", { name: "Chủ thể hiện tại" }).waitFor();
      await panel.getByRole("columnheader", { name: "Chủ thể mới" }).waitFor();
      await panel.getByRole("heading", { name: "Áp dụng", exact: true }).waitFor();
      await rest(page);
      await shot("chi-tiet", "Bấm vào yêu cầu: chủ thể hiện tại và chủ thể mới");

      await scrollTo(panel.getByRole("heading", { name: "Áp dụng", exact: true }));
      await panel.getByText("Hoàng Văn Nam (theo pháp luật)", { exact: true }).waitFor();
      await shot("ap-dung", "Áp dụng từ ngày, căn cứ và người đại diện sẽ kết thúc");

      const box = await openVerify(page, panel, SUBJECT.replacement);
      await pick(page, "verification-source", "Cổng thông tin quốc gia về đăng ký doanh nghiệp");
      await rest(page);
      await shot("hop-xac-minh", "Bấm Xác minh: chọn nguồn đối chiếu");

      await box.getByRole("button", { name: "Xác minh", exact: true }).click();
      await typeCode(page);
      await page.getByRole("dialog", { name: "Xác nhận thao tác" }).getByText("yêu cầu thay chủ thể pháp lý", { exact: false }).waitFor();
      await shot("ma-xac-thuc", "Bấm Xác minh: nhập mã xác thực");

      await sendCode(page);
      await decided(page, SUBJECT.replacement, MESSAGES.legalVerified);
      await rest(page);
      await shot("da-xac-minh", "Đã xác minh thay chủ thể: yêu cầu rời khỏi danh sách");
      expect(mock.input).toMatchObject({ status: "VERIFIED", source: "NATIONAL_BUSINESS_REGISTRY" });
    },
  }),
];
