import type { Page } from "playwright";
import { expect } from "playwright/test";
import { defineFlow, type FlowContext } from "../../capture";
import { mockPin } from "./superplatform-screen-lock";

export const IDENTITY_URL = "/workspace/account/identity-document";
export const STEP_UP_CODE = "515060";
const AT = "2026-10-12T02:00:00.000Z";
export const CONSENT_TEXT = "Tôi đồng ý cho SuperShip dùng ảnh hai mặt căn cước và ảnh khuôn mặt của tôi để xác thực danh tính và để xác minh khi quên mật khẩu. Ảnh khuôn mặt mỗi lần xác minh được giữ 90 ngày. Tôi có thể rút đồng ý bất cứ lúc nào; khi rút, ảnh bị xóa, số và thông tin trên căn cước được giữ cho hồ sơ lao động.";
export const PERMANENT = "45 Nguyễn Trãi, Phường Sài Gòn, Thành phố Hồ Chí Minh";

/** Exact sentences of IdentityDocumentImageService. */
export const MESSAGES = {
  verified: "Đã xác thực căn cước.",
  ready: "Đã đọc được căn cước.",
  retakeFront: "Chưa đọc rõ mặt trước. Hãy chụp lại.",
  retakeBack: "Chưa đọc rõ mặt sau. Hãy chụp lại.",
  retakeFace: "Chưa thấy rõ khuôn mặt. Hãy chụp lại nơi đủ sáng, không đeo khẩu trang.",
  notLive: "Không xác minh được khuôn mặt. Hãy chụp trực tiếp, không dùng ảnh.",
  notMatched: "Khuôn mặt không khớp ảnh trên căn cước.",
  expired: "Căn cước đã hết hạn.",
  otherNumber: "Căn cước khác số đã xác thực. Liên hệ Quản trị hệ thống.",
  inUse: "Số căn cước này không dùng được. Liên hệ Quản trị hệ thống.",
};

type Status = "NONE" | "VERIFIED" | "EXPIRING" | "EXPIRED";
type Place = { province_code: string; province_name: string; ward_code: string; ward_name: string; line: string };
export type Outcome =
  | { result: "VERIFIED" }
  | { result: "RETAKE"; retake: "FRONT" | "BACK" | "FACE"; message: string }
  | { result: "NOT_MATCHED" | "NOT_LIVE" | "REFUSED"; message: string };
/** An answer of the card read before the face ("Tiếp tục" after the back side); READY when none is queued. */
export type CardOutcome =
  | { result: "RETAKE"; retake: "FRONT" | "BACK"; message: string }
  | { result: "REFUSED"; message: string };

const verifiedCard = () => ({
  number: "********0482", full_name: "Nguyễn Minh Anh", birth_date: "1994-08-17", gender: "FEMALE" as const,
  issued_on: "2021-04-12", issued_place: "Cục Cảnh sát quản lý hành chính về trật tự xã hội", valid_until: "2034-08-17",
  verified_at: AT, images_available: true, images_deleted: false, card_warnings: [] as string[],
});

export interface IdentityMock {
  status: Status;
  card: ReturnType<typeof verifiedCard> | null;
  consent: boolean;
  consentAvailable: boolean;
  available: boolean;
  lockedUntil: string | null;
  remaining: number;
  sameAsPermanent: boolean | null;
  current: Place | null;
  /** Answers of the next verifications, in order; VERIFIED once empty. */
  outcomes: Outcome[];
  verifications: number;
  /** Answers of the next card reads, in order; READY once empty. */
  cardOutcomes: CardOutcome[];
  /** Citizen ID photo tries left, counted apart from the face's. */
  cardRemaining: number;
}
export interface IdentityContext extends FlowContext { mock: IdentityMock }

export function identityFlow(id: string, name: string, run: (ctx: IdentityContext) => Promise<void>,
                             setup: Partial<IdentityMock> = {}) {
  return defineFlow({ id: `superplatform-cccd-${id}`, name, app: "superplatform",
    group: ["SUPERPLATFORM", "XÁC THỰC ĐỊNH DANH (CCCD)"],
    async run(ctx) {
      await mockPin(ctx.page, ctx.log, false);
      await fakeCamera(ctx.page);
      const mock: IdentityMock = { status: "NONE", card: null, consent: false, consentAvailable: true, available: true,
        lockedUntil: null, remaining: 5, sameAsPermanent: null, current: null, outcomes: [], verifications: 0,
        cardOutcomes: [], cardRemaining: 5, ...setup };
      if (mock.status !== "NONE" && !mock.card) mock.card = verifiedCard();
      await mockIdentity(ctx, mock);
      await run({ ...ctx, mock });
    },
  });
}

