import { addDaysUtc, formatDateUtc, listDateRange, parseIsoDate, startOfUtcDay, startOfWeekSunday } from "./date.js";

export const RED_PALETTE = ["#161b22", "#3d0f0f", "#6b1a1a", "#a12c2c", "#d64545"] as const;

const CELL_SIZE = 10;
const CELL_GAP = 3;
const CELL_RADIUS = 2;
const LABEL_GUTTER_WIDTH = 28;
const HEADER_ROW_HEIGHT = 13;
const LABEL_COLOR = "#7d8590";
const LABEL_FONT =
  "-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif";

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC"
});

export interface ContributionCell {
  date: string;
  day: number;
  week: number;
  level: number;
  x: number;
  y: number;
}

export interface MonthLabel {
  date: string;
  text: string;
  week: number;
  x: number;
}

export interface RenderOptions {
  levelsByDate: Record<string, number>;
  minutesByDate?: Record<string, number>;
  endDate?: Date;
  palette?: readonly [string, string, string, string, string];
  title?: string;
}

function clampLevel(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 4) {
    return 4;
  }

  return Math.floor(value);
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function tooltipLabel(date: string, minutesByDate: Record<string, number> | undefined): string {
  const minutes = minutesByDate?.[date] ?? 0;
  if (minutes <= 0) {
    return `No activity on ${date}`;
  }

  if (minutes === 1) {
    return `1 minute of activity on ${date}`;
  }

  return `${minutes} minutes of activity on ${date}`;
}

function gridStartDate(endDate: Date): Date {
  const oneYearBack = addDaysUtc(startOfUtcDay(endDate), -364);
  return startOfWeekSunday(oneYearBack);
}

export function buildContributionGrid(
  levelsByDate: Record<string, number>,
  endDate: Date = new Date()
): ContributionCell[] {
  const normalizedEnd = startOfUtcDay(endDate);
  const start = gridStartDate(normalizedEnd);
  const dates = listDateRange(start, normalizedEnd);

  return dates.map((date, index) => {
    const week = Math.floor(index / 7);
    const day = date.getUTCDay();
    const dateKey = formatDateUtc(date);

    return {
      date: dateKey,
      day,
      week,
      level: clampLevel(levelsByDate[dateKey]),
      x: week * (CELL_SIZE + CELL_GAP),
      y: day * (CELL_SIZE + CELL_GAP)
    };
  });
}

export function buildMonthLabels(cells: ReadonlyArray<ContributionCell>): MonthLabel[] {
  if (cells.length === 0) {
    return [];
  }

  const seenMonths = new Set<string>();
  const labels: MonthLabel[] = [];

  for (let index = 0; index < cells.length; index += 7) {
    const cell = cells[index];
    if (!cell) {
      continue;
    }

    const date = parseIsoDate(cell.date);
    const yearMonth = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;

    if (seenMonths.has(yearMonth)) {
      continue;
    }

    seenMonths.add(yearMonth);
    labels.push({
      date: cell.date,
      text: MONTH_FORMATTER.format(date),
      week: cell.week,
      x: cell.x
    });
  }

  return labels;
}

export function renderContributionGraph(options: RenderOptions): string {
  const endDate = options.endDate ?? new Date();
  const palette = options.palette ?? RED_PALETTE;
  const title = options.title ?? "Fitness contributions";

  const cells = buildContributionGrid(options.levelsByDate, endDate);
  const monthLabels = buildMonthLabels(cells);

  const pitch = CELL_SIZE + CELL_GAP;
  const weeks = Math.max(...cells.map((cell) => cell.week), 0) + 1;
  const gridOffsetX = LABEL_GUTTER_WIDTH + CELL_GAP;
  const gridOffsetY = HEADER_ROW_HEIGHT + CELL_GAP;
  const gridWidth = weeks * pitch - CELL_GAP;
  const gridHeight = 7 * pitch - CELL_GAP;
  const contentWidth = gridOffsetX + gridWidth;
  const contentHeight = gridOffsetY + gridHeight;

  const marginTop = 14;
  const marginLeft = 12;
  const marginRight = 12;
  const marginBottom = 12;

  const width = marginLeft + contentWidth + marginRight;
  const height = marginTop + contentHeight + marginBottom;

  const weekdayLabels = [
    { text: "Mon", day: 1 },
    { text: "Wed", day: 3 },
    { text: "Fri", day: 5 }
  ];

  const monthText = monthLabels
    .map(
      (label) =>
        `<text class="month" x="${gridOffsetX + label.x}" y="10" fill="${LABEL_COLOR}" font-size="12" font-family="${LABEL_FONT}">${label.text}</text>`
    )
    .join("");

  const weekdayText = weekdayLabels
    .map(({ text, day }) => {
      const y = gridOffsetY + day * pitch + 8;
      return `<text class="wday" x="0" y="${y}" fill="${LABEL_COLOR}" font-size="12" font-family="${LABEL_FONT}">${text}</text>`;
    })
    .join("");

  const rects = cells
    .map((cell) => {
      const fill = palette[clampLevel(cell.level)] ?? palette[0];
      const tooltip = escapeXml(tooltipLabel(cell.date, options.minutesByDate));

      return `<rect class="day" width="${CELL_SIZE}" height="${CELL_SIZE}" x="${gridOffsetX + cell.x}" y="${gridOffsetY + cell.y}" rx="${CELL_RADIUS}" ry="${CELL_RADIUS}" data-date="${cell.date}" data-level="${cell.level}" fill="${fill}"><title>${tooltip}</title></rect>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="fithub-title"><title id="fithub-title">${escapeXml(title)}</title><desc>Daily workout intensity rendered like a GitHub contribution graph.</desc><rect width="100%" height="100%" fill="#0d1117"/><g transform="translate(${marginLeft},${marginTop})"><g>${monthText}</g><g>${weekdayText}</g><g>${rects}</g></g></svg>\n`;
}
