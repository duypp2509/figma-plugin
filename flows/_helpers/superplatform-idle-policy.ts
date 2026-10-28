import { expect, type Page } from "playwright/test";
import { defineFlow, type FlowContext } from "../../capture";
import { mockPin, type PinMock } from "./superplatform-screen-lock";
import { capability } from "./supership-session";

const AT = "2026-10-12T02:00:00.000Z";
export const POLICY_URL = "/workspace/security-policies";
export const OFFICE = "Bưu cục Tân Bình";
export const PARTNER = "Nhượng quyền Miền Nam";
const organizations = [
  { id: "corp", code: "SST", name: "Tổng công ty SuperShip", type_code: "CORPORATION", type_name: "Tổng công ty" },
  { id: "partner", code: "NQMN", name: PARTNER, type_code: "FRANCHISE_PARTNER", type_name: "Nhượng quyền" },
  { id: "office", code: "BCT29V84HYT", name: OFFICE, type_code: "POST_OFFICE", type_name: "Bưu cục" },
  { id: "shop", code: "SHOP1", name: "Shop Khả Ái", type_code: "SHOP", type_name: "Shop" },
].map(org => ({ ...org, parent_id: "corp", parent_name: "Tổng công ty SuperShip", status: "ACTIVE", valid_from: AT, valid_to: null, created_at: AT }));

const initialPolicy = () => ({ organization_id: "office", organization_code: "BCT29V84HYT", organization_name: OFFICE,
  organization_type_name: "Bưu cục", applies_to_descendants: true, idle_timeout_minutes: 10,
  reason: "Cập nhật thời gian tự đăng xuất cho tổ chức.", set_by_name: "Nguyễn Minh Anh", set_at: AT, version: 1 });
interface PolicyMock { items: ReturnType<typeof initialPolicy>[]; view: boolean; update: boolean; pin: PinMock; writes: number }
interface PolicyContext extends FlowContext { mock: PolicyMock }

export function policyFlow(id: string, name: string, run: (ctx: PolicyContext) => Promise<void>, populated = false) {
  return defineFlow({ id: `superplatform-idle-policy-${id}`, name, app: "superplatform",
    group: ["SUPERPLATFORM", "CHÍNH SÁCH TỰ ĐĂNG XUẤT"],
    async run(ctx) {
      const pin = await mockPin(ctx.page, ctx.log, false);
      const mock: PolicyMock = { items: populated ? [initialPolicy()] : [], view: true, update: true, pin, writes: 0 };
      let recoveryCodesRemaining = 8;
      await ctx.context.route("**/api/**", async route => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace(/^\/api\/backend/, "");
        const method = request.method();
        const send = (data: unknown, status = 200, code?: string) => route.fulfill({ status,
          headers: { "X-Browser-Session-Version": "1" }, json: { error: status >= 400, message: "", data: code ? { code } : data } });
        const overview = () => ({ default_minutes: 30, min_minutes: 5, max_minutes: 30, items: mock.items });
        if (path === "/v1/me/mfa" && method === "GET") return send({ enrolled: pin.enrolled,
          factor_status: pin.enrolled ? "ACTIVE" : null, recovery_codes_remaining: recoveryCodesRemaining });
        if (path === "/v1/me/mfa/verify" && request.postDataJSON().code === "ABCD-EFGH") {
          recoveryCodesRemaining--;
          return route.fallback();
        }
        if (path === "/v1/me/capabilities") return send({
          context: { context_id: "pin-context", context_type: "SUPERPLATFORM", application_name: "SUPERPLATFORM", membership_id: "pin-member", organization_id: "pin-org" },
          assurance: { level: 2, mfa_verified: true, mfa_verified_at: AT }, capabilities: ["identity.view", ...(mock.view ? ["security.session_policy.view"] : []), ...(mock.update ? ["security.session_policy.update"] : [])].map(key => capability(key, "pin-org")),
          revision: "capture", generated_at: AT, expires_at: "2026-10-13T02:00:00.000Z",
        });
        if (path === "/v1/organizations" && method === "GET") {
          const search = (url.searchParams.get("search") ?? "").toLocaleLowerCase("vi");
          return send({ items: organizations.filter(org => `${org.name} ${org.code}`.toLocaleLowerCase("vi").includes(search)), page: 0, size: 10, has_next: false });
        }
        if (path === "/v1/security/session-policy" && method === "GET") return send(overview());
        const match = path.match(/^\/v1\/security\/session-policy\/organizations\/([^/]+)$/);
        if (match && (method === "PUT" || method === "DELETE")) {
          if (!pin.fresh) return send({}, 403, "MFA_REQUIRED");
          pin.fresh = false;
          mock.writes++;
          const id = decodeURIComponent(match[1]!);
          const old = mock.items.find(item => item.organization_id === id);
          mock.items = mock.items.filter(item => item.organization_id !== id);
          if (method === "PUT") {
            const org = organizations.find(item => item.id === id)!;
            const body = request.postDataJSON();
            mock.items.push({ ...initialPolicy(), organization_id: id, organization_code: org.code, organization_name: org.name,
              organization_type_name: org.type_name, applies_to_descendants: body.applies_to_descendants,
              idle_timeout_minutes: body.idle_timeout_minutes, version: (old?.version ?? 0) + 1 });
          }
          return send(overview());
        }
        return route.fallback();
      });
      await run({ ...ctx, mock });
    },
  });
}
export async function openPolicy(page: Page) {
  await page.goto(POLICY_URL);
  await page.getByRole("heading", { name: "Chính sách bảo mật", exact: true }).waitFor();
  await page.getByText("Thời gian mặc định", { exact: true }).waitFor();
  await expect(page.getByRole("button", { name: "Thêm tổ chức", exact: true })).toBeVisible();
}
export const save = (page: Page) => page.getByRole("button", { name: "Lưu", exact: true });
export const minutes = (page: Page) => page.getByLabel("Thời gian tự đăng xuất (phút)", { exact: true });
export async function createPolicy(page: Page) {
  await page.getByRole("button", { name: "Thêm tổ chức", exact: true }).click();
  await page.getByLabel("Tìm tổ chức", { exact: true }).waitFor();
}
export async function selectOrg(page: Page, name = OFFICE) {
  await page.getByLabel("Tìm tổ chức", { exact: true }).fill(name);
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.getByRole("button", { name: "Đổi", exact: true }).waitFor();
}
export async function fillPolicy(page: Page, value = "10", name = OFFICE) {
  await selectOrg(page, name); await minutes(page).fill(value); await expect(save(page)).toBeEnabled();
}
export const mfaCode = (page: Page) => page.getByRole("textbox", { name: /^Mã xác thực(?:, gồm 6 chữ số)?$/ });
export async function waitMfa(page: Page) { await mfaCode(page).waitFor(); }
export async function verifyPolicy(page: Page, recovery = false) {
  if (recovery) await page.getByRole("textbox", { name: "Mã dự phòng", exact: true }).fill("ABCD-EFGH");
  else { await waitMfa(page); await mfaCode(page).fill("515060"); }
  await page.getByRole("button", { name: "Xác thực MFA và tiếp tục", exact: true }).click();
  await (recovery ? page.getByRole("textbox", { name: "Mã dự phòng", exact: true }) : mfaCode(page)).waitFor({ state: "hidden" });
}
export async function saved(page: Page) { await page.getByText("Đã lưu thời gian tự đăng xuất.", { exact: true }).waitFor(); }