/** A verified card; {@code status} EXPIRING / EXPIRED moves the validity date accordingly. */
export function verified(status: Status = "VERIFIED", consent = true): Partial<IdentityMock> {
  const card = verifiedCard();
  if (status === "EXPIRING") card.valid_until = "2026-11-02";
  if (status === "EXPIRED") card.valid_until = "2026-09-30";
  return { status, card, consent, sameAsPermanent: true };
}

async function mockIdentity({ context }: FlowContext, mock: IdentityMock) {
  const document = () => ({
    status: mock.status,
    ...(mock.card ?? { number: null, full_name: null, birth_date: null, gender: null, issued_on: null, issued_place: null,
      valid_until: null, verified_at: null, images_available: false, images_deleted: false, card_warnings: [] }),
    residence: { permanent_on_card: mock.card ? PERMANENT : null, permanent: null,
      current_same_as_permanent: mock.sameAsPermanent, current: mock.current, updated_at: mock.sameAsPermanent !== null || mock.current ? AT : null },
  });
  const consent = () => ({ granted: mock.consent, granted_at: mock.consent ? AT : null, available: mock.consentAvailable,
    consent_version: mock.consentAvailable ? "2026-10" : null, consent_text: mock.consentAvailable ? CONSENT_TEXT : null,
    consent_digest: mock.consentAvailable ? "capture-digest" : null });
  const verification = (result: string, message: string, retake: string | null = null) => ({ result, retake, message,
    remaining_attempts: mock.remaining, remaining_card_attempts: mock.cardRemaining, locked_until: mock.lockedUntil,
    document: document(), card: null as unknown });
  /** The card as read from the photos, for the owner to confirm: not verified yet, the number cut to four digits. */
  const readCard = () => ({ status: "NONE", ...verifiedCard(), verified_at: null, images_available: false,
    residence: { permanent_on_card: PERMANENT, permanent: null, current_same_as_permanent: null, current: null, updated_at: null } });

  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api\/backend/, "");
    const method = request.method();
    const send = (data: unknown, status = 200, message = "") => route.fulfill({ status,
      headers: { "X-Browser-Session-Version": "1" }, json: { error: status >= 400, message, data } });
    /** The step-up the server asks before a write; the dialog repeats the same request with the code. */
    const stepUp = (summary: string) => {
      const code = request.headers()["x-step-up-code"];
      if (!code) return send({ code: "STEP_UP_REQUIRED", challenge_id: `cccd-${Date.now()}`, action: "IDENTITY_DOCUMENT", summary,
        method: "AUTHENTICATOR", expires_at: "2026-10-12T02:05:00.000Z" }, 403, "Vui lòng nhập mã xác thực.");
      if (code !== STEP_UP_CODE) return send({ code: "MFA_INVALID_CODE" }, 400, "Mã xác thực không đúng hoặc đã được sử dụng.");
      return null;
    };

    if (path === "/v1/me/consents/ekyc-face") {
      if (method === "POST") mock.consent = true;
      if (method === "DELETE") { mock.consent = false; if (mock.card) Object.assign(mock.card, { images_available: false, images_deleted: true }); }
      return send(consent());
    }
    if (path === "/v1/me/identity-document" && method === "GET") {
      return send({ document: document(), available: mock.available, locked_until: mock.lockedUntil,
        remaining_attempts: mock.remaining, face_scan_available: false });
    }
    if (path === "/v1/me/identity-document/card-check" && method === "POST") {
      if (mock.lockedUntil) return send(verification("LOCKED", lockedMessage(mock.lockedUntil)));
      const outcome = mock.cardOutcomes.shift();
      if (!outcome) return send({ ...verification("READY", MESSAGES.ready), card: readCard() });
      mock.cardRemaining = Math.max(0, mock.cardRemaining - 1);
      return send(verification(outcome.result, outcome.message, outcome.result === "RETAKE" ? outcome.retake : null));
    }
    if (path === "/v1/me/identity-document" && method === "PUT") {
      // No code is asked: the live face matching the card is the proof.
      if (mock.lockedUntil) return send(verification("LOCKED", lockedMessage(mock.lockedUntil)));
      mock.verifications++;
      const outcome = mock.outcomes.shift() ?? { result: "VERIFIED" };
      if (outcome.result === "VERIFIED") {
        mock.status = "VERIFIED"; mock.card = verifiedCard(); mock.remaining = 5;
        if (mock.sameAsPermanent === null) mock.sameAsPermanent = true;
        return send(verification("VERIFIED", MESSAGES.verified));
      }
      if (outcome.result === "NOT_MATCHED") {
        mock.remaining = Math.max(0, mock.remaining - 1);
        if (!mock.remaining) {
          mock.lockedUntil = "2026-10-13T02:00:00.000Z";
          return send(verification("LOCKED", lockedMessage(mock.lockedUntil)));
        }
      }
      return send(verification(outcome.result, outcome.message, outcome.result === "RETAKE" ? outcome.retake : null));
    }
    if (path === "/v1/me/identity-document/residence" && method === "PUT") {
      const asked = stepUp("Cập nhật nơi ở hiện tại");
      if (asked) return asked;
      const body = request.postDataJSON();
      mock.sameAsPermanent = body.current_same_as_permanent;
      mock.current = body.current;
      return send(document());
    }
    // The Address module's public catalog, which the webs reach through the API gateway's /api/address.
    if (path === "/api/address/v1/provinces") return send({ provinces: PROVINCES.map(([code, name]) => ({ code, name, unit_level: 1 })) });
    const children = /^\/api\/address\/v1\/administrative-units\/([^/]+)\/children$/.exec(path);
    if (children) return send({ units: (WARDS[decodeURIComponent(children[1]!)] ?? [])
      .map(([code, name]) => ({ code, name, unit_level: 3 })) });
    // The workspace shell around the page, and the face capture modes (the photo by hand allowed).
    if (path === "/v1/me/reminders") return send({ items: [], banners: [], notices: [] });
    if (path === "/v1/me/employee-invitations/count") return send({ count: 0 });
    if (path === "/v1/me/profile-update-request") return send(null);
    if (path === "/v1/public/apps/current") return send({ id: "app-superplatform", code: "SUPERPLATFORM", name: "SuperPlatform",
      app_group: "INTERNAL", status: "ACTIVE" });
    if (path === "/v1/me/access-context/token") return send({ token: "capture-order-token", expires_at: "2026-10-13T02:00:00.000Z" });
    if (path === "/v1/public/ekyc/face-modes") return send({ manual: true, auto: false });
    return route.fallback();
  });
}

