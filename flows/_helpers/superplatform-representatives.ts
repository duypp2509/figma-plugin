import type { Page } from "playwright";
import { unitFlow, unitUrl, type HA_DONG } from "./superplatform-legal-profile";

/*
 * "Người đại diện" (/workspace/organizations/{id}?section=representatives) of SuperPlatform. The stand-in backend of
 * the units, their legal profile and their representatives is shared with "Thông tin pháp lý"
 * (superplatform-legal-profile.ts): a change of legal subject ends the representatives there.
 */

export { DONG_ANH, HA_DONG, LONG_BIEN, ME_LINH, MESSAGES, YEN_NGHIA } from "./superplatform-legal-profile";
export { codeDialog, dialog, enterCode, field, pick, pickDate, press, scrollTop, toast, waitCode } from "./superplatform-legal-profile";

export const representativeFlow = (flow: Parameters<typeof unitFlow>[2]) => unitFlow("nguoi-dai-dien", "superplatform-nguoi-dai-dien-", flow);

const section = (page: Page) => page.locator("section.representative-page");
/** "Người đại diện" of a unit, loaded: the table or the empty state. */
export async function openRepresentatives(page: Page, unit: typeof HA_DONG) {
  await page.goto(unitUrl(unit, "representatives"));
  await section(page).waitFor();
  await section(page).getByRole("heading", { name: "Người đại diện", exact: true }).waitFor();
  await section(page).locator(".representative-table, :text('Chưa có người đại diện')").first().waitFor();
}
export const appointButton = (page: Page) => section(page).locator("button").filter({ hasText: /^Bổ nhiệm người đại diện$/ });
export const historyToggle = (page: Page) => section(page).getByRole("switch", { name: "Xem cả người đã kết thúc nhiệm kỳ" });
/** The table row of one term, named by the representative's full name. */
export const row = (page: Page, name: string) => section(page).locator(".representative-table tbody tr")
  .filter({ has: page.locator("th[scope=row] > strong").getByText(name, { exact: true }) });
/**
 * "Sửa" or "Kết thúc nhiệm kỳ" in the "⋯" menu of a row, with the menu opened; a disabled one carries
 * "<label> — <reason>" as its label.
 */
export async function rowAction(page: Page, name: string, label: "Xem chi tiết" | "Sửa" | "Kết thúc nhiệm kỳ") {
  const item = row(page, name).getByRole("menuitem", { name: new RegExp(`^${label}( — |$)`) });
  if (!(await item.isVisible())) await row(page, name).getByRole("button", { name: `Thao tác với ${name}`, exact: true }).click();
  await item.waitFor();
  return item;
}
export const reminder = (page: Page, text: string) => section(page).getByRole("status").filter({ hasText: text });
export const APPOINT = "Bổ nhiệm người đại diện";
export const EDIT = "Sửa thông tin người đại diện";
export const TERMINATE = "Kết thúc nhiệm kỳ";
