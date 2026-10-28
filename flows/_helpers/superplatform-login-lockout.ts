import { expect, type Page } from "playwright/test";
import { defineFlow, type FlowContext } from "../../capture";
import { mockPin } from "./superplatform-screen-lock";
import { capability } from "./supership-session";

/*
 * "Chính sách bảo mật › Khóa đăng nhập" of the admin console: how many wrong passwords lock password sign-in from one
 * IP, and for how long. The stand-in keeps the policy, checks a change as the server does (bounds, reason, version,
 * then the step-up code bound to the values) and answers with the same sentences. Clock frozen by mockPin.
 */
const AT = "2026-10-12T02:00:00.000Z";
const LATER = "2026-10-12T02:05:00.000Z";
export const POLICY_URL = "/workspace/security-policies?tab=login-lockout";
export const STEP_UP_CODE = "515060";
const LIMITS = { max_attempts_min: 3, max_attempts_max: 20, lockout_minutes_min: 1, lockout_minutes_max: 1440 };
export const MESSAGES = {
  saved: "Đã lưu chính sách khóa đăng nhập.",
  wrongCode: "Mã xác thực không đúng hoặc đã được sử dụng.",
  changed: "Chính sách vừa được người khác thay đổi. Hãy tải lại trước khi lưu.",
  attempts: "Số lần nhập sai từ 3 đến 20.",
  minutes: "Thời gian khóa từ 1 đến 1440 phút.",
};

interface Policy { max_attempts: number; lockout_seconds: number; set_by_name: string | null; set_at: string | null; version: number }
export interface LockoutMock {
  policy: Policy;
  /** Someone else saves first: the next save carries an old version. */
  changedElsewhere: boolean;
  writes: number;
}
interface LockoutContext extends FlowContext { mock: LockoutMock }

