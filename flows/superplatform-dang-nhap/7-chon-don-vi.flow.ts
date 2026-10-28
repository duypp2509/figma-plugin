import type { Page } from "playwright";
import {
  EMAIL, chooseUnit, confirmMfa, enterUnit, fill, pickerHeading, refusal, submit, verifyMfa, workspaceHome, type LoginContext,
} from "../_helpers/superplatform-login";
import {
  BLOCKED, GO_VAP, day, MIEN_NAM, PHU_NHUAN, TAN_BINH, THU_DUC, continueButton, openUnitsLogin, searchField, starButton, unitFlow,
  unitRow,
} from "../_helpers/superplatform-login-units";

/** The login page filled with the company email, then "Đăng nhập" through to the MFA asked before any unit (ADR-017). */
async function signIn(page: Page, shot: LoginContext["shot"]) {
  await openUnitsLogin(page);
  await fill(page, EMAIL);
  await shot("da-nhap", "Nhập Email công ty và mật khẩu");
  await submit(page);
  await page.getByRole("heading", { name: "Xác thực hai lớp" }).waitFor();
  await shot("mfa", "Xác thực hai lớp trước khi vào đơn vị");
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
  unitFlow("mot-don-vi", "CHỈ CÓ MỘT ĐƠN VỊ: VÀO THẲNG", [{ ...TAN_BINH }], async ({ page, shot }) => {
    await signIn(page, shot);
    await passMfa(page);
    // A single unit is entered at once: no picker.
    await workspaceHome(page).waitFor();
    await shot("trang-chu", "Một đơn vị: không hỏi, vào thẳng trang chủ");
  }),

  unitFlow("mac-dinh", "CÓ ĐƠN VỊ MẶC ĐỊNH: VÀO THẲNG",
    [{ ...TAN_BINH, is_default: true }, { ...MIEN_NAM }, { ...GO_VAP }], async ({ page, shot }) => {
    await signIn(page, shot);
    await passMfa(page);
    await workspaceHome(page).waitFor();
    await shot("trang-chu", "Có đơn vị mặc định: vào thẳng trang chủ đơn vị đó");
  }),

  unitFlow("nhieu-don-vi", "NHIỀU ĐƠN VỊ: TÌM VÀ ĐẶT ĐƠN VỊ MẶC ĐỊNH",
    [{ ...TAN_BINH }, { ...MIEN_NAM }, { ...GO_VAP }, { ...PHU_NHUAN }, { ...THU_DUC }], async ({ page, shot }) => {
    await signIn(page, shot);
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

  unitFlow("don-vi-tam-dung", "ĐƠN VỊ TẠM DỪNG HOẶC CHƯA TỚI NGÀY LÀM VIỆC", [
    { ...MIEN_NAM, is_default: true, blocked: BLOCKED.held(MIEN_NAM.org_name) },
    { ...GO_VAP, blocked: BLOCKED.notStarted(day(10 * 86400)) },
    { ...THU_DUC, blocked: BLOCKED.unitSuspended },
    { ...TAN_BINH },
  ], async ({ page, shot }) => {
    await signIn(page, shot);
    await openPicker(page);
    await page.getByText(BLOCKED.held(MIEN_NAM.org_name).reason_message, { exact: true }).waitFor();
    // The default unit is paused: the picker is shown instead of entering it.
    await shot("danh-sach", "Đơn vị mặc định bị tạm dừng quyền: hỏi chọn đơn vị");
    await chooseUnit(page, TAN_BINH.org_name);
    await shot("da-chon", "Chỉ chọn được đơn vị còn vào được");
    await enterUnit(page);
    await shot("trang-chu", "Vào trang chủ Bưu cục Tân Bình");
  }),

  unitFlow("khong-vao-duoc", "KHÔNG CÓ ĐƠN VỊ NÀO VÀO ĐƯỢC", [{ ...TAN_BINH, blocked: BLOCKED.suspendedAbove }],
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
];
