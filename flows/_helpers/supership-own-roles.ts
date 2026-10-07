// A stateful stand-in backend and steps for a shop's own roles (SuperShip Web, /settings/organization/roles):
// creating one on a single page (name, description, permissions) and changing one later. The person never
// meets drafts, versions or scopes; the app does those calls behind the one button.
//
// Components: RoleListPage, RoleEditorPage, RoleDetailPage and PermissionGroupPicker
// (features/organization-settings).
import type { Page } from "playwright";
import { defineFlow, type FlowContext, type FlowDefinition } from "../../capture";
import { KHA_AI_SHOP, mockSignedInShop, pageOf, type Backend } from "./supership-session";
import { CATALOG_NAMES, OWNER_PERMISSIONS, ROLES_URL, SHOP_ROLES, mockShopRoles, permissionId } from "./supership-shop-roles";

/** The Section that holds every flow of the shop's own roles. */
export const GROUP = "VAI TRÒ RIÊNG CỦA SHOP";
/** Creating a role, changing its permissions and renaming it need these on top of what the owner holds in the other flows. */
export const ROLE_ADMIN_PERMISSIONS = [...OWNER_PERMISSIONS, "role.create", "role.update"];
/** Someone who may create roles and choose their permissions, but not rename an existing one. */
export const ROLE_CREATOR_PERMISSIONS = [...OWNER_PERMISSIONS, "role.create"];

const CREATED_AT = "2026-10-06T02:00:00Z";
const SYSTEM_DESCRIPTIONS: Record<string, string> = {
  SHOP_OWNER: "Toàn quyền quản lý cửa hàng.",
  SHOP_OPERATOR: "Tạo và xử lý đơn hàng hằng ngày.",
  SHOP_ACCOUNTANT: "Đối soát và xuất báo cáo.",
};

interface OwnRole {
  id: string; code: string; name: string; description: string | null; status: string; version: number;
  /** Newest first. */
  versions: Array<{ id: string; number: number; published: boolean; permissionIds: string[] }>;
}

export interface OwnRolesMock {
  /** Adds a role the shop already has, in use, giving `keys`. */
  seed(name: string, description: string, keys: string[]): string;
  /** Adds a role whose creation stopped before any permission was saved. */
  seedUnfinished(name: string): string;
  /** What the last save asked for about the members who hold the role. */
  lastMoveAssignments(): boolean | null;
}

