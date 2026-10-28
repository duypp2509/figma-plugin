import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";

/** Wide enough for the largest card on a 2× screen. */
const WIDTH = 800;
/** Cards show the top of a screen at 16:10, so only that part is kept. */
const HEIGHT = 500;

const pending = new Map<string, Promise<string>>();

/**
 * A small copy of the top of a picture, for the cards. A full 2880 px screenshot costs the browser 20 MB
 * or more once decoded, and every flow browsed would add its pictures to that.
 * Kept under `<cacheDir>/<folder>/`, named after the picture's version so a new capture gets a new copy.
 */
export function thumbnail(source: string, cacheDir: string, folder: string, version: string): Promise<string> {
  const base = path.basename(source, ".png");
  const target = path.join(cacheDir, folder, `${base}.${version}.png`);
  let job = pending.get(target);
  if (!job) {
    job = build(source, target, base).finally(() => pending.delete(target));
    pending.set(target, job);
  }
  return job;
}

async function build(source: string, target: string, base: string): Promise<string> {
  if (await stat(target).then(() => true, () => false)) return target;
  const image = PNG.sync.read(await readFile(source));
  const scale = image.width / WIDTH;
  const height = Math.min(HEIGHT, Math.floor(image.height / scale));
  const out = new PNG({ width: WIDTH, height });
  // Area average: each target pixel is the mean of the source pixels it covers.
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor(y * scale);
    const y1 = Math.max(y0 + 1, Math.min(image.height, Math.floor((y + 1) * scale)));
    for (let x = 0; x < WIDTH; x += 1) {
      const x0 = Math.floor(x * scale);
      const x1 = Math.max(x0 + 1, Math.min(image.width, Math.floor((x + 1) * scale)));
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        let index = (sy * image.width + x0) * 4;
        for (let sx = x0; sx < x1; sx += 1, index += 4) {
          r += image.data[index]!;
          g += image.data[index + 1]!;
          b += image.data[index + 2]!;
          a += image.data[index + 3]!;
        }
      }
      const count = (y1 - y0) * (x1 - x0);
      const index = (y * WIDTH + x) * 4;
      out.data[index] = r / count;
      out.data[index + 1] = g / count;
      out.data[index + 2] = b / count;
      out.data[index + 3] = a / count;
    }
  }
  const directory = path.dirname(target);
  await mkdir(directory, { recursive: true });
  // Copies of earlier versions of the same picture are of no use any more.
  for (const file of await readdir(directory).catch(() => [] as string[])) {
    if (file.startsWith(`${base}.`) && path.join(directory, file) !== target) await rm(path.join(directory, file), { force: true });
  }
  await writeFile(target, PNG.sync.write(out));
  return target;
}
