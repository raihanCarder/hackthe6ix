import { chromium } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const SHOTS = "./e2e-shots";
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
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
    await page.screenshot({ path: `${SHOTS}/FAIL-${name.replace(/\W+/g, "-")}.png` });
    throw e;
  }
};

await step("landing", async () => {
  await page.goto(BASE);
  await page.getByText("HOTELS COMPETE").waitFor();
  await page.screenshot({ path: `${SHOTS}/01-landing.png` });
});

await step("dev sign-in", async () => {
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByPlaceholder("Manager name").fill(`Manager ${Date.now().toString(36)}`);
  await page.getByRole("button", { name: "Sign in" }).last().click();
  await page.getByText("coins").waitFor();
});

await step("choose trip pack", async () => {
  await page.goto(`${BASE}/packs`);
  await page.getByRole("button", { name: "Choose Trip Pack" }).click();
  await page.getByRole("button", { name: "Scout the field" }).click();
  await page.getByText("Scouting report").waitFor({ timeout: 20000 });
  await page.screenshot({ path: `${SHOTS}/02-trip-pack-setup.png` });
});

await step("open pack", async () => {
  await page.getByRole("button", { name: /Open your free Trip Pack|Open a Trip Pack/ }).click();
  await page.waitForURL(/\/pack\//, { timeout: 20000 });
  await page.getByText("Tap to reveal").waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/03-pack-facedown.png` });
});

await step("reveal cards", async () => {
  await page.getByRole("button", { name: "Reveal all" }).click();
  await page.getByRole("link", { name: "Play a match" }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(900); // let flips finish
  await page.screenshot({ path: `${SHOTS}/04-pack-revealed.png` });
});

await step("trip cup card selection", async () => {
  await page.getByRole("link", { name: "Play a match" }).click();
  await page.waitForURL(/\/play$/);
  await page.getByRole("button", { name: "Play Trip Cup" }).click();
  await page.getByText("Pick your card").waitFor();
  await page.locator("button:has(.card-face)").first().click();
  await page.getByRole("button", { name: /Enter .* into the tournament/ }).click();
});

await step("trip questionnaire", async () => {
  await page.getByText("Pre-match interview").waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${SHOTS}/05-questions.png` });
  for (let i = 0; i < 8; i++) {
    const done = await page
      .waitForURL(/\/tournament\//, { timeout: 1500 })
      .then(() => true)
      .catch(() => false);
    if (done) break;
    const options = page.locator("button.btn-chalk");
    if ((await options.count()) === 0) break;
    await options.first().click();
  }
  await page.waitForURL(/\/tournament\//, { timeout: 30000 });
});

await step("tournament + champion", async () => {
  await page.getByText("Group stage", { exact: false }).first().waitFor({ timeout: 20000 });
  await page.getByText("Trip champion").waitFor({ timeout: 20000 });
  await page.screenshot({ path: `${SHOTS}/06-tournament-top.png` });
  await page.getByText("Trip champion").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/07-champion.png` });
  const bookHref = await page.getByRole("link", { name: /Book the champion/ }).getAttribute("href");
  if (!bookHref || !bookHref.startsWith("https://www.stay22.com")) {
    throw new Error(`unexpected booking href: ${bookHref}`);
  }
  console.log(`    booking link → ${bookHref.slice(0, 80)}…`);
});

await step("match highlights", async () => {
  await page.locator("button.panel").first().click();
  await page.getByText("Back to the bracket").waitFor();
  await page.screenshot({ path: `${SHOTS}/08-highlights.png` });
  await page.getByRole("button", { name: "Back to the bracket" }).click();
});

await step("collection + rehydrate", async () => {
  await page.goto(`${BASE}/collection`);
  await page.getByText("Your collection").waitFor();
  await page.locator("button:has(.card-face)").first().click();
  await page.getByText(/Live right now|Transfer pending/).waitFor({ timeout: 20000 });
  await page.screenshot({ path: `${SHOTS}/09-collection.png` });
});

await step("profile", async () => {
  await page.goto(`${BASE}/profile`);
  await page.getByText("Manager profile").waitFor();
  await page.screenshot({ path: `${SHOTS}/10-profile.png` });
});

await step("global pack", async () => {
  await page.goto(`${BASE}/packs`);
  await page.getByRole("button", { name: "Choose Global Pack" }).click();
  await page.getByRole("button", { name: "Draw a destination" }).click();
  await page.getByText("Scouting report").waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: /Open a Global Pack/ }).click();
  await page.waitForURL(/\/pack\//, { timeout: 20000 });
  await page.getByRole("button", { name: "Reveal all" }).click();
  await page.getByRole("link", { name: "Play a match" }).waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${SHOTS}/10-global-pack.png` });
});

await step("global cup", async () => {
  await page.goto(`${BASE}/play`);
  await page.getByRole("button", { name: "Play Global Cup" }).click();
  await page.getByText("Pick your card").waitFor();
  await page.locator("button:has(.card-face)").first().click();
  await page.getByRole("button", { name: /Enter .* into the tournament/ }).click();
  await page.waitForURL(/\/tournament\//, { timeout: 30000 });
  await page.getByText("World champion").waitFor({ timeout: 20000 });
  await page.screenshot({ path: `${SHOTS}/11-global-cup.png` });
});

// Security check: the API never leaks a key (none configured, but check shape anyway)
await step("no key leakage", async () => {
  const response = await page.request.get(`${BASE}/api/cards`);
  const text = await response.text();
  if (/api[_-]?key|authorization|bearer/i.test(text)) throw new Error("suspicious credential-like content in API response");
});

console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();
