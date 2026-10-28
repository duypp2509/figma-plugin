import type { Page } from "playwright";
import {
  EMAIL, MFA_CODE, PASSWORD, PHONE, UNITS, at, fill, loginFlow, loginReady, openLogin, refusal, submit, workspaceHome,
  type Ended, type LoginContext,
} from "../_helpers/superplatform-login";
import { button, press, withMfa } from "../_helpers/superplatform-login-mfa";

/*
 * Why the user is back on "/" after the session ended (LoginCard): the web notes the reason before leaving for the
 * sign-in page, which reads it back into a dialog. Each story starts where the person was working, then the server
 * ends the session (SecurityConfig's 401 for an ended session, IpPolicyGuard's 403) or the person signs out from
 * "Bảo mật" (AccountSecurityPage), and the next screen is the sign-in page with its notice.
 */

function noticeFlow(id: string, name: string, run: (ctx: LoginContext) => Promise<void>) {
  return loginFlow(`thong-bao-${id}`, ["SUPERPLATFORM", "ĐĂNG NHẬP", "THÔNG BÁO KHI QUAY VỀ TRANG ĐĂNG NHẬP"], name, run);
}

/** SecurityConfig: a session that ended, as the server answers every later call of the browser. */
const ENDED = {
  expired: { status: 401, message: "Bạn cần đăng nhập.", data: {} },
  idle: { status: 401, message: "Bạn đã được đăng xuất do không thao tác trong 15 phút.",
    data: { code: "SESSION_EXPIRED", reason: "IDLE_TIMEOUT", idle_timeout_seconds: 900, idle_timeout_minutes: 15 } },
  sessionLimit: { status: 401, message: "Phiên đã bị đăng xuất vì tài khoản vừa đăng nhập ở nơi khác.",
    data: { code: "SESSION_LIMIT_REACHED", reason: "CONCURRENT_SESSION_LIMIT" } },
  signedOutElsewhere: { status: 401, message: "Phiên đăng nhập đã bị đăng xuất từ thiết bị khác.",
    data: { code: "SIGNED_OUT_ELSEWHERE", reason: "USER_REVOKED_SESSION", ended_message: "Phiên đăng nhập đã bị đăng xuất từ thiết bị khác." } },
  accessHeld: { status: 401, message: "Quyền làm việc của bạn tại đơn vị này đang bị tạm dừng. Liên hệ bộ phận nhân sự.",
    data: { code: "ACCESS_HELD", reason: "ACCESS_HOLD",
      ended_message: "Quyền làm việc của bạn tại đơn vị này đang bị tạm dừng. Liên hệ bộ phận nhân sự." } },
  // IpPolicyGuard refuses the call and revokes the session: what follows has no session at all.
  ipBlocked: { status: 403, message: "Bạn không được phép truy cập từ mạng này.", data: { code: "IP_NOT_ALLOWED" },
    then: { status: 401, message: "Phiên đăng nhập không tồn tại.", data: { code: "SESSION_MISSING" } } },
} satisfies Record<string, Ended>;
/** The session signed out by the person: nothing about "me" answers any more. */
const SIGNED_OUT: Ended = { status: 401, message: "Phiên đăng nhập không tồn tại.", data: { code: "SESSION_MISSING" } };

/**
 * Signed in without pictures (the story starts at work): the sign-in, its MFA and the unit, as the page would send
 * them, then the workspace page {@code path}.
 */
