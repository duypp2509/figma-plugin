import { defineConfig } from "./capture";

// Shared settings only. A flow lives in its own file under flows/.
export default defineConfig({
  apps: {
    supership: { baseUrl: process.env.SUPERSHIP_URL ?? "http://localhost:3001", label: "SuperShip" },
    superplatform: { baseUrl: process.env.SUPERPLATFORM_URL ?? "http://localhost:3000", label: "SuperPlatform" },
  },
  viewports: {
    desktop: { width: 1440, height: 900 },
    mobile: { width: 390, height: 844, isMobile: true },
  },
  defaultViewport: "desktop",
  deviceScaleFactor: 2,
  // Dev-only overlays of the two apps. They are hidden only while a picture is taken, so a flow can
  // still click them.
  hide: [
    // FigmaCaptureButton and DebugLogPanel (features/dev-tools).
    "[data-figma-capture-exclude]",
    "#__figma_capture_toolbar_host__",
    // DevSeedAccounts on /login.
    'role=button[name="Tài khoản test"]',
    // Dev autofill on /register.
    'role=button[name="Tự điền dữ liệu mẫu"]',
    // Next.js dev indicator.
    "nextjs-portal",
  ],
  blockUrls: ["**://mcp.figma.com/**"],
  // Distances on the Figma canvas, in pixels. "headroom" keeps a Section's name clear of the frame names
  // under it; "colorFrom: 2" colours the outermost Section with "Section 2", the next one in "Section 3"…
  layout: { gap: 320, padding: 240, headroom: 200, rowGap: 400, sectionGap: 800, arrows: false, colorFrom: 2 },
});
