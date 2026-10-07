// A stateful stand-in backend and steps for "Thông tin cửa hàng" (SuperShip Web, /settings/organization):
// one form with the shop's name and its one address, edited in place; the code, the user model, the
// creation date and the representative (the owner) are read-only.
//
// Components: OrganizationOverviewPage (features/organization-settings), RegionPickerField and
// RegionPickerDialog (shared/components). The region catalog is the real one, as in the sign-up flows.
import type { Page } from "playwright";
import { defineFlow, type FlowContext, type FlowDefinition } from "../../capture";
import { KHA_AI_SHOP, mockSignedInShop, type Backend } from "./supership-session";
import { OWNER_PERMISSIONS } from "./supership-shop-roles";

/** The Section that holds every flow of the shop's information. */
export const GROUP = "THÔNG TIN CỬA HÀNG";
export const SHOP_INFO_URL = "/settings/organization";
export const SAVED = "Cập nhật thông tin cửa hàng thành công.";

/** What a member who may look at the shop but not change it has. */
export const VIEW_ONLY_PERMISSIONS = OWNER_PERMISSIONS.filter((key) => key !== "organization.profile.update" && key !== "organization.address.manage");

const CREATED_AT = "2026-01-05T01:00:00Z";

/** Answers the shop's profile, its one address and its representative; saving changes what is read next. */
export function mockShopInfo(backend: Backend): void {
  const shop = KHA_AI_SHOP;
  let name = shop.name;
  let version = 1;
  let address = {
    id: "address-1", address_line: "36 Nguyễn Tư Giản", region_level: "LEVEL_2", ward_code: "P21C0046", ward_name: "Phường Ngũ Hành Sơn",
    district_code: null as string | null, district_name: null as string | null, province_code: "P21", province_name: "Thành phố Đà Nẵng",
    is_primary: true, status: "ACTIVE", valid_from: CREATED_AT, valid_to: null, created_at: CREATED_AT, updated_at: CREATED_AT,
  };
  const profile = () => ({
    id: shop.organizationId, code: shop.code, name, logo_url: null,
    type: { id: "type-shop", code: "SHOP", name: "Cửa hàng" }, parent_id: null, internal: false, status: "ACTIVE",
    valid_from: CREATED_AT, valid_to: null, version, user_model: shop.userModel, created_at: CREATED_AT, updated_at: CREATED_AT,
  });

  backend.on("GET", /^\/v1\/organizations\/[^/]+\/profile$/, () => ({ data: profile() }));
  backend.on("PATCH", /^\/v1\/organizations\/[^/]+\/profile$/, (request) => {
    name = (request.postDataJSON() as { name: string }).name.toUpperCase();
    version += 1;
    return { data: profile() };
  });
  backend.on("GET", /^\/v1\/organizations\/[^/]+\/addresses$/, () => ({ data: { organization_id: shop.organizationId, addresses: [address] } }));
  backend.on("PATCH", /^\/v1\/organizations\/[^/]+\/addresses\/[^/]+$/, (request) => {
    // As the backend does: a changed address is a new record that replaces the old one.
    address = { ...address, ...(request.postDataJSON() as Partial<typeof address>), id: `address-${version}-${Date.now()}`, updated_at: new Date().toISOString() };
    return { data: { organization_id: shop.organizationId, address } };
  });
  backend.on("GET", /^\/v1\/organizations\/[^/]+\/representatives$/, () => ({
    data: { organization_id: shop.organizationId, representatives: [{
      id: "representative-1", person: { id: "capture-person", full_name: shop.fullName }, representative_type: "LEGAL_REPRESENTATIVE",
      position_title: shop.title, is_primary: true, status: "ACTIVE", valid_from: CREATED_AT, valid_to: null,
      appointment_reference: null, change_reason: null, created_at: CREATED_AT, updated_at: CREATED_AT,
    }] },
  }));
}

export interface ShopInfoContext {
  page: Page;
  shot: FlowContext["shot"];
  backend: Backend;
}

/** A flow on the shop's information page: the owner signed in, the stand-in backend answering. */
export function shopInfoFlow(flow: { id: string; name: string; run(context: ShopInfoContext): Promise<void> }): FlowDefinition {
  return defineFlow({
    id: `thong-tin-cua-hang-${flow.id}`,
    group: GROUP,
    name: flow.name,
    app: "supership",
    async run({ page, shot, log }) {
      const backend = await mockSignedInShop(page, KHA_AI_SHOP, OWNER_PERMISSIONS, log);
      mockShopInfo(backend);
      await flow.run({ page, shot, backend });
    },
  });
}

export const shopName = (page: Page) => page.locator("#shop-name");
export const addressLine = (page: Page) => page.locator("#shop-address-line");
export const saveButton = (page: Page) => page.getByRole("button", { name: "Cập nhật thông tin", exact: true });
/** The dialog on top: native dialogs make everything behind them inert. */
export const openDialog = (page: Page) => page.locator("dialog[open]").last();

export async function openShopInfo(page: Page): Promise<void> {
  await page.goto(SHOP_INFO_URL);
  await page.getByRole("heading", { level: 1, name: "Thông tin cửa hàng" }).waitFor();
  await shopName(page).waitFor();
  // The representative is read after the form appears.
  await page.locator("#shop-representative").waitFor();
}

/** Opens the region dialog from the field showing the current region; waits for the provinces. */
export async function openRegionDialog(page: Page, currentRegion: string): Promise<void> {
  await page.getByRole("button", { name: currentRegion }).click();
  await openDialog(page).locator("li button").first().waitFor();
}

/** Narrows the open region list to what matches `search` and picks the first match. */
export async function pickRegionOption(page: Page, search: string): Promise<void> {
  const dialog = openDialog(page);
  await dialog.getByPlaceholder("Tìm kiếm").fill(search);
  const option = dialog.locator("li button").first();
  await option.waitFor();
  await option.click();
}
