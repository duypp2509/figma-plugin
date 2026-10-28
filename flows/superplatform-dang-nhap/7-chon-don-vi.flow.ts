import type { Page } from "playwright";
import {
  EMAIL, chooseUnit, confirmMfa, enterUnit, fill, pickerHeading, refusal, scrollToTop, submit, verifyMfa, workspaceHome,
} from "../_helpers/superplatform-login";
import {
  BLOCKED, GO_VAP, day, MIEN_NAM, PHU_NHUAN, TAN_BINH, THU_DUC, continueButton, openUnitsLogin, searchField, starButton, unitFlow,
  unitRow,
} from "../_helpers/superplatform-login-units";

/** Signed in with the company email; MFA is asked before any unit (ADR-017) and passed without a picture. */
async function signIn(page: Page) {
  await openUnitsLogin(page);
  await fill(page, EMAIL);
  await submit(page);
}
async function passMfa(page: Page) {
  await verifyMfa(page);
  await confirmMfa(page);
}
/** The picker, once the refreshed list (with eligibility) is in. */
async function openPicker(page: Page) {
  await passMfa(page);
  await pickerHeading(page).waitFor();
  await continueButton(page).waitFor();
}
/** The pointer leaves what it pressed, so no tooltip covers the list. */
async function pointerAway(page: Page) {
  await page.mouse.move(8, 8);
}

