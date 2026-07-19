import "server-only";
import { z } from "zod";
import type Stripe from "stripe";
import type { User } from "@/generated/prisma/client";
import { COIN_TIERS, getCoinTier, stripeCurrency } from "@/lib/coins";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { ApiError } from "./core";

export const createCoinCheckoutSchema = z.object({
  tierId: z.string().min(1),
});

export async function createCoinCheckoutSession(user: User, tierId: string, origin: string) {
  const tier = getCoinTier(tierId);
  if (!tier) throw new ApiError(400, "Unknown coin pack");

  const currency = stripeCurrency();
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: user.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: tier.amountCents,
          product_data: {
            name: `${tier.coins.toLocaleString()} Check-In Champions coins`,
            description: `${tier.label} coin pack`,
          },
        },
      },
    ],
    metadata: {
      userId: user.id,
      tierId: tier.id,
      coins: String(tier.coins),
    },
    success_url: `${origin}/coins/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/coins`,
  });

  if (!session.url) {
    throw new ApiError(502, "Stripe did not return a checkout URL");
  }

  await prisma.coinPurchase.upsert({
    where: { stripeCheckoutSessionId: session.id },
    create: {
      userId: user.id,
      stripeCheckoutSessionId: session.id,
      tierId: tier.id,
      coinAmount: tier.coins,
      amountCents: tier.amountCents,
      currency,
      status: "pending",
    },
    update: {},
  });

  return { url: session.url };
}

function paymentIntentId(session: Stripe.Checkout.Session) {
  if (!session.payment_intent) return null;
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent.id;
}

function validatePaidCoinSession(session: Stripe.Checkout.Session, expectedUserId?: string) {
  if (session.payment_status !== "paid") {
    return { paid: false as const };
  }

  const userId = session.metadata?.userId;
  const tierId = session.metadata?.tierId;
  const coins = Number(session.metadata?.coins);
  const tier = tierId ? getCoinTier(tierId) : null;
  const currency = stripeCurrency();

  if (!userId || !tier || !Number.isInteger(coins)) {
    throw new ApiError(422, "Stripe session is missing coin purchase metadata");
  }
  if (expectedUserId && userId !== expectedUserId) {
    throw new ApiError(403, "This checkout session belongs to another user");
  }
  if (coins !== tier.coins || session.amount_total !== tier.amountCents || session.currency !== currency) {
    throw new ApiError(422, "Stripe session does not match a known coin pack");
  }

  return { paid: true as const, userId, tier, currency };
}

export async function fulfillCoinCheckoutSession(sessionId: string, expectedUserId?: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });
  const validation = validatePaidCoinSession(session, expectedUserId);
  if (!validation.paid) {
    return {
      status: "unpaid" as const,
      coins: 0,
      balance: null,
      sessionId,
    };
  }

  const { userId, tier, currency } = validation;
  const intentId = paymentIntentId(session);

  return prisma.$transaction(async (tx) => {
    const purchase = await tx.coinPurchase.upsert({
      where: { stripeCheckoutSessionId: session.id },
      create: {
        userId,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: intentId,
        tierId: tier.id,
        coinAmount: tier.coins,
        amountCents: tier.amountCents,
        currency,
        status: "paid",
      },
      update: {
        stripePaymentIntentId: intentId,
        tierId: tier.id,
        coinAmount: tier.coins,
        amountCents: tier.amountCents,
        currency,
        status: "paid",
      },
    });

    const fulfilled = await tx.coinPurchase.updateMany({
      where: { id: purchase.id, fulfilledAt: null },
      data: {
        stripePaymentIntentId: intentId,
        tierId: tier.id,
        coinAmount: tier.coins,
        amountCents: tier.amountCents,
        currency,
        status: "fulfilled",
        fulfilledAt: new Date(),
      },
    });

    if (fulfilled.count === 0) {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      return {
        status: "already_fulfilled" as const,
        coins: tier.coins,
        balance: user.currency,
        sessionId: session.id,
      };
    }

    const user = await tx.user.update({
      where: { id: userId },
      data: { currency: { increment: tier.coins } },
    });

    return {
      status: "fulfilled" as const,
      coins: tier.coins,
      balance: user.currency,
      sessionId: session.id,
    };
  });
}

export function publicCoinTiers() {
  return COIN_TIERS;
}
