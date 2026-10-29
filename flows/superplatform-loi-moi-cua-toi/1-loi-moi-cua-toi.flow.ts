import { takeFace, sendFace } from "../_helpers/superplatform-identity-document";
import {
  GO_VAP, HA_DONG, MESSAGES, card, codeDialog, dialog, enterCode, invitationsFlow, notice, openFromMenu, openHistory, openInvitations,
} from "../_helpers/superplatform-my-invitations";

// "Lời mời của tôi" of the SuperPlatform console: the employee invitations sent to the signed-in staff member, opened
// from the account menu. Accepting reads the details again, takes the face when the invitation needs it, then asks the
// Authenticator code; declining asks why. The backend is a stand-in (superplatform-my-invitations.ts).
export default [
  invitationsFlow("xem", "XEM LỜI MỜI ĐANG CHỜ PHẢN HỒI", async ({ page, shot, mock }) => {
    await openFromMenu(page, shot);
    await card(page, GO_VAP).waitFor();
    await shot("loi-moi-dang-cho", "Lời mời đang chờ phản hồi", { mode: "fullPage" });

    mock.waiting = [];
    await openInvitations(page);
    await page.getByText(MESSAGES.emptyPending).waitFor();
    await shot("chua-co-loi-moi", "Không có lời mời nào đang chờ");
  }),

  invitationsFlow("lich-su", "XEM LỊCH SỬ LỜI MỜI", async ({ page, shot, mock }) => {
    await openFromMenu(page);
    await card(page, GO_VAP).waitFor();
    await shot("loi-moi-dang-cho", "Lời mời đang chờ phản hồi");

    await openHistory(page);
    await page.getByText("Bưu cục SuperShip Tân Bình").first().waitFor();
    await shot("lich-su-loi-moi", "Lịch sử lời mời: đã chấp nhận, đã từ chối, hết hạn, đã hủy", { mode: "fullPage" });

    mock.history = [];
    await openInvitations(page);
    await openHistory(page);
    await page.getByText(MESSAGES.emptyHistory).waitFor();
    await shot("lich-su-trong", "Chưa có lời mời nào trong lịch sử");
  }),

  invitationsFlow("chap-nhan", "CHẤP NHẬN LỜI MỜI", async ({ page, shot }) => {
    await openFromMenu(page);
    await card(page, GO_VAP).waitFor();
    await shot("loi-moi-dang-cho", "Lời mời đang chờ phản hồi");

    await card(page, GO_VAP).getByRole("button", { name: "Chấp nhận lời mời" }).click();
    const review = dialog(page, "Xem lại thông tin lời mời");
    await review.waitFor();
    await shot("xem-lai-thong-tin", "Xem lại thông tin lời mời trước khi chấp nhận");

    await review.getByText("Tôi đã đọc và đồng ý với các thông tin trên.").click();
    await shot("da-dong-y", "Đã đồng ý với thông tin lời mời");

    await review.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await codeDialog(page).waitFor();
    await shot("nhap-ma-xac-thuc", "Nhập mã xác thực để chấp nhận lời mời");

    await enterCode(page);
    await shot("da-nhap-ma", "Đã nhập mã xác thực");

    await codeDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
    await notice(page, GO_VAP.accepted).getByRole("button", { name: /^(Đã hiểu|Đóng|Xác nhận)$/ }).waitFor();
    await shot("chap-nhan-thanh-cong", "Chấp nhận lời mời thành công");

    await notice(page, GO_VAP.accepted).getByRole("button", { name: /^(Đã hiểu|Đóng|Xác nhận)$/ }).click();
    await card(page, GO_VAP).waitFor({ state: "detached" });
    await shot("dang-cho-sau-khi-chap-nhan", "Danh sách đang chờ sau khi chấp nhận");

    await openHistory(page);
    await card(page, GO_VAP).getByText("Đã chấp nhận").waitFor();
    await shot("lich-su-sau-khi-chap-nhan", "Lời mời đã chấp nhận trong lịch sử", { mode: "fullPage" });
  }),

  invitationsFlow("chap-nhan-xac-thuc-khuon-mat", "CHẤP NHẬN LỜI MỜI CẦN XÁC THỰC KHUÔN MẶT", async ({ page, shot }) => {
    await openFromMenu(page);
    await card(page, HA_DONG).waitFor();
    await shot("loi-moi-dang-cho", "Lời mời đang chờ phản hồi");

    await card(page, HA_DONG).getByRole("button", { name: "Chấp nhận lời mời" }).click();
    const review = dialog(page, "Xem lại thông tin lời mời");
    await review.getByText("Tôi đã đọc và đồng ý với các thông tin trên.").click();
    await shot("xem-lai-thong-tin", "Xem lại và đồng ý với thông tin lời mời");

    await review.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await page.getByText("Chụp khuôn mặt để xác thực.").waitFor();
    await page.getByText("Đang mở camera…").waitFor({ state: "hidden" });
    await shot("chup-khuon-mat", "Chụp khuôn mặt để xác thực trước khi nhận lời mời");

    await takeFace(page);
    await shot("da-chup", "Đã chụp khuôn mặt");

    await sendFace(page);
    await codeDialog(page).waitFor();
    await shot("nhap-ma-xac-thuc", "Khuôn mặt đã khớp, nhập mã xác thực để chấp nhận");

    await enterCode(page);
    await codeDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
    await notice(page, HA_DONG.accepted).getByRole("button", { name: /^(Đã hiểu|Đóng|Xác nhận)$/ }).waitFor();
    await shot("chap-nhan-thanh-cong", "Chấp nhận lời mời thành công");
  }, { needsFace: new Set([HA_DONG.id]) }),

  invitationsFlow("tu-choi", "TỪ CHỐI LỜI MỜI", async ({ page, shot }) => {
    await openFromMenu(page);
    await card(page, HA_DONG).waitFor();
    await shot("loi-moi-dang-cho", "Lời mời đang chờ phản hồi");

    await card(page, HA_DONG).getByRole("button", { name: "Từ chối", exact: true }).click();
    const ask = dialog(page, `Từ chối lời mời làm việc tại ${HA_DONG.unit}?`);
    await ask.getByText("Đã nhận công việc khác").waitFor();
    await shot("chon-ly-do", "Chọn lý do từ chối lời mời");

    await ask.getByRole("button", { name: "Xác nhận từ chối" }).click();
    await ask.getByText(MESSAGES.reasonMissing).waitFor();
    await shot("chua-chon-ly-do", "Chưa chọn lý do từ chối");

    await ask.getByText("Lý do khác", { exact: true }).click();
    await ask.getByRole("button", { name: "Xác nhận từ chối" }).click();
    await ask.getByText(MESSAGES.noteMissing).waitFor();
    await shot("chua-ghi-ly-do", "Chọn Lý do khác nhưng chưa ghi rõ lý do");

    await ask.getByPlaceholder("Nhập lý do của bạn").fill("Tôi muốn tiếp tục làm việc tại SuperTek.");
    await shot("da-ghi-ly-do", "Đã ghi rõ lý do từ chối");

    await ask.getByRole("button", { name: "Xác nhận từ chối" }).click();
    await notice(page, MESSAGES.declined).getByRole("button", { name: /^(Đã hiểu|Đóng|Xác nhận)$/ }).waitFor();
    await shot("tu-choi-thanh-cong", "Từ chối lời mời thành công");

    await notice(page, MESSAGES.declined).getByRole("button", { name: /^(Đã hiểu|Đóng|Xác nhận)$/ }).click();
    await card(page, HA_DONG).waitFor({ state: "detached" });
    await openHistory(page);
    await card(page, HA_DONG).getByText("Đã từ chối").waitFor();
    await shot("lich-su-sau-khi-tu-choi", "Lời mời đã từ chối trong lịch sử", { mode: "fullPage" });
  }),

  invitationsFlow("nhap-sai-ma", "CHẤP NHẬN LỜI MỜI THẤT BẠI DO NHẬP SAI MÃ XÁC THỰC", async ({ page, shot }) => {
    await openFromMenu(page);
    await card(page, GO_VAP).waitFor();
    await shot("loi-moi-dang-cho", "Lời mời đang chờ phản hồi");

    await card(page, GO_VAP).getByRole("button", { name: "Chấp nhận lời mời" }).click();
    const review = dialog(page, "Xem lại thông tin lời mời");
    await review.getByText("Tôi đã đọc và đồng ý với các thông tin trên.").click();
    await review.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    await codeDialog(page).waitFor();
    await enterCode(page, "111111");
    await shot("da-nhap-ma-sai", "Đã nhập mã xác thực sai");

    await codeDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
    await page.getByText(MESSAGES.wrongCode).first().waitFor();
    await shot("ma-khong-dung", "Mã xác thực không đúng");
  }),

  invitationsFlow("het-han", "CHẤP NHẬN LỜI MỜI THẤT BẠI DO LỜI MỜI ĐÃ HẾT HẠN", async ({ page, shot }) => {
    await openFromMenu(page);
    await card(page, GO_VAP).waitFor();
    await shot("loi-moi-dang-cho", "Lời mời đang chờ phản hồi");

    await card(page, GO_VAP).getByRole("button", { name: "Chấp nhận lời mời" }).click();
    const review = dialog(page, "Xem lại thông tin lời mời");
    await review.getByText("Tôi đã đọc và đồng ý với các thông tin trên.").click();
    await review.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    // The web shows its own line for a 410, not the server's "Lời mời đã hết hạn…" (notify-request-error.ts).
    const failed = page.getByRole("alertdialog").or(page.getByRole("dialog")).filter({ hasText: "Thông báo" }).last();
    await failed.getByRole("button", { name: "Đã hiểu" }).waitFor();
    await shot("loi-moi-het-han", "Lời mời đã hết hạn");

    // The list was read again: the invitation is no longer waiting.
    await failed.getByRole("button", { name: "Đã hiểu" }).click();
    await card(page, GO_VAP).waitFor({ state: "detached" });
    await shot("dang-cho-sau-khi-het-han", "Lời mời hết hạn không còn trong danh sách đang chờ");
  }, { lapsed: new Set([GO_VAP.id]) }),
];