/** Answers the role catalog for a shop that may have roles of its own; saving changes what is read next. */
export function mockOwnRoles(backend: Backend): OwnRolesMock {
  const shop = KHA_AI_SHOP;
  mockShopRoles(backend, shop);
  const roles: OwnRole[] = [];
  let moved: boolean | null = null;
  let sequence = 0;

  const roleDto = (role: OwnRole) => ({
    id: role.id, code: role.code, name: role.name, description: role.description, scope_level: "LOCAL",
    owner_organization_id: shop.organizationId, system_policy_key: null, status: role.status, is_protected: false,
    version: role.version, created_at: CREATED_AT, updated_at: CREATED_AT,
  });
  const versionDto = (role: OwnRole, version: OwnRole["versions"][number]) => ({
    id: version.id, role_id: role.id, version_number: version.number, publication_status: version.published ? "PUBLISHED" : "DRAFT",
    support_status: "SUPPORTED", published_at: version.published ? CREATED_AT : null, support_status_changed_at: null,
    change_summary: null, created_by_membership_id: "capture-membership", role_aggregate_version: role.version, created_at: CREATED_AT,
  });
  const contentDto = (role: OwnRole, version: OwnRole["versions"][number]) => ({
    role_id: role.id, role_version_id: version.id, role_aggregate_version: role.version,
    permissions: version.permissionIds.map((id) => ({
      assignment_id: `assignment-${version.id}-${id}`, permission_id: id, permission_key: id.replace(/^permission-/, ""), scopes: [],
      selection_source: "EXPLICIT", required_by: [],
    })),
  });
  const find = (id: string) => roles.find((role) => role.id === id);
  const notFound = { status: 404, code: "ROLE_NOT_FOUND", message: "Không tìm thấy vai trò." };

  backend.on("GET", /^\/v1\/roles$/, () => ({ data: pageOf(roles.map(roleDto), 100) }));
  backend.on("POST", /^\/v1\/roles$/, (request) => {
    const body = request.postDataJSON() as { name: string; description?: string };
    sequence += 1;
    const role: OwnRole = { id: `own-role-${sequence}`, code: `ROLE_${String(sequence).padStart(6, "0")}`, name: body.name, description: body.description ?? null, status: "DRAFT", version: 1, versions: [] };
    roles.push(role);
    return { data: roleDto(role) };
  });
  // A role's own page and its description in the list of roles in use: a system role is answered too.
  backend.on("GET", /^\/v1\/roles\/([^/]+)$/, (_request, match) => {
    const own = find(match[1]!);
    if (own) return { data: roleDto(own) };
    const system = SHOP_ROLES.find((role) => role.roleId === match[1]);
    return system ? { data: {
      id: system.roleId, code: system.code, name: system.name, description: SYSTEM_DESCRIPTIONS[system.code] ?? null, scope_level: "SYSTEM",
      owner_organization_id: null, system_policy_key: null, status: "ACTIVE", is_protected: true, version: 1, created_at: CREATED_AT, updated_at: CREATED_AT,
    } } : notFound;
  });
  backend.on("PATCH", /^\/v1\/roles\/(own-role-[^/]+)$/, (request, match) => {
    const role = find(match[1]!);
    if (!role) return notFound;
    const body = request.postDataJSON() as { name: string; description: string };
    role.name = body.name; role.description = body.description || null; role.version += 1;
    return { data: roleDto(role) };
  });
  backend.on("GET", /^\/v1\/roles\/(own-role-[^/]+)\/versions$/, (_request, match) => {
    const role = find(match[1]!);
    return role ? { data: pageOf(role.versions.map((version) => versionDto(role, version)), 100) } : notFound;
  });
  backend.on("POST", /^\/v1\/roles\/(own-role-[^/]+)\/versions$/, (_request, match) => {
    const role = find(match[1]!);
    if (!role) return notFound;
    const version = { id: `${role.id}-v${role.versions.length + 1}`, number: role.versions.length + 1, published: false, permissionIds: [] as string[] };
    role.versions.unshift(version); role.version += 1;
    return { data: versionDto(role, version) };
  });
  backend.on("GET", /^\/v1\/roles\/(own-role-[^/]+)\/versions\/([^/]+)\/permissions$/, (_request, match) => {
    const role = find(match[1]!);
    const version = role?.versions.find((candidate) => candidate.id === match[2]);
    return role && version ? { data: contentDto(role, version) } : notFound;
  });
  backend.on("PUT", /^\/v1\/roles\/(own-role-[^/]+)\/versions\/([^/]+)\/permissions$/, (request, match) => {
    const role = find(match[1]!);
    const version = role?.versions.find((candidate) => candidate.id === match[2]);
    if (!role || !version) return notFound;
    version.permissionIds = (request.postDataJSON() as { permissions: Array<{ permission_id: string }> }).permissions.map((item) => item.permission_id);
    role.version += 1;
    return { data: contentDto(role, version) };
  });
  backend.on("POST", /^\/v1\/roles\/(own-role-[^/]+)\/versions\/([^/]+)\/publish$/, (request, match) => {
    const role = find(match[1]!);
    const version = role?.versions.find((candidate) => candidate.id === match[2]);
    if (!role || !version) return notFound;
    moved = Boolean((request.postDataJSON() as { move_assignments?: boolean }).move_assignments);
    version.published = true; role.status = "ACTIVE"; role.version += 1;
    return { data: versionDto(role, version) };
  });

  // What the signed-in owner holds: a role cannot give more than that.
  backend.on("GET", /^\/v1\/me\/access-summary$/, () => ({
    data: {
      membership: { organization: { name: shop.name }, membership_type_name: "Chủ sở hữu" },
      items: OWNER_PERMISSIONS.map((key) => ({
        permission_key: key, permission_name: CATALOG_NAMES[key] ?? key, module_code: key.split(".")[0]!.toUpperCase(),
        requires_mfa: false, requires_approval: false, sources: [{ source_type: "ROLE_VERSION", effect: "ALLOW", role: null }],
      })),
      total_elements: OWNER_PERMISSIONS.length,
    },
  }));
  // Every shop permission applies to the shop itself; none needs a narrower scope.
  backend.on("GET", /^\/v1\/permissions\/([^/]+)\/scope-rules$/, (_request, match) => ({
    data: { permission_id: match[1], permission_version: 1, rules: [{ id: `rule-${match[1]}`, scope_type: "ORGANIZATION", is_required: true, valid_from: "2025-01-01T01:00:00Z" }] },
  }));

  return {
    seed: (name, description, keys) => {
      sequence += 1;
      const id = `own-role-${sequence}`;
      roles.push({ id, code: `ROLE_${String(sequence).padStart(6, "0")}`, name, description, status: "ACTIVE", version: 4,
        versions: [{ id: `${id}-v1`, number: 1, published: true, permissionIds: keys.map(permissionId) }] });
      return id;
    },
    seedUnfinished: (name) => {
      sequence += 1;
      const id = `own-role-${sequence}`;
      roles.push({ id, code: `ROLE_${String(sequence).padStart(6, "0")}`, name, description: null, status: "DRAFT", version: 1, versions: [] });
      return id;
    },
    lastMoveAssignments: () => moved,
  };
}

