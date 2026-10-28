import type { Page } from "playwright";
import {
  MESSAGES, PROFILE_URL, contactInput, fullNameInput, openProfile, profileFlow, result, saveButton, type ProfileContext,
  type ProfileSetup,
} from "../_helpers/superplatform-my-profile";
import {
  EXTRA_MESSAGES, acceptAvatar, announceElsewhere, cropDialog, cropReady, pickAvatar, portraitPng, request, rest,
} from "../_helpers/superplatform-my-profile-extras";

const SECTION = "YÊU CẦU CẬP NHẬT HỒ SƠ VÀ CẢNH BÁO";
const flow = (id: string, name: string, run: (ctx: ProfileContext) => Promise<void>, setup?: ProfileSetup) =>
  profileFlow(SECTION, `yeu-cau-${id}`, name, run, setup);

/** RouteProgress starts on the link click the guard then cancels, and stays at 88% until a route changes (web defect). */
const STUCK_PROGRESS = '[role="status"][aria-label="Đang tải trang"]';
const reminder = (page: Page) => page.getByRole("status", { name: "Yêu cầu cập nhật hồ sơ" });
const marks = (page: Page) => page.getByText("Cần cập nhật", { exact: true });
const conflictBox = (page: Page) => page.getByRole("alert").filter({ hasText: MESSAGES.conflict });
async function closeResult(page: Page) {
  await page.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await page.getByRole("button", { name: "Đã hiểu", exact: true }).waitFor({ state: "hidden" });
}
/** Waits until `count` "Cần cập nhật" marks are left on the page. */
async function marksLeft(page: Page, count: number) {
  await page.waitForFunction(n => Array.from(document.querySelectorAll("span")).filter(span => span.textContent === "Cần cập nhật").length === n, count);
}

