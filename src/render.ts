import {
  addDaysUtc,
  endOfWeekSaturday,
  formatDateUtc,
  listDateRange,
  parseIsoDate,
  startOfUtcDay,
  startOfWeekSunday
} from "./date.js";

export const RED_PALETTE = ["#161b22", "#3d0f0f", "#6b1a1a", "#a12c2c", "#d64545"] as const;
export const LIGHT_RED_PALETTE = ["#ebedf0", "#ffebe9", "#ffcecb", "#ffaba8", "#cf222e"] as const;
export type GraphTheme = "dark" | "light";

const CELL_SIZE = 10;
const CELL_GAP = 3;
const CELL_RADIUS = 2;
const LABEL_GUTTER_WIDTH = 28;
const HEADER_ROW_HEIGHT = 13;
const SUMMARY_ROW_HEIGHT = 24;
const LABEL_FONT =
  "-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif";
const MIN_MONTH_LABEL_SPACING = 28;
const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");

const THEME_STYLE = {
  dark: {
    labelColor: "#7d8590",
    palette: RED_PALETTE
  },
  light: {
    labelColor: "#57606a",
    palette: LIGHT_RED_PALETTE
  }
} as const;

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
  sessionCount?: number;
  endDate?: Date;
  theme?: GraphTheme;
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

function yearlySummaryText(
  minutesByDate: Record<string, number> | undefined,
  sessionCount: number | undefined
): string {
  if (typeof sessionCount === "number" && Number.isFinite(sessionCount) && sessionCount >= 0) {
    const normalizedSessions = Math.floor(sessionCount);
    const sessionWord = normalizedSessions === 1 ? "workout" : "workouts";
    return `${NUMBER_FORMATTER.format(normalizedSessions)} ${sessionWord} in the last year`;
  }

  const totalMinutes = Object.values(minutesByDate ?? {}).reduce((sum, value) => {
    if (!Number.isFinite(value) || value <= 0) {
      return sum;
    }

    return sum + Math.floor(value);
  }, 0);
  const formattedMinutes = NUMBER_FORMATTER.format(totalMinutes);
  const minuteWord = totalMinutes === 1 ? "minute" : "minutes";

  return `${formattedMinutes} active ${minuteWord} in the last year`;
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
  const renderEnd = endOfWeekSaturday(normalizedEnd);
  const dates = listDateRange(start, renderEnd);

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
    const nextLabel = {
      date: cell.date,
      text: MONTH_FORMATTER.format(date),
      week: cell.week,
      x: cell.x
    };

    const lastLabel = labels[labels.length - 1];
    if (lastLabel && nextLabel.x - lastLabel.x < MIN_MONTH_LABEL_SPACING) {
      nextLabel.x = lastLabel.x + MIN_MONTH_LABEL_SPACING;
    }

    labels.push(nextLabel);
  }

  return labels;
}

export function renderContributionGraph(options: RenderOptions): string {
  const endDate = options.endDate ?? new Date();
  const theme = options.theme ?? "dark";
  const themeStyle = THEME_STYLE[theme];
  const palette = options.palette ?? themeStyle.palette;
  const title = options.title ?? "Fitness contributions";
  const summaryText = yearlySummaryText(options.minutesByDate, options.sessionCount);

  const cells = buildContributionGrid(options.levelsByDate, endDate);
  const monthLabels = buildMonthLabels(cells);

  const pitch = CELL_SIZE + CELL_GAP;
  const weeks = Math.max(...cells.map((cell) => cell.week), 0) + 1;
  const gridOffsetX = LABEL_GUTTER_WIDTH + CELL_GAP;
  const gridOffsetY = SUMMARY_ROW_HEIGHT + HEADER_ROW_HEIGHT + CELL_GAP;
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
        `<text class="month" x="${gridOffsetX + label.x}" y="${SUMMARY_ROW_HEIGHT + 10}" fill="${themeStyle.labelColor}" font-size="12" font-family="${LABEL_FONT}">${label.text}</text>`
    )
    .join("");

  const summary = `<text class="summary" x="0" y="16" fill="${themeStyle.labelColor}" font-size="18" font-family="${LABEL_FONT}">${escapeXml(summaryText)}</text>`;

  const weekdayText = weekdayLabels
    .map(({ text, day }) => {
      const y = gridOffsetY + day * pitch + 8;
      return `<text class="wday" x="0" y="${y}" fill="${themeStyle.labelColor}" font-size="12" font-family="${LABEL_FONT}">${text}</text>`;
    })
    .join("");

  const rects = cells
    .map((cell) => {
      const fill = palette[clampLevel(cell.level)] ?? palette[0];
      const tooltip = escapeXml(tooltipLabel(cell.date, options.minutesByDate));

      return `<rect class="day" width="${CELL_SIZE}" height="${CELL_SIZE}" x="${gridOffsetX + cell.x}" y="${gridOffsetY + cell.y}" rx="${CELL_RADIUS}" ry="${CELL_RADIUS}" data-date="${cell.date}" data-level="${cell.level}" fill="${fill}"><title>${tooltip}</title></rect>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="git-big-title"><title id="git-big-title">${escapeXml(title)}</title><desc>Daily workout intensity rendered like a GitHub contribution graph.</desc><g transform="translate(${marginLeft},${marginTop})"><g>${summary}</g><g>${monthText}</g><g>${weekdayText}</g><g>${rects}</g></g></svg>\n`;
}