/** Two-level catalog (from 01/07/2025): the provinces the flows pick and a few of their wards. */
const PROVINCES: [string, string][] = [["P01", "Thành phố Hà Nội"], ["P48", "Thành phố Đà Nẵng"], ["P79", "Thành phố Hồ Chí Minh"]];
const WARDS: Record<string, [string, string][]> = {
  P01: [["P01-00004", "Phường Ba Đình"], ["P01-00166", "Phường Cầu Giấy"]],
  P48: [["P48-20194", "Phường Hải Châu"]],
  P79: [["P79-26734", "Phường Bến Thành"], ["P79-26737", "Phường Sài Gòn"], ["P79-26965", "Phường Tân Bình"]],
};

/** "Tạm khóa xác thực tới HH:mm dd/MM." in Vietnam time, as the server words it. */
function lockedMessage(until: string) {
  const local = new Date(Date.parse(until) + 7 * 3600_000);
  const two = (value: number) => String(value).padStart(2, "0");
  return `Tạm khóa xác thực tới ${two(local.getUTCHours())}:${two(local.getUTCMinutes())} ${two(local.getUTCDate())}/${two(local.getUTCMonth() + 1)}.`;
}

/**
 * Replaces the cameras with drawn scenes: the back camera films a citizen ID on a desk, the front camera a person.
 * `window.__ffcCamera = "denied"` refuses the camera like a browser without permission.
 */