async function atWork(page: Page, path = "/workspace") {
  await page.goto("/");
  await page.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor();
  // One call per evaluate: a helper function inside the page code would be wrapped by the TypeScript loader.
  for (const [path, method, body] of [
    ["/v1/sessions", "POST", { identifier: EMAIL, password: PASSWORD }],
    ["/v1/me/mfa/verify", "POST", { code: MFA_CODE }],
    ["/v1/me/access-context", "PUT", { membership_id: UNITS[0]!.membership_id }],
  ] as const) {
    await page.evaluate(({ path, method, body }) => fetch(`/api/backend${path}`, { method,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(() => undefined), { path, method, body });
  }
  await page.goto(path);
}
/** The workspace home, the pointer away from the menu. */
async function home(page: Page) {
  await atWork(page);
  await workspaceHome(page).waitFor();
  await page.mouse.move(700, 900);
}
/** The person's next click in the menu, after the server ended the session: back on the sign-in page with why. */
async function nextClick(page: Page, mock: LoginContext["mock"], ended: Ended, message: string) {
  mock.ended = ended;
  await page.getByRole("link", { name: "Hồ sơ", exact: true }).first().click();
  await page.waitForURL(url => url.pathname === "/");
  await loginReady(page);
  await refusal(page, message);
}
/** The notice read: "Đã hiểu" (or "Đóng"). */
async function closeNotice(page: Page) {
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button").last().click();
  await dialog.waitFor({ state: "hidden" });
}

/* ---- "Bảo mật" → "Thiết bị và phiên đăng nhập" of Trần Thu Hà: this computer and her phone ---- */

const COMPUTER = "Chrome trên Windows";
/** How the page writes the computer's name (displayDeviceName). */
const SHOWN = "Chrome - Windows";
function mockSecurity(mock: LoginContext["mock"]) {
  const device = (id: string, name: string, type: string, browser: string, os: string, current: boolean) => ({
    device_id: id, name, type, trust_status: "TRUSTED", current, first_seen_at: at(-40 * 86400), last_seen_at: at(current ? 0 : -3600),
    application_code: "SUPERPLATFORM", application_name: "SuperPlatform", browser, os, session_count: 1, trusted_at: at(-40 * 86400) });
  const session = (id: string, deviceId: string, name: string, type: string, browser: string, os: string, current: boolean, ip: string) => ({
    session_id: id, current, device_id: deviceId, device_name: name, device_type: type, assurance_level: 2,
    authenticated_at: at(current ? -1800 : -2 * 86400), last_seen_at: at(current ? 0 : -3600), expires_at: at(86400),
    application_name: "SuperPlatform", company_name: "Bưu cục Tân Bình", browser, os, ip_address: ip, region: "TP. Hồ Chí Minh" });
  const signOut = () => { mock.ended = SIGNED_OUT; return { message: "Đã đăng xuất.", data: { revoked_session_count: 1, revoked_context_count: 0 } }; };
  mock.on("GET", "/v1/me/devices", () => ({ data: { devices: [
    device("device-capture", COMPUTER, "DESKTOP", "Chrome", "Windows", true),
    device("device-iphone", "iPhone 15", "MOBILE", "Safari", "iOS", false),
  ] } }));
  mock.on("GET", "/v1/me/sessions", () => ({ data: { sessions: [
    session("login-session", "device-capture", COMPUTER, "DESKTOP", "Chrome", "Windows", true, "113.161.72.15"),
    session("session-iphone", "device-iphone", "iPhone 15", "MOBILE", "Safari", "iOS", false, "171.244.18.92"),
  ], actions: { logout_others: true, logout_others_reason: null,
    logout_others_confirm: "1 phiên trên thiết bị khác sẽ bị đăng xuất. Thiết bị này vẫn đăng nhập.", logout_all_confirm: null } } }));
  mock.on("GET", "/v1/me/login-protection", () => ({ data: { enabled: true, changed_at: at(-40 * 86400), can_enable: true,
    methods: { phone: true, email: true, authenticator: true, recovery_codes_remaining: 8 } } }));
  mock.on("DELETE", "/v1/me/sessions/login-session", signOut);
  mock.on("DELETE", "/v1/me/devices/device-capture", () => ({ ...signOut(), data: { device_id: "device-capture",
    revoked_session_count: 1, revoked_context_count: 0 } }));
}
const devicesPanel = (page: Page) => page.getByRole("list", { name: "Thiết bị tin cậy" });
/** "Bảo mật" with its first tab, once both lists are in. */
async function securityLoaded(page: Page) {
  await devicesPanel(page).getByText(SHOWN, { exact: true }).first().waitFor();
  await page.mouse.move(700, 1100);
}
/** The confirmation of the security page, answered with its red button. */
async function confirmSignOut(page: Page, title: string, confirm: string) {
  const dialog = page.getByRole("dialog", { name: title });
  await dialog.getByRole("button", { name: confirm, exact: true }).click();
  await page.waitForURL(url => url.pathname === "/");
  await loginReady(page);
}

export default [
  noticeFlow("het-phien", "PHIÊN HẾT HẠN HOẶC KHÔNG THAO TÁC", async ({ page, shot, mock }) => {
    await home(page);
    await shot("lam-viec", "Đang làm việc, phiên đăng nhập hết hạn");
    await nextClick(page, mock, ENDED.expired, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    await shot("het-han", "Bấm tiếp: về trang đăng nhập, báo phiên đã hết hạn");
    await closeNotice(page);
    await home(page);
    await shot("lam-viec-roi-may", "Đăng nhập lại, rồi để máy 15 phút không thao tác");
    await nextClick(page, mock, ENDED.idle, "Bạn đã được đăng xuất do không thao tác trong 15 phút.");
    await shot("khong-thao-tac", "Quay lại bấm tiếp: đã tự đăng xuất vì không thao tác");
  }),
  noticeFlow("dang-xuat-tu-noi-khac", "BỊ ĐĂNG XUẤT TỪ NƠI KHÁC", async ({ page, shot, mock }) => {
    for (const [id, work, ended, message, title] of [
      ["dang-nhap-noi-khac", "Đang làm việc trên máy này", ENDED.sessionLimit, ENDED.sessionLimit.message,
        "Tài khoản vừa đăng nhập ở nơi khác, vượt số phiên cho phép"],
      ["thiet-bi-khac", "Đăng nhập lại, đang làm việc trên máy này", ENDED.signedOutElsewhere, ENDED.signedOutElsewhere.message,
        "Bị đăng xuất hoặc gỡ thiết bị từ thiết bị khác"],
      ["quyen-tam-dung", "Đăng nhập lại, đang làm việc trên máy này", ENDED.accessHeld, ENDED.accessHeld.message,
        "Quyền làm việc vừa bị tạm dừng"],
      ["mang-khong-duoc-phep", "Đăng nhập lại, đang làm việc trên máy này", ENDED.ipBlocked, ENDED.ipBlocked.message,
        "Mạng đang dùng không được phép truy cập"],
    ] as const) {
      if (id !== "dang-nhap-noi-khac") await closeNotice(page);
      await home(page);
      await shot(`lam-viec-${id}`, work);
      await nextClick(page, mock, ended, message);
      await shot(id, `Bấm tiếp: ${title.charAt(0).toLowerCase()}${title.slice(1)}`);
    }
  }),
  noticeFlow("tu-dang-xuat", "TỰ ĐĂNG XUẤT", async ({ page, shot, mock }) => {
    mockSecurity(mock);
    // Phiên hiện tại: Trang chủ → Bảo mật → the session of this computer → Đăng xuất → Xác nhận.
    await home(page);
    await shot("trang-chu", "Trang chủ");
    await page.getByRole("link", { name: "Bảo mật", exact: true }).first().click();
    await securityLoaded(page);
    await shot("bao-mat", "Bảo mật: thiết bị và phiên đăng nhập");
    await devicesPanel(page).getByRole("button", { name: new RegExp(`^Xem phiên đăng nhập lúc .* trên ${SHOWN}$`) }).click();
    await page.getByRole("dialog", { name: "Chi tiết phiên đăng nhập" }).waitFor();
    await shot("chi-tiet-phien", "Chi tiết phiên đăng nhập trên máy này");
    await page.getByRole("dialog", { name: "Chi tiết phiên đăng nhập" }).getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await page.getByRole("dialog", { name: "Đăng xuất phiên hiện tại?" }).waitFor();
    await shot("hoi-dang-xuat-phien", "Hỏi lại trước khi đăng xuất phiên hiện tại");
    await confirmSignOut(page, "Đăng xuất phiên hiện tại?", "Xác nhận");
    await refusal(page, "Đã đăng xuất phiên hiện tại.");
    await shot("phien-hien-tai", "Đã đăng xuất phiên hiện tại, về trang đăng nhập");

    // Gỡ thiết bị này: Bảo mật → "…" of this computer → Gỡ thiết bị → Gỡ thiết bị.
    await closeNotice(page);
    await atWork(page, "/workspace/account/security");
    await securityLoaded(page);
    await shot("bao-mat-go-thiet-bi", "Đăng nhập lại, mở Bảo mật");
    await devicesPanel(page).getByRole("button", { name: `Thao tác với ${SHOWN}` }).click();
    await page.getByRole("menuitem", { name: "Gỡ thiết bị" }).waitFor();
    await shot("thao-tac-thiet-bi", "Mở thao tác của máy này");
    await page.getByRole("menuitem", { name: "Gỡ thiết bị" }).click();
    await page.getByRole("dialog", { name: "Gỡ thiết bị hiện tại?" }).waitFor();
    await shot("hoi-go-thiet-bi", "Hỏi lại trước khi gỡ thiết bị hiện tại");
    await confirmSignOut(page, "Gỡ thiết bị hiện tại?", "Xác nhận");
    await refusal(page, "Đã gỡ thiết bị và đăng xuất các phiên liên quan.");
    await shot("go-thiet-bi", "Đã gỡ thiết bị này, về trang đăng nhập");
  }),
  noticeFlow("huy-dang-nhap", "LẦN ĐĂNG NHẬP BỊ HỦY KHI THIẾT LẬP XÁC THỰC HAI LỚP", async ctx => {
    const { page, shot } = ctx;
    await withMfa(ctx, false);
    await openLogin(page);
    await fill(page, PHONE);
    await shot("da-nhap", "Nhập số điện thoại và mật khẩu");
    await submit(page);
    await page.getByRole("heading", { name: "Thiết lập xác thực hai lớp", exact: true }).waitFor();
    await button(page, "Chọn kênh nhận mã OTP").waitFor();
    await shot("thiet-lap", "Chưa có Authenticator: thiết lập trước khi chọn đơn vị");
    await press(page, "Chọn kênh nhận mã OTP");
    const channels = page.getByRole("dialog");
    await channels.getByRole("button", { name: "Nhận mã OTP", exact: true }).waitFor();
    await shot("chon-kenh", "Chọn kênh nhận mã OTP");
    await channels.getByRole("button", { name: "Nhận mã OTP", exact: true }).click();
    const otp = page.getByRole("textbox", { name: "Nhập mã xác thực OTP" });
    await otp.waitFor();
    await page.getByText("Có thể gửi lại sau", { exact: false }).waitFor();
    // Any code but DEV_OTP is wrong.
    const wrong = "735190";
    for (let attempt = 1; attempt <= 5; attempt++) {
      await otp.focus();
      await otp.press("Control+A");
      await otp.press("Backspace");
      await otp.pressSequentially(wrong);
      if (attempt === 1) await shot("nhap-sai-otp", "Nhập sai mã OTP");
      await press(page, "Xác minh OTP");
      if (attempt === 5) break;
      const failure = page.getByRole("alertdialog");
      await failure.getByText(`Mã OTP không đúng. Bạn còn ${5 - attempt} lần nhập.`, { exact: true }).waitFor();
      if (attempt === 1) await shot("sai-otp", "Mã OTP không đúng, còn 4 lần nhập");
      if (attempt === 4) await shot("con-mot-lan", "Sai 4 lần, còn 1 lần nhập");
      await failure.getByRole("button", { name: "Đã hiểu", exact: true }).click();
      await failure.waitFor({ state: "hidden" });
    }
    await page.waitForURL(url => url.pathname === "/");
    await loginReady(page);
    await refusal(page, "Bạn đã nhập sai mã quá số lần nên lần đăng nhập bị hủy. Bạn đăng nhập lại để thử lần nữa.");
    await shot("sai-ma-qua-so-lan", "Sai lần thứ 5: lần đăng nhập bị hủy, về trang đăng nhập");
  }),
];
