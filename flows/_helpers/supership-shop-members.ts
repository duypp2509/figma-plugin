// Fixtures, a stateful stand-in backend and steps for a Shop's member management (SuperShip Web,
// /settings/organization/memberships): the list with its filters and invitations tab, a member's page
// with its four tabs, and the two pages that give and take back permissions.
//
// Components: MembershipListPage, MembershipDetailPage, MemberRoleAssignments, MemberDirectPermissions,
// MemberPermissionChangePage (features/organization-settings) and InviteMemberDialog,
// MemberInvitationsPanel (features/member-invitations). Members are the seed's Khả Ái shop.
//
// Giving, taking back and restoring really change the stand-in's records, so the lists a flow returns to
// show the result, as they do against the real backend.
import type { Page } from "playwright";
import { defineFlow, type FlowContext, type FlowDefinition } from "../../capture";
import { KHA_AI_SHOP, mockSignedInShop, pageOf, type Backend, type ShopFixture } from "./supership-session";
import {
  CATALOG_NAMES, OWNER_PERMISSIONS, SHOP_ACCOUNTANT, SHOP_OPERATOR, SHOP_OWNER, SHOP_ROLES, mockShopRoles, permissionId,
  type RoleFixture,
} from "./supership-shop-roles";

/** The moment every flow runs at, so dates in the pictures do not change from run to run. */
export const NOW = Date.parse("2026-10-06T09:00:00+07:00");
const iso = (millis: number) => new Date(millis).toISOString();
const at = (value: string) => new Date(`${value}+07:00`).toISOString();

/** The one Section that holds everything reached from "Thành viên" in the sidebar. */
export const ROOT = "THÀNH VIÊN CỬA HÀNG";
/**
 * The Sections inside ROOT that hold several flows, each flow a Section of its own. The two flows that
 * only look at members (the list, a member's page) sit in ROOT directly, with no Section in between.
 */
export const AREA = {
  status: [ROOT, "QUẢN LÍ TRẠNG THÁI TƯ CÁCH THÀNH VIÊN"],
  roles: [ROOT, "CHI TIẾT THÀNH VIÊN - TAB VAI TRÒ"],
  granted: [ROOT, "CHI TIẾT THÀNH VIÊN - TAB QUYỀN BỔ SUNG"],
  revoked: [ROOT, "CHI TIẾT THÀNH VIÊN - TAB QUYỀN BỊ THU HỒI"],
  invite: [ROOT, "MỜI THÀNH VIÊN"],
};
export const MEMBERS_URL = "/settings/organization/memberships";

/** What the owner needs on top of the role's own permissions to manage members and their access. */
export const MEMBER_ADMIN_PERMISSIONS = [...OWNER_PERMISSIONS, "permission.view", "permission.assign", "membership.invite"];

type MemberStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "TERMINATED" | "EXPIRED";

export interface MemberFixture {
  id: string;
  fullName: string;
  type: "OWNER" | "SHOP_MEMBER";
  status: MemberStatus;
  validFrom: string;
  validTo?: string;
  terminationReason?: string;
}

