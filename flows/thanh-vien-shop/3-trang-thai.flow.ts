import {
  AREA, LAM, VIET, memberFlow, openDialog, openMember, successNotice, waitLoaded, type MemberFixture,
} from "../_helpers/supership-shop-members";

// Managing a member's standing in the shop from their page: suspending them, bringing a suspended
// member back, and ending the membership. Each asks for confirmation and then says it is done.
function lifecycle(flow: {
  id: string; name: string; member: MemberFixture; action: "Tạm khóa" | "Kích hoạt" | "Ngừng hoạt động";
  before: string; question: string; confirmTitle: string; done: string; doneTitle: string; after: string;
}) {
  return memberFlow({
    id: flow.id, group: AREA.status, name: flow.name,
    async run({ page, shot }) {
      await openMember(page, flow.member);
      await shot("truoc-khi-doi", flow.before);

      await page.getByRole("button", { name: flow.action, exact: true }).click();
      await openDialog(page).getByText(flow.question).waitFor();
      await shot("xac-nhan", flow.confirmTitle);

      await openDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
      const done = await successNotice(page, flow.done);
      await shot("thanh-cong", flow.doneTitle);
      await done.close();

      // The page now offers what fits the new standing, and no longer the action just taken.
      await page.getByRole("button", { name: flow.action, exact: true }).waitFor({ state: "detached" });
      await waitLoaded(page);
      await shot("sau-khi-doi", flow.after);
    },
  });
}

export default [
  lifecycle({
    id: "trang-thai-tam-khoa", name: "TẠM KHÓA THÀNH VIÊN", member: VIET, action: "Tạm khóa",
    before: "Thành viên đang hoạt động", question: "Tạm khóa thành viên?", confirmTitle: "Xác nhận tạm khóa thành viên",
    done: `Đã tạm khóa thành viên ${VIET.fullName} thành công.`, doneTitle: "Tạm khóa thành viên thành công",
    after: "Thành viên sau khi tạm khóa",
  }),
  lifecycle({
    id: "trang-thai-kich-hoat-lai", name: "KÍCH HOẠT LẠI THÀNH VIÊN ĐÃ TẠM KHÓA", member: LAM, action: "Kích hoạt",
    before: "Thành viên đang tạm khóa", question: "Kích hoạt thành viên?", confirmTitle: "Xác nhận kích hoạt lại thành viên",
    done: `Đã kích hoạt thành viên ${LAM.fullName} thành công.`, doneTitle: "Kích hoạt lại thành viên thành công",
    after: "Thành viên sau khi kích hoạt lại",
  }),
  lifecycle({
    id: "trang-thai-ngung-hoat-dong", name: "NGỪNG HOẠT ĐỘNG THÀNH VIÊN", member: VIET, action: "Ngừng hoạt động",
    before: "Thành viên đang hoạt động", question: "Cho thành viên ngừng hoạt động?", confirmTitle: "Xác nhận cho thành viên ngừng hoạt động",
    done: `Đã cho thành viên ${VIET.fullName} ngừng hoạt động tại cửa hàng thành công.`, doneTitle: "Cho thành viên ngừng hoạt động thành công",
    after: "Thành viên sau khi ngừng hoạt động",
  }),
];
