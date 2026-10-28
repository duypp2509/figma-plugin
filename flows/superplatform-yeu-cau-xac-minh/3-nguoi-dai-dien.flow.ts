import { expect } from "playwright/test";
import {
  MESSAGES, SUBJECT, decided, dialogNamed, openList, openRequest, rest, sendCode, typeCode, verificationFlow, viewerShown,
} from "../_helpers/superplatform-verification-requests";

const DONG_ANH_NAME = "NHƯỢNG QUYỀN ĐÔNG ANH";

export default [
  verificationFlow({
    id: "bo-nhiem-nguoi-dai-dien", name: "XÁC MINH NGƯỜI ĐẠI DIỆN MỚI BỔ NHIỆM",
    async run({ page, shot, mock }) {
      await openList(page);
      await rest(page);
      await shot("danh-sach", "Danh sách yêu cầu: bổ nhiệm người đại diện của Nhượng quyền Đông Anh");

      const panel = await openRequest(page, SUBJECT.appointment);
      await panel.getByRole("heading", { name: "Thông tin", exact: true }).waitFor();
      await panel.getByRole("button", { name: "Xem tệp căn cứ", exact: true }).waitFor();
      await rest(page);
      await shot("chi-tiet", "Bấm vào yêu cầu: loại, chức danh, phạm vi ủy quyền, thời gian, căn cứ");

      await panel.getByRole("button", { name: "Xem tệp căn cứ", exact: true }).click();
      await typeCode(page);
      await shot("ma-xem-tep", "Xem tệp căn cứ: nhập mã xác thực");

      await sendCode(page);
      const viewer = await viewerShown(page, "Tệp căn cứ");
      await shot("tep-can-cu", "Giấy ủy quyền mở trong trình xem để đối chiếu");
      await viewer.getByRole("button", { name: "Đóng", exact: true }).last().click();
      await viewer.waitFor({ state: "detached" });

      await panel.getByRole("button", { name: "Xác minh", exact: true }).click();
      const confirm = dialogNamed(page, `Xác minh ${SUBJECT.appointment}?`);
      await confirm.getByText(DONG_ANH_NAME, { exact: true }).waitFor();
      await rest(page);
      await shot("xac-nhan", "Bấm Xác minh: hỏi lại trước khi xác minh");

      await confirm.getByRole("button", { name: "Xác minh", exact: true }).click();
      await typeCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");

      await sendCode(page);
      await decided(page, SUBJECT.appointment, MESSAGES.repVerified);
      await rest(page);
      await shot("da-xac-minh", "Đã xác minh người đại diện: yêu cầu rời khỏi danh sách");
      expect(mock.input).toEqual({ status: "VERIFIED", version: 1 });
    },
  }),
  verificationFlow({
    id: "sua-nguoi-dai-dien", name: "XÁC MINH SỬA THÔNG TIN NGƯỜI ĐẠI DIỆN",
    async run({ page, shot, mock }) {
      await openList(page);
      await rest(page);
      await shot("danh-sach", "Danh sách yêu cầu: sửa thông tin người đại diện của Nhượng quyền Hà Đông", { mode: "fullPage" });

      const panel = await openRequest(page, SUBJECT.repUpdate);
      await panel.getByRole("columnheader", { name: "Đã xác minh" }).waitFor();
      await panel.getByText("Chưa có tệp căn cứ", { exact: true }).waitFor();
      await rest(page);
      await shot("chi-tiet", "Bấm vào yêu cầu: chức danh, phạm vi đã xác minh và yêu cầu sửa; chưa có tệp căn cứ");

      await panel.getByRole("button", { name: "Xác minh", exact: true }).click();
      const confirm = dialogNamed(page, `Xác minh ${SUBJECT.repUpdate}?`);
      await confirm.getByRole("button", { name: "Xác minh", exact: true }).waitFor();
      await rest(page);
      await shot("xac-nhan", "Bấm Xác minh: hỏi lại trước khi xác minh");

      await confirm.getByRole("button", { name: "Xác minh", exact: true }).click();
      await typeCode(page);
      await shot("ma-xac-thuc", "Nhập mã xác thực");

      await sendCode(page);
      await decided(page, SUBJECT.repUpdate, MESSAGES.repVerified);
      await rest(page);
      await shot("da-xac-minh", "Đã xác minh: chức danh và phạm vi mới có hiệu lực, yêu cầu rời khỏi danh sách", { mode: "fullPage" });
      expect(mock.input).toEqual({ status: "VERIFIED", version: 3 });
    },
  }),
];
