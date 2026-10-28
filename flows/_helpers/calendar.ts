import type { Locator } from "playwright";

/*
 * The console's shared calendar (CalendarPicker, since 27/10): a button that opens a popover panel, linked through
 * aria-controls, with a typed "Ngày" field (dd/mm/yyyy) and "Áp dụng". Typing the day avoids walking years and months.
 */

/** Opens the calendar of `trigger`, types the day (yyyy-mm-dd) and applies it. */
export async function pickCalendarDay(trigger: Locator, iso: string) {
  const [year, month, day] = iso.split("-");
  await trigger.click();
  const panelId = await trigger.getAttribute("aria-controls");
  const panel = trigger.page().locator(`[id="${panelId}"]`);
  await panel.getByRole("textbox", { name: "Ngày", exact: true }).fill(`${day}/${month}/${year}`);
  await panel.getByRole("button", { name: "Áp dụng", exact: true }).click();
  await panel.waitFor({ state: "hidden" });
}
