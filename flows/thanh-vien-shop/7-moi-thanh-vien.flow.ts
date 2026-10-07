import type { Page } from "playwright";
import {
  AREA, EXPIRED_INVITEE, INVITED_PHONE, MEMBER_PHONE, choose, conflict, dialogWith, errorNotice, memberFlow, openDialog,
  openMembers, successNotice,
} from "../_helpers/supership-shop-members";
import { SHOP_OPERATOR } from "../_helpers/supership-shop-roles";

// Inviting someone into the shop and looking after the invitations already sent: the list, taking one
// back, and sending its link again. An action the backend can refuse has a flow of its own for each
// refusal, worded as MemberInvitationService words it.
const group = AREA.invite;

/** The "Mời thành viên" dialog, found by its own field: a notice opened over it must not be mistaken for it. */
async function openInviteDialog(page: Page) {
  await page.getByRole("button", { name: "Mời thành viên" }).click();
  const dialog = page.locator("dialog[open]").filter({ has: page.locator("#member-invitee") }).last();
  await dialog.getByRole("checkbox", { name: SHOP_OPERATOR.name }).waitFor();
  return dialog;
}

async function fillInvite(dialog: Awaited<ReturnType<typeof openInviteDialog>>, contact: string) {
  await dialog.locator("#member-invitee").fill(contact);
  await dialog.getByRole("checkbox", { name: SHOP_OPERATOR.name }).check();
}

async function openInvitations(page: Page) {
  await openMembers(page);
  await page.locator("#membership-tab-invitations").click();
  await page.getByText(INVITED_PHONE).waitFor();
}

/** The row of the invitation sent to `contact`. */
const invitationOf = (page: Page, contact: string) => page.getByRole("listitem").filter({ hasText: contact });

/** An invitation that the backend refuses, from the list to the notice that says why. */
function refusedInvite(id: string, name: string, contact: string, filledTitle: string, message: string) {
  return memberFlow({
    id, group, name,
    async run({ page, shot }) {
      await openMembers(page);
      await shot("danh-sach", "Danh sách thành viên");

      const dialog = await openInviteDialog(page);
      await fillInvite(dialog, contact);
      await shot("da-nhap", filledTitle);

      await dialog.getByRole("button", { name: "Gửi lời mời" }).click();
      await errorNotice(page, message);
      await shot("khong-gui-duoc", "Không gửi được lời mời");
    },
  });
}

