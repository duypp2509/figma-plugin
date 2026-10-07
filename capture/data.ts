import { randomInt } from "node:crypto";

const MOBILE_PREFIXES = ["032", "033", "034", "035", "036", "037", "038", "039", "070", "077", "079", "081", "082", "083", "084", "085", "086", "088", "090", "091", "093", "094", "096", "097", "098"];

/** Generic random data for flows that create records, so a run never collides with an earlier one. */
export const data = {
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("pick() cần ít nhất một phần tử.");
    return items[randomInt(items.length)]!;
  },
  digits(length: number): string {
    return Array.from({ length }, () => randomInt(10)).join("");
  },
  /** A Vietnamese mobile number that passes the usual prefix validation. */
  phone(): string {
    return `${data.pick(MOBILE_PREFIXES)}${data.digits(7)}`;
  },
  email(prefix = "capture"): string {
    return `${prefix}${data.digits(8)}@example.com`;
  },
};

export type DataHelpers = typeof data;
