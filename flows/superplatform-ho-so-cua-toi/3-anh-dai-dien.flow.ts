import type { Page } from "playwright";
import { MESSAGES, openProfile, profileFlow, result, type ProfileContext, type ProfileSetup } from "../_helpers/superplatform-my-profile";
import {
  EXTRA_MESSAGES, acceptAvatar, cropDialog, cropReady, notAnImage, pickAvatar, portraitDataUrl, portraitPng, rest,
} from "../_helpers/superplatform-my-profile-extras";

const SECTION = "ẢNH ĐẠI DIỆN";
const flow = (id: string, name: string, run: (ctx: ProfileContext) => Promise<void>, setup?: ProfileSetup) =>
  profileFlow(SECTION, `anh-dai-dien-${id}`, name, run, setup);

const pageAvatar = (page: Page) => page.getByRole("img", { name: "Ảnh đại diện của Nguyễn Minh Anh" });
/** Waits until the avatar on the page shows `url`. */
async function showsAvatar(page: Page, url: string) {
  await page.waitForFunction(src => Array.from(document.images).some(image => image.src === src && image.complete && image.naturalWidth > 0), url);
}
const dialogNamed = (page: Page, title: string) => page.getByRole("alertdialog").or(page.getByRole("dialog")).filter({ has: page.getByRole("heading", { name: title, exact: true }) });

/**
 * A refused upload is said twice: the error under the avatar (FeedbackMessage) opens "Không thể hoàn tất thao tác" on
 * top of the page's own "Thất bại" result, both with the server's sentence.
 */
async function twoErrorDialogs(page: Page, shot: ProfileContext["shot"], message: string, title: string) {
  const first = dialogNamed(page, "Không thể hoàn tất thao tác");
  await first.getByText(message, { exact: true }).waitFor();
  await rest(page);
  await shot("that-bai", title);

  await first.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await first.waitFor({ state: "hidden" });
  const second = dialogNamed(page, "Thất bại");
  await second.getByText(message, { exact: true }).waitFor();
  await rest(page);
  await shot("hop-thoai-thu-hai", "Hộp thoại lỗi thứ hai, cùng câu");

  await second.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await second.waitFor({ state: "hidden" });
  await showsAvatar(page, portraitDataUrl("a"));
  await rest(page);
  await shot("giu-anh-cu", "Đóng lỗi, giữ ảnh cũ");
}
async function closeResult(page: Page) {
  await page.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await page.getByRole("button", { name: "Đã hiểu", exact: true }).waitFor({ state: "hidden" });
}

export default [
  flow("doi-anh", "01. ĐỔI ẢNH ĐẠI DIỆN", async ({ page, shot, mock }) => {
    await openProfile(page);
    await pageAvatar(page).waitFor();
    await shot("thong-tin-tai-khoan", "Thông tin tài khoản, ảnh mặc định");

    const portrait = await portraitPng(page, "b");
    acceptAvatar(mock, portrait.dataUrl);
    await pickAvatar(page, portrait.file);
    await cropReady(page);
    await rest(page);
    await shot("cat-anh", "Cắt ảnh đại diện");

    await cropDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
    await result(page, MESSAGES.avatarSaved);
    await rest(page);
    await shot("thanh-cong", "Cập nhật ảnh đại diện thành công");

    await closeResult(page);
    await showsAvatar(page, portrait.dataUrl);
    await rest(page);
    await shot("anh-moi", "Ảnh mới trên trang và góc trên");
  }),

  flow("huy-cat-anh", "02. HỦY Ở HỘP CẮT ẢNH", async ({ page, shot }) => {
    await openProfile(page);
    await showsAvatar(page, portraitDataUrl("a"));
    const portrait = await portraitPng(page, "b");
    await pickAvatar(page, portrait.file);
    await cropReady(page);
    await rest(page);
    await shot("cat-anh", "Cắt ảnh đại diện");

    await cropDialog(page).getByRole("button", { name: "Đóng hộp thoại" }).click();
    await cropDialog(page).waitFor({ state: "hidden" });
    await rest(page);
    await shot("giu-anh-cu", "Đã hủy, giữ ảnh cũ");
  }, { avatarUrl: portraitDataUrl("a") }),

  flow("tep-khong-phai-anh", "03. CHỌN TỆP KHÔNG PHẢI ẢNH", async ({ page, shot, mock }) => {
    await openProfile(page);
    await showsAvatar(page, portraitDataUrl("a"));
    let uploads = 0;
    mock.on("PUT", "/v1/me/avatar", () => { uploads++; return undefined; });
    await pickAvatar(page, notAnImage);
    // The picture never loads, so "Xác nhận" stays locked and nothing is sent.
    await cropDialog(page).locator("img").evaluate((image: HTMLImageElement) => image.decode().catch(() => undefined));
    if (!await cropDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).isDisabled())
      throw new Error("Nút Xác nhận không bị khóa với tệp không phải ảnh.");
    await rest(page);
    await shot("hop-cat-trong", "Hộp cắt ảnh không hiện ảnh, không xác nhận được");
    if (uploads) throw new Error("Tệp không phải ảnh đã được gửi lên máy chủ.");
  }, { avatarUrl: portraitDataUrl("a") }),

  flow("kho-anh-loi", "04. MÁY CHỦ KHÔNG LƯU ĐƯỢC ẢNH", async ({ page, shot, mock }) => {
    await openProfile(page);
    await showsAvatar(page, portraitDataUrl("a"));
    mock.on("PUT", "/v1/me/avatar", () => ({ status: 503, message: EXTRA_MESSAGES.storageUnavailable, data: null }));
    const portrait = await portraitPng(page, "b");
    await pickAvatar(page, portrait.file);
    await cropReady(page);
    await cropDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
    await twoErrorDialogs(page, shot, EXTRA_MESSAGES.storageUnavailable, "Không lưu được ảnh");
  }, { avatarUrl: portraitDataUrl("a") }),

  flow("xung-dot", "05. HỒ SƠ ĐÃ ĐỔI Ở THIẾT BỊ KHÁC", async ({ page, shot, mock }) => {
    await openProfile(page);
    await showsAvatar(page, portraitDataUrl("a"));
    // Saved from another device after this page loaded: the version the page sends is stale.
    mock.version++;
    mock.on("PUT", "/v1/me/avatar", () => ({ status: 409, message: EXTRA_MESSAGES.versionConflict, data: {} }));
    const portrait = await portraitPng(page, "b");
    await pickAvatar(page, portrait.file);
    await cropReady(page);
    await cropDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
    await twoErrorDialogs(page, shot, EXTRA_MESSAGES.versionConflict, "Hồ sơ đã đổi ở nơi khác");
  }, { avatarUrl: portraitDataUrl("a") }),
];