// The signed-in owner's own membership has the id the session carries, so the page knows it is theirs.
export const OWNER: MemberFixture = { id: "capture-membership", fullName: "Đỗ Khánh Linh", type: "OWNER", status: "ACTIVE", validFrom: at("2026-01-05T08:00:00") };
/** The member most flows look at: has a role, an extra permission and a blocked one, each with history. */
export const VIET: MemberFixture = { id: "member-tran-quoc-viet", fullName: "Trần Quốc Việt", type: "SHOP_MEMBER", status: "ACTIVE", validFrom: at("2026-03-02T09:30:00") };
export const YEN: MemberFixture = { id: "member-nguyen-hai-yen", fullName: "Nguyễn Hải Yến", type: "SHOP_MEMBER", status: "ACTIVE", validFrom: at("2026-03-02T09:45:00") };
export const MAI: MemberFixture = { id: "member-tran-ngoc-mai", fullName: "Trần Ngọc Mai", type: "SHOP_MEMBER", status: "ACTIVE", validFrom: at("2026-04-14T14:10:00") };
export const BAO: MemberFixture = { id: "member-ly-gia-bao", fullName: "Lý Gia Bảo", type: "SHOP_MEMBER", status: "ACTIVE", validFrom: at("2026-05-20T10:00:00") };
/** A member who has just joined: no role and no permission of their own yet. */
export const THU: MemberFixture = { id: "member-le-thi-thu", fullName: "Lê Thị Thu", type: "SHOP_MEMBER", status: "ACTIVE", validFrom: at("2026-10-01T08:15:00") };
export const ANH: MemberFixture = {
  id: "member-hoang-the-anh", fullName: "Hoàng Thế Anh", type: "SHOP_MEMBER", status: "TERMINATED",
  validFrom: at("2026-02-10T08:00:00"), validTo: at("2026-08-31T17:30:00"), terminationReason: "Đã nghỉ việc tại cửa hàng.",
};
/** A member the owner suspended a while ago. */
export const LAM: MemberFixture = { id: "member-pham-tung-lam", fullName: "Phạm Tùng Lâm", type: "SHOP_MEMBER", status: "SUSPENDED", validFrom: at("2026-06-08T08:40:00") };
const MEMBERS = [OWNER, VIET, YEN, MAI, BAO, THU, LAM, ANH];

/** A phone number that already belongs to a member, and one that already has an invitation waiting. */
export const MEMBER_PHONE = "0912000222";
export const INVITED_PHONE = "0934000111";
/** The invitation that ran out and may be sent again. */
export const EXPIRED_INVITEE = "0977123456";

/** What the real backend answers when a rule stops a change: a sentence for the person, and a code. */
export const conflict = (code: string, message: string) => ({ status: 409, code, message });

type AssignmentStatus = "ACTIVE" | "ENDED" | "EXPIRED";
interface RoleRecord { id: string; memberId: string; role: RoleFixture; status: AssignmentStatus; validFrom: string; validTo: string | null; version: number }
interface DirectRecord { id: string; memberId: string; key: string; effect: "ALLOW" | "DENY"; status: AssignmentStatus; validFrom: string; validTo: string | null; version: number }

const REISSUE_COOLDOWN_MS = 60_000;

const typeOf = (member: MemberFixture) => member.type === "OWNER"
  ? { id: "type-owner", code: "OWNER", name: "Chủ sở hữu" }
  : { id: "type-shop-member", code: "SHOP_MEMBER", name: "Thành viên cửa hàng" };

const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

const ORGANIZATION_SCOPE = {
  scope_type: "ORGANIZATION", organization_mode: "SELF", anchor_type: "MEMBERSHIP_ORGANIZATION",
  explicit_root_organization_id: null, application_ids: [], organization_ids: [], resource_ids: [], attribute_conditions: [],
};

