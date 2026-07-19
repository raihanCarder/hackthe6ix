import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { fulfillCoinCheckoutSession, handleApiError } from "@/lib/api";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      getStripeWebhookSecret(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Stripe webhook";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      await fulfillCoinCheckoutSession(session.id);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return handleApiError(error);
  }
}
