# Stripe sandbox coin purchases

Stripe is used only for demo coin purchases. It does not affect hotel booking links, Stay22
inventory, or the recommendation engine.

## What this integration does

1. A signed-in user opens `/coins`.
2. The browser posts a selected tier to `/api/coins/checkout`.
3. The server creates a Stripe-hosted Checkout Session in sandbox mode.
4. Stripe redirects the user to `/coins/success?session_id=...` after payment.
5. The success page and webhook both call the same fulfillment code.
6. `User.currency` is incremented once, guarded by the `CoinPurchase` ledger.

The webhook is the reliable fulfillment path. The success page is also allowed to fulfill so a live
demo updates immediately after redirect.

## Local setup

1. Create or log in to a Stripe account and use **test mode**.
2. Install the Stripe CLI so your terminal can forward sandbox webhooks.

   macOS with Homebrew:

   ```bash
   brew install stripe/stripe-cli/stripe
   ```

   Other install options are in Stripe's CLI docs: https://docs.stripe.com/stripe-cli/use-cli

3. Authenticate the CLI:

   ```bash
   stripe login
   ```

   This opens a browser confirmation flow and connects the CLI to your Stripe account.

4. Copy your test secret key into `.env`:

   ```env
   STRIPE_SECRET_KEY="sk_test_..."
   STRIPE_CURRENCY="cad"
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

6. In a second terminal, forward Stripe sandbox events to the local webhook:

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

7. Copy the emitted webhook signing secret into `.env`:

   ```env
   STRIPE_WEBHOOK_SECRET="whsec_..."
   ```

8. Restart `npm run dev` after changing `.env`.

9. Apply migrations if the purchase table is not present:

   ```bash
   npx prisma migrate dev
   ```

## Demo checkout

1. Sign in.
2. Go to `/coins`.
3. Click a coin tier.
4. Use Stripe test card:

   ```text
   4242 4242 4242 4242
   ```

5. Use any future expiry, any 3-digit CVC, and any postal code.
6. After Stripe redirects back, `/coins/success` shows whether coins were added or already credited.

## Coin tiers

Tiers live in `src/lib/coins.ts` and are shared by the UI, checkout session creation, and
fulfillment validation.

| Tier ID | Price | Coins |
| --- | ---: | ---: |
| `starter` | `$5` | `100` |
| `pack-night` | `$20` | `1,000` |
| `champion-vault` | `$100` | `5,100` |

Change tiers in `src/lib/coins.ts`; do not hard-code separate values in route handlers or UI.

## Endpoints

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/coins` | `GET` | Signed-in page | Coin shop UI. |
| `/api/coins/checkout` | `POST` | Required | Accepts `{ "tierId": string }`, creates a Checkout Session, stores a pending `CoinPurchase`, and returns `{ "url": string }`. |
| `/api/stripe/webhook` | `POST` | Stripe signature | Verifies `Stripe-Signature`, handles successful Checkout events, and fulfills coins. |
| `/coins/success?session_id=...` | `GET` | Required | Retrieves the Checkout Session and runs the same fulfillment function as a demo-friendly fallback. |

`/api/coins/checkout` uses the request origin for `success_url` and `cancel_url`, so local and
deployed hosts both redirect back to the same app instance that created the session.

## Fulfillment and idempotency

Fulfillment is implemented in `fulfillCoinCheckoutSession()` in `src/lib/api/coins.ts`.

It must verify:

- Stripe session `payment_status` is `paid`.
- Session metadata includes `userId`, `tierId`, and `coins`.
- Metadata, Stripe amount, and Stripe currency match a known tier.
- Success-page fulfillment only credits the currently signed-in owner of the session.

Coins are credited by updating `CoinPurchase.fulfilledAt` from `null` to a timestamp inside a
database transaction. If the webhook retries or the success page refreshes, the existing
`fulfilledAt` prevents duplicate currency increments.

## Webhook events

The webhook currently handles:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`

Delayed or failed payment methods are not surfaced in the UI beyond the pending state. For the demo,
use the standard card test flow so Checkout completes immediately.

## Common failures

### Buy button says Stripe sandbox is not configured

`STRIPE_SECRET_KEY` is missing or the Next server was not restarted after editing `.env`.

### Webhook returns missing or invalid Stripe signature

The request did not come through Stripe CLI or a configured Stripe webhook endpoint. Use:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Then set the emitted `whsec_...` as `STRIPE_WEBHOOK_SECRET`.

### Checkout succeeds but coins do not update

Check these in order:

1. The app server was restarted after setting `STRIPE_SECRET_KEY`.
2. `npx prisma migrate dev` has created `CoinPurchase`.
3. The user returned to `/coins/success?session_id=...`.
4. The Stripe CLI listener is still running.
5. The webhook secret in `.env` matches the currently running `stripe listen` session.

### `/api/dev/login` returns Auth0 is configured

This is expected when all `AUTH0_*` values are set. Use Auth0 login for local Stripe demos, or unset
one Auth0 value and restart the server to use local dev sign-in.

## Useful Stripe references

- Checkout Sessions: https://docs.stripe.com/api/checkout/sessions/create
- Fulfillment: https://docs.stripe.com/checkout/fulfillment
- Webhooks and signature verification: https://docs.stripe.com/webhooks
- Stripe CLI event forwarding: https://docs.stripe.com/stripe-cli/use-cli