export default [
  flow("cap-nhat-theo-yeu-cau", "01. CẬP NHẬT HỒ SƠ THEO YÊU CẦU", async ({ page, shot, mock }) => {
    mock.request = request.of(["DATE_OF_BIRTH", "AVATAR", "EMERGENCY_CONTACT"], "Trần Quốc Bảo",
      "Em bổ sung ảnh đại diện và người liên hệ khẩn cấp trước ngày 15/10 giúp anh nhé.");
    request.track(mock);
    await openProfile(page);
    await reminder(page).getByText("Bạn cần cập nhật hồ sơ: Ngày sinh, Ảnh đại diện, Liên hệ khẩn cấp.", { exact: true }).waitFor();
    await marksLeft(page, 3);
    await rest(page);
    await shot("thanh-nhac-va-dau", "Thanh nhắc và các trường cần cập nhật", { mode: "fullPage" });

    // Ngày sinh is right as it is: saving it unchanged confirms it.
    await saveButton(page).click();
    await result(page, MESSAGES.saved);
    await closeResult(page);
    await reminder(page).getByText("Bạn cần cập nhật hồ sơ: Ảnh đại diện, Liên hệ khẩn cấp.", { exact: true }).waitFor();
    await marksLeft(page, 2);
    await rest(page);
    await shot("da-xac-nhan-ngay-sinh", "Đã xác nhận ngày sinh, còn hai việc", { mode: "fullPage" });

    await contactInput(page, "name").fill("Nguyễn Văn Hùng");
    await contactInput(page, "relationship").fill("Bố");
    await contactInput(page, "phoneNumber").fill("0913 274 586");
    await saveButton(page).click();
    await result(page, MESSAGES.saved);
    await closeResult(page);
    await reminder(page).getByText("Bạn cần cập nhật hồ sơ: Ảnh đại diện.", { exact: true }).waitFor();
    await marksLeft(page, 1);
    await rest(page);
    await shot("da-luu-lien-he", "Đã lưu liên hệ khẩn cấp, còn ảnh đại diện", { mode: "fullPage" });

    const portrait = await portraitPng(page, "a");
    acceptAvatar(mock, portrait.dataUrl);
    await pickAvatar(page, portrait.file);
    await cropReady(page);
    await cropDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
    await result(page, MESSAGES.avatarSaved);
    await closeResult(page);
    await reminder(page).waitFor({ state: "detached" });
    await marks(page).first().waitFor({ state: "detached" });
    await rest(page);
    await shot("da-xong", "Đã xong, thanh nhắc tự ẩn", { mode: "fullPage" });
  }),

  flow("roi-trang-khi-dang-sua", "02. RỜI TRANG KHI ĐANG SỬA DỞ", async ({ page, shot, mock }) => {
    // The page left for: Giấy tờ định danh, consent to the face scan already given.
    mock.on("GET", "/v1/me/consents/ekyc-face", () => ({ data: { granted: true, granted_at: "2026-09-02T03:00:00.000Z",
      available: true, consent_version: null, consent_text: null, consent_digest: null } }));
    await openProfile(page);
    await fullNameInput(page).fill("Nguyễn Thị Minh Anh");
    const leaveLink = page.getByRole("link", { name: "Giấy tờ định danh", exact: true });
    await leaveLink.click();
    const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog")).filter({ hasText: "Bạn chưa lưu thay đổi" });
    await dialog.waitFor();
    await rest(page);
    await shot("hoi-roi-trang", "Hỏi trước khi rời trang", { hide: [STUCK_PROGRESS] });

    await dialog.getByRole("button", { name: "Ở lại", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await rest(page);
    await shot("o-lai", "Ở lại, giữ thay đổi đang nhập", { hide: [STUCK_PROGRESS] });

    await leaveLink.click();
    await dialog.waitFor();
    await dialog.getByRole("button", { name: "Rời trang", exact: true }).click();
    await page.waitForURL(url => !url.pathname.startsWith(PROFILE_URL));
    await page.getByRole("heading", { name: "Giấy tờ định danh" }).first().waitFor();
    await rest(page);
    await shot("da-roi-trang", "Đã rời trang, bỏ thay đổi");
  }),

  flow("cap-nhat-o-noi-khac", "03. HỒ SƠ VỪA ĐƯỢC CẬP NHẬT Ở NƠI KHÁC", async ({ page, shot, mock }) => {
    await openProfile(page);
    await fullNameInput(page).fill("Nguyễn Thị Minh Anh");
    // Another tab of the same person saves a new date of birth while this one is being edited.
    mock.dateOfBirth = "1994-05-28";
    mock.version++;
    await fullNameInput(page).blur();
    await announceElsewhere(page);
    await conflictBox(page).waitFor();
    await rest(page);
    await shot("canh-bao", "Cảnh báo hồ sơ đã đổi ở nơi khác");

    await conflictBox(page).getByRole("button", { name: "Tải thông tin mới và bỏ thay đổi đang nhập" }).click();
    await conflictBox(page).waitFor({ state: "detached" });
    await page.waitForFunction(() => (document.getElementById("profile-full-name") as HTMLInputElement | null)?.value === "Nguyễn Minh Anh");
    await rest(page);
    await shot("da-tai-moi", "Đã tải thông tin mới");
  }),

  flow("luu-bi-tu-choi", "04. LƯU KHI HỒ SƠ ĐÃ ĐỔI Ở THIẾT BỊ KHÁC", async ({ page, shot, mock }) => {
    await openProfile(page);
    await fullNameInput(page).fill("Nguyễn Thị Minh Anh");
    // Saved from another device: this page is not told, so it sends the version it loaded.
    mock.version++;
    mock.on("PUT", "/v1/me/profile", () => ({ status: 409, message: EXTRA_MESSAGES.versionConflict, data: {} }));
    await saveButton(page).click();
    await result(page, EXTRA_MESSAGES.versionConflict);
    await rest(page);
    await shot("that-bai", "Lưu thất bại, hồ sơ đã đổi ở nơi khác");
  }),
];
