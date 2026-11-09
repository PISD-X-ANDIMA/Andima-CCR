export const QUICK_PERIODS = [
  { months: 1, label: "1 Bulan" },
  { months: 3, label: "3 Bulan" },
  { months: 6, label: "6 Bulan" },
  { months: 12, label: "12 Bulan" },
] as const;

export function shiftPeriod(value: string, offset: number) {
  const date = new Date(`${value}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function quickPeriodRange(endPeriod: string, months: number) {
  return {
    startPeriod: shiftPeriod(endPeriod, -(months - 1)),
    endPeriod,
  };
}

export function matchingQuickPeriod(startPeriod: string, endPeriod: string) {
  return QUICK_PERIODS.find((period) => quickPeriodRange(endPeriod, period.months).startPeriod === startPeriod)?.months ?? null;
}

export function listPeriods(startPeriod: string, endPeriod: string) {
  const periods: string[] = [];
  let current = startPeriod;
  while (current <= endPeriod) {
    periods.push(current);
    current = shiftPeriod(current, 1);
  }
  return periods;
}
