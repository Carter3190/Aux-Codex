import type { UserRole } from "../auth/profile";
import type { CustomerIconName } from "../../components/dashboard/customer-icon";

type SupportCard = {
  key: string;
  title: string;
  body: string;
  icon: CustomerIconName;
  actions: Array<{ label: string; href: string }>;
};

export type SupportAccountAccess = {
  role: UserRole;
  canUseCustomer: boolean;
  canUseProvider: boolean;
};

const providerCard: SupportCard = {
  key: "provider",
  title: "Provider profile or payouts",
  body: "Review your application, service requirements, or payment setup.",
  icon: "book",
  actions: [
    { label: "Manage profile", href: "/dashboard/provider/onboarding" },
    { label: "Payments", href: "/dashboard/provider/payments" },
  ],
};

function bookingCard(role?: "customer" | "provider", dualAccess = false): SupportCard {
  return {
    key: `${role ?? "account"}-bookings`,
    title: dualAccess ? `${role === "provider" ? "Provider" : "Customer"} bookings` : "My Bookings",
    body: "Open the booking to ask a question, review payment details, or request help with a service issue.",
    icon: "calendar",
    actions: [{
      label: dualAccess ? `Open ${role} bookings` : "Open my bookings",
      href: role ? `/dashboard/${role}/bookings` : "/dashboard/bookings",
    }],
  };
}

export function supportActionsFor(account: SupportAccountAccess | null): SupportCard[] {
  if (!account) {
    return [
      bookingCard(),
      providerCard,
      {
        key: "sign-in",
        title: "Account access",
        body: "Sign in with your confirmed email. If you just registered, check for the confirmation message.",
        icon: "help",
        actions: [{ label: "Go to sign in", href: "/login" }],
      },
    ];
  }

  const cards: SupportCard[] = [];
  const dualAccess = account.canUseCustomer && account.canUseProvider;
  const roles: Array<"customer" | "provider"> = account.role === "provider"
    ? ["provider", "customer"]
    : ["customer", "provider"];
  for (const role of roles) {
    if ((role === "customer" && account.canUseCustomer) || (role === "provider" && account.canUseProvider)) {
      cards.push(bookingCard(role, dualAccess));
    }
  }
  if (account.canUseProvider) cards.push(providerCard);
  else if (account.role === "customer") cards.push({
    key: "offer-services",
    title: "Offer services",
    body: "Apply to offer services using your existing account.",
    icon: "book",
    actions: [{ label: "Offer Services", href: "/offer-services" }],
  });
  if (account.role === "admin") cards.push({
    key: "resolution-center",
    title: "Resolution center",
    body: "Review booking issues, refund requests, and disputes.",
    icon: "help",
    actions: [{ label: "Open resolution center", href: "/dashboard/admin/cases" }],
  });
  cards.push({
    key: "account",
    title: "Your account",
    body: "Return to your dashboard to continue.",
    icon: "overview",
    actions: [{ label: "Open my dashboard", href: `/dashboard/${account.role}` }],
  });
  return cards;
}
