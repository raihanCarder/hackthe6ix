import { chromium } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const SHOTS = "./e2e-shots";
const errors = [];

// The pack-acquisition UI drifts often, so the collection is seeded through the
// API (dev sign-in + mock Stay22 inventory). Everything the gameplay overhaul
// touches — the play-page card fold, the match broadcast, the celebration, and
// the full results — is then exercised through the real UI below.
const iso = (d) => d.toISOString().slice(0, 10);
const now = new Date();
const checkin = iso(new Date(now.getTime() + 30 * 864e5));
const checkout = iso(new Date(now.getTime() + 33 * 864e5));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

const step = async (name, fn) => {
  try {
    await fn();
    console.log(`OK  ${name}`);
  } catch (e) {
    console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`);
    await page.screenshot({ path: `${SHOTS}/FAIL-${name.replace(/\W+/g, "-")}.png` }).catch(() => {});
    throw e;
  }
};

const post = async (path, data) => {
  const r = await page.request.post(`${BASE}${path}`, { data });
  if (!r.ok()) throw new Error(`${path} → ${r.status()} ${await r.text()}`);
  return r.json();
};

await step("landing", async () => {
  await page.goto(BASE);
  await page.getByText(/turned into a game/i).waitFor();
  await page.screenshot({ path: `${SHOTS}/01-landing.png` });
});

await step("seed collection (dev sign-in + two trip packs)", async () => {
  await post("/api/dev/login", { username: `Manager ${Date.now().toString(36)}` });
  for (const destination of ["Toronto, Canada", "Lisbon, Portugal"]) {
    const search = await post("/api/search", {
      scope: "trip",
      destination,
      checkin,
      checkout,
      adults: 2,
      children: 0,
      rooms: 1,
    });
    await post("/api/packs/open", { searchId: search.searchId, scope: "trip" });
  }
  const { cards } = await page.request.get(`${BASE}/api/cards`).then((r) => r.json());
  if (cards.length < 9) throw new Error(`expected >=9 cards, got ${cards.length}`);
});

await step("play page — Show More fold", async () => {
  await page.goto(`${BASE}/play`);
  await page.getByRole("button", { name: "Play Global Cup" }).click();
  await page.getByText("Pick your card").waitFor();
  await page.waitForTimeout(400);
  const folded = await page.locator("button:has(.card-face)").count();
  if (folded !== 8) throw new Error(`expected 8 cards before Show more, saw ${folded}`);
  await page.screenshot({ path: `${SHOTS}/02-play-folded.png` });
  await page.getByRole("button", { name: /Show more/ }).click();
  await page.waitForTimeout(300);
  const expanded = await page.locator("button:has(.card-face)").count();
  if (expanded <= folded) throw new Error(`Show more revealed nothing (${folded} → ${expanded})`);
  await page.screenshot({ path: `${SHOTS}/03-play-expanded.png` });
});

await step("enter the tournament", async () => {
  await page.locator("button:has(.card-face)").first().click();
  await page.getByRole("button", { name: /Enter .* into the tournament/ }).click();
  await page.waitForURL(/\/tournament\//, { timeout: 30000 });
});

await step("broadcast opens on the pitch", async () => {
  await page.getByRole("button", { name: /Skip to full results/ }).waitFor({ timeout: 20000 });
  await page.getByText("momentum", { exact: false }).first().waitFor({ timeout: 20000 });
  await page.locator('[data-testid="soccer-ball"]').waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/04-broadcast.png` });
});

await step("skip to champion celebration", async () => {
  await page.getByRole("button", { name: "Skip to champion" }).click();
  await page.getByText("lifts the cup").waitFor({ timeout: 15000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/05-celebration.png` });
});

await step("full results + champion", async () => {
  await page.getByRole("button", { name: /View full results/ }).click();
  await page.getByText("World champion").waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/06-full-results.png` });
  const bookHref = await page.getByRole("link", { name: /Book the champion/ }).getAttribute("href");
  if (!bookHref || !bookHref.startsWith("https://www.stay22.com")) {
    throw new Error(`unexpected booking href: ${bookHref}`);
  }
  console.log(`    booking link → ${bookHref.slice(0, 80)}…`);
});

await step("match highlight modal", async () => {
  await page.locator("button.panel").first().click();
  await page.getByText("Back to the bracket").waitFor();
  await page.screenshot({ path: `${SHOTS}/07-highlights.png` });
  await page.getByRole("button", { name: "Back to the bracket" }).click();
});

await step("rewatch broadcast toggle", async () => {
  await page.getByRole("button", { name: /Rewatch broadcast/ }).click();
  await page.getByRole("button", { name: /Skip to full results/ }).waitFor({ timeout: 15000 });
});

// Security check: the API never leaks a key (none configured, but check shape anyway).
await step("no key leakage", async () => {
  const response = await page.request.get(`${BASE}/api/cards`);
  const text = await response.text();
  if (/api[_-]?key|authorization|bearer/i.test(text)) {
    throw new Error("suspicious credential-like content in API response");
  }
});

console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();
