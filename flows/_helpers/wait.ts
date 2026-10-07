import type { Locator, Page } from "playwright";

/** Waits until a control can be used, e.g. a submit button that unlocks once the captcha passes. */
export async function waitEnabled(locator: Locator, timeoutMs = 20_000): Promise<void> {
  await locator.waitFor({ state: "visible", timeout: timeoutMs });
  const deadline = Date.now() + timeoutMs;
  while (!(await locator.isEnabled())) {
    if (Date.now() > deadline) throw new Error(`Phần tử vẫn bị khóa sau ${timeoutMs / 1000} giây: ${locator}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * Stops the page's clock where it is, while timers keep running. A countdown computed from the
 * current time then shows the same value on every run.
 */
export async function freezeTime(page: Page, at: Date = new Date()): Promise<void> {
  await page.clock.setFixedTime(at);
}
