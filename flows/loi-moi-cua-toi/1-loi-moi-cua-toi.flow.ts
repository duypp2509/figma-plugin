import {
  DEV_OTP, HA_VY, MOC_MIEN, acknowledge, confirmOtp, dialogSaying, invitationRow, myInvitationsFlow, openDialog, openHistoryTab,
  openMyInvitations, otpDialog, sendOtp, typeOtp,
} from "../_helpers/supership-my-invitations";

// The invitations a signed-in person received from shops ("Lời mời" in the sidebar): looking at the ones
// still waiting, the history of the others, accepting one, declining one (both confirmed with an OTP),
// a wrong code, and accepting one the shop has withdrawn meanwhile. The backend is a stand-in (see mockMyInvitations).
const WITHDRAWN = "Lời mời không còn hiệu lực. Vui lòng liên hệ cửa hàng đã mời bạn để nhận lời mời mới.";

export default [
  myInvitationsFlow({
    id: "xem",
    name: "XEM LỜI MỜI ĐANG CHỜ PHẢN HỒI",
    async run({ page, shot, invitations }) {
      await openMyInvitations(page);
      await invitationRow(page, MOC_MIEN).waitFor();
      await shot("loi-moi-dang-cho", "Lời mời đang chờ phản hồi", { mode: "fullPage" });

      // An invitation sent to an email the account has not verified yet looks like any other; answering it
      // first asks, in a dialog, to verify that email.
      invitations.sentToUnverifiedEmail(HA_VY);
      await openMyInvitations(page);
      await invitationRow(page, HA_VY).getByRole("button", { name: "Chấp nhận lời mời" }).click();
      await dialogSaying(page, "Cần xác thực email").getByRole("button", { name: "Gửi mã xác thực" }).waitFor();
      await shot("can-xac-thuc-email", "Lời mời cần xác thực email trước khi chấp nhận");

      invitations.clear();
      await openMyInvitations(page);
      await page.getByText("Bạn chưa có lời mời nào.").waitFor();
      await shot("chua-co-loi-moi", "Chưa có lời mời nào");
    },
  }),

  myInvitationsFlow({
    id: "lich-su",
    name: "XEM LỊCH SỬ LỜI MỜI THAM GIA",
    async run({ page, shot, invitations }) {
      await openMyInvitations(page);
      await invitationRow(page, MOC_MIEN).waitFor();
      await shot("loi-moi-dang-cho", "Lời mời đang chờ phản hồi");

      await openHistoryTab(page);
      await page.getByText("Shop Gốm Nhà Lam").waitFor();
      await shot("lich-su-loi-moi", "Lịch sử lời mời tham gia", { mode: "fullPage" });

      invitations.clear(true);
      await openMyInvitations(page);
      await openHistoryTab(page);
      await page.getByText("Chưa có lời mời nào trong lịch sử.").waitFor();
      await shot("lich-su-trong", "Chưa có lời mời nào trong lịch sử");
    },
  }),

  myInvitationsFlow({
    id: "chap-nhan",
    name: "CHẤP NHẬN LỜI MỜI THAM GIA",
    async run({ page, shot }) {
      await openMyInvitations(page);
      await invitationRow(page, MOC_MIEN).waitFor();
      await shot("loi-moi-dang-cho", "Lời mời đang chờ phản hồi");

      await invitationRow(page, MOC_MIEN).getByRole("button", { name: "Chấp nhận lời mời" }).click();
      await openDialog(page).getByText("Chấp nhận lời mời?").waitFor();
      await shot("xac-nhan-chap-nhan", "Xác nhận chấp nhận lời mời");

      await openDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
      await otpDialog(page).getByRole("button", { name: "Gửi mã OTP" }).waitFor();
      await shot("chon-kenh-nhan-otp", "Chọn nơi nhận mã OTP để xác nhận chấp nhận lời mời");

      await sendOtp(page);
      await shot("nhap-ma-otp", "Nhập mã OTP");

      await typeOtp(page, DEV_OTP);
      await shot("da-nhap-ma-otp", "Đã nhập mã OTP");

      await confirmOtp(page);
      const joined = `Đã tham gia ${MOC_MIEN.shop}.`;
      await dialogSaying(page, joined).getByRole("button", { name: "Xác nhận", exact: true }).waitFor();
      await shot("chap-nhan-thanh-cong", "Chấp nhận lời mời thành công");
      await acknowledge(page, joined);

      await invitationRow(page, MOC_MIEN).waitFor({ state: "detached" });
      await shot("dang-cho-sau-khi-chap-nhan", "Danh sách đang chờ sau khi chấp nhận");

      await openHistoryTab(page);
      await invitationRow(page, MOC_MIEN).getByText("Đã tham gia").waitFor();
      await shot("lich-su-sau-khi-chap-nhan", "Lời mời đã chấp nhận trong lịch sử", { mode: "fullPage" });
    },
  }),

  myInvitationsFlow({
    id: "tu-choi",
    name: "TỪ CHỐI LỜI MỜI THAM GIA",
    async run({ page, shot }) {
      await openMyInvitations(page);
      await invitationRow(page, HA_VY).waitFor();
      await shot("loi-moi-dang-cho", "Lời mời đang chờ phản hồi");

      await invitationRow(page, HA_VY).getByRole("button", { name: "Từ chối", exact: true }).click();
      await openDialog(page).getByText("Từ chối lời mời?").waitFor();
      await shot("xac-nhan-tu-choi", "Xác nhận từ chối lời mời");

      await openDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
      await otpDialog(page).getByRole("button", { name: "Gửi mã OTP" }).waitFor();
      await shot("chon-kenh-nhan-otp", "Chọn nơi nhận mã OTP để xác nhận từ chối lời mời");

      await sendOtp(page);
      await shot("nhap-ma-otp", "Nhập mã OTP");

      await typeOtp(page, DEV_OTP);
      await shot("da-nhap-ma-otp", "Đã nhập mã OTP");

      await confirmOtp(page);
      await dialogSaying(page, "Đã từ chối lời mời.").getByRole("button", { name: "Xác nhận", exact: true }).waitFor();
      await shot("tu-choi-thanh-cong", "Từ chối lời mời thành công");
      await acknowledge(page, "Đã từ chối lời mời.");

      await invitationRow(page, HA_VY).waitFor({ state: "detached" });
      await shot("dang-cho-sau-khi-tu-choi", "Danh sách đang chờ sau khi từ chối");

      await openHistoryTab(page);
      await invitationRow(page, HA_VY).getByText("Đã từ chối").waitFor();
      await shot("lich-su-sau-khi-tu-choi", "Lời mời đã từ chối trong lịch sử", { mode: "fullPage" });
    },
  }),

  myInvitationsFlow({
    id: "nhap-sai-otp",
    name: "CHẤP NHẬN LỜI MỜI THẤT BẠI DO NHẬP SAI MÃ OTP",
    async run({ page, shot }) {
      await openMyInvitations(page);
      await invitationRow(page, MOC_MIEN).waitFor();
      await shot("loi-moi-dang-cho", "Lời mời đang chờ phản hồi");

      await invitationRow(page, MOC_MIEN).getByRole("button", { name: "Chấp nhận lời mời" }).click();
      await openDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
      await otpDialog(page).getByRole("button", { name: "Gửi mã OTP" }).waitFor();
      await sendOtp(page);
      await typeOtp(page, "111111");
      await shot("da-nhap-ma-sai", "Đã nhập mã OTP sai");

      await confirmOtp(page);
      await page.getByText("Mã OTP không đúng. Bạn còn 4 lần nhập.").first().waitFor();
      await shot("ma-otp-khong-dung", "Mã OTP không đúng, còn 4 lần nhập");
    },
  }),

  myInvitationsFlow({
    id: "chap-nhan-that-bai",
    name: "CHẤP NHẬN LỜI MỜI THẤT BẠI DO LỜI MỜI KHÔNG CÒN HIỆU LỰC",
    async run({ page, shot, backend, invitations }) {
      // The shop withdraws the invitation while the person still has the list open.
      backend.on("POST", /^\/v1\/me\/member-invitations\/[^/]+\/accept$/, () => {
        invitations.withdraw(MOC_MIEN);
        return { status: 410, code: "INVITATION_NO_LONGER_VALID", message: WITHDRAWN };
      });

      await openMyInvitations(page);
      await invitationRow(page, MOC_MIEN).waitFor();
      await shot("loi-moi-dang-cho", "Lời mời đang chờ phản hồi");

      await invitationRow(page, MOC_MIEN).getByRole("button", { name: "Chấp nhận lời mời" }).click();
      await openDialog(page).getByText("Chấp nhận lời mời?").waitFor();
      await shot("xac-nhan-chap-nhan", "Xác nhận chấp nhận lời mời");

      await openDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
      await dialogSaying(page, "Không thể hoàn tất thao tác").getByRole("button", { name: "Đã hiểu" }).waitFor();
      await shot("khong-chap-nhan-duoc", "Không chấp nhận được lời mời");
      await acknowledge(page, "Không thể hoàn tất thao tác");

      // The list was read again: the invitation is no longer waiting.
      await invitationRow(page, MOC_MIEN).waitFor({ state: "detached" });
      await shot("dang-cho-sau-khi-that-bai", "Lời mời đã bị thu hồi không còn trong danh sách đang chờ");
    },
  }),
];
