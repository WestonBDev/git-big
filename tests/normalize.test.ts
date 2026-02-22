import { describe, expect, it } from "vitest";

import {
  aggregateMinutesByDate,
  deriveIntensityBoundaries,
  bucketMinutes,
  fillDateRange,
  normalizeMinutesByDate
} from "../src/normalize.js";

describe("normalize", () => {
  it("aggregates moving time by calendar date", () => {
    const activities = [
      { start_date_local: "2026-02-18T06:20:00Z", moving_time: 1_200 },
      { start_date_local: "2026-02-18T18:45:00Z", moving_time: 1_800 },
      { start_date_local: "2026-02-17T08:00:00Z", moving_time: 600 }
    ];

    expect(aggregateMinutesByDate(activities)).toEqual({
      "2026-02-17": 10,
      "2026-02-18": 50
    });
  });

  it("derives github-like quartile boundaries from score distribution", () => {
    const boundaries = deriveIntensityBoundaries([0, 1, 2, 3, 4, 8]);
    expect(boundaries).toEqual([0, 2, 4, 6, 8]);
  });

  it("maps minutes to levels using derived boundaries", () => {
    const boundaries = deriveIntensityBoundaries([0, 1, 2, 3, 4, 8]);

    expect(bucketMinutes(0, boundaries)).toBe(0);
    expect(bucketMinutes(1, boundaries)).toBe(1);
    expect(bucketMinutes(2, boundaries)).toBe(1);
    expect(bucketMinutes(3, boundaries)).toBe(2);
    expect(bucketMinutes(4, boundaries)).toBe(2);
    expect(bucketMinutes(8, boundaries)).toBe(4);
  });

  it("normalizes an aggregated map with relative intensity levels", () => {
    expect(normalizeMinutesByDate({
      "2026-02-16": 0,
      "2026-02-17": 1,
      "2026-02-18": 2,
      "2026-02-19": 3,
      "2026-02-20": 4,
      "2026-02-21": 8
    })).toEqual({
      "2026-02-16": 0,
      "2026-02-17": 1,
      "2026-02-18": 1,
      "2026-02-19": 2,
      "2026-02-20": 2,
      "2026-02-21": 4
    });
  });

  it("keeps zeros at level 0 when all days are inactive", () => {
    expect(
      normalizeMinutesByDate({
        "2026-02-16": 0,
        "2026-02-17": 0,
        "2026-02-18": 0
      })
    ).toEqual({
      "2026-02-16": 0,
      "2026-02-17": 0,
      "2026-02-18": 0
    });
  });

  it("reduces outlier skew using github-style outlier handling", () => {
    const scores = [
      ...Array.from({ length: 300 }, () => 0),
      1,
      2,
      3,
      4,
      1000
    ];
    const boundaries = deriveIntensityBoundaries(scores);

    expect(boundaries).toEqual([0, 1, 2, 3, 1000]);
    expect(bucketMinutes(4, boundaries)).toBe(4);
    expect(bucketMinutes(1000, boundaries)).toBe(4);
  });

  it("fills missing days including leap day", () => {
    expect(
      fillDateRange(
        {
          "2024-02-28": 2
        },
        new Date("2024-02-28T00:00:00Z"),
        new Date("2024-03-01T00:00:00Z")
      )
    ).toEqual({
      "2024-02-28": 2,
      "2024-02-29": 0,
      "2024-03-01": 0
    });
  });
});
