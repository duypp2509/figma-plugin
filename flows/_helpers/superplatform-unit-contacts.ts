import type { Locator, Page } from "playwright";
import { expect } from "playwright/test";
import { unitFlow, unitUrl } from "./superplatform-unit-profile";

/*
 * "Liên hệ" and "Địa chỉ" of an internal unit (/workspace/organizations/{id}?section=contacts|addresses), on the
 * same in-browser backend as the profile flows (superplatform-unit-profile.ts).
 */

export const contactFlow = (options: Parameters<typeof unitFlow>[1]) => unitFlow("lien-he", options);
export const addressFlow = (options: Parameters<typeof unitFlow>[1]) => unitFlow("dia-chi", options);

export const field = (page: Page, id: string) => page.locator(`[id="${id}"]`);
export const editButton = (page: Page) => page.locator("section.ui-panel").getByRole("button", { name: "Sửa", exact: true });
export const historyButton = (page: Page) => page.getByRole("button", { name: "Xem lịch sử", exact: true });

/** "Liên hệ" or "Địa chỉ" of a unit, loaded. */
export async function openSection(page: Page, id: string, section: "contacts" | "addresses") {
  await page.goto(unitUrl(id, section));
  await page.getByRole("heading", { name: section === "contacts" ? "Liên hệ" : "Địa chỉ", exact: true }).waitFor();
  await historyButton(page).waitFor();
  await page.locator(".organization-sidebar .organization-sidebar-identity").waitFor();
}

export const contactDialog = (page: Page) => page.getByRole("dialog", { name: "Sửa liên hệ" });
export const addressDialog = (page: Page) => page.getByRole("dialog", { name: "Sửa địa chỉ" });
export async function openContactEdit(page: Page) {
  await editButton(page).click();
  await field(page, "contacts.PHONE").waitFor();
}
export async function openAddressEdit(page: Page, type: string) {
  await editButton(page).click();
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

/* ---- History ---- */

export const historyDialog = (page: Page, title: string) => page.getByRole("dialog", { name: title });
export async function openHistory(page: Page, title: string) {
  await historyButton(page).click();
  await historyDialog(page, title).locator("ol li").first().waitFor();
}
/** "Loại" of the history dialog. */
export async function filterKind(dialog: Locator, option: string) {
  await dialog.getByRole("combobox").first().click();
  await dialog.page().getByRole("option", { name: option, exact: true }).click();
  await expect(dialog.getByRole("combobox").first()).toContainText(option);
}
/** Picks a day (yyyy-mm-dd) in the shared calendar opened from the picker named `label`. */
export async function pickDay(dialog: Locator, label: string, iso: string) {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  const trigger = dialog.getByLabel(label, { exact: true });
  await trigger.click();
  const calendar = dialog.getByRole("dialog", { name: "Lịch chọn ngày" });
  await calendar.waitFor();
  await calendar.getByRole("button", { name: "Chọn năm" }).click();
  await calendar.getByRole("group", { name: "Danh sách năm" }).getByRole("button", { name: String(year), exact: true }).click();
  await calendar.getByRole("button", { name: "Chọn tháng" }).click();
  await calendar.getByRole("group", { name: "Danh sách tháng" }).getByRole("button", { name: `Tháng ${month}`, exact: true }).click();
  const days = calendar.getByRole("button", { name: String(day), exact: true });
  await (day < 15 ? days.first() : days.last()).click();
  await calendar.waitFor({ state: "hidden" });
}

export { expect };
