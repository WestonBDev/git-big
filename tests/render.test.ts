import { describe, expect, it } from "vitest";

import {
  RED_PALETTE,
  buildContributionGrid,
  buildMonthLabels,
  renderContributionGraph
} from "../src/render.js";

describe("render", () => {
  const endDate = new Date("2026-02-19T00:00:00Z");

  it("builds a 53-week grid aligned to Sunday", () => {
    const cells = buildContributionGrid({}, endDate);

    expect(cells.length).toBeGreaterThanOrEqual(365);
    expect(cells.length).toBeLessThanOrEqual(371);
    expect(cells[0]?.day).toBe(0);
    expect(cells[cells.length - 1]?.date).toBe("2026-02-19");
    expect(new Set(cells.map((cell: { week: number }) => cell.week)).size).toBe(53);
  });

  it("creates month labels from first-of-month boundaries", () => {
    const cells = buildContributionGrid({}, endDate);
    const labels = buildMonthLabels(cells);

    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some((label: { text: string }) => label.text === "Jan")).toBe(true);
    expect(labels.some((label: { text: string }) => label.text === "Feb")).toBe(true);
  });

  it("keeps adjacent month labels visually separated", () => {
    const cells = buildContributionGrid({}, new Date("2026-02-19T00:00:00Z"));
    const labels = buildMonthLabels(cells);

    for (let index = 1; index < labels.length; index += 1) {
      const previous = labels[index - 1];
      const current = labels[index];

      expect(current?.x).toBeGreaterThan((previous?.x ?? 0) + 20);
    }
  });

  it("renders valid svg with level-based fill colors", () => {
    const svg = renderContributionGraph({
      levelsByDate: {
        "2026-02-18": 4,
        "2026-02-17": 2
      },
      endDate,
      palette: RED_PALETTE
    });

    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>\n")).toBe(true);
    expect(svg).toContain("<title>");
    expect(svg).toContain("Fitness contributions");
    expect(svg).toContain('data-date="2026-02-18"');

    const intenseDayMatch = svg.match(
      /<rect[^>]*data-date="2026-02-18"[^>]*fill="([^"]+)"/
    );
    expect(intenseDayMatch?.[1]).toBe("#d64545");

    const mediumDayMatch = svg.match(
      /<rect[^>]*data-date="2026-02-17"[^>]*fill="([^"]+)"/
    );
    expect(mediumDayMatch?.[1]).toBe("#6b1a1a");
  });

  it("renders weekday labels in a dedicated left gutter", () => {
    const svg = renderContributionGraph({
      levelsByDate: {},
      endDate
    });

    expect(svg).toContain('<text class="wday" x="0"');
    expect(svg).not.toContain('<text class="wday" x="-14"');
  });
});
