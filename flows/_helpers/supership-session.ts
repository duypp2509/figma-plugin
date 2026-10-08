// A signed-in SuperShip Web session without signing in: the tab is handed a session and every backend
// call is answered in the browser. This is the approach of the backend repo's own UI smoke scripts
// (Server/supership-superplatform-user/scripts/ui-smoke.cjs); the real login cannot be automated here
// because the local backend checks a real captcha.
import type { Page, Request, Route } from "playwright";

/** sessionStorage key of the app's per-tab session copy (shared/auth/session-store.ts). */
const SESSION_STORAGE_KEY = "supership.web.session.v1";

export interface ShopFixture {
  organizationId: string;
  code: string;
  name: string;
  userModel: "SINGLE_USER" | "MULTI_USER";
  /** The signed-in member. */
  fullName: string;
  title: string;
}

export const KHA_AI_SHOP: ShopFixture = {
  organizationId: "org-shop-kha-ai", code: "KHAAI", name: "Khả Ái", userModel: "MULTI_USER",
  fullName: "Đỗ Khánh Linh", title: "Chủ shop",
};

export interface Reply {
  status?: number;
  data?: unknown;
  /** For a failure: the backend's `data.code` and message. */
  code?: string;
  message?: string;
}

type Handler = (request: Request, match: RegExpMatchArray) => Reply | Promise<Reply>;

/** The stand-in for one of the app's APIs: the calls under one base path. */
export interface MockedApi {
  /**
   * Answers calls whose path (after the API's base path) matches. A handler added later wins over an
   * earlier one, so a flow can replace a default for one scenario.
   */
  on(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: RegExp, handler: Handler): void;
  /** Calls no handler knew, e.g. "GET /v1/orders". They got a 404; a flow should not rely on them. */
  readonly unexpected: string[];
}

/** The app's other APIs by the base path its pages call them on (shared/config/env.ts of the app). */
export const API_BASE = { orders: "/api/orders", support: "/api/support", mock: "/api/mock" } as const;

export interface Backend extends MockedApi {
  /** Changes what the signed-in member may do; takes effect on the next page load. */
  setPermissions(permissions: readonly string[]): void;
  /**
   * Stands in for another API of the app, e.g. `backend.api(API_BASE.orders)` for the Order API. Until this is
   * called for a base path, its calls go to whatever really runs there. Asking twice gives the same stand-in.
   */
  api(basePath: string): Promise<MockedApi>;
}

const ok = (data: unknown) => ({ status: 200, json: { error: false, message: null, data } });

interface Registered { method: string; path: RegExp; handler: Handler }

/** Answers every call under `basePath` from `handlers`; a call none of them knows gets a 404 and is logged once. */
async function routeApi(page: Page, basePath: string, handlers: Registered[], unexpected: string[], log: (line: string) => void): Promise<void> {
  const label = basePath === "/api/backend" ? "" : `${basePath} `;
  await page.route(`**${basePath}/**`, async (route: Route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const path = pathname.slice(pathname.indexOf(basePath) + basePath.length);
    for (const { method, path: pattern, handler } of handlers) {
      const match = request.method() === method ? path.match(pattern) : null;
      if (!match) continue;
      const reply = await handler(request, match);
      if (reply.status && reply.status >= 400) {
        // Without a message the app shows its own wording for a failed request.
        return route.fulfill({ status: reply.status, json: { error: true, message: reply.message ?? null, data: reply.code ? { code: reply.code } : null } });
      }
      return route.fulfill(ok(reply.data ?? {}));
    }
    const call = `${request.method()} ${path}`;
    if (!unexpected.includes(call)) { unexpected.push(call); log(`chưa giả lập: ${label}${call}`); }
    return route.fulfill({ status: 404, json: { error: true, message: `Chưa giả lập: ${call}`, data: null } });
  });
}

export function capability(key: string, organizationId: string) {
  return {
    permission_key: key, allowed: true, available: true, availability: "AVAILABLE", requires_mfa: false,
    requires_approval: false, required_scope_types: ["ORGANIZATION"], rejection_reasons: [],
    grants: [{
      assignment_id: "assignment-1", source_type: "ROLE_VERSION", effect: "ALLOW", role_id: "role-owner", role_version_id: "role-owner-v1",
      scopes: [{ scope_type: "ORGANIZATION", organization_mode: "SELF", anchor_organization_id: organizationId, organization_ids: [], application_ids: [], resources: [], attribute_conditions: [] }],
    }],
  };
}

/**
 * Opens a signed-in session for a member of `shop` holding `permissions`, and routes every backend call
 * to the handlers. Call before the first page.goto().
 */
