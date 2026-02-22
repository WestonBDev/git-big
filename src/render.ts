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
const HEADER_HEIGHT = 32;
const CARD_HEADER_HEIGHT = 18;
const CARD_PADDING_X = 12;
const CARD_PADDING_TOP = 12;
const CARD_PADDING_BOTTOM = 12;
const FOOTER_HEIGHT = 18;
const FOOTER_TOP_GAP = 24;
const LABEL_FONT =
  "-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif";
const MIN_MONTH_LABEL_SPACING = 28;
const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");

const THEME_STYLE = {
  dark: {
    summaryColor: "#c9d1d9",
    axisColor: "#7d8590",
    mutedColor: "#7d8590",
    cardBorder: "#30363d",
    palette: RED_PALETTE
  },
  light: {
    summaryColor: "#24292f",
    axisColor: "#24292f",
    mutedColor: "#57606a",
    cardBorder: "#d0d7de",
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

  const labels: MonthLabel[] = [];
  const weekCount = Math.max(...cells.map((cell) => cell.week), 0) + 1;

  for (let week = 0; week < weekCount; week += 1) {
    const weekCells = cells.filter((cell) => cell.week === week).sort((left, right) => left.day - right.day);
    const monthStartCell = weekCells.find((cell) => {
      const date = parseIsoDate(cell.date);
      return date.getUTCDate() === 1;
    });
    if (!monthStartCell) {
      continue;
    }

    const monthStartDate = parseIsoDate(monthStartCell.date);
    const nextLabel = {
      date: monthStartCell.date,
      text: MONTH_FORMATTER.format(monthStartDate),
      week,
      x: week * (CELL_SIZE + CELL_GAP)
    };

    const lastLabel = labels[labels.length - 1];
    if (lastLabel && nextLabel.x - lastLabel.x < MIN_MONTH_LABEL_SPACING) {
      continue;
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
  const gridWidth = weeks * pitch - CELL_GAP;
  const gridHeight = 7 * pitch - CELL_GAP;

  const outerMarginX = 10;
  const outerMarginY = 10;
  const cardX = outerMarginX;
  const cardY = outerMarginY + HEADER_HEIGHT;
  const gridOffsetX = cardX + CARD_PADDING_X + LABEL_GUTTER_WIDTH + CELL_GAP;
  const monthTextY = cardY + CARD_PADDING_TOP + 12;
  const gridOffsetY = cardY + CARD_PADDING_TOP + CARD_HEADER_HEIGHT;
  const footerBaselineY = gridOffsetY + gridHeight + FOOTER_TOP_GAP;
  const cardWidth = CARD_PADDING_X + LABEL_GUTTER_WIDTH + CELL_GAP + gridWidth + CARD_PADDING_X;
  const cardHeight =
    CARD_PADDING_TOP + CARD_HEADER_HEIGHT + gridHeight + FOOTER_TOP_GAP + FOOTER_HEIGHT + CARD_PADDING_BOTTOM;

  const width = outerMarginX * 2 + cardWidth;
  const height = cardY + cardHeight + outerMarginY;

  const weekdayLabels = [
    { text: "Mon", day: 1 },
    { text: "Wed", day: 3 },
    { text: "Fri", day: 5 }
  ];

  const monthText = monthLabels
    .map(
      (label) =>
        `<text class="month" x="${gridOffsetX + label.x}" y="${monthTextY}" fill="${themeStyle.axisColor}" font-size="12" font-family="${LABEL_FONT}">${label.text}</text>`
    )
    .join("");

  const summary = `<text class="summary" x="${outerMarginX}" y="${outerMarginY + 20}" fill="${themeStyle.summaryColor}" font-size="18" font-family="${LABEL_FONT}">${escapeXml(summaryText)}</text>`;
  const settingsTextX = cardX + cardWidth - 24;
  const settingsY = outerMarginY + 21;
  const settings = `<text class="settings" x="${settingsTextX}" y="${settingsY}" text-anchor="end" fill="${themeStyle.mutedColor}" font-size="10" font-family="${LABEL_FONT}">Contribution settings</text><path class="settings-caret" d="M0 0h7l-3.5 4z" fill="${themeStyle.mutedColor}" transform="translate(${settingsTextX + 8},${settingsY - 7})"/>`;
  const card = `<rect class="card" x="${cardX + 0.5}" y="${cardY + 0.5}" width="${cardWidth - 1}" height="${cardHeight - 1}" rx="6" ry="6" fill="none" stroke="${themeStyle.cardBorder}"/>`;

  const weekdayText = weekdayLabels
    .map(({ text, day }) => {
      const y = gridOffsetY + day * pitch + 8;
      return `<text class="wday" x="${cardX + CARD_PADDING_X}" y="${y}" fill="${themeStyle.axisColor}" font-size="12" font-family="${LABEL_FONT}">${text}</text>`;
    })
    .join("");

  const rects = cells
    .map((cell) => {
      const fill = palette[clampLevel(cell.level)] ?? palette[0];
      const tooltip = escapeXml(tooltipLabel(cell.date, options.minutesByDate));

      return `<rect class="day" width="${CELL_SIZE}" height="${CELL_SIZE}" x="${gridOffsetX + cell.x}" y="${gridOffsetY + cell.y}" rx="${CELL_RADIUS}" ry="${CELL_RADIUS}" data-date="${cell.date}" data-level="${cell.level}" fill="${fill}"><title>${tooltip}</title></rect>`;
    })
    .join("");

  const legendCellGap = 5;
  const legendCellWidth = CELL_SIZE;
  const legendWidth = 5 * legendCellWidth + 4 * legendCellGap;
  const moreTextX = cardX + cardWidth - CARD_PADDING_X;
  const legendStartX = moreTextX - 30 - legendWidth;
  const lessTextX = legendStartX - 8;
  const legendY = footerBaselineY - 8;
  const legendSwatches = Array.from({ length: 5 }, (_, index) => {
    const fill = palette[index] ?? palette[0];
    const x = legendStartX + index * (legendCellWidth + legendCellGap);
    return `<rect class="legend-swatch" x="${x}" y="${legendY}" width="${legendCellWidth}" height="${legendCellWidth}" rx="${CELL_RADIUS}" ry="${CELL_RADIUS}" fill="${fill}"/>`;
  }).join("");
  const footer = `<text class="help-link" x="${gridOffsetX}" y="${footerBaselineY}" fill="${themeStyle.mutedColor}" font-size="11" font-family="${LABEL_FONT}">Learn how we count contributions</text><text class="legend-less" x="${lessTextX}" y="${footerBaselineY}" text-anchor="end" fill="${themeStyle.mutedColor}" font-size="11" font-family="${LABEL_FONT}">Less</text>${legendSwatches}<text class="legend-more" x="${moreTextX}" y="${footerBaselineY}" text-anchor="end" fill="${themeStyle.mutedColor}" font-size="11" font-family="${LABEL_FONT}">More</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="git-big-title"><title id="git-big-title">${escapeXml(title)}</title><desc>Daily workout intensity rendered like a GitHub contribution graph.</desc>${summary}${settings}${card}${monthText}${weekdayText}<g>${rects}</g>${footer}</svg>\n`;
}
