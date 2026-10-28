import type { Page } from "playwright";
import { profileOf, type ProfileMock } from "./superplatform-my-profile";
import { waitEnabled } from "./wait";

/*
 * Extras of "Thông tin tài khoản" for the avatar and the profile update request flows: a drawn portrait to upload, the
 * avatar upload answered like the server, and the signed-in person's open request (MineDto) kept as the server does.
 */

/** Sentences of the server (UserService). */
export const EXTRA_MESSAGES = {
  avatarSaved: "Đã cập nhật ảnh đại diện.",
};

/** A flat, drawn portrait (no real person); two variants tell the old and the new picture apart. */
export function portraitSvg(variant: "a" | "b") {
  const [bg1, bg2, shirt, hair] = variant === "a"
    ? ["#fde7d9", "#f8c9b0", "#334155", "#2b1d16"]
    : ["#dbeafe", "#bfdbfe", "#b91c1c", "#3b2418"];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
  <rect width="600" height="600" fill="url(#g)"/>
  <path d="M168 255 C150 120 450 120 432 255 L446 400 C446 430 154 430 154 400 Z" fill="${hair}"/>
  <path d="M90 600 C96 470 190 430 300 430 C410 430 504 470 510 600 Z" fill="${shirt}"/>
  <path d="M262 380 L338 380 L344 450 C320 470 280 470 256 450 Z" fill="#e8b48f"/>
  <ellipse cx="300" cy="280" rx="108" ry="128" fill="#f2c4a0"/>
  <path d="M190 262 C198 168 300 150 410 236 C392 176 340 146 300 146 C228 146 186 196 190 262 Z" fill="${hair}"/>
  <ellipse cx="258" cy="290" rx="11" ry="13" fill="#2b1d16"/>
  <ellipse cx="342" cy="290" rx="11" ry="13" fill="#2b1d16"/>
  <path d="M236 258 Q258 246 280 256" stroke="#2b1d16" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M320 256 Q342 246 364 258" stroke="#2b1d16" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M296 300 Q300 326 290 334" stroke="#d99a73" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M266 352 Q300 378 334 352" stroke="#b4533a" stroke-width="7" fill="none" stroke-linecap="round"/>
  <ellipse cx="232" cy="330" rx="18" ry="10" fill="#f0a98a" opacity=".5"/>
  <ellipse cx="368" cy="330" rx="18" ry="10" fill="#f0a98a" opacity=".5"/>
</svg>`;
}
export const portraitDataUrl = (variant: "a" | "b") => `data:image/svg+xml,${encodeURIComponent(portraitSvg(variant))}`;

/** The portrait drawn as a PNG in the page: the file to pick, and the same picture as a data URL the server "stores". */
export async function portraitPng(page: Page, variant: "a" | "b") {
  const png = await page.evaluate(async svg => {
    const image = new Image(); image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 600;
    canvas.getContext("2d")!.drawImage(image, 0, 0, 600, 600);
    return canvas.toDataURL("image/png");
  }, portraitSvg(variant));
  return { dataUrl: png, file: { name: "anh-chan-dung.png", mimeType: "image/png", buffer: Buffer.from(png.split(",")[1]!, "base64") } };
}

/** A document picked by mistake: the picker's "Tất cả tệp" lets it through. */
export const notAnImage = { name: "so-yeu-ly-lich.pdf", mimeType: "application/pdf",
  buffer: Buffer.concat([Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"), Buffer.alloc(214_000, 0x20)]) };

export const avatarButton = (page: Page) => page.getByRole("button", { name: "Đổi ảnh đại diện", exact: true });
export const cropDialog = (page: Page) => page.getByRole("dialog", { name: "Thay đổi ảnh đại diện" });
export const cropConfirm = (page: Page) => cropDialog(page).getByRole("button", { name: "Xác nhận", exact: true });

/** Clicks the pencil and picks `file` in the file chooser it opens. */
export async function pickAvatar(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), avatarButton(page).click()]);
  await chooser.setFiles(file);
  await cropDialog(page).waitFor();
}

/** Waits for the picture to be drawn in the crop box and "Xác nhận" to unlock. */
export async function cropReady(page: Page) {
  await cropDialog(page).locator("img").evaluate((image: HTMLImageElement) => image.decode());
  await waitEnabled(cropConfirm(page));
}

/** Moves the mouse off every control, so no button is shot while hovered. */
export async function rest(page: Page) {
  await page.mouse.move(2, 898);
}

/** PUT /v1/me/avatar answered like the server: the picture stored at `url`, the version moved on. */
export function acceptAvatar(mock: ProfileMock, url: string) {
  mock.on("PUT", "/v1/me/avatar", () => {
    mock.avatarUrl = url;
    mock.version++;
    request.done(mock, ["AVATAR"]);
    return { message: EXTRA_MESSAGES.avatarSaved, data: profileOf(mock) };
  });
}

/** Task codes and labels of a profile update request (ProfileUpdateFields), in the order of the screen. */
const LABELS: Record<string, string> = {
  FULL_NAME: "Họ và tên", DATE_OF_BIRTH: "Ngày sinh", GENDER: "Giới tính", AVATAR: "Ảnh đại diện",
  EMERGENCY_CONTACT: "Liên hệ khẩn cấp", VERIFY_EMAIL: "Xác minh Email cá nhân", VERIFY_PHONE: "Xác minh số điện thoại",
  IDENTITY_DOCUMENT: "Xác thực căn cước",
};
interface FieldState { code: string; label: string; done: boolean; status_name: string; status_tone: string; saved_at: string | null }
export interface MineDto {
  id: string; notice: string; message: string | null; requested_by_name: string | null; requested_at: string;
  fields: FieldState[]; links: { code: string; label: string }[];
}

export const request = {
  /** The open request asking for `codes`, sent by `by` with `message`, as GET /v1/me/profile-update-request answers it. */
  of(codes: string[], by: string, message: string | null, at = "2026-10-10T03:15:00.000Z"): MineDto {
    const fields = Object.keys(LABELS).filter(code => codes.includes(code)).map(code => ({ code, label: LABELS[code]!, done: false,
      status_name: "Chưa làm", status_tone: "warning", saved_at: null }));
    return request.refresh({ id: "request-1", notice: "", message, requested_by_name: by, requested_at: at, fields, links: [] });
  },
  /** The notice and the buttons for the tasks still left (ProfileUpdateRequestService.mine, links). */
  refresh(mine: MineDto): MineDto {
    const left = mine.fields.filter(field => !field.done);
    mine.notice = `Bạn cần cập nhật hồ sơ: ${left.map(field => field.label).join(", ")}.`;
    const destinations = [...new Set(left.map(field => field.code === "IDENTITY_DOCUMENT" ? "IDENTITY_DOCUMENT" : "MY_PROFILE"))];
    mine.links = destinations.map(code => ({ code, label: code === "MY_PROFILE" ? "Cập nhật hồ sơ" : "Xác thực căn cước" }));
    return mine;
  },
  /** Marks `codes` saved (ProfileUpdateTracker); the request closes once every task is done. */
  done(mock: ProfileMock, codes: string[]) {
    const mine = mock.request as MineDto | null;
    if (!mine) return;
    for (const field of mine.fields) if (codes.includes(field.code) && !field.done)
      Object.assign(field, { done: true, status_name: "Đã xong", status_tone: "success", saved_at: "2026-10-12T02:00:00.000Z" });
    mock.request = mine.fields.every(field => field.done) ? null : request.refresh(mine);
  },
  /** Saves of the profile and the emergency contact count for the open request, like the server. */
  track(mock: ProfileMock) {
    mock.on("PUT", "/v1/me/profile", body => {
      if (body?.version !== mock.version) return undefined;
      const saved: string[] = [];
      if (typeof body.full_name === "string" && body.full_name.trim()) saved.push("FULL_NAME");
      if (body.date_of_birth) saved.push("DATE_OF_BIRTH");
      if (typeof body.gender === "string" && body.gender.trim()) saved.push("GENDER");
      request.done(mock, saved);
      return undefined;
    });
    mock.on("PUT", "/v1/me/emergency-contact", body => {
      if (body?.name && body?.relationship && /^0\d{9}$/.test(String(body.phone_number ?? "").replace(/\s/g, "")))
        request.done(mock, ["EMERGENCY_CONTACT"]);
      return undefined;
    });
  },
};