export async function mockSignedInShop(page: Page, shop: ShopFixture, permissions: readonly string[], log: (line: string) => void): Promise<Backend> {
  const now = Date.now();
  const session = {
    sessionId: "capture-session", identityId: "capture-identity", fullName: shop.fullName, avatarUrl: null,
    assuranceLevel: 1, nextAction: "NONE", expiresAt: new Date(now + 8 * 3_600_000).toISOString(),
    availableMemberships: [{
      membershipId: "capture-membership", orgId: shop.organizationId, orgCode: shop.code, orgName: shop.name, orgType: "SHOP",
      membershipType: "OWNER", title: shop.title, status: "ACTIVE", applicationCode: "SUPERSHIP", eligible: true, isDefault: true,
    }],
    activeContext: { contextId: "capture-context", activeMembershipId: "capture-membership", orgCode: shop.code, orgName: shop.name, applicationName: "SUPERSHIP" },
  };
  await page.context().addInitScript(`sessionStorage.setItem(${JSON.stringify(SESSION_STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(session))});`);

  const handlers: Registered[] = [];
  const unexpected: string[] = [];
  const others = new Map<string, MockedApi>();
  let granted = permissions;
  const backend: Backend = {
    on: (method, path, handler) => { handlers.unshift({ method, path, handler }); },
    setPermissions: (next) => { granted = next; },
    unexpected,
    api: async (basePath) => {
      const known = others.get(basePath);
      if (known) return known;
      const apiHandlers: Registered[] = [];
      const api: MockedApi = { on: (method, path, handler) => { apiHandlers.unshift({ method, path, handler }); }, unexpected: [] };
      await routeApi(page, basePath, apiHandlers, api.unexpected, log);
      others.set(basePath, api);
      return api;
    },
  };

  backend.on("GET", /^\/v1\/me\/capabilities$/, () => ({
    data: {
      context: { context_id: "capture-context", context_type: "SUPERSHIP", application_name: "SUPERSHIP", membership_id: "capture-membership", organization_id: shop.organizationId },
      assurance: { level: 1, mfa_verified: false, mfa_verified_at: null },
      capabilities: granted.map((key) => capability(key, shop.organizationId)),
      revision: "capture", generated_at: new Date(now).toISOString(), expires_at: new Date(now + 3_600_000).toISOString(),
    },
  }));

  // What every signed-in page asks for before it shows anything.
  const membership = {
    membership_id: "capture-membership", org_id: shop.organizationId, org_code: shop.code, org_name: shop.name,
    membership_type: "OWNER", title: shop.title, application_code: "SUPERSHIP", eligible: true, is_default: true,
  };
  const activeContext = { context_id: "capture-context", active_membership_id: "capture-membership", org_code: shop.code, org_name: shop.name, application_code: "SUPERSHIP" };
  backend.on("GET", /^\/v1\/auth\/customer\/session$/, () => ({
    data: {
      session_id: session.sessionId, expires_at: session.expiresAt, assurance_level: 1, next_action: "NONE",
      identity_id: session.identityId, full_name: shop.fullName, avatar_url: null,
      available_memberships: [membership], active_context: activeContext,
    },
  }));
  backend.on("GET", /^\/v1\/auth\/customer\/state$/, () => ({
    data: {
      next_action: "NONE", mfa_reason: null, enrolled: false, assurance_level: 1, step_up_method: "OTP",
      otp_step_up_expires_at: null, mfa_verified_at: null, mfa_access_expires_at: null, mfa_elevation_expires_at: null,
      active_context: activeContext,
    },
  }));
  // The Bearer token the Order, Support and Mock APIs are called with. The page asks for it before its first
  // call to one of them; a stand-in API does not check it, a real one refuses it.
  backend.on("POST", /^\/v1\/me\/access-context\/token$/, () => ({
    data: {
      active_context: { ...activeContext, context_version: 1 }, access_token: "capture-access-token", token_type: "Bearer",
      expires_in: 600, access_token_expires_at: new Date(Date.now() + 600_000).toISOString(),
    },
  }));
  backend.on("GET", /^\/v1\/me\/profile$/, () => ({
    data: {
      identity_id: session.identityId, person_id: "capture-person", full_name: shop.fullName, date_of_birth: "1994-05-12", gender: "FEMALE",
      avatar_url: null, status: "ACTIVE", last_login_at: new Date(now).toISOString(), person_version: 1,
      identifiers: [{ type: "EMAIL", value: "dokhanhlinh@gmail.com", verified: true }, { type: "PHONE", value: "0906842735", verified: true }],
    },
  }));
  backend.on("GET", /^\/v1\/organizations\/[^/]+\/profile$/, () => ({
    data: {
      id: shop.organizationId, code: shop.code, name: shop.name, logo_url: null,
      type: { id: "type-shop", code: "SHOP", name: "Cửa hàng" }, parent_id: null, internal: false, status: "ACTIVE",
      valid_from: "2026-01-05T01:00:00Z", valid_to: null, version: 1, user_model: shop.userModel,
      created_at: "2026-01-05T01:00:00Z", updated_at: "2026-01-05T01:00:00Z",
    },
  }));

  await routeApi(page, "/api/backend", handlers, unexpected, log);

  return backend;
}

export const pageOf = <T>(items: T[], size = 20) => ({ items, page: 0, size, total_elements: items.length, total_pages: 1, has_next: false });
