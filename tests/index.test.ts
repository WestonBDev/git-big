import { describe, expect, it } from "vitest";

import { parseEndDate } from "../src/index.js";

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
      "Invalid FITHUB_END_DATE value: not-a-date"
    );
  });
});
