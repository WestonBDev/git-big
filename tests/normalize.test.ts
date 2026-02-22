import { describe, expect, it } from "vitest";

import {
  aggregateMinutesByDate,
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

  it("maps minute boundaries to the expected level", () => {
    expect(bucketMinutes(0)).toBe(0);
    expect(bucketMinutes(1)).toBe(1);
    expect(bucketMinutes(19)).toBe(1);
    expect(bucketMinutes(20)).toBe(2);
    expect(bucketMinutes(39)).toBe(2);
    expect(bucketMinutes(40)).toBe(3);
    expect(bucketMinutes(59)).toBe(3);
    expect(bucketMinutes(60)).toBe(4);
    expect(bucketMinutes(180)).toBe(4);
  });

  it("normalizes an aggregated map with custom thresholds", () => {
    expect(
      normalizeMinutesByDate(
        {
          "2026-02-16": 0,
          "2026-02-17": 15,
          "2026-02-18": 25,
          "2026-02-19": 45,
          "2026-02-20": 90
        },
        [1, 20, 40, 60]
      )
    ).toEqual({
      "2026-02-16": 0,
      "2026-02-17": 1,
      "2026-02-18": 2,
      "2026-02-19": 3,
      "2026-02-20": 4
    });
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
