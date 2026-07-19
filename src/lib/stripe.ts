import "server-only";
import Stripe from "stripe";
import { ApiError } from "@/lib/api/core";

let stripe: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new ApiError(503, "Stripe sandbox is not configured");
  }

  stripe ??= new Stripe(secretKey);
  return stripe;
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new ApiError(503, "Stripe webhook secret is not configured");
  }
  return secret;
}