/** Answers every member, role-assignment, direct-permission and invitation endpoint of the shop. */
export async function mockShopMembers(page: Page, backend: Backend, shop: ShopFixture): Promise<void> {
  await page.clock.setFixedTime(NOW);
  mockShopRoles(backend, shop);

  let sequence = 0;
  const nextId = (prefix: string) => `${prefix}-new-${++sequence}`;
  // This run's own copy: suspending or ending a membership changes it.
  const members = MEMBERS.map((member) => ({ ...member, version: 3 }));
  const roles: RoleRecord[] = [
    { id: "ra-owner", memberId: OWNER.id, role: SHOP_OWNER, status: "ACTIVE", validFrom: OWNER.validFrom, validTo: null, version: 1 },
    { id: "ra-viet-operator", memberId: VIET.id, role: SHOP_OPERATOR, status: "ACTIVE", validFrom: at("2026-06-15T09:00:00"), validTo: null, version: 1 },
    { id: "ra-viet-accountant", memberId: VIET.id, role: SHOP_ACCOUNTANT, status: "ENDED", validFrom: VIET.validFrom, validTo: at("2026-06-15T09:00:00"), version: 2 },
    { id: "ra-yen", memberId: YEN.id, role: SHOP_ACCOUNTANT, status: "ACTIVE", validFrom: YEN.validFrom, validTo: null, version: 1 },
    { id: "ra-mai", memberId: MAI.id, role: SHOP_ACCOUNTANT, status: "ACTIVE", validFrom: MAI.validFrom, validTo: null, version: 1 },
    { id: "ra-bao", memberId: BAO.id, role: SHOP_OPERATOR, status: "ACTIVE", validFrom: BAO.validFrom, validTo: null, version: 1 },
    { id: "ra-lam", memberId: LAM.id, role: SHOP_OPERATOR, status: "ACTIVE", validFrom: LAM.validFrom, validTo: null, version: 1 },
    { id: "ra-anh", memberId: ANH.id, role: SHOP_OPERATOR, status: "ENDED", validFrom: ANH.validFrom, validTo: ANH.validTo ?? null, version: 2 },
  ];
  const directs: DirectRecord[] = [
    { id: "da-viet-report", memberId: VIET.id, key: "report.export", effect: "ALLOW", status: "ACTIVE", validFrom: at("2026-07-01T10:20:00"), validTo: null, version: 1 },
    { id: "da-viet-cod", memberId: VIET.id, key: "cod.reconcile", effect: "ALLOW", status: "ENDED", validFrom: at("2026-07-01T10:20:00"), validTo: at("2026-08-12T16:00:00"), version: 2 },
    { id: "da-viet-cancel", memberId: VIET.id, key: "order.cancel", effect: "DENY", status: "ACTIVE", validFrom: at("2026-09-03T11:05:00"), validTo: null, version: 1 },
    { id: "da-viet-update", memberId: VIET.id, key: "order.update", effect: "DENY", status: "ENDED", validFrom: at("2026-08-20T09:40:00"), validTo: at("2026-08-27T09:15:00"), version: 2 },
  ];

  const currentRoles = (memberId: string) => roles.filter((record) => record.memberId === memberId && record.status === "ACTIVE");
  const memberDto = (member: MemberFixture & { version: number }) => ({
    id: member.id, identity_id: null, person: { id: `person-${member.id}`, full_name: member.fullName },
    membership_type: typeOf(member), employee_profile_id: null, job_position_code: null, position_title: null,
    status: member.status, valid_from: member.validFrom, valid_to: member.validTo ?? null, version: member.version,
    created_at: member.validFrom, updated_at: member.validFrom, termination_reason: member.terminationReason ?? null,
    roles: currentRoles(member.id).map((record) => ({ id: record.role.roleId, name: record.role.name })),
  });
  const roleDto = (record: RoleRecord) => ({
    id: record.id, membership_id: record.memberId, role_id: record.role.roleId, local_role_version_id: null,
    anchor_organization_id: shop.organizationId, status: record.status, valid_from: record.validFrom, valid_to: record.validTo,
    created_by_membership_id: OWNER.id, is_protected: false, version: record.version,
    revoked_at: null, revoke_reason: null, change_reason: "", created_at: record.validFrom, updated_at: record.validTo ?? record.validFrom,
  });
  const directDto = (record: DirectRecord) => ({
    id: record.id, organization_id: shop.organizationId, membership_id: record.memberId, permission_id: permissionId(record.key),
    permission_key: record.key, effect: record.effect, status: record.status, scopes: [ORGANIZATION_SCOPE], scope_fingerprint: record.id,
    valid_from: record.validFrom, valid_to: record.validTo, revoked_at: null, revoke_reason: null,
    created_by_membership_id: OWNER.id, protected_assignment: false, version: record.version,
    created_at: record.validFrom, updated_at: record.validTo ?? record.validFrom,
  });
  const newestFirst = <T extends { validFrom: string }>(records: T[]) => [...records].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  const notFound = { status: 404, code: "NOT_FOUND", message: "Không tìm thấy dữ liệu." };

  const MEMBERSHIPS = /^\/v1\/organizations\/[^/]+\/memberships/;
  const path = (suffix: string) => new RegExp(`${MEMBERSHIPS.source}${suffix}$`);

  backend.on("GET", path(""), (request) => {
    const query = new URL(request.url()).searchParams;
    const search = plain(query.get("search") ?? "");
    const items = members.filter((member) =>
      (!search || plain(member.fullName).includes(search))
      && (!query.get("status") || member.status === query.get("status"))
      && (!query.get("roleId") || currentRoles(member.id).some((record) => record.role.roleId === query.get("roleId"))));
    return { data: pageOf(items.map(memberDto)) };
  });
  backend.on("GET", path("/([^/]+)"), (_request, match) => {
    const member = members.find((candidate) => candidate.id === match[1]);
    return member ? { data: memberDto(member) } : notFound;
  });
  // Suspending, bringing back and ending a membership.
  backend.on("POST", path("/([^/]+)/(activate|suspend|terminate)"), (request, match) => {
    const member = members.find((candidate) => candidate.id === match[1]);
    if (!member) return notFound;
    member.version += 1;
    if (match[2] === "terminate") {
      const body = request.postDataJSON() as { reason?: string };
      Object.assign(member, { status: "TERMINATED", validTo: iso(NOW), terminationReason: body.reason ?? null });
    } else {
      member.status = match[2] === "suspend" ? "SUSPENDED" : "ACTIVE";
    }
    return { data: memberDto(member) };
  });

  // Roles a member holds or held.
  backend.on("GET", path("/([^/]+)/role-assignments"), (request, match) => {
    const current = new URL(request.url()).searchParams.get("state") === "CURRENT";
    return { data: pageOf(newestFirst(roles.filter((record) => record.memberId === match[1] && (!current || record.status === "ACTIVE"))).map(roleDto)) };
  });
  backend.on("GET", path("/([^/]+)/role-assignments/([^/]+)"), (_request, match) => {
    const record = roles.find((candidate) => candidate.id === match[2]);
    return record ? { data: roleDto(record) } : notFound;
  });
  backend.on("POST", path("/([^/]+)/role-assignments"), (request, match) => {
    const body = request.postDataJSON() as { role_id: string; valid_to?: string };
    const role = SHOP_ROLES.find((candidate) => candidate.roleId === body.role_id) ?? SHOP_OPERATOR;
    if (currentRoles(match[1]!).some((held) => held.role.roleId === role.roleId)) {
      return conflict("DUPLICATE_OR_OVERLAPPING_ASSIGNMENT", "Thành viên đã có vai trò này và vai trò vẫn đang hiệu lực.");
    }
    const record: RoleRecord = { id: nextId("ra"), memberId: match[1]!, role, status: "ACTIVE", validFrom: iso(NOW), validTo: body.valid_to ?? null, version: 1 };
    roles.push(record);
    return { data: { assignment: roleDto(record), outcome: "EXECUTED" } };
  });
  backend.on("POST", path("/([^/]+)/role-assignments/([^/]+)/end"), (_request, match) => {
    const record = roles.find((candidate) => candidate.id === match[2]);
    if (!record) return notFound;
    Object.assign(record, { status: "ENDED", validTo: iso(NOW), version: record.version + 1 });
    return { data: { assignment: roleDto(record), outcome: "EXECUTED" } };
  });

  // Permissions given on top of the roles (ALLOW) and taken away from them (DENY).
  backend.on("GET", path("/([^/]+)/direct-permission-assignments"), (request, match) => {
    const query = new URL(request.url()).searchParams;
    const current = query.get("state") === "CURRENT";
    return {
      data: pageOf(newestFirst(directs.filter((record) => record.memberId === match[1]
        && (!query.get("effect") || record.effect === query.get("effect")) && (!current || record.status === "ACTIVE"))).map(directDto)),
    };
  });
  backend.on("GET", path("/([^/]+)/direct-permission-assignments/([^/]+)"), (_request, match) => {
    const record = directs.find((candidate) => candidate.id === match[2]);
    return record ? { data: directDto(record) } : notFound;
  });
  backend.on("POST", path("/([^/]+)/direct-permission-assignments"), (request, match) => {
    const body = request.postDataJSON() as { permission_id: string; effect: "ALLOW" | "DENY"; valid_to?: string };
    const key = Object.keys(CATALOG_NAMES).find((candidate) => permissionId(candidate) === body.permission_id) ?? body.permission_id;
    const record: DirectRecord = { id: nextId("da"), memberId: match[1]!, key, effect: body.effect, status: "ACTIVE", validFrom: iso(NOW), validTo: body.valid_to ?? null, version: 1 };
    directs.push(record);
    return { data: { assignment: directDto(record), outcome: "EXECUTED" } };
  });
  backend.on("POST", path("/([^/]+)/direct-permission-assignments/([^/]+)/end"), (_request, match) => {
    const record = directs.find((candidate) => candidate.id === match[2]);
    if (!record) return notFound;
    Object.assign(record, { status: "ENDED", validTo: iso(NOW), version: record.version + 1 });
    return { data: { assignment: directDto(record), outcome: "EXECUTED" } };
  });

  // Every permission in effect for a member, with where it comes from.
  backend.on("GET", path("/([^/]+)/effective-permissions"), (_request, match) => {
    const sources = new Map<string, unknown[]>();
    const add = (key: string, source: unknown) => sources.set(key, [...(sources.get(key) ?? []), source]);
    for (const record of currentRoles(match[1]!)) {
      for (const key of record.role.permissions) {
        add(key, { source_type: "ROLE_VERSION", assignment_id: record.id, effect: "ALLOW", role: { id: record.role.roleId, name: record.role.name } });
      }
    }
    for (const record of directs.filter((candidate) => candidate.memberId === match[1] && candidate.status === "ACTIVE")) {
      add(record.key, { source_type: "MEMBERSHIP", assignment_id: record.id, effect: record.effect, role: null });
    }
    return { data: { items: [...sources].map(([key, list]) => ({ permission_key: key, permission_name: CATALOG_NAMES[key] ?? key, sources: list })) } };
  });

  // What the signed-in owner holds: only those permissions may be given to, or taken from, someone else.
  backend.on("GET", /^\/v1\/me\/access-summary$/, () => ({
    data: {
      membership: { organization: { name: shop.name }, membership_type_name: "Chủ sở hữu" },
      items: MEMBER_ADMIN_PERMISSIONS.map((key) => ({
        permission_key: key, permission_name: CATALOG_NAMES[key] ?? key, module_code: key.split(".")[0]!.toUpperCase(),
        requires_mfa: false, requires_approval: false,
        sources: [{ source_type: "ROLE_VERSION", effect: "ALLOW", role: { id: SHOP_OWNER.roleId, name: SHOP_OWNER.name } }],
      })),
      total_elements: MEMBER_ADMIN_PERMISSIONS.length,
    },
  }));
  // Every shop permission applies to the shop itself; none needs a narrower scope.
  backend.on("GET", /^\/v1\/permissions\/([^/]+)\/scope-rules$/, (_request, match) => ({
    data: { permission_id: match[1], permission_version: 1, rules: [{ id: `rule-${match[1]}`, scope_type: "ORGANIZATION", is_required: true, valid_from: at("2025-01-01T08:00:00") }] },
  }));
  // A shop has no roles of its own.
  backend.on("GET", /^\/v1\/roles$/, () => ({ data: pageOf([], 100) }));

  // Invitations the shop sent.
  const invitation = (id: string, contact: string, status: string, role: RoleFixture, createdAt: string, extra: Record<string, unknown> = {}) => ({
    id, organization_id: shop.organizationId, organization_name: shop.name, organization_code: shop.code,
    invitee_type: contact.includes("@") ? "EMAIL" : "PHONE", invitee_contact: contact, invitee_name: null,
    role_ids: [role.roleId], role_names: [role.name], status, close_reason: null, inviter_name: OWNER.fullName,
    inviter_role_names: [SHOP_OWNER.name], created_at: createdAt, expires_at: iso(Date.parse(createdAt) + 7 * 86_400_000),
    responded_at: null, resulting_membership_id: null, version: 1,
    reissue: status === "PENDING" || status === "EXPIRED" ? { allowed: true, available_at: null, reason: null, count: 0 } : null,
    ...extra,
  });
  const invitations = [
    invitation("inv-pending", INVITED_PHONE, "PENDING", SHOP_OPERATOR, at("2026-10-05T15:20:00")),
    invitation("inv-accepted", "lethithu@gmail.com", "ACCEPTED", SHOP_OPERATOR, at("2026-09-29T10:00:00"), { invitee_name: THU.fullName, responded_at: THU.validFrom, resulting_membership_id: THU.id, reissue: null }),
    invitation("inv-expired", EXPIRED_INVITEE, "EXPIRED", SHOP_ACCOUNTANT, at("2026-09-28T09:00:00")),
    invitation("inv-declined", "phamvanan@gmail.com", "DECLINED", SHOP_ACCOUNTANT, at("2026-09-02T13:30:00"), { responded_at: at("2026-09-03T08:10:00"), reissue: null }),
  ];
  const INVITATIONS = /^\/v1\/organizations\/[^/]+\/member-invitations$/;
  const link = (token: string) => `${new URL(page.url()).origin}/member-invitations/${token}`;
  backend.on("GET", INVITATIONS, (request) => {
    const status = new URL(request.url()).searchParams.get("status");
    const items = invitations.filter((item) => !status || item.status === status);
    return { data: { items, page: 0, size: 20, total_items: items.length, total_pages: 1 } };
  });
  backend.on("POST", INVITATIONS, (request) => {
    const body = request.postDataJSON() as { identifier: string; role_ids: string[] };
    if (body.identifier === MEMBER_PHONE) {
      return conflict("MEMBER_INVITATION_ALREADY_MEMBER", "Người này đã là thành viên của cửa hàng. Nếu thành viên đang bị tạm ngưng, hãy kích hoạt lại.");
    }
    if (invitations.some((item) => item.status === "PENDING" && item.invitee_contact === body.identifier)) {
      return conflict("MEMBER_INVITATION_ALREADY_OPEN", "Đã có lời mời đang chờ phản hồi cho người này.");
    }
    const role = SHOP_ROLES.find((candidate) => candidate.roleId === body.role_ids[0]) ?? SHOP_OPERATOR;
    const created = invitation(nextId("inv"), body.identifier, "PENDING", role, iso(NOW));
    invitations.unshift(created);
    return { data: { ...created, invitation_link: link("capture-new-invitation") } };
  });
  // Taking an invitation back, and sending its link again (which makes the old link useless).
  backend.on("POST", /^\/v1\/organizations\/[^/]+\/member-invitations\/([^/]+)\/cancel$/, (_request, match) => {
    const item = invitations.find((candidate) => candidate.id === match[1]);
    if (!item) return notFound;
    Object.assign(item, { status: "CANCELLED", close_reason: "CANCELLED_BY_INVITER", responded_at: iso(NOW), reissue: null, version: item.version + 1 });
    return { data: item };
  });
  backend.on("POST", /^\/v1\/organizations\/[^/]+\/member-invitations\/([^/]+)\/link:reissue$/, (_request, match) => {
    const item = invitations.find((candidate) => candidate.id === match[1]);
    if (!item) return notFound;
    Object.assign(item, {
      status: "PENDING", expires_at: iso(NOW + 7 * 86_400_000), version: item.version + 1,
      // Sent a moment ago, so it cannot be sent again straight away.
      reissue: { allowed: false, available_at: iso(NOW + REISSUE_COOLDOWN_MS), reason: "Vui lòng chờ hết thời gian giới hạn trước khi gửi lại lời mời.", count: (item.reissue?.count ?? 0) + 1 },
    });
    return { data: { ...item, invitation_link: link("capture-reissued-invitation") } };
  });
}

