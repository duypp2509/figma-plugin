// Bundles the plugin: sandbox code to dist/code.js, and the UI script inlined into dist/ui.html
// (Figma loads the UI from a single HTML string, so it cannot reference a separate script file).
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../plugin");
const common = { bundle: true, target: "es2017", logLevel: "warning" };

await mkdir(path.join(root, "dist"), { recursive: true });
await build({ ...common, entryPoints: [path.join(root, "src/code.ts")], outfile: path.join(root, "dist/code.js") });

const ui = await build({ ...common, entryPoints: [path.join(root, "src/ui.ts")], format: "iife", write: false });
const script = ui.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = await readFile(path.join(root, "src/ui.html"), "utf8");
await writeFile(path.join(root, "dist/ui.html"), html.replace("/*__UI_SCRIPT__*/", () => script));

console.log("Đã build plugin vào plugin/dist — import plugin/manifest.json trong Figma desktop.");
