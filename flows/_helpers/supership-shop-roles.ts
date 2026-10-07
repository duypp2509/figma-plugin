// Fixtures and steps for a Shop's role management (SuperShip Web, /settings/organization/roles).
// A Shop has no roles of its own: it uses the system roles the platform gives it, so the page lists
// those and each one opens read-only with its permissions (RoleListPage, ShopRoleDetailPage,
// RolePermissionList in features/organization-settings).
//
// Role names, descriptions and permission sets follow the backend's own data: V1046__shop_accountant_
// operator_roles.sql and R__authorization_dev_seed.sql in authorization-service. Permission names are
// the dev catalog's; a key the catalog does not name is worded by the page itself.
import type { Page } from "playwright";
import { pageOf, type Backend, type ShopFixture } from "./supership-session";

export interface RoleFixture {
  roleId: string;
  code: string;
  name: string;
  versionId: string;
  versionNumber: number;
  /** When the shop started using the role. */
  validFrom: string;
  permissions: string[];
}

export const SHOP_OWNER: RoleFixture = {
  roleId: "41000000-0000-0000-0000-000000000012", code: "SHOP_OWNER", name: "Chủ cửa hàng",
  versionId: "42000000-0000-0000-0000-000000000037", versionNumber: 7, validFrom: "2026-01-05T01:00:00Z",
  permissions: [
    "application.access", "organization.view", "organization.profile.update", "organization.contact.manage",
    "organization.address.manage", "organization.representative.view", "employee.view", "employee.manage",
    "employee.contact.manage", "membership.view", "membership.create", "membership.update", "membership.activate",
    "membership.suspend", "membership.terminate", "order.view", "order.create", "order.update", "order.cancel",
    "report.export", "cod.reconcile", "role.view", "role.assign",
  ],
};
export const SHOP_OPERATOR: RoleFixture = {
  roleId: "41000000-0000-0000-0000-000000000018", code: "SHOP_OPERATOR", name: "Nhân viên vận hành",
  versionId: "42000000-0000-0000-0000-000000000038", versionNumber: 1, validFrom: "2026-03-02T02:30:00Z",
  permissions: ["application.access", "organization.view", "membership.view", "order.view", "order.create", "order.update", "order.cancel"],
};
export const SHOP_ACCOUNTANT: RoleFixture = {
  roleId: "41000000-0000-0000-0000-000000000019", code: "SHOP_ACCOUNTANT", name: "Kế toán",
  versionId: "42000000-0000-0000-0000-000000000039", versionNumber: 1, validFrom: "2026-03-02T02:30:00Z",
  permissions: ["application.access", "organization.view", "order.view", "report.export", "cod.reconcile"],
};
export const SHOP_ROLES = [SHOP_OWNER, SHOP_OPERATOR, SHOP_ACCOUNTANT];

/** What the signed-in member may do, by role. Only the owner manages members and their roles. */
export const OWNER_PERMISSIONS = SHOP_OWNER.permissions;
export const OPERATOR_PERMISSIONS = SHOP_OPERATOR.permissions;

/** Names from the dev permission catalog (R__authorization_dev_seed.sql). */
export const CATALOG_NAMES: Record<string, string> = {
  "application.access": "Mở ứng dụng",
  "organization.view": "Xem tổ chức",
  "organization.profile.update": "Cập nhật hồ sơ cơ bản của tổ chức",
  "organization.contact.manage": "Quản lý thông tin liên hệ của tổ chức",
  "organization.address.manage": "Quản lý địa chỉ của tổ chức",
  "organization.representative.view": "Xem người đại diện tổ chức",
  "employee.view": "Xem hồ sơ nhân viên",
  "employee.manage": "Tạo và quản lý hồ sơ nhân viên",
  "employee.contact.manage": "Quản lý liên hệ công việc",
  "membership.view": "Xem thành viên",
  "membership.create": "Tạo thành viên",
  "membership.update": "Cập nhật thành viên",
  "membership.activate": "Kích hoạt thành viên",
  "membership.suspend": "Tạm khóa thành viên",
  "membership.terminate": "Kết thúc thành viên",
  "order.view": "Xem đơn hàng",
  "order.create": "Tạo đơn hàng",
  "order.update": "Cập nhật đơn hàng",
  "order.cancel": "Hủy đơn hàng",
  "cod.reconcile": "Đối soát COD",
  "report.export": "Xuất báo cáo",
  "role.view": "Xem vai trò",
  "role.assign": "Gán vai trò",
};