export async function fakeCamera(page: Page) {
  // tsx keeps function names with a "__name" helper the page does not have.
  await page.addInitScript("window.__name = window.__name || ((target) => target);");
  // DevCardButton (features/dev-tools), the dev "Căn cước mẫu" button beside the camera, is never part of a picture.
  await page.addInitScript(() => {
    const hide = () => {
      const style = document.createElement("style");
      style.textContent = '[aria-label="Căn cước mẫu"] { visibility: hidden !important; }';
      document.head.append(style);
    };
    if (document.head) hide(); else document.addEventListener("DOMContentLoaded", hide, { once: true });
  });
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__ffcCamera = "ok";
    w.__ffcSide = "FRONT";

    function card(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, side: string) {
      const height = width / (85.6 / 54);
      const s = width / 1000;
      ctx.save();
      ctx.translate(x, y);
      ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 40 * s; ctx.shadowOffsetY = 12 * s;
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#e8f1f7"); gradient.addColorStop(0.55, "#f4efe2"); gradient.addColorStop(1, "#dfe9e4");
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.roundRect(0, 0, width, height, 34 * s); ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "rgba(30,64,110,0.08)"; ctx.lineWidth = 2 * s;
      for (let i = -height; i < width; i += 26 * s) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + height, height); ctx.stroke(); }
      ctx.fillStyle = "#16365c";
      ctx.textBaseline = "top";
      if (side === "FRONT") {
        ctx.font = `700 ${30 * s}px Arial`; ctx.textAlign = "center";
        ctx.fillText("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", width / 2 + 60 * s, 34 * s);
        ctx.font = `600 ${22 * s}px Arial`;
        ctx.fillText("Độc lập - Tự do - Hạnh phúc", width / 2 + 60 * s, 72 * s);
        ctx.fillStyle = "#b42318"; ctx.font = `800 ${48 * s}px Arial`;
        ctx.fillText("CĂN CƯỚC", width / 2 + 60 * s, 112 * s);
        ctx.textAlign = "left";
        // Portrait.
        ctx.fillStyle = "#cfd8e3"; ctx.fillRect(48 * s, 190 * s, 210 * s, 270 * s);
        ctx.fillStyle = "#7b8796";
        ctx.beginPath(); ctx.ellipse(153 * s, 290 * s, 58 * s, 70 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(153 * s, 470 * s, 110 * s, 100 * s, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#c9a227"; ctx.beginPath(); ctx.arc(110 * s, 540 * s, 34 * s, 0, Math.PI * 2); ctx.fill();
        const rows: [string, string][] = [
          ["Số định danh cá nhân", "079194000482"], ["Họ, chữ đệm và tên", "NGUYỄN MINH ANH"],
          ["Ngày sinh", "17/08/1994"], ["Giới tính", "Nữ          Quốc tịch: Việt Nam"],
        ];
        rows.forEach(([label, value], index) => {
          ctx.fillStyle = "#3b4a5c"; ctx.font = `${21 * s}px Arial`; ctx.fillText(label, 300 * s, (190 + index * 88) * s);
          ctx.fillStyle = "#0f1f33"; ctx.font = `700 ${(index === 0 ? 40 : 32) * s}px Arial`;
          ctx.fillText(value, 300 * s, (218 + index * 88) * s);
        });
      } else {
        ctx.textAlign = "left";
        const rows: [string, string][] = [
          ["Nơi cư trú", "45 Nguyễn Trãi, Phường Sài Gòn,"], ["", "Thành phố Hồ Chí Minh"],
          ["Nơi đăng ký khai sinh", "Thành phố Hồ Chí Minh"], ["Ngày, tháng, năm cấp", "12/04/2021"],
          ["Ngày, tháng, năm hết hạn", "17/08/2034"],
        ];
        rows.forEach(([label, value], index) => {
          ctx.fillStyle = "#3b4a5c"; ctx.font = `${20 * s}px Arial`; ctx.fillText(label, 48 * s, (44 + index * 70) * s);
          ctx.fillStyle = "#0f1f33"; ctx.font = `700 ${26 * s}px Arial`; ctx.fillText(value, 48 * s, (68 + index * 70) * s);
        });
        // QR code.
        ctx.fillStyle = "#ffffff"; ctx.fillRect(720 * s, 44 * s, 230 * s, 230 * s);
        ctx.fillStyle = "#111827";
        let seed = 7;
        for (let row = 0; row < 25; row++) for (let col = 0; col < 25; col++) {
          seed = (seed * 9301 + 49297) % 233280;
          const finder = (row < 7 && col < 7) || (row < 7 && col > 17) || (row > 17 && col < 7);
          if (finder ? (row % 6 === 0 || col % 6 === 0 || (row % 6 > 1 && row % 6 < 5 && col % 6 > 1 && col % 6 < 5)) : seed / 233280 > 0.5)
            ctx.fillRect((730 + col * 8.4) * s, (54 + row * 8.4) * s, 8.4 * s, 8.4 * s);
        }
        // Machine readable zone.
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 440 * s, width, height - 440 * s);
        ctx.fillStyle = "#1f2937"; ctx.font = `600 ${27 * s}px Courier New`;
        ["IDVNM0940004827079194000482<<6", "9408172F3408176VNM<<<<<<<<<<<6", "NGUYEN<<MINH<ANH<<<<<<<<<<<<<<"]
          .forEach((line, index) => ctx.fillText(line, 60 * s, (462 + index * 40) * s));
      }
      ctx.restore();
    }

    function person(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
      ctx.fillStyle = "#1e3a5f";
      ctx.beginPath(); ctx.ellipse(cx, cy + 330 * s, 230 * s, 170 * s, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#f0c7a5"; ctx.fillRect(cx - 45 * s, cy + 90 * s, 90 * s, 80 * s);
      ctx.beginPath(); ctx.ellipse(cx, cy, 105 * s, 135 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2b1d16";
      ctx.beginPath(); ctx.ellipse(cx, cy - 55 * s, 118 * s, 100 * s, 0, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx - 118 * s, cy - 60 * s, 30 * s, 190 * s); ctx.fillRect(cx + 88 * s, cy - 60 * s, 30 * s, 190 * s);
      ctx.fillStyle = "#3a2a20";
      ctx.beginPath(); ctx.ellipse(cx - 38 * s, cy + 5 * s, 11 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 38 * s, cy + 5 * s, 11 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#b5654a"; ctx.lineWidth = 6 * s; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(cx, cy + 55 * s, 30 * s, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }

    function scene(canvas: HTMLCanvasElement, facing: string) {
      const ctx = canvas.getContext("2d")!;
      if (facing === "user") {
        const background = ctx.createLinearGradient(0, 0, 0, canvas.height);
        background.addColorStop(0, "#dfe7ef"); background.addColorStop(1, "#b9c6d3");
        ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height);
        person(ctx, canvas.width / 2, canvas.height * 0.44, canvas.height / 900);
        return;
      }
      const desk = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      desk.addColorStop(0, "#5b4636"); desk.addColorStop(1, "#3d2e24");
      ctx.fillStyle = desk; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width * 0.72;
      card(ctx, (canvas.width - width) / 2, (canvas.height - width / (85.6 / 54)) / 2, width, String(w.__ffcSide));
      // Frames drawn since the card was last turned, read by filmSide().
      w.__ffcFrames = w.__ffcDrawnSide === w.__ffcSide ? Number(w.__ffcFrames ?? 0) + 1 : 1;
      w.__ffcDrawnSide = w.__ffcSide;
    }

    /** A citizen ID photo as a data URL, for "Tải ảnh". {@code small} is below the size the app accepts. */
    w.__ffcCardImage = (side: string, small = false) => {
      const canvas = document.createElement("canvas");
      canvas.width = small ? 640 : 1600; canvas.height = small ? 404 : 1010;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#f3f4f6"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      card(ctx, canvas.width * 0.03, canvas.height * 0.03, canvas.width * 0.94, side);
      return canvas.toDataURL("image/png");
    };

    const original = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (!navigator.mediaDevices) return;
    navigator.mediaDevices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
      if (!constraints?.video) return original!(constraints);
      if (w.__ffcCamera === "denied") throw new DOMException("Permission denied", "NotAllowedError");
      const video = constraints.video as MediaTrackConstraints;
      const facing = typeof video.facingMode === "object" ? String((video.facingMode as { ideal?: string }).ideal) : String(video.facingMode);
      const canvas = document.createElement("canvas");
      canvas.width = facing === "user" ? 1280 : 1920; canvas.height = facing === "user" ? 720 : 1080;
      scene(canvas, facing);
      const timer = setInterval(() => scene(canvas, facing), 100);
      const stream = canvas.captureStream(15);
      stream.getVideoTracks()[0]!.addEventListener("ended", () => clearInterval(timer));
      return stream;
    };
  });
}

