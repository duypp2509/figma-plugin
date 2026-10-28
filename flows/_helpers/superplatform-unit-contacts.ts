import type { Locator, Page } from "playwright";
import { expect } from "playwright/test";
import { pickCalendarDay } from "./calendar";
import { unitFlow, unitUrl } from "./superplatform-unit-profile";

/*
 * "Liên hệ" and "Địa chỉ" of an internal unit (/workspace/organizations/{id}?section=contacts|addresses), on the
 * same in-browser backend as the profile flows (superplatform-unit-profile.ts).
 */

export const contactFlow = (options: Parameters<typeof unitFlow>[1]) => unitFlow("lien-he", options);
export const addressFlow = (options: Parameters<typeof unitFlow>[1]) => unitFlow("dia-chi", options);

export const field = (page: Page, id: string) => page.locator(`[id="${id}"]`);
export const editButton = (page: Page) => page.locator("section.ui-panel").getByRole("button", { name: "Sửa", exact: true });
// A link to the unit's history page since 27/10, no longer a button opening a dialog.
export const historyButton = (page: Page) => page.getByRole("link", { name: "Xem lịch sử", exact: true });

/** "Liên hệ" or "Địa chỉ" of a unit, loaded. */
export async function openSection(page: Page, id: string, section: "contacts" | "addresses") {
  await page.goto(unitUrl(id, section));
  await page.getByRole("heading", { name: section === "contacts" ? "Liên hệ" : "Địa chỉ", exact: true }).waitFor();
  await historyButton(page).waitFor();
  await page.locator(".organization-sidebar .organization-sidebar-identity").waitFor();
}

export const contactDialog = (page: Page) => page.getByRole("dialog", { name: "Sửa liên hệ" });
// Since 27/10 each address kind has its own row, button and dialog: "Sửa …" while it has an address, "Thêm …" before.
const ADDRESS_NAMES: Record<string, string> = { SERVICE_POINT: "địa chỉ điểm phục vụ", TRANSACTION_OFFICE: "văn phòng giao dịch" };
const addressName = (type: string) => new RegExp(`^(Sửa|Thêm) ${ADDRESS_NAMES[type] ?? type}$`);
export const addressEditButton = (page: Page, type: string) => page.getByRole("button", { name: addressName(type) });
export const addressDialog = (page: Page, type: string) => page.getByRole("dialog", { name: addressName(type) });
export async function openContactEdit(page: Page) {
  await editButton(page).click();
  await field(page, "contacts.PHONE").waitFor();
}
export async function openAddressEdit(page: Page, type: string) {
  await addressEditButton(page, type).click();
  await field(page, `addresses.${type}.address_line`).waitFor();
  // The province list arrives from the Address module through the unit's API.
  await expect(page.locator(`[data-field="addresses.${type}.province_code"] [role="combobox"]`)).toBeEnabled();
}
export async function save(dialog: Locator) {
  await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
}

/** The custom listbox of a field: opens it, waits for the option and picks it. */
export async function choose(page: Page, id: string, option: string) {
  const trigger = page.locator(`[data-field="${id}"] [role="combobox"]`);
  await expect(trigger).toBeEnabled();
  const target = page.locator(`[id="${id}-options-list"]`).getByRole("option", { name: option, exact: true });
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!(await target.isVisible())) await trigger.click();
    try { await target.waitFor({ timeout: 2000 }); break; } catch { /* open it again */ }
  }
  await target.click();
  await expect(trigger).toContainText(option);
}
export async function fillAddress(page: Page, type: string, province: string, ward: string, line?: string) {
  await choose(page, `addresses.${type}.province_code`, province);
  await choose(page, `addresses.${type}.ward_code`, ward);
  if (line !== undefined) await field(page, `addresses.${type}.address_line`).fill(line);
}

/* ---- History: its own page since 27/10, a table filtered by kind and day ---- */

export const historyTable = (page: Page) => page.locator("table");
export const historyRows = (page: Page) => historyTable(page).locator("tbody tr");
export async function openHistory(page: Page, title: string) {
  await historyButton(page).click();
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
  await historyRows(page).first().waitFor();
}
/** "Loại liên hệ" / "Loại địa chỉ" of the history page. */
export async function filterKind(page: Page, label: string, option: string) {
  const trigger = page.getByRole("combobox", { name: label, exact: true });
  await trigger.click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(trigger).toContainText(option);
}
/** "Từ ngày" / "Đến ngày" of the history page. */
export async function pickDay(page: Page, label: string, iso: string) {
  await pickCalendarDay(page.getByRole("button", { name: label, exact: true }), iso);
}

export { expect };
