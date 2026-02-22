import { formatDateUtc, listDateRange, startOfUtcDay } from "./date.js";

export type ActivityDuration = {
  moving_time: number;
  start_date_local: string;
};

export type IntensityLevel = 0 | 1 | 2 | 3 | 4;
export type Thresholds = readonly [number, number, number, number];

export const DEFAULT_THRESHOLDS: Thresholds = [1, 20, 40, 60] as const;

function sortObjectByDate<T extends number>(values: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(values).sort(([left], [right]) => left.localeCompare(right)));
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

export function bucketMinutes(minutes: number, thresholds: Thresholds = DEFAULT_THRESHOLDS): IntensityLevel {
  if (!Number.isFinite(minutes) || minutes < thresholds[0]) {
    return 0;
  }

  if (minutes < thresholds[1]) {
    return 1;
  }

  if (minutes < thresholds[2]) {
    return 2;
  }

  if (minutes < thresholds[3]) {
    return 3;
  }

  return 4;
}

export function normalizeMinutesByDate(
  minutesByDate: Record<string, number>,
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): Record<string, IntensityLevel> {
  const normalized = Object.fromEntries(
    Object.entries(minutesByDate).map(([date, minutes]) => [date, bucketMinutes(minutes, thresholds)])
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
