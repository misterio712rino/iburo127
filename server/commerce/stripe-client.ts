import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | undefined;

export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey || !/^sk_(test|live)_/.test(secretKey)) {
    throw new Error("STRIPE_CONFIGURATION_INVALID");
  }
  stripeClient = new Stripe(secretKey);
  return stripeClient;
}

export function readStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !secret.startsWith("whsec_")) {
    throw new Error("STRIPE_CONFIGURATION_INVALID");
  }
  return secret;
}