export const permissionId = (key: string) => `permission-${key}`;

const adoption = (shop: ShopFixture, role: RoleFixture) => ({
  id: `adoption-${role.code}`, organization_id: shop.organizationId, role_id: role.roleId, role_code: role.code,
  role_name: role.name, role_version_id: role.versionId, role_version_number: role.versionNumber, version: 1,
  status: "ACTIVE", valid_from: role.validFrom, valid_to: null, changed_by_membership_id: "platform",
  change_reason: "Cửa hàng dùng bộ vai trò Chủ cửa hàng, Nhân viên vận hành, Kế toán", created_at: role.validFrom,
  single_holder: role.code === "SHOP_OWNER", assignable: role.code !== "SHOP_OWNER",
});

/** Answers the role endpoints of a shop that uses `roles`. */
export function mockShopRoles(backend: Backend, shop: ShopFixture, roles: RoleFixture[] = SHOP_ROLES): void {
  // The page asks for the list sorted by role code, which puts Kế toán first and Chủ cửa hàng last.
  const byCode = [...roles].sort((a, b) => a.code.localeCompare(b.code));
  backend.on("GET", /^\/v1\/organizations\/[^/]+\/role-adoptions$/, () => ({ data: pageOf(byCode.map((role) => adoption(shop, role))) }));
  backend.on("GET", /^\/v1\/organizations\/[^/]+\/role-adoptions\/([^/]+)$/, (_request, match) => {
    const role = roles.find((candidate) => candidate.roleId === match[1]);
    return role ? { data: adoption(shop, role) } : { status: 404, code: "ROLE_ADOPTION_NOT_FOUND", message: "Không tìm thấy vai trò." };
  });
  backend.on("GET", /^\/v1\/roles\/([^/]+)\/versions\/([^/]+)\/permissions$/, (_request, match) => {
    const role = roles.find((candidate) => candidate.roleId === match[1]);
    return {
      data: {
        role_id: match[1], role_version_id: match[2], role_aggregate_version: 1,
        permissions: (role?.permissions ?? []).map((key) => ({
          assignment_id: `assignment-${key}`, permission_id: permissionId(key), permission_key: key, scopes: [],
          selection_source: "EXPLICIT", required_by: [],
        })),
      },
    };
  });
  backend.on("GET", /^\/v1\/permissions$/, () => ({
    data: pageOf(Object.entries(CATALOG_NAMES).map(([key, name]) => ({
      id: permissionId(key), key, module_code: key.split(".")[0]!.toUpperCase(), name, description: name,
      action_group: "DEFAULT", requires_mfa: false, requires_approval: false, status: "ACTIVE", version: 1, required_permission_ids: [],
    })), 100),
  }));
}

export const ROLES_URL = "/settings/organization/roles";
/** The parent Section of every shop role flow. */
export const GROUP = "QUẢN LÝ VAI TRÒ CỦA SHOP";

/** From a role's page back to the list, by the page's own back link. */
export async function backToRoles(page: Page): Promise<void> {
  await page.getByRole("main").getByRole("link", { name: "Vai trò", exact: true }).first().click();
  await page.getByRole("heading", { level: 1, name: "Vai trò", exact: true }).waitFor();
}

/** Opens the roles page and waits for its content: the table, an empty state, or a message. */
export async function openRoles(page: Page): Promise<void> {
  await page.goto(ROLES_URL);
  await page.getByText(/^Đang (tải|kiểm tra)/).first().waitFor({ state: "detached" }).catch(() => undefined);
}

/** From the list into one role's page, with its permissions loaded. */
export async function openRole(page: Page, role: RoleFixture): Promise<void> {
  await page.getByRole("link", { name: role.name, exact: true }).click();
  await page.getByRole("heading", { level: 1, name: role.name }).waitFor();
  await page.getByText("Đang tải quyền của vai trò…").waitFor({ state: "detached" });
}