export interface MemberFlowContext {
  page: Page;
  shot: FlowContext["shot"];
  /** To answer one call differently for a scenario, e.g. with `conflict(...)`. */
  backend: Backend;
}

/**
 * A shop member flow: the shop's owner is signed in and the stand-in backend is answering before `run`
 * starts. `group` is the path of Sections the flow sits in, starting with one of AREA.
 */
export function memberFlow(flow: { id: string; group: string[]; name: string; run(context: MemberFlowContext): Promise<void> }): FlowDefinition {
  return defineFlow({
    id: `thanh-vien-shop-${flow.id}`,
    group: flow.group as [string, ...string[]],
    name: flow.name,
    app: "supership",
    async run({ page, shot, log }) {
      const backend = await mockSignedInShop(page, KHA_AI_SHOP, MEMBER_ADMIN_PERMISSIONS, log);
      await mockShopMembers(page, backend, KHA_AI_SHOP);
      await flow.run({ page, shot, backend });
    },
  });
}

/** The notice the app opens when a change is refused, saying `message`. */
export async function errorNotice(page: Page, message: string | RegExp) {
  const dialog = dialogWith(page, message);
  await dialog.getByText(message).waitFor();
  return dialog;
}

/** From the members list into a member's page, by their name in the table. */
export async function openMemberFromList(page: Page, member: MemberFixture): Promise<void> {
  await page.getByRole("link", { name: member.fullName, exact: true }).click();
  await page.getByRole("heading", { level: 1, name: member.fullName }).waitFor();
  await waitLoaded(page);
}

