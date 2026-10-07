import type { Page } from "playwright";

/** Cloudflare's published sitekey for testing: a visible widget that always passes. */
const TEST_SITEKEY = "1x00000000000000000000AA";

/**
 * Lets an automated browser get past the app's captcha, for flows whose backend calls are mocked
 * (a real backend rejects the tokens this produces).
 *
 * - "visible" (default): Cloudflare's real widget is loaded, but made to use the testing sitekey instead
 *   of the app's real one. It draws itself in its solved state, so the captcha box is in the pictures.
 * - "hidden": the widget is replaced by a stand-in that only hands out a token, the way
 *   UI Screenshots/otp-channel-review/check-otp.cjs does. Nothing is drawn; works without network.
 */
export async function mockTurnstile(page: Page, mode: "visible" | "hidden" = "visible"): Promise<void> {
  if (mode === "visible") {
    // With the testing sitekey Cloudflare lays a red "Chỉ để kiểm tra…" strip over the widget, which no
    // real visitor ever sees. This runs inside the widget's own frame and hides that strip alone, so the
    // picture shows the solved widget as it looks in production.
    await page.context().addInitScript(`
      (() => {
        if (!location.hostname.endsWith("challenges.cloudflare.com")) return;
        const strip = /Chỉ để kiểm tra|Testing only/i;
        const hide = (root) => {
          for (const element of root.querySelectorAll("*")) {
            if (element.childElementCount === 0 && strip.test(element.textContent || "")) element.style.setProperty("display", "none", "important");
          }
        };
        const attach = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function (init) {
          const root = attach.call(this, init);
          new MutationObserver(() => hide(root)).observe(root, { childList: true, subtree: true, characterData: true });
          return root;
        };
      })();
    `);
  }

  await page.route("**/challenges.cloudflare.com/turnstile/v0/api.js*", async (route) => {
    if (mode === "hidden") {
      const callback = new URL(route.request().url()).searchParams.get("onload");
      return route.fulfill({
        contentType: "application/javascript",
        body: `
          (() => {
            // Like the real widget, a reset runs the challenge again and hands out a fresh token.
            const widgets = new Map();
            let count = 0;
            const solve = (id) => setTimeout(() => widgets.get(id)?.callback?.("capture-token-" + Date.now()), 0);
            // The real widget leaves its token in a hidden field; the capture tool waits for that field.
            const field = (element) => {
              const target = typeof element === "string" ? document.querySelector(element) : element;
              if (!target) return;
              const input = document.createElement("input");
              input.type = "hidden"; input.name = "cf-turnstile-response"; input.value = "capture-token";
              target.appendChild(input);
            };
            window.turnstile = {
              render: (element, options) => { const id = "capture-widget-" + (++count); widgets.set(id, options); field(element); solve(id); return id; },
              reset: (id) => { if (id === undefined) widgets.forEach((_, key) => solve(key)); else solve(id); },
              remove: (id) => { widgets.delete(id); },
              getResponse: () => "capture-token", isExpired: () => false
            };
          })();
          window[${JSON.stringify(callback)}]?.();
        `,
      });
    }

    // (The testing banner is taken care of by the init script added below.)
    // Make the real script's render() use the testing sitekey. The script must find no `turnstile` on the
    // page when it starts (it refuses to load twice), so the wrapping happens once it has published its
    // API: just before the app's "loaded" callback runs, and again right after the script body.
    const response = await route.fetch();
    const onload = new URL(route.request().url()).searchParams.get("onload");
    const wrap = `
      window.__captureWrapTurnstile = () => {
        const api = window.turnstile;
        if (!api || api.__captureWrapped || typeof api.render !== "function") return;
        const render = api.render.bind(api);
        api.render = (element, options) => render(element, Object.assign({}, options, { sitekey: ${JSON.stringify(TEST_SITEKEY)} }));
        api.__captureWrapped = true;
      };
      (() => {
        const name = ${JSON.stringify(onload)};
        const loaded = name && window[name];
        if (typeof loaded === "function") window[name] = function () { window.__captureWrapTurnstile(); return loaded.apply(this, arguments); };
      })();
    `;
    await route.fulfill({ response, body: `${wrap}\n${await response.text()}\n;window.__captureWrapTurnstile();` });
  });
}
