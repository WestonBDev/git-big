const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDaysUtc(date: Date, days: number): Date {
  const base = startOfUtcDay(date).getTime();
  return new Date(base + days * ONE_DAY_MS);
}

export function startOfWeekSunday(date: Date): Date {
  const normalized = startOfUtcDay(date);
  return addDaysUtc(normalized, -normalized.getUTCDay());
}

export function formatDateUtc(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function listDateRange(startDate: Date, endDate: Date): Date[] {
  const start = startOfUtcDay(startDate);
  const end = startOfUtcDay(endDate);

  if (start.getTime() > end.getTime()) {
    return [];
  }

  const dates: Date[] = [];
  for (let current = start; current.getTime() <= end.getTime(); current = addDaysUtc(current, 1)) {
    dates.push(current);
  }

  return dates;
}
