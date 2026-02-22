import { describe, expect, it } from "vitest";

import {
  LIGHT_RED_PALETTE,
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
    expect(cells[cells.length - 1]?.date).toBe("2026-02-21");
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
    const cells = buildContributionGrid({}, new Date("2026-02-22T00:00:00Z"));
    const labels = buildMonthLabels(cells);

    for (let index = 1; index < labels.length; index += 1) {
      const previous = labels[index - 1];
      const current = labels[index];

      expect(current?.x).toBeGreaterThanOrEqual((previous?.x ?? 0) + 28);
    }
  });

  it("skips cramped leading month labels at year boundary", () => {
    const cells = buildContributionGrid({}, new Date("2026-02-22T00:00:00Z"));
    const labels = buildMonthLabels(cells);
    const monthTexts = labels.map((label) => label.text);

    expect(monthTexts[0]).toBe("Mar");
    expect(monthTexts[1]).toBe("Apr");
  });

  it("renders full trailing week through saturday", () => {
    const cells = buildContributionGrid({}, new Date("2026-02-22T00:00:00Z"));
    const lastWeek = Math.max(...cells.map((cell) => cell.week));
    const trailingWeek = cells.filter((cell) => cell.week === lastWeek);

    expect(trailingWeek.length).toBe(7);
    expect(trailingWeek[0]?.date).toBe("2026-02-22");
    expect(trailingWeek[trailingWeek.length - 1]?.date).toBe("2026-02-28");
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

    const weekdayMatches = [...svg.matchAll(/<text class="wday" x="([^"]+)"/g)];

    expect(weekdayMatches.length).toBe(3);
    for (const match of weekdayMatches) {
      expect(Number(match[1])).toBeGreaterThanOrEqual(0);
    }
  });

  it("renders github-style card chrome and footer legend", () => {
    const svg = renderContributionGraph({
      levelsByDate: {},
      endDate
    });

    expect(svg).toContain('class="card"');
    expect(svg).toContain("Contribution settings");
    expect(svg).toContain('class="help-link"');
    expect(svg).toContain('class="legend-less"');
    expect(svg).toContain('class="legend-more"');
    expect(svg.match(/class="legend-swatch"/g)?.length).toBe(5);
  });

  it("renders light theme styles for github light mode", () => {
    const svg = renderContributionGraph({
      levelsByDate: {
        "2026-02-18": 4
      },
      endDate,
      theme: "light",
      palette: LIGHT_RED_PALETTE
    });

    expect(svg).not.toContain('<rect width="100%" height="100%"');
    expect(svg).toContain('fill="#57606a"');

    const intenseDayMatch = svg.match(
      /<rect[^>]*data-date="2026-02-18"[^>]*fill="([^"]+)"/
    );
    expect(intenseDayMatch?.[1]).toBe("#cf222e");
  });

  it("uses transparent background for both light and dark themes", () => {
    const darkSvg = renderContributionGraph({
      levelsByDate: {},
      endDate,
      theme: "dark"
    });
    const lightSvg = renderContributionGraph({
      levelsByDate: {},
      endDate,
      theme: "light"
    });

    expect(darkSvg).not.toContain('<rect width="100%" height="100%"');
    expect(lightSvg).not.toContain('<rect width="100%" height="100%"');
  });

  it("renders a yearly activity summary header", () => {
    const svg = renderContributionGraph({
      levelsByDate: {},
      minutesByDate: {
        "2026-02-18": 120,
        "2026-02-17": 30
      },
      endDate
    });

    expect(svg).toContain('class="summary"');
    expect(svg).toContain("150 active minutes in the last year");
  });

  it("includes workout count in summary when available", () => {
    const svg = renderContributionGraph({
      levelsByDate: {},
      minutesByDate: {
        "2026-02-18": 1250
      },
      sessionCount: 34,
      endDate
    });

    expect(svg).toContain("34 workouts in the last year");
    expect(svg).not.toContain("active minutes in the last year");
  });

  it("uses singular workout noun when session count is one", () => {
    const svg = renderContributionGraph({
      levelsByDate: {},
      minutesByDate: {
        "2026-02-18": 75
      },
      sessionCount: 1,
      endDate
    });

    expect(svg).toContain("1 workout in the last year");
  });
});