export interface OwnRolesContext {
  page: Page;
  shot: FlowContext["shot"];
  roles: OwnRolesMock;
  backend: Backend;
  log: FlowContext["log"];
}

/** A flow of the shop's own roles: the owner signed in and allowed to create roles, the stand-in backend answering. */
export function ownRolesFlow(flow: { id: string; name: string; run(context: OwnRolesContext): Promise<void> }): FlowDefinition {
  return defineFlow({
    id: `vai-tro-rieng-${flow.id}`,
    group: GROUP,
    name: flow.name,
    app: "supership",
    async run({ page, shot, log }) {
      const backend = await mockSignedInShop(page, KHA_AI_SHOP, ROLE_ADMIN_PERMISSIONS, log);
      const roles = mockOwnRoles(backend);
      await flow.run({ page, shot, roles, backend, log });
    },
  });
}

/** The dialog on top: native dialogs make everything behind them inert. */
export const openDialog = (page: Page) => page.locator("dialog[open]").last();

export async function openRoleList(page: Page): Promise<void> {
  await page.goto(ROLES_URL);
  await page.getByRole("heading", { level: 1, name: "Vai trò", exact: true }).waitFor();
  await page.getByRole("heading", { level: 2, name: "Vai trò đang sử dụng" }).waitFor();
  await page.getByText(/^Đang tải/).first().waitFor({ state: "detached" }).catch(() => undefined);
}

/** From the list into one of the shop's own roles, with its permissions loaded. */
export async function openOwnRole(page: Page, name: string): Promise<void> {
  await page.getByRole("link", { name, exact: true }).click();
  await page.getByRole("heading", { level: 1, name }).waitFor();
  await page.getByText(/^Đang tải/).first().waitFor({ state: "detached" }).catch(() => undefined);
}

/** Waits for the role form: the permission groups are listed. */
export async function waitRoleForm(page: Page, title: "Tạo vai trò" | "Chỉnh sửa vai trò"): Promise<void> {
  await page.getByRole("heading", { level: 1, name: title }).waitFor();
  await page.getByRole("button", { name: "Mở tất cả" }).waitFor();
}

/** Ticks or unticks permissions by their names, opening every group first so each one can be reached. */
export async function togglePermissions(page: Page, names: string[]): Promise<void> {
  await page.getByRole("button", { name: "Mở tất cả" }).click();
  for (const name of names) await page.getByRole("checkbox", { name, exact: true }).click();
}

/** Acknowledges the success notice saying `text`. */
export async function acknowledge(page: Page, text: string): Promise<void> {
  const notice = page.locator("dialog[open]").filter({ hasText: text }).last();
  await notice.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await notice.waitFor({ state: "detached" });
}