export default [
  unitFlow("mot-don-vi", "01. CHỈ CÓ MỘT ĐƠN VỊ: VÀO THẲNG", [{ ...TAN_BINH }], async ({ page, shot }) => {
    await signIn(page);
    await page.getByRole("heading", { name: "Xác thực hai lớp" }).waitFor();
    await shot("mfa", "Xác thực hai lớp trước khi vào đơn vị");
    await passMfa(page);
    // A single unit is entered at once: no picker.
    await workspaceHome(page).waitFor();
    await shot("trang-chu", "Một đơn vị: không hỏi, vào thẳng trang chủ");
  }),

  unitFlow("mac-dinh", "02. CÓ ĐƠN VỊ MẶC ĐỊNH: VÀO THẲNG",
    [{ ...TAN_BINH, is_default: true }, { ...MIEN_NAM }, { ...GO_VAP }], async ({ page, shot }) => {
    await signIn(page);
    await page.getByRole("heading", { name: "Xác thực hai lớp" }).waitFor();
    await shot("mfa", "Xác thực hai lớp trước khi vào đơn vị");
    await passMfa(page);
    await workspaceHome(page).waitFor();
    await shot("trang-chu", "Có đơn vị mặc định: vào thẳng trang chủ đơn vị đó");
  }),

  unitFlow("nhieu-don-vi", "03. NHIỀU ĐƠN VỊ: TÌM VÀ ĐẶT ĐƠN VỊ MẶC ĐỊNH",
    [{ ...TAN_BINH }, { ...MIEN_NAM }, { ...GO_VAP }, { ...PHU_NHUAN }, { ...THU_DUC }], async ({ page, shot }) => {
    await signIn(page);
    await openPicker(page);
    await shot("chon-don-vi", "Chọn đơn vị làm việc");

    await searchField(page).fill("go vap");
    await unitRow(page, TAN_BINH).waitFor({ state: "hidden" });
    await shot("tim-khong-dau", "Tìm theo tên, gõ không dấu");
    await searchField(page).fill("BCT29");
    await unitRow(page, TAN_BINH).waitFor();
    await shot("tim-theo-ma", "Tìm theo mã đơn vị");
    await searchField(page).fill("Quận 7");
    await page.getByText("Không tìm thấy đơn vị phù hợp.", { exact: true }).waitFor();
    await shot("khong-tim-thay", "Không có đơn vị khớp");
    await searchField(page).fill("");

    await starButton(page, TAN_BINH).click();
    await starButton(page, TAN_BINH).and(page.locator("[aria-pressed=true]")).waitFor();
    await pointerAway(page);
    await shot("dat-mac-dinh", "Đặt Bưu cục Tân Bình làm đơn vị mặc định");
    await starButton(page, TAN_BINH).click();
    await starButton(page, TAN_BINH).and(page.locator("[aria-pressed=false]")).waitFor();
    await pointerAway(page);
    await shot("bo-mac-dinh", "Bấm lại ngôi sao: bỏ đơn vị mặc định");

    await chooseUnit(page, TAN_BINH.org_name);
    await shot("da-chon", "Chọn Bưu cục Tân Bình");
    await enterUnit(page);
    await shot("trang-chu", "Vào trang chủ của đơn vị");
  }),

  unitFlow("don-vi-tam-dung", "04. ĐƠN VỊ TẠM DỪNG HOẶC CHƯA TỚI NGÀY LÀM VIỆC", [
    { ...MIEN_NAM, is_default: true, blocked: BLOCKED.held(MIEN_NAM.org_name) },
    { ...GO_VAP, blocked: BLOCKED.notStarted(day(10 * 86400)) },
    { ...THU_DUC, blocked: BLOCKED.unitSuspended },
    { ...TAN_BINH },
  ], async ({ page, shot }) => {
    await signIn(page);
    await openPicker(page);
    await page.getByText(BLOCKED.held(MIEN_NAM.org_name).reason_message, { exact: true }).waitFor();
    // The default unit is paused: the picker is shown instead of entering it.
    await shot("danh-sach", "Đơn vị mặc định bị tạm dừng quyền: hỏi chọn đơn vị");
    await chooseUnit(page, TAN_BINH.org_name);
    await shot("da-chon", "Chỉ chọn được đơn vị còn vào được");
    await enterUnit(page);
    await shot("trang-chu", "Vào trang chủ Bưu cục Tân Bình");
  }),

  unitFlow("khong-vao-duoc", "05. KHÔNG CÓ ĐƠN VỊ NÀO VÀO ĐƯỢC", [{ ...TAN_BINH, blocked: BLOCKED.suspendedAbove }],
    async ({ page, shot }) => {
    await openUnitsLogin(page);
    await fill(page, EMAIL);
    await shot("da-nhap", "Nhập Email công ty và mật khẩu");
    await submit(page);
    // No unit to enter: the sign-in ends and the login page says why (ContextSelectionCard).
    await refusal(page, `${BLOCKED.suspendedAbove.reason_message} ${BLOCKED.suspendedAbove.suggested_action}`);
    await page.getByRole("alertdialog").getByText(`Chưa vào được ${TAN_BINH.org_name}`, { exact: true }).waitFor();
    await shot("ket-thuc", "Đơn vị duy nhất tạm ngưng: kết thúc đăng nhập, báo lý do");
  }),

  unitFlow("tu-choi-khi-vao", "06. BỊ TỪ CHỐI KHI VÀO ĐƠN VỊ", [{ ...TAN_BINH }, { ...MIEN_NAM }, { ...GO_VAP }],
    async ({ page, shot, mock, units }) => {
    const suspended = BLOCKED.employmentSuspended;
    // Suspended at Gò Vấp after the list was read: the entry is refused (AuthService.doSelectAccessContext).
    mock.on("PUT", "/v1/me/access-context", body => {
      if (body?.membership_id !== GO_VAP.membership_id) return undefined;
      units.units.find(unit => unit.membership_id === GO_VAP.membership_id)!.blocked = suspended;
      return { status: 403, message: suspended.reason_message,
        data: { code: suspended.reason_code, reason_code: suspended.reason_code, suggested_action: suspended.suggested_action } };
    });
    await signIn(page);
    await openPicker(page);
    await chooseUnit(page, GO_VAP.org_name);
    await shot("da-chon", "Chọn Bưu cục Gò Vấp");
    await continueButton(page).click();
    await refusal(page, suspended.reason_message);
    await shot("tu-choi", "Không vào được đơn vị: báo lý do");
    await page.getByRole("alertdialog").getByRole("button", { name: "Làm mới danh sách" }).click();
    await page.getByRole("alertdialog").waitFor({ state: "hidden" });
    await unitRow(page, GO_VAP).getByText(suspended.reason_message, { exact: true }).waitFor();
    await scrollToTop(page);
    await shot("lam-moi", "Làm mới danh sách: Bưu cục Gò Vấp bị khóa");
    await chooseUnit(page, TAN_BINH.org_name);
    await enterUnit(page);
    await shot("trang-chu", "Chọn đơn vị khác, vào trang chủ");
  }),
];