export function lockoutFlow(id: string, name: string, run: (ctx: LockoutContext) => Promise<void>,
  { canUpdate = true, start }: { canUpdate?: boolean; start?: Partial<Policy> } = {}) {
  return defineFlow({ id: `superplatform-login-lockout-${id}`, name, app: "superplatform",
    group: ["SUPERPLATFORM", "CHÍNH SÁCH KHÓA ĐĂNG NHẬP"],
    async run(ctx) {
      await mockPin(ctx.page, ctx.log, false);
      const mock: LockoutMock = { policy: { max_attempts: 5, lockout_seconds: 900, set_by_name: null, set_at: null, version: 0, ...start },
        changedElsewhere: false, writes: 0 };
      let challenges = 0;
      // Registered after mockPin, so it is asked first and falls back to it for the session calls.
      await ctx.context.route("**/api/**", async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname.replace(/^\/api\/backend/, "");
        const method = request.method();
        const send = (data: unknown, status = 200, message = "") => route.fulfill({ status,
          headers: { "X-Browser-Session-Version": "1" }, json: { error: status >= 400, message, data } });
        const view = () => ({ ...mock.policy, default_max_attempts: 5, default_lockout_seconds: 900,
          is_default: mock.policy.version === 0, can_update: canUpdate, limits: LIMITS });

        if (path === "/v1/me/capabilities") return send({
          context: { context_id: "pin-context", context_type: "SUPERPLATFORM", application_name: "SUPERPLATFORM", membership_id: "pin-member", organization_id: "pin-org" },
          assurance: { level: 2, mfa_verified: true, mfa_verified_at: AT },
          capabilities: ["identity.view", "security.policy.view", ...(canUpdate ? ["security.policy.update"] : [])].map(key => capability(key, "pin-org")),
          revision: "capture", generated_at: AT, expires_at: "2026-10-13T02:00:00.000Z",
        });
        if (path === "/v1/me/employee-invitations/count") return send({ pending: 0 });
        if (path === "/v1/public/apps/current") return send({ id: "app-superplatform", code: "SUPERPLATFORM", name: "SuperPlatform",
          app_group: "INTERNAL", status: "ACTIVE" });
        if (path === "/v1/me/profile-update-request") return send(null);
        if (path === "/v1/me/reminders") return send({ items: [], banners: [], notices: [] });
        if (path !== "/v1/security/login-lockout-policy") return route.fallback();
        if (method === "GET") return send(view());
        if (method !== "PUT") return route.fallback();

        const body = request.postDataJSON();
        const invalid = (message: string) => send({ code: "LOGIN_LOCKOUT_POLICY_INVALID" }, 400, message);
        if (body.max_attempts < LIMITS.max_attempts_min || body.max_attempts > LIMITS.max_attempts_max) return invalid(MESSAGES.attempts);
        if (body.lockout_minutes < LIMITS.lockout_minutes_min || body.lockout_minutes > LIMITS.lockout_minutes_max) return invalid(MESSAGES.minutes);
        if (!String(body.reason ?? "").trim()) return invalid("Hãy nhập lý do thay đổi.");
        if (mock.changedElsewhere) {
          mock.policy = { max_attempts: 8, lockout_seconds: 1800, set_by_name: "Trần Minh Quân", set_at: AT, version: mock.policy.version + 1 };
          mock.changedElsewhere = false;
        }
        if (body.version !== mock.policy.version) return send({ code: "LOGIN_LOCKOUT_POLICY_CHANGED" }, 409, MESSAGES.changed);
        const code = request.headers()["x-step-up-code"];
        if (!code) return send({ code: "STEP_UP_REQUIRED", challenge_id: `lockout-${++challenges}`, action: "LOGIN_LOCKOUT_CHANGE",
          summary: "Đổi chính sách khóa đăng nhập", method: "AUTHENTICATOR", expires_at: LATER }, 403,
          "Vui lòng nhập mã xác thực để xác nhận thao tác này.");
        if (code !== STEP_UP_CODE) return send({ code: "MFA_INVALID_CODE" }, 400, MESSAGES.wrongCode);
        mock.writes++;
        mock.policy = { max_attempts: body.max_attempts, lockout_seconds: body.lockout_minutes * 60,
          set_by_name: "Nguyễn Minh Anh", set_at: AT, version: mock.policy.version + 1 };
        return send(view());
      });
      await run({ ...ctx, mock });
    },
  });
}

export async function openPolicy(page: Page) {
  await page.goto(POLICY_URL);
  await page.getByRole("heading", { name: "Khóa đăng nhập khi nhập sai mật khẩu", exact: true }).waitFor();
}
export const editButton = (page: Page) => page.getByRole("button", { name: "Sửa", exact: true });
export const dialog = (page: Page) => page.getByRole("dialog", { name: "Sửa khóa đăng nhập" });
export const attempts = (page: Page) => page.getByLabel("Số lần nhập sai mật khẩu", { exact: true });
export const minutes = (page: Page) => page.getByLabel("Thời gian khóa (phút)", { exact: true });
export const reason = (page: Page) => page.getByLabel("Lý do thay đổi", { exact: true });
export const save = (page: Page) => dialog(page).getByRole("button", { name: "Lưu", exact: true });
export async function openEdit(page: Page) { await editButton(page).click(); await attempts(page).waitFor(); }
export async function fillPolicy(page: Page, tries: string, lock: string, why = "Tăng thời gian khóa sau đợt dò mật khẩu từ nhiều IP lạ.") {
  await attempts(page).fill(tries); await minutes(page).fill(lock); await reason(page).fill(why);
}
export const codeDialog = (page: Page) => page.getByRole("dialog", { name: "Xác nhận thao tác" });
export const codeField = (page: Page) => page.locator('[id="step-up-code"]');
export async function enterCode(page: Page, code = STEP_UP_CODE) {
  await codeField(page).fill(code);
  await codeDialog(page).getByRole("button", { name: "Xác nhận", exact: true }).click();
}
export { expect };