export async function openIdentity(page: Page) {
  await page.goto(IDENTITY_URL);
  await page.getByRole("heading", { name: "Căn cước công dân" }).waitFor();
}
export const dialog = (page: Page) => page.getByRole("dialog").last();
export const startButton = (page: Page) => page.getByRole("button", { name: "Xác thực căn cước", exact: true });
export const nextButton = (page: Page) => page.getByRole("button", { name: "Tiếp tục", exact: true });

export async function waitCamera(page: Page) {
  await page.getByText("Đang mở camera…").waitFor({ state: "hidden" });
}
/** Turns the card under the back camera to {@code side}; the next frames show it. */
export async function filmSide(page: Page, side: "FRONT" | "BACK") {
  await page.evaluate((value) => { (window as unknown as Record<string, unknown>).__ffcSide = value; }, side);
  await waitCamera(page);
  // Three redraws of the fake camera with the new side, so the preview shows it. Polled from Node: a promise polled
  // inside the page stalled under load and timed out.
  await expect.poll(() => page.evaluate(value => {
    const w = window as unknown as Record<string, unknown>;
    return w.__ffcDrawnSide === value && Number(w.__ffcFrames ?? 0) >= 3;
  }, side), { intervals: [50], timeout: 15_000 }).toBe(true);
}
/** Takes the card side shown by the wizard with the camera. */
export async function takeCard(page: Page, side: "FRONT" | "BACK") {
  await filmSide(page, side);
  await page.getByRole("button", { name: side === "FRONT" ? "Chụp mặt trước" : "Chụp mặt sau", exact: true }).click();
  await page.getByRole("img", { name: side === "FRONT" ? "Ảnh mặt trước căn cước" : "Ảnh mặt sau căn cước" }).waitFor();
}
/** Chooses a card photo from the device ("Tải ảnh"). */
export async function uploadCard(page: Page, side: "FRONT" | "BACK", small = false) {
  await page.getByRole("tab", { name: "Tải ảnh" }).click();
  const url = await page.evaluate(([value, tiny]) =>
    (window as unknown as { __ffcCardImage: (side: string, small: boolean) => string }).__ffcCardImage(value, tiny), [side, small] as const);
  const label = side === "FRONT" ? "mặt trước" : "mặt sau";
  await page.getByLabel(`Chọn ảnh ${label}`, { exact: true }).setInputFiles({ name: `${side.toLowerCase()}.png`, mimeType: "image/png",
    buffer: Buffer.from(url.split(",")[1]!, "base64") });
}
/** "Tiếp tục" after the back side: the card is read and what was read is shown to confirm. */
export async function readCardShown(page: Page) {
  await page.getByText("Kiểm tra thông tin trên căn cước", { exact: true }).waitFor();
}
/** "Xác nhận" on what was read: the face step comes next. */
export async function confirmCard(page: Page) {
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await page.getByText("Đưa khuôn mặt vào khung", { exact: true }).waitFor();
}
/** The system's error dialog ("Chưa xác thực được") a refused card opens over the wizard. */
export const refusedDialog = (page: Page) => page.getByRole("alertdialog", { name: "Chưa xác thực được" });
export async function takeFace(page: Page) {
  await waitCamera(page);
  await page.getByRole("button", { name: "Chụp", exact: true }).click();
  await page.getByRole("img", { name: "Ảnh vừa chụp" }).waitFor();
}
export const stepUpCode = (page: Page) => page.getByRole("textbox", { name: "Mã xác thực" });
/** Sends the face; no code is asked, the wizard then shows what the server answered. */
export async function sendFace(page: Page) {
  await page.getByRole("button", { name: "Gửi xác thực", exact: true }).click();
}
/** Takes a face and sends it: the wizard then shows what the server answered. */
export async function verifyFace(page: Page) {
  await takeFace(page); await sendFace(page);
}
