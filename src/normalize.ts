import { formatDateUtc, listDateRange, startOfUtcDay } from "./date.js";

export type ActivityDuration = {
  moving_time: number;
  start_date_local: string;
};

export type IntensityLevel = 0 | 1 | 2 | 3 | 4;
export type IntensityBoundaries = readonly [number, number, number, number, number];

// Matches githubstats/githubchart outlier z-score constant.
export const GITHUB_OUTLIER_Z_SCORE = 3.77972616981;

function sortObjectByDate<T extends number>(values: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(values).sort(([left], [right]) => left.localeCompare(right)));
}

function sanitizeMinutes(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.floor(value);
}

function mean(values: ReadonlyArray<number>): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: ReadonlyArray<number>, valuesMean: number): number {
  if (values.length < 2) {
    return 0;
  }

  const squaredDeltaSum = values.reduce((sum, value) => sum + (value - valuesMean) ** 2, 0);
  return Math.sqrt(squaredDeltaSum / (values.length - 1));
}

function uniqueScores(values: ReadonlyArray<number>): number[] {
  return Array.from(new Set(values));
}

function githubOutliers(values: ReadonlyArray<number>): number[] {
  const uniques = uniqueScores(values);
  if (uniques.length < 5) {
    return [];
  }

  const valuesMean = mean(values);
  const stdDev = standardDeviation(values, valuesMean);
  if (!Number.isFinite(stdDev) || stdDev === 0) {
    return [];
  }

  const outliers = uniques.filter((score) => Math.abs((valuesMean - score) / stdDev) > GITHUB_OUTLIER_Z_SCORE);
  const maxScore = Math.max(...values, 0);
  const maxOutlierCount = maxScore - valuesMean < 6 || maxScore < 15 ? 1 : 3;

  return outliers.slice(0, maxOutlierCount);
}

function quartileMidpoint(rangeTop: number, quartile: 1 | 2 | 3): number {
  if (rangeTop <= 0) {
    return 0;
  }

  const rangeSize = rangeTop;
  const index = Math.floor((quartile * rangeSize) / 4) - 1;
  if (index < 0 || index >= rangeSize) {
    return rangeTop;
  }

  return index + 1;
}

export function deriveIntensityBoundaries(minutes: ReadonlyArray<number>): IntensityBoundaries {
  if (minutes.length === 0) {
    return [0, 0, 0, 0, 0];
  }

  const sanitized = minutes.map(sanitizeMinutes);
  const maxScore = Math.max(...sanitized, 0);
  if (maxScore <= 0) {
    return [0, 0, 0, 0, 0];
  }

  const outliers = githubOutliers(sanitized);
  const nonOutlierTop = Math.max(...sanitized.filter((score) => !outliers.includes(score)), 0);

  const first = quartileMidpoint(nonOutlierTop, 1);
  const second = quartileMidpoint(nonOutlierTop, 2);
  const third = quartileMidpoint(nonOutlierTop, 3);
  const uniqueSortedBounds = Array.from(new Set([first, second, third, maxScore])).sort((a, b) => a - b);
  while (uniqueSortedBounds.length < 5) {
    uniqueSortedBounds.unshift(0);
  }

  return [
    uniqueSortedBounds[0] ?? 0,
    uniqueSortedBounds[1] ?? 0,
    uniqueSortedBounds[2] ?? 0,
    uniqueSortedBounds[3] ?? 0,
    uniqueSortedBounds[4] ?? 0
  ];
}

export function aggregateMinutesByDate(
  activities: ReadonlyArray<ActivityDuration>
): Record<string, number> {
  const secondsByDate = new Map<string, number>();

  for (const activity of activities) {
    if (!activity.start_date_local || !Number.isFinite(activity.moving_time)) {
      continue;
    }

    const dateKey = activity.start_date_local.slice(0, 10);
    const existing = secondsByDate.get(dateKey) ?? 0;
    secondsByDate.set(dateKey, existing + Math.max(0, activity.moving_time));
  }

  const minutesByDate = Object.fromEntries(
    Array.from(secondsByDate.entries(), ([date, totalSeconds]) => [date, Math.floor(totalSeconds / 60)])
  );

  return sortObjectByDate(minutesByDate);
}

export function bucketMinutes(
  minutes: number,
  boundaries: IntensityBoundaries
): IntensityLevel {
  const normalized = sanitizeMinutes(minutes);
  if (normalized <= 0) {
    return 0;
  }

  const level = boundaries.filter((boundary) => normalized > boundary).length;
  return Math.max(0, Math.min(4, level)) as IntensityLevel;
}

export function normalizeMinutesByDate(
  minutesByDate: Record<string, number>
): Record<string, IntensityLevel> {
  const normalizedInput = Object.fromEntries(
    Object.entries(minutesByDate).map(([date, minutes]) => [date, sanitizeMinutes(minutes)])
  );

  const boundaries = deriveIntensityBoundaries(Object.values(normalizedInput));
  const normalized = Object.fromEntries(
    Object.entries(normalizedInput).map(([date, minutes]) => [date, bucketMinutes(minutes, boundaries)])
  );

  return sortObjectByDate(normalized as Record<string, IntensityLevel>);
}

export function fillDateRange(
  valuesByDate: Record<string, number>,
  startDate: Date,
  endDate: Date
): Record<string, number> {
  const start = startOfUtcDay(startDate);
  const end = startOfUtcDay(endDate);
  const filled: Record<string, number> = {};

  for (const date of listDateRange(start, end)) {
    const key = formatDateUtc(date);
    filled[key] = valuesByDate[key] ?? 0;
  }

  return filled;
}
