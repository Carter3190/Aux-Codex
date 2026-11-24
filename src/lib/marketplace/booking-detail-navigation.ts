export type BookingDetailTab = "overview" | "payment" | "help" | "review";

export function bookingDetailTab(value: unknown): BookingDetailTab | undefined {
  return value === "overview" || value === "payment" || value === "help" || value === "review"
    ? value
    : undefined;
}
