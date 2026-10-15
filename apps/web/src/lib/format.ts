// Datas de lançamento são guardadas como meia-noite UTC do dia escolhido,
// então toda formatação de data usa timeZone UTC para não "voltar um dia".

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactNumber = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export const brl = (value: number) => currency.format(value);

export const compact = (value: number) => compactNumber.format(value);

export const percent = (value: number) =>
  `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

export function shortDate(value: string | Date) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

// "12,50" / "1.234,56" / "1234.56" -> número; null se não for um valor válido.
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

export function moneyInput(value: number | null | undefined) {
  return value == null ? "" : value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
