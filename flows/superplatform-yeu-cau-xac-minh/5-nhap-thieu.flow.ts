import type { Page } from "playwright";
import { expect } from "playwright/test";
import {
  MESSAGES, SUBJECT, dialogNamed, openList, openRequest, pick, rest, verificationFlow,
} from "../_helpers/superplatform-verification-requests";

/** The calendar of "Ngày đối chiếu", opened. */
async function openCalendar(page: Page) {
  const trigger = page.locator('[id="verification-checked-on"]');
  await trigger.click();
  const panel = page.locator(`[id="${await trigger.getAttribute("aria-controls")}"]`);
  await panel.getByRole("textbox", { name: "Ngày", exact: true }).waitFor();
  return panel;
}

export default [
  verificationFlow({
    id: "nhap-thieu", name: "NHẬP THIẾU KHI XÁC MINH",
    async run({ page, shot }) {
      await openList(page);
      await rest(page);
      await shot("danh-sach", "Danh sách yêu cầu: hồ sơ pháp lý Khai báo của Nhượng quyền Thanh Xuân");

      const panel = await openRequest(page, SUBJECT.declaration);
      await panel.getByRole("heading", { name: "Thông tin khai báo", exact: true }).waitFor();
      await rest(page);
      await shot("chi-tiet", "Bấm vào yêu cầu: thông tin khai báo");

      await panel.getByRole("button", { name: "Xác minh", exact: true }).click();
      const box = dialogNamed(page, `Xác minh ${SUBJECT.declaration}?`);
      await box.getByText("Nguồn đối chiếu").first().waitFor();
      await rest(page);
      await shot("hop-xac-minh", "Bấm Xác minh: hộp chọn nguồn và ngày đối chiếu");

      await box.getByRole("button", { name: "Xác minh", exact: true }).click();
      await box.getByText(MESSAGES.sourceRequired, { exact: true }).waitFor();
      await rest(page);
      await shot("chua-chon-nguon", "Chưa chọn nguồn đối chiếu");

      let calendar = await openCalendar(page);
      await calendar.getByRole("button", { name: "Xóa", exact: true }).click();
      await calendar.waitFor({ state: "hidden" });
      await box.getByRole("button", { name: "Xác minh", exact: true }).click();
      await box.getByText(MESSAGES.dateRequired, { exact: true }).waitFor();
      await rest(page);
      await shot("chua-chon-ngay", "Xóa ngày đối chiếu rồi bấm Xác minh: thiếu cả nguồn và ngày");

      await pick(page, "verification-source", "Trang tra cứu thông tin người nộp thuế");
      calendar = await openCalendar(page);
      await calendar.getByRole("textbox", { name: "Ngày", exact: true }).fill("15/10/2026");
      await calendar.getByText("Chọn đến 12/10/2026.", { exact: true }).waitFor();
      await expect(calendar.getByRole("button", { name: "Áp dụng", exact: true })).toBeDisabled();
      await shot("ngay-tuong-lai", "Nhập ngày đối chiếu ở tương lai: không áp dụng được");

      await calendar.getByRole("textbox", { name: "Ngày", exact: true }).fill("05/10/2026");
      await calendar.getByText("Chọn từ 09/10/2026 trở đi.", { exact: true }).waitFor();
      await shot("ngay-truoc-ngay-gui", "Nhập ngày trước ngày gửi yêu cầu: không áp dụng được");
    },
  }),
];
