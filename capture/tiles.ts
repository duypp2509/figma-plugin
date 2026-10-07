import { PNG } from "pngjs";
import { MAX_TILE_PX } from "../shared/types";

export interface Tile {
  x: number;
  y: number;
  width: number;
  height: number;
  data: Buffer;
}

export interface SlicedImage {
  width: number;
  height: number;
  tiles: Tile[];
}

/** Reads the size from the PNG header, without decoding the pixels. */
export function pngSize(png: Buffer): { width: number; height: number } {
  if (png.length < 24 || png.toString("ascii", 12, 16) !== "IHDR") throw new Error("Ảnh không phải PNG hợp lệ.");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/**
 * Figma refuses images above 4096 px on a side, so a tall full-page screenshot is cut into a grid of
 * tiles that the plugin lays back together. An image that already fits is passed through untouched.
 */
export function sliceImage(png: Buffer, maxSide = MAX_TILE_PX): SlicedImage {
  const { width, height } = pngSize(png);
  if (width <= maxSide && height <= maxSide) {
    return { width, height, tiles: [{ x: 0, y: 0, width, height, data: png }] };
  }

  const source = PNG.sync.read(png);
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y += maxSide) {
    for (let x = 0; x < width; x += maxSide) {
      const tileWidth = Math.min(maxSide, width - x);
      const tileHeight = Math.min(maxSide, height - y);
      const tile = new PNG({ width: tileWidth, height: tileHeight });
      PNG.bitblt(source, tile, x, y, tileWidth, tileHeight, 0, 0);
      tiles.push({ x, y, width: tileWidth, height: tileHeight, data: PNG.sync.write(tile) });
    }
  }
  return { width, height, tiles };
}
