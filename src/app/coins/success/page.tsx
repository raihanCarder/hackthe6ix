import Link from "next/link";
import { fulfillCoinCheckoutSession, requireUser } from "@/lib/api";

export const runtime = "nodejs";

type SuccessResult =
  | Awaited<ReturnType<typeof fulfillCoinCheckoutSession>>
  | { status: "missing"; coins: 0; balance: number | null; sessionId: string | null };

export default async function CoinsSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const user = await requireUser();
  const { session_id: sessionId } = await searchParams;

  let result: SuccessResult;
  let error: string | null = null;

  if (!sessionId) {
    result = { status: "missing", coins: 0, balance: null, sessionId: null };
    error = "Stripe did not send a checkout session id.";
  } else {
    try {
      result = await fulfillCoinCheckoutSession(sessionId, user.id);
    } catch (caught) {
      result = { status: "missing", coins: 0, balance: null, sessionId: sessionId };
      error = caught instanceof Error ? caught.message : "Could not verify this purchase.";
    }
  }

  const fulfilled = result.status === "fulfilled" || result.status === "already_fulfilled";

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <div className="panel rounded-xl p-8">
        <p className="eyebrow">Stripe sandbox</p>
        <h1 className="font-display mt-2 text-3xl text-chalk">
          {fulfilled ? "Coins added" : "Purchase pending"}
        </h1>

        {error ? (
          <p className="mt-4 text-sm text-whistle">{error}</p>
        ) : fulfilled ? (
          <>
            <p className="font-score mt-6 text-5xl text-gold-bright">
              +{result.coins.toLocaleString()}
            </p>
            <p className="mt-1 font-display text-sm text-chalk">coins</p>
            <p className="mt-4 text-sm text-chalk-dim">
              Your balance is now{" "}
              <span className="font-score text-gold-bright">
                {result.balance?.toLocaleString()} coins
              </span>
              .
            </p>
            {result.status === "already_fulfilled" && (
              <p className="mt-3 text-xs text-chalk-dim">
                This checkout session was already credited, so no duplicate coins were added.
              </p>
            )}
          </>
        ) : (
          <p className="mt-4 text-sm text-chalk-dim">
            Stripe has not marked this checkout session as paid yet. If you used a delayed payment
            method, the webhook will credit coins once the payment succeeds.
          </p>
        )}

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/coins" className="btn-gold rounded-lg px-6 py-3">
            Back to coin shop
          </Link>
          <Link href="/packs" className="btn-chalk rounded-lg px-6 py-3">
            Open packs
          </Link>
        </div>
      </div>
    </div>
  );
}
