import { describe, expect, it } from "vitest";

import { parseEndDate, parseThresholds } from "../src/index.js";

describe("index config parsing", () => {
  it("defaults to current UTC day when unset", () => {
    const parsed = parseEndDate(undefined);
    expect(parsed.getUTCHours()).toBe(0);
    expect(parsed.getUTCMinutes()).toBe(0);
    expect(parsed.getUTCSeconds()).toBe(0);
    expect(parsed.getUTCMilliseconds()).toBe(0);
  });

  it("parses explicit end date as UTC midnight", () => {
    const parsed = parseEndDate("2026-02-19");
    expect(parsed.toISOString()).toBe("2026-02-19T00:00:00.000Z");
  });

  it("throws for invalid end date", () => {
    expect(() => parseEndDate("not-a-date")).toThrowError(
      "Invalid GITBIG_END_DATE value: not-a-date"
    );
  });
});

describe("parseThresholds", () => {
  it("returns undefined when unset", () => {
    expect(parseThresholds(undefined)).toBeUndefined();
    expect(parseThresholds("")).toBeUndefined();
  });

  it("parses valid thresholds into IntensityBoundaries", () => {
    expect(parseThresholds("1,20,40,60")).toEqual([0, 1, 20, 40, 60]);
  });

  it("trims whitespace around values", () => {
    expect(parseThresholds(" 1 , 20 , 40 , 60 ")).toEqual([0, 1, 20, 40, 60]);
  });

  it("throws for wrong number of values", () => {
    expect(() => parseThresholds("1,20,40")).toThrowError("expected 4 comma-separated numbers");
    expect(() => parseThresholds("1,20,40,60,80")).toThrowError("expected 4 comma-separated numbers");
  });

  it("throws for non-numeric values", () => {
    expect(() => parseThresholds("a,b,c,d")).toThrowError("expected 4 comma-separated numbers");
  });

  it("throws for negative values", () => {
    expect(() => parseThresholds("1,-20,40,60")).toThrowError("expected 4 comma-separated numbers");
  });
});
