import "server-only";

import Stripe from "stripe";
import { getStripeSecretKey } from "./config";

let stripeClient: Stripe | undefined;

export function getStripe() {
  stripeClient ??= new Stripe(getStripeSecretKey(), {
    appInfo: {
      name: "Auxilium",
      version: "0.1.0",
    },
  });

  return stripeClient;
}
