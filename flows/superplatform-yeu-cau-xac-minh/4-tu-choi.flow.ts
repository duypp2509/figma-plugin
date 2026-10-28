import { expect } from "playwright/test";
import {
  MESSAGES, SUBJECT, decided, dialogNamed, openChoices, openList, openRequest, pick, rest, row, sendCode, typeCode, verificationFlow,
} from "../_helpers/superplatform-verification-requests";

export default [
  verificationFlow({
    id: "tu-choi", name: "TỪ CHỐI XÁC MINH",
    async run({ page, shot, mock }) {
      await openList(page);
      await rest(page);
      await shot("danh-sach", "Danh sách yêu cầu: yêu cầu sửa thông tin pháp lý của Nhượng quyền Hà Đông");

      const panel = await openRequest(page, SUBJECT.amendment);
      await panel.getByRole("columnheader", { name: "Đã xác minh" }).waitFor();
      await rest(page);
      await shot("chi-tiet", "Bấm vào yêu cầu: thông tin đã xác minh và thông tin yêu cầu sửa");

      await panel.getByRole("button", { name: "Từ chối", exact: true }).click();
      const box = dialogNamed(page, `Từ chối xác minh ${SUBJECT.amendment}?`);
      await box.getByRole("combobox").filter({ hasText: "Chọn lý do" }).waitFor();
      await expect(box.getByRole("button", { name: "Từ chối", exact: true })).toBeDisabled();
      await rest(page);
      await shot("hop-tu-choi", "Bấm Từ chối: chưa chọn lý do thì nút Từ chối bị khóa");

      const id = await openChoices(page, box, "Thông tin không khớp giấy tờ");
      await shot("danh-sach-ly-do", "Mở danh sách lý do từ chối");

      await pick(page, id, "Thông tin không khớp giấy tờ");
      await expect(box.getByRole("button", { name: "Từ chối", exact: true })).toBeEnabled();
      await rest(page);
      await shot("da-chon-ly-do", "Đã chọn lý do: Thông tin không khớp giấy tờ");

      await box.getByRole("button", { name: "Từ chối", exact: true }).click();
      await typeCode(page);
      await shot("ma-xac-thuc", "Bấm Từ chối: nhập mã xác thực");

      await sendCode(page);
      await decided(page, SUBJECT.amendment, MESSAGES.legalRejected);
      await rest(page);
      await shot("da-tu-choi", "Đã từ chối xác minh: yêu cầu rời khỏi danh sách");
      expect(mock.input).toMatchObject({ status: "REJECTED", version: 1, reason_code: "THONG_TIN_KHONG_KHOP_GIAY_TO" });
    },
  }),
  verificationFlow({
    id: "tu-choi-ly-do-khac", name: "TỪ CHỐI XÁC MINH VỚI LÝ DO KHÁC",
    async run({ page, shot, mock }) {
      await openList(page);
      await rest(page);
      await shot("danh-sach", "Danh sách yêu cầu: bổ nhiệm người đại diện của Nhượng quyền Đông Anh");

      await row(page, SUBJECT.appointment).getByRole("button", { name: "Từ chối", exact: true }).click();
      const box = dialogNamed(page, `Từ chối xác minh ${SUBJECT.appointment}?`);
      await box.getByRole("combobox").filter({ hasText: "Chọn lý do" }).waitFor();
      await rest(page);
      await shot("hop-tu-choi", "Bấm Từ chối ngay trên dòng: hộp từ chối xác minh");

      const id = await box.locator("select").first().getAttribute("id");
      await pick(page, id!, "Khác");
      await box.getByText("Lý do khác").first().waitFor();
      await expect(box.getByRole("button", { name: "Từ chối", exact: true })).toBeDisabled();
      await rest(page);
      await shot("chon-khac", "Chọn Khác: phải nhập Lý do khác, nút Từ chối còn khóa");

      await box.locator("textarea").fill("Giấy ủy quyền chưa có chữ ký của Giám đốc Đặng Quốc Bảo");
      await expect(box.getByRole("button", { name: "Từ chối", exact: true })).toBeEnabled();
      await rest(page);
      await shot("nhap-ly-do", "Đã nhập lý do khác");

      await box.getByRole("button", { name: "Từ chối", exact: true }).click();
      await typeCode(page);
      await shot("ma-xac-thuc", "Bấm Từ chối: nhập mã xác thực");

      await sendCode(page);
      await decided(page, SUBJECT.appointment, MESSAGES.repRejected);
      await rest(page);
      await shot("da-tu-choi", "Đã từ chối xác minh người đại diện: yêu cầu rời khỏi danh sách");
      expect(mock.input).toMatchObject({ status: "REJECTED", reason_code: "OTHER", reason_note: "Giấy ủy quyền chưa có chữ ký của Giám đốc Đặng Quốc Bảo" });
    },
  }),
];
