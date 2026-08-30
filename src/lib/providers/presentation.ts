import type { PricingType } from "./types";

export const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function formatPrice(
  pricingType: PricingType,
  priceCents: number | null,
) {
  if (pricingType === "quote" || priceCents === null) {
    return "Contact for quote";
  }

  const dollars = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: priceCents % 100 === 0 ? 0 : 2,
  }).format(priceCents / 100);

  if (pricingType === "hourly") return `${dollars}/hour`;
  if (pricingType === "starting_at") return `Starting at ${dollars}`;
  return dollars;
}
export function labelFromSnakeCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
