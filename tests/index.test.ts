import { describe, expect, it } from "vitest";

import { parseEndDate, parseThresholds } from "../src/index.js";
import { DEFAULT_THRESHOLDS } from "../src/normalize.js";

describe("index config parsing", () => {
  it("parses explicit end date as UTC midnight", () => {
    const parsed = parseEndDate("2026-02-19");
    expect(parsed.toISOString()).toBe("2026-02-19T00:00:00.000Z");
  });

  it("throws for invalid end date", () => {
    expect(() => parseEndDate("not-a-date")).toThrowError(
      "Invalid FITHUB_END_DATE value: not-a-date"
    );
  });

  it("uses default thresholds when env value is empty", () => {
    expect(parseThresholds(undefined)).toEqual(DEFAULT_THRESHOLDS);
    expect(parseThresholds("")).toEqual(DEFAULT_THRESHOLDS);
  });

  it("parses custom thresholds", () => {
    expect(parseThresholds("5,15,35,55")).toEqual([5, 15, 35, 55]);
  });

  it("rejects invalid threshold count", () => {
    expect(() => parseThresholds("1,20,40")).toThrowError(
      "Invalid FITHUB_THRESHOLDS value: 1,20,40. Expected 4 comma-separated integers."
    );
  });

  it("rejects non-ascending thresholds", () => {
    expect(() => parseThresholds("1,20,20,60")).toThrowError(
      "Invalid FITHUB_THRESHOLDS value: 1,20,20,60. Thresholds must be strictly ascending."
    );
  });
});
