// Turns a picture into the art the menu shows beside its title: capture/banner-art.ts as coloured
// characters, and capture/banner.png as a real image for terminals that can show one.
//
//   npx tsx scripts/make-banner.ts <picture.png> [columns]
//
// Each character cell holds four pixels, two by two, drawn with one of the quadrant block characters
// ("▘", "▚", "▙"…) in two colours: the pixels closest to one colour are the character, the rest its
// background. The picture's black surround is left out, so the terminal's own background shows through
// whatever its theme.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";

const [source, columnsArg] = process.argv.slice(2);
if (!source) {
  console.error("Cách dùng: npx tsx scripts/make-banner.ts <ảnh.png> [số cột, mặc định 44]");
  process.exit(1);
}
const columns = Number(columnsArg ?? 44);
/** A pixel this dark counts as the black surround when it is connected to the picture's edge. */
const DARK = 40;
/** Indexed by which pixels are the character: 1 upper left, 2 upper right, 4 lower left, 8 lower right. */
const QUADRANTS = [" ", "▘", "▝", "▀", "▖", "▌", "▞", "▛", "▗", "▚", "▐", "▜", "▄", "▙", "▟", "█"];

interface Pixel { r: number; g: number; b: number; dark: boolean }

const png = PNG.sync.read(await readFile(source));
const at = (x: number, y: number) => {
  const offset = (y * png.width + x) * 4;
  return [png.data[offset]!, png.data[offset + 1]!, png.data[offset + 2]!, png.data[offset + 3]!] as const;
};
const isDark = ([r, g, b, a]: readonly number[]) => a! < 128 || Math.max(r!, g!, b!) < DARK;

// Crop to what is drawn, so the surround does not take up columns.
let left = png.width, right = -1, top = png.height, bottom = -1;
for (let y = 0; y < png.height; y += 2) {
  for (let x = 0; x < png.width; x += 2) {
    if (isDark(at(x, y))) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
}
if (right < 0) throw new Error("Ảnh toàn màu đen.");
const cropWidth = right - left + 1;
const cropHeight = bottom - top + 1;
// A cell is twice as tall as it is wide.
const lineCount = Math.round(columns * cropHeight / cropWidth / 2);

/** The cropped picture at a given size, and which of its pixels are the surround. */
function sample(width: number, height: number): { pixels: Pixel[]; outside: boolean[] } {
// Each pixel is the average of the block of the picture it covers.
const pixels: Pixel[] = [];
for (let row = 0; row < height; row++) {
  for (let column = 0; column < width; column++) {
    const x0 = left + Math.floor(column * cropWidth / width), x1 = left + Math.floor((column + 1) * cropWidth / width);
    const y0 = top + Math.floor(row * cropHeight / height), y1 = top + Math.floor((row + 1) * cropHeight / height);
    let r = 0, g = 0, b = 0, count = 0, dark = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const pixel = at(x, y);
        if (isDark(pixel)) dark++;
        r += pixel[0]; g += pixel[1]; b += pixel[2]; count++;
      }
    }
    pixels.push({ r: r / count, g: g / count, b: b / count, dark: dark > count / 2 });
  }
}

// Only darkness that reaches the edge is surround; an eyelash or a microphone inside the figure stays.
const outside = new Array<boolean>(pixels.length).fill(false);
const queue: number[] = [];
const visit = (column: number, row: number) => {
  if (column < 0 || row < 0 || column >= width || row >= height) return;
  const index = row * width + column;
  if (outside[index] || !pixels[index]!.dark) return;
  outside[index] = true;
  queue.push(index);
};
for (let column = 0; column < width; column++) { visit(column, 0); visit(column, height - 1); }
for (let row = 0; row < height; row++) { visit(0, row); visit(width - 1, row); }
while (queue.length > 0) {
  const index = queue.pop()!;
  const column = index % width, row = Math.floor(index / width);
  visit(column - 1, row); visit(column + 1, row); visit(column, row - 1); visit(column, row + 1);
}
return { pixels, outside };
}

const width = columns * 2;
const { pixels, outside } = sample(width, lineCount * 2);

const mean = (group: Pixel[]) => ({
  r: Math.round(group.reduce((sum, pixel) => sum + pixel.r, 0) / group.length),
  g: Math.round(group.reduce((sum, pixel) => sum + pixel.g, 0) / group.length),
  b: Math.round(group.reduce((sum, pixel) => sum + pixel.b, 0) / group.length),
});
const spread = (group: Pixel[]) => {
  if (group.length === 0) return 0;
  const centre = mean(group);
  return group.reduce((sum, pixel) => sum + (pixel.r - centre.r) ** 2 + (pixel.g - centre.g) ** 2 + (pixel.b - centre.b) ** 2, 0);
};

