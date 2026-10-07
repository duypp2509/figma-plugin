import { PNG } from "pngjs";

/**
 * A flat colour with a darker band every 500 px and a stripe down the left edge whose length grows
 * with the row, so a tile laid in the wrong place or order is visible at a glance.
 */
export function makeTestImage(width: number, height: number, [r, g, b]: [number, number, number]): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    const band = y % 500 < 12;
    const stripe = Math.round((y / height) * width);
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const dark = band || x < 24 || x >= width - 24 || y < 24 || y >= height - 24 || Math.abs(x - stripe) < 6;
      png.data[offset] = dark ? r >> 1 : r;
      png.data[offset + 1] = dark ? g >> 1 : g;
      png.data[offset + 2] = dark ? b >> 1 : b;
      png.data[offset + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}
