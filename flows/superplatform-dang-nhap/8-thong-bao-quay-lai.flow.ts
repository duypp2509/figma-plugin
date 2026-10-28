import type { Page } from "playwright";
import { loginFlow, openLogin, refusal, type LoginContext } from "../_helpers/superplatform-login";

/*
 * Why the user is back on "/" after the session ended on its own (LoginCard): the web notes the reason in
 * sessionStorage before leaving for the sign-in page, which reads it back into a dialog. The notes are written
 * here as the web writes them (session-expired-notice.ts, ip-policy-notice.ts); the sentences are the web's and
 * the server's (SessionAuthenticationFilter.EndedSession).
 */
const EXPIRED = "supership.admin.session-expired";
const IP_POLICY = "superplatform.ip-policy-notice";

function noticeFlow(id: string, name: string, run: (ctx: LoginContext) => Promise<void>) {
  return loginFlow(`thong-bao-${id}`, ["SUPERPLATFORM", "ĐĂNG NHẬP", "THÔNG BÁO KHI QUAY VỀ TRANG ĐĂNG NHẬP"], name, run);
}

/** Opens "/" as the web does after a sign-out that left `note` behind, and waits for its dialog. */
async function backWith(page: Page, key: string, note: unknown, message: string) {
  await page.goto("/");
  await page.evaluate(([key, value]) => { sessionStorage.clear(); sessionStorage.setItem(key, value); },
    [key, typeof note === "string" ? note : JSON.stringify(note)] as const);
  await openLogin(page);
  await refusal(page, message);
}

export default [
  noticeFlow("het-phien", "01. PHIÊN HẾT HẠN HOẶC KHÔNG THAO TÁC", async ({ page, shot }) => {
    await backWith(page, EXPIRED, "1", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    await shot("het-han", "Phiên đăng nhập đã hết hạn");
    await backWith(page, EXPIRED, { reason: "idle", minutes: 15 }, "Bạn đã được đăng xuất do không thao tác trong 15 phút.");
    await shot("khong-thao-tac", "Tự đăng xuất vì không thao tác");
  }),
  noticeFlow("dang-xuat-tu-noi-khac", "02. BỊ ĐĂNG XUẤT TỪ NƠI KHÁC", async ({ page, shot }) => {
    await backWith(page, EXPIRED, { reason: "session-limit" }, "Phiên đã bị đăng xuất vì tài khoản vừa đăng nhập ở nơi khác.");
    await shot("dang-nhap-noi-khac", "Tài khoản vừa đăng nhập ở nơi khác, vượt số phiên cho phép");
    await backWith(page, EXPIRED, { reason: "ended", title: "Bạn cần đăng nhập lại", message: "Phiên đăng nhập đã bị đăng xuất từ thiết bị khác." },
      "Phiên đăng nhập đã bị đăng xuất từ thiết bị khác.");
    await shot("thiet-bi-khac", "Bị đăng xuất hoặc gỡ thiết bị từ thiết bị khác");
    await backWith(page, EXPIRED, { reason: "ended", title: "Bạn cần đăng nhập lại",
      message: "Quyền làm việc của bạn tại đơn vị này đang bị tạm dừng. Liên hệ bộ phận nhân sự." },
    "Quyền làm việc của bạn tại đơn vị này đang bị tạm dừng. Liên hệ bộ phận nhân sự.");
    await shot("quyen-tam-dung", "Quyền làm việc vừa bị tạm dừng");
    await backWith(page, IP_POLICY, "Bạn không được phép truy cập từ mạng này.", "Bạn không được phép truy cập từ mạng này.");
    await shot("mang-khong-duoc-phep", "Mạng đang dùng không được phép truy cập");
  }),
  noticeFlow("tu-dang-xuat", "03. TỰ ĐĂNG XUẤT", async ({ page, shot }) => {
    await backWith(page, EXPIRED, { reason: "signed-out", message: "Đã đăng xuất phiên hiện tại." }, "Đã đăng xuất phiên hiện tại.");
    await shot("phien-hien-tai", "Đăng xuất phiên hiện tại");
    await backWith(page, EXPIRED, { reason: "signed-out", message: "Đã gỡ thiết bị và đăng xuất các phiên liên quan." },
      "Đã gỡ thiết bị và đăng xuất các phiên liên quan.");
    await shot("go-thiet-bi", "Gỡ thiết bị này");
    await backWith(page, EXPIRED, { reason: "signed-out", message: "Bạn đã đăng xuất khỏi mọi nơi." }, "Bạn đã đăng xuất khỏi mọi nơi.");
    await shot("moi-noi", "Đăng xuất khỏi mọi nơi");
  }),
  noticeFlow("huy-dang-nhap", "04. LẦN ĐĂNG NHẬP BỊ HỦY KHI THIẾT LẬP XÁC THỰC HAI LỚP", async ({ page, shot }) => {
    await backWith(page, EXPIRED, { reason: "enrollment-otp" },
      "Bạn đã nhập sai mã quá số lần nên lần đăng nhập bị hủy. Bạn đăng nhập lại để thử lần nữa.");
    await shot("sai-ma-qua-so-lan", "Nhập sai mã quá số lần khi thiết lập: đăng nhập lại");
  }),
];