interface Cell { mask: number; fg: ReturnType<typeof mean> | null; bg: ReturnType<typeof mean> | null }

/** Which of a cell's four pixels are the character and in which two colours, losing the least colour. */
function cellOf(column: number, line: number): Cell {
  const indexes = [0, 1, 2, 3].map((quadrant) => (line * 2 + (quadrant >> 1)) * width + column * 2 + (quadrant & 1));
  const inside = indexes.map((index) => !outside[index]);
  const drawn = inside.reduce((mask, isInside, quadrant) => mask | (isInside ? 1 << quadrant : 0), 0);
  if (drawn === 0) return { mask: 0, fg: null, bg: null };
  // Beside the surround the background has to stay the terminal's own, which leaves one colour.
  if (drawn !== 15) return { mask: drawn, fg: mean(indexes.filter((_, quadrant) => inside[quadrant]).map((index) => pixels[index]!)), bg: null };

  let best = { mask: 0, error: Infinity };
  // The lower right pixel is always background: a split and its mirror image look the same.
  for (let mask = 0; mask < 8; mask++) {
    const error = spread(indexes.filter((_, quadrant) => mask & (1 << quadrant)).map((index) => pixels[index]!))
      + spread(indexes.filter((_, quadrant) => !(mask & (1 << quadrant))).map((index) => pixels[index]!));
    if (error < best.error) best = { mask, error };
  }
  const character = indexes.filter((_, quadrant) => best.mask & (1 << quadrant)).map((index) => pixels[index]!);
  const background = indexes.filter((_, quadrant) => !(best.mask & (1 << quadrant))).map((index) => pixels[index]!);
  return { mask: best.mask, fg: character.length > 0 ? mean(character) : null, bg: mean(background) };
}

const cells: Cell[][] = [];
const lines: string[] = [];
for (let line = 0; line < lineCount; line++) {
  const row: Cell[] = [];
  let text = "";
  for (let column = 0; column < columns; column++) {
    const cell = cellOf(column, line);
    row.push(cell);
    text += "\x1b[0m";
    if (cell.fg) text += `\x1b[38;2;${cell.fg.r};${cell.fg.g};${cell.fg.b}m`;
    if (cell.bg) text += `\x1b[48;2;${cell.bg.r};${cell.bg.g};${cell.bg.b}m`;
    text += QUADRANTS[cell.mask];
  }
  cells.push(row);
  lines.push(`${text}\x1b[0m`);
}

const target = path.resolve(import.meta.dirname, "../capture/banner-art.ts");
await writeFile(target, [
  "// Generated by scripts/make-banner.ts from a picture; do not edit by hand.",
  `export const BANNER_ART_WIDTH = ${columns};`,
  `export const BANNER_ART: readonly string[] = ${JSON.stringify(lines, null, 2)};`,
  "",
].join("\n"));

// The same picture as a real image, for terminals that can show one (see printBanner). Sized for the
// cells it covers at 16 px a column, which stays sharp on a high-density screen.
const imageWidth = columns * 16, imageHeight = lineCount * 32;
const full = sample(imageWidth, imageHeight);
const image = new PNG({ width: imageWidth, height: imageHeight });
full.pixels.forEach((pixel, index) => {
  image.data.set([Math.round(pixel.r), Math.round(pixel.g), Math.round(pixel.b), full.outside[index] ? 0 : 255], index * 4);
});
await writeFile(path.resolve(import.meta.dirname, "../capture/banner.png"), PNG.sync.write(image));

// FFC_BANNER_PREVIEW=<file.png> also draws the cells as a terminal would, to look at without one.
if (process.env.FFC_BANNER_PREVIEW) {
  const cellWidth = 10, cellHeight = 20;
  const preview = new PNG({ width: columns * cellWidth, height: lineCount * cellHeight });
  for (let y = 0; y < preview.height; y++) {
    for (let x = 0; x < preview.width; x++) {
      const cell = cells[Math.floor(y / cellHeight)]![Math.floor(x / cellWidth)]!;
      const quadrant = (y % cellHeight >= cellHeight / 2 ? 2 : 0) + (x % cellWidth >= cellWidth / 2 ? 1 : 0);
      const colour = (cell.mask & (1 << quadrant) ? cell.fg : cell.bg) ?? { r: 24, g: 24, b: 24 };
      preview.data.set([colour.r, colour.g, colour.b, 255], (y * preview.width + x) * 4);
    }
  }
  await writeFile(process.env.FFC_BANNER_PREVIEW, PNG.sync.write(preview));
}
console.log(`Đã ghi ${path.relative(process.cwd(), target)}: ${columns} cột × ${lineCount} dòng.`);