/** A member's page on one of its tabs, reached the way a person does: open the member, click the tab. */
export async function openMemberTab(page: Page, member: MemberFixture, tab: "Vai trò" | "Quyền bổ sung" | "Quyền bị thu hồi"): Promise<void> {
  await openMember(page, member);
  await page.getByRole("tab", { name: tab, exact: true }).click();
  await waitLoaded(page);
}

/** Opens the members list and waits for its rows. */
export async function openMembers(page: Page): Promise<void> {
  await page.goto(MEMBERS_URL);
  await page.getByRole("link", { name: VIET.fullName, exact: true }).waitFor();
}

/** Opens a member's page on one of its tabs, the way the list and the app's own links do. */
export async function openMember(page: Page, member: MemberFixture, tab?: "roles" | "direct-permissions" | "revoked-permissions"): Promise<void> {
  await page.goto(`${MEMBERS_URL}/${member.id}${tab ? `?tab=${tab}` : ""}`);
  await page.getByRole("heading", { level: 1, name: member.fullName }).waitFor();
  await waitLoaded(page);
}

/** Every "Đang tải…" line on the page is gone. */
export async function waitLoaded(page: Page): Promise<void> {
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('[role="status"], p')).some((element) =>
    (element as HTMLElement).offsetParent !== null && /^Đang (tải|kiểm tra)/.test(element.textContent ?? "")));
}

/** The dialog on top: native dialogs make everything behind them inert. */
export const openDialog = (page: Page) => page.locator("dialog[open]").last();

/**
 * The open dialog that says `text`. A notice opened from inside another dialog is not the last dialog
 * in the page, so it has to be found by what it says.
 */
export const dialogWith = (page: Page, text: string | RegExp) => page.locator("dialog[open]").filter({ hasText: text }).last();

/** Picks an option of the app's own dropdown, opened from its trigger. */
export async function choose(page: Page, trigger: ReturnType<Page["locator"]>, option: string): Promise<void> {
  await trigger.click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/** The "done" notice the app shows after a change; closes it. */
export async function successNotice(page: Page, message: string | RegExp) {
  const dialog = dialogWith(page, message);
  await dialog.getByText(message).waitFor();
  return { dialog, close: async () => { await dialog.getByRole("button", { name: "Xác nhận", exact: true }).click(); await dialog.waitFor({ state: "hidden" }).catch(() => undefined); } };
}

/** Switches a tab's table between what applies now and the full history. */
export async function showHistory(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Lịch sử", exact: true }).click();
  await waitLoaded(page);
}
export async function showCurrent(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Hiện tại", exact: true }).click();
  await waitLoaded(page);
}
