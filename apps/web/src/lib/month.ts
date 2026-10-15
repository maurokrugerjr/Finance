// Mês no formato "YYYY-MM" (UTC), usado na URL (?mes=) e nas consultas.
export type MonthKey = string;

export function currentMonth(): MonthKey {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function isMonthKey(value: string | null): value is MonthKey {
  return value !== null && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year!, m! - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(month: MonthKey) {
  const [year, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(year!, m! - 1, 1));
  const to = new Date(Date.UTC(year!, m!, 1) - 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function monthLabel(month: MonthKey, style: "long" | "short" = "long") {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year!, m! - 1, 1));
  if (style === "short") {
    return date.toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "");
  }
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function monthOf(date: string): MonthKey {
  return date.slice(0, 7);
}
