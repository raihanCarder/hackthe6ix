export const COIN_TIERS = [
  {
    id: "starter",
    priceLabel: "$5",
    amountCents: 500,
    coins: 100,
    label: "Starter stack",
    badge: null,
  },
  {
    id: "pack-night",
    priceLabel: "$20",
    amountCents: 2000,
    coins: 1000,
    label: "Pack night",
    badge: null,
  },
  {
    id: "champion-vault",
    priceLabel: "$100",
    amountCents: 10000,
    coins: 5100,
    label: "Champion vault",
    badge: "Best value",
  },
] as const;

export type CoinTierId = (typeof COIN_TIERS)[number]["id"];

export function getCoinTier(tierId: string) {
  return COIN_TIERS.find((tier) => tier.id === tierId) ?? null;
}

export function stripeCurrency() {
  return process.env.STRIPE_CURRENCY?.trim().toLowerCase() || "cad";
}
