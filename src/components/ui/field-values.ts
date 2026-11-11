/** Pure presentation conversions. Submitted field values keep their existing formats. */
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCFullYear(year);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function dateToDisplay(value: string): string {
  if (!validDate(value)) return "";
  const [year, month, day] = value.split("-");
  return `${month}/${day}/${year}`;
}

export function dateFromDisplay(value: string): string {
  const text = value.trim();
  if (validDate(text)) return text;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!match) return "";
  const iso = `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  return validDate(iso) ? iso : "";
}

export function dateAllowed(value: string, min?: string, max?: string): boolean {
  return validDate(value) && (!min || value >= min) && (!max || value <= max);
}

export function timeToDisplay(value: string): string {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3] ?? 0) > 59) return "";
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]}${match[3] ? `:${match[3]}` : ""} ${hour < 12 ? "AM" : "PM"}`;
}

export function timeFromDisplay(value: string): string {
  const text = value.trim().toUpperCase();
  const twentyFour = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (twentyFour && Number(twentyFour[1]) < 24 && Number(twentyFour[2]) < 60 && Number(twentyFour[3] ?? 0) < 60) {
    return `${twentyFour[1].padStart(2, "0")}:${twentyFour[2]}${twentyFour[3] ? `:${twentyFour[3]}` : ""}`;
  }
  const match = /^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(AM|PM)$/.exec(text);
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 12 || Number(match[2] ?? 0) > 59 || Number(match[3] ?? 0) > 59) return "";
  const hour = Number(match[1]) % 12 + (match[4] === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${match[2] ?? "00"}${match[3] ? `:${match[3]}` : ""}`;
}

export function numericError(value: string, min?: number, max?: number, step?: number | "any"): string {
  if (!value.trim()) return "";
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(value) || !Number.isFinite(Number(value))) return "Enter a valid number.";
  const amount = Number(value);
  if (min !== undefined && amount < min) return `Enter ${min} or more.`;
  if (max !== undefined && amount > max) return `Enter ${max} or less.`;
  if (step !== undefined && step !== "any" && step > 0) {
    const units = (amount - (min ?? 0)) / step;
    if (Math.abs(units - Math.round(units)) > 0.000001) return step === 1 ? "Enter a whole number." : `Use increments of ${step}.`;
  }
  return "";
}