export default [
  memberFlow({
    id: "moi-thanh-cong",
    group,
    name: "MỜI THÀNH VIÊN MỚI VÀO SHOP",
    async run({ page, shot }) {
      await openMembers(page);
      await shot("danh-sach", "Danh sách thành viên");

      const dialog = await openInviteDialog(page);
      await shot("moi-thanh-vien", "Mời thành viên");

      await fillInvite(dialog, "0988765432");
      await shot("da-nhap", "Đã nhập người được mời và vai trò");

      await dialog.getByRole("button", { name: "Gửi lời mời" }).click();
      // The result replaces the form inside the same dialog.
      const sent = dialogWith(page, "Đã gửi lời mời");
      await sent.getByRole("heading", { name: "Đã gửi lời mời" }).waitFor();
      await shot("da-gui-loi-moi", "Đã gửi lời mời");

      await sent.getByRole("button", { name: "Xong" }).click();
      await page.locator("#membership-tab-invitations").click();
      await page.getByText("0988765432").waitFor();
      await shot("loi-moi-moi-trong-danh-sach", "Lời mời mới trong danh sách lời mời đã gửi", { mode: "fullPage" });
    },
  }),

  memberFlow({
    id: "moi-thieu-thong-tin",
    group,
    name: "MỜI THÀNH VIÊN THẤT BẠI DO CHƯA NHẬP ĐỦ THÔNG TIN",
    async run({ page, shot }) {
      await openMembers(page);
      await shot("danh-sach", "Danh sách thành viên");

      const dialog = await openInviteDialog(page);
      await shot("moi-thanh-vien", "Mời thành viên");

      // The role that is missing is said in a notice; the contact that is missing, under its field.
      await dialog.getByRole("button", { name: "Gửi lời mời" }).click();
      const notice = dialogWith(page, "Chọn ít nhất một vai trò.");
      await notice.getByRole("button", { name: "Đã hiểu" }).waitFor();
      await shot("thieu-vai-tro", "Chưa chọn vai trò");
      await notice.getByRole("button", { name: "Đã hiểu" }).click();
      await notice.waitFor({ state: "hidden" }).catch(() => undefined);

      await dialog.getByText("Nhập số điện thoại hoặc email hợp lệ.").waitFor();
      await shot("thieu-nguoi-duoc-moi", "Chưa nhập số điện thoại hoặc email");
    },
  }),

  refusedInvite("moi-da-la-thanh-vien", "MỜI THÀNH VIÊN THẤT BẠI DO NGƯỜI ĐƯỢC MỜI ĐÃ LÀ THÀNH VIÊN", MEMBER_PHONE,
    "Nhập số điện thoại của người đã là thành viên",
    "Người này đã là thành viên của cửa hàng. Nếu thành viên đang bị tạm ngưng, hãy kích hoạt lại."),

  refusedInvite("moi-da-co-loi-moi", "MỜI THÀNH VIÊN THẤT BẠI DO ĐÃ CÓ LỜI MỜI ĐANG CHỜ PHẢN HỒI", INVITED_PHONE,
    "Nhập số điện thoại đã có lời mời đang chờ", "Đã có lời mời đang chờ phản hồi cho người này."),

  memberFlow({
    id: "loi-moi-xem-danh-sach",
    group,
    name: "XEM DANH SÁCH LỜI MỜI ĐÃ GỬI",
    async run({ page, shot }) {
      await openInvitations(page);
      await shot("loi-moi-da-gui", "Danh sách lời mời đã gửi", { mode: "fullPage" });

      const status = page.locator("#membership-panel-invitations").getByRole("combobox");
      await choose(page, status, "Chờ phản hồi");
      await page.getByText(EXPIRED_INVITEE).waitFor({ state: "detached" });
      await shot("loc-cho-phan-hoi", "Lọc lời mời đang chờ phản hồi");

      await choose(page, status, "Đã thu hồi");
      await page.getByText("Không có lời mời phù hợp").waitFor();
      await shot("khong-co-loi-moi-phu-hop", "Không có lời mời phù hợp");
    },
  }),

  memberFlow({
    id: "loi-moi-thu-hoi-thanh-cong",
    group,
    name: "THU HỒI LỜI MỜI ĐÃ GỬI",
    async run({ page, shot }) {
      await openInvitations(page);
      await shot("loi-moi-da-gui", "Danh sách lời mời đã gửi");

      await invitationOf(page, INVITED_PHONE).getByRole("button", { name: "Thu hồi", exact: true }).click();
      await openDialog(page).getByText("Thu hồi lời mời?").waitFor();
      await shot("xac-nhan-thu-hoi", "Xác nhận thu hồi lời mời");

      await openDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
      const revoked = await successNotice(page, "Đã thu hồi lời mời.");
      await shot("thu-hoi-thanh-cong", "Thu hồi lời mời thành công");
      await revoked.close();

      await invitationOf(page, INVITED_PHONE).getByText("Đã thu hồi").waitFor();
      await shot("loi-moi-da-thu-hoi", "Lời mời đã thu hồi trong danh sách");
    },
  }),

  memberFlow({
    id: "loi-moi-thu-hoi-that-bai",
    group,
    name: "THU HỒI LỜI MỜI THẤT BẠI DO LỜI MỜI ĐÃ ĐƯỢC XỬ LÝ",
    async run({ page, shot, backend }) {
      // The person answered the invitation while this list was open.
      const message = "Lời mời này đã được xử lý, không thể thu hồi.";
      backend.on("POST", /\/member-invitations\/[^/]+\/cancel$/, () => conflict("MEMBER_INVITATION_NOT_AVAILABLE", message));

      await openInvitations(page);
      await shot("loi-moi-da-gui", "Danh sách lời mời đã gửi");

      await invitationOf(page, INVITED_PHONE).getByRole("button", { name: "Thu hồi", exact: true }).click();
      await openDialog(page).getByText("Thu hồi lời mời?").waitFor();
      await shot("xac-nhan-thu-hoi", "Xác nhận thu hồi lời mời");

      await openDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
      await errorNotice(page, message);
      await shot("khong-thu-hoi-duoc", "Không thu hồi được lời mời");
    },
  }),

  memberFlow({
    id: "loi-moi-gui-lai-thanh-cong",
    group,
    name: "GỬI LẠI LIÊN KẾT MỜI",
    async run({ page, shot }) {
      await openInvitations(page);
      await shot("loi-moi-da-gui", "Danh sách lời mời đã gửi");

      await invitationOf(page, EXPIRED_INVITEE).getByRole("button", { name: "Gửi lại", exact: true }).click();
      await openDialog(page).getByText("Gửi lại lời mời?").waitFor();
      await shot("xac-nhan-gui-lai", "Xác nhận gửi lại lời mời");

      await openDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
      const resent = await successNotice(page, "Đã gửi lại lời mời. Liên kết cũ không còn dùng được.");
      await shot("gui-lai-thanh-cong", "Gửi lại lời mời thành công");
      await resent.close();

      // The row now carries the new link, and waits before it can be sent again.
      await invitationOf(page, EXPIRED_INVITEE).getByText("Liên kết mời").waitFor();
      await shot("lien-ket-moi", "Liên kết mời mới trong danh sách", { mode: "fullPage" });
    },
  }),

  memberFlow({
    id: "loi-moi-gui-lai-that-bai",
    group,
    name: "GỬI LẠI LIÊN KẾT MỜI THẤT BẠI DO ĐÃ ĐẠT GIỚI HẠN GỬI LẠI",
    async run({ page, shot, backend }) {
      const message = "Lời mời đã đạt giới hạn gửi lại. Hãy tạo lời mời mới.";
      backend.on("POST", /\/member-invitations\/[^/]+\/link:reissue$/, () => conflict("MEMBER_INVITATION_REISSUE_NOT_ALLOWED", message));

      await openInvitations(page);
      await shot("loi-moi-da-gui", "Danh sách lời mời đã gửi");

      await invitationOf(page, EXPIRED_INVITEE).getByRole("button", { name: "Gửi lại", exact: true }).click();
      await openDialog(page).getByText("Gửi lại lời mời?").waitFor();
      await shot("xac-nhan-gui-lai", "Xác nhận gửi lại lời mời");

      await openDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
      await errorNotice(page, message);
      await shot("khong-gui-lai-duoc", "Không gửi lại được lời mời");
    },
  }),
];
