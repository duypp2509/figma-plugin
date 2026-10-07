import {
  ANH, LAM, OWNER, ROOT, VIET, memberFlow, openMember, openMemberFromList, openMembers,
} from "../_helpers/supership-shop-members";

// Looking at a member, in one row of frames: from the list into a member's page on its first tab,
// "Thông tin chung", for each kind of member the owner can open.
export default memberFlow({
  id: "thong-tin",
  group: [ROOT],
  name: "XEM THÔNG TIN THÀNH VIÊN",
  async run({ page, shot }) {
    await openMembers(page);
    await shot("danh-sach", "Danh sách thành viên");

    await openMemberFromList(page, VIET);
    await shot("dang-hoat-dong", "Thông tin chung của thành viên đang hoạt động");

    await openMember(page, LAM);
    await shot("dang-tam-khoa", "Thông tin chung của thành viên đang tạm khóa");

    await openMember(page, ANH);
    await shot("da-ngung-hoat-dong", "Thông tin chung của thành viên đã ngừng hoạt động");

    // Nobody suspends, ends or re-permissions themselves, so the owner's own page has no such buttons.
    await openMember(page, OWNER);
    await shot("chinh-chu-cua-hang", "Thông tin chung của chính chủ cửa hàng");
  },
});
