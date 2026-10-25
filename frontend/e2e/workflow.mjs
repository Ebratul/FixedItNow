// Real Chrome pass over the booking workflow: accept -> private chat -> arrival -> work finished (payment due) -> review.
// Needs the stack from e2e/README.md plus `node e2e/seed.mjs > e2e/seed.json`. Env: QA_BASE, QA_DATABASE_URL (a *_qa scratch database), CHROME_PATH.
//
// Honest limits: there is no bKash sandbox in the scratch stack, so the "payment verified" step is a SIMULATED paid state written with SQL
// (the real verified-payment path is covered by the API tests against the mock provider). Arrival and start need the appointment time to be
// near, so the booking's window is moved with SQL after it is accepted.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.QA_BASE ?? "http://localhost:3101";
const API = `${BASE}/api/v1`;
const DB = process.env.QA_DATABASE_URL ?? "";
if (!/\/[A-Za-z0-9_]+_qa(\?.*)?$/.test(DB)) throw new Error("QA_DATABASE_URL must point at a scratch database whose name ends in _qa");
const PSQL = (sql) => execFileSync("psql", [DB, "-Atc", sql]).toString().trim();
const seed = JSON.parse(readFileSync(new URL("./seed.json", import.meta.url)));
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const axeSource = readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
mkdirSync(new URL("./shots/", import.meta.url), { recursive: true });
const PW = "correct-horse-battery";

async function call(cookies, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", origin: BASE, cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ") },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const jar = { ...cookies };
  for (const c of res.headers.getSetCookie()) { const [pair] = c.split(";"); const i = pair.indexOf("="); jar[pair.slice(0, i)] = pair.slice(i + 1); }
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json, jar };
}
async function newCustomer(email, name) {
  let r = await call({}, "POST", "/auth/sign-up/email", { name, email, password: PW });
  if (r.status !== 200) throw new Error(`signup ${r.status}`);
  PSQL(`UPDATE "user" SET "emailVerified"=true WHERE email='${email}'`);
  r = await call({}, "POST", "/auth/sign-in/email", { email, password: PW });
  if (r.status !== 200) throw new Error(`signin ${r.status}`);
  return r.jar;
}

const stamp = Date.now().toString(36);
const customerCookies = await newCustomer(`qa-wf-${stamp}@example.com`, "Nadia Chowdhury");
const workerCookies = seed.cookies.worker;
const strangerCookies = seed.cookies.cust1;

// a booking request (the request form itself is covered by browse.mjs/unit tests; here we start from the request)
const profileId = (await call(workerCookies, "GET", "/me")).body.worker.profile.id;
const start = new Date(Date.now() + 6 * 86_400_000); start.setUTCHours(6, 0, 0, 0);
const created = await call(customerCookies, "POST", "/bookings", { workerId: profileId, categorySlug: "electrical", description: "Replace the bathroom light fitting.", serviceArea: "Dhaka", serviceAddress: "Flat 4B, Road 11, Banani", startAt: start.toISOString(), durationMinutes: 60 });
if (created.status !== 201) throw new Error(`booking ${created.status} ${JSON.stringify(created.body)}`);
const bookingId = created.body.booking.id;

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const consoleErrors = [];
async function ctxFor(cookies, width = 430) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addCookies(Object.entries(cookies).map(([name, value]) => ({ name, value, url: BASE })));
  context.on("page", (p) => {
    p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`${p.url()} :: ${m.text().slice(0, 160)}`); });
    p.on("response", (r) => { if (r.status() === 404) consoleErrors.push(`404 ${r.url()}`); });
    p.on("pageerror", (e) => consoleErrors.push(`${p.url()} :: pageerror ${String(e).slice(0, 160)}`));
  });
  return context;
}
const results = [];
async function step(name, fn) {
  try { await fn(); results.push(`PASS  ${name}`); } catch (e) { results.push(`FAIL  ${name}: ${String(e).split("\n")[0]}`); }
}
async function audit(page, label) {
  for (const width of [375, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.evaluate(axeSource);
    const axe = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0].target.join(" ")}`));
    results.push(`${overflow <= 0 && axe.length === 0 ? "PASS" : "FAIL"}  layout+axe ${label} @${width}px overflow=${overflow} axe=${JSON.stringify(axe)}`);
  }
  await page.setViewportSize({ width: 430, height: 900 });
}
const shot = (page, name) => page.screenshot({ path: new URL(`./shots/workflow-${name}.png`, import.meta.url).pathname, fullPage: true });

const customerCtx = await ctxFor(customerCookies);
const workerCtx = await ctxFor(workerCookies);
const strangerCtx = await ctxFor(strangerCookies);
const cust = await customerCtx.newPage();
const work = await workerCtx.newPage();
const other = await strangerCtx.newPage();
const url = `${BASE}/bookings/${bookingId}`;

await step("before acceptance: customer sees no chat button, only the note", async () => {
  await cust.goto(url, { waitUntil: "networkidle" });
  await cust.getByText("Messaging opens once the professional accepts the booking.").waitFor();
  if ((await cust.getByRole("button", { name: /^Chat with/ }).count()) > 0) throw new Error("chat button visible before acceptance");
});
await step("professional accepts the request in the UI", async () => {
  await work.goto(url, { waitUntil: "networkidle" });
  await work.getByRole("button", { name: "Accept request" }).click();
  await work.getByRole("button", { name: "Accept and confirm" }).click();
  await work.getByText("Booking confirmed. The time is now reserved.").waitFor();
});
await step("chat opens for the customer; a stranger gets 'not found'", async () => {
  await cust.reload({ waitUntil: "networkidle" });
  await cust.getByRole("button", { name: "Chat with Rahim Uddin" }).waitFor();
  await other.goto(url, { waitUntil: "networkidle" });
  await other.getByText("Booking not found").waitFor();
  const r = await call(strangerCookies, "GET", `/bookings/${bookingId}/chat`);
  if (r.status !== 404) throw new Error(`stranger chat API gave ${r.status}`);
});
await step("customer and professional exchange messages; they persist after a reload", async () => {
  await cust.getByRole("button", { name: "Chat with Rahim Uddin" }).click();
  await cust.getByText(/No messages yet/).waitFor();
  await cust.getByLabel(/Message the professional/).fill("Hello! Please bring a ladder.\n<b>Thanks</b>");
  await cust.getByRole("button", { name: "Send message" }).click();
  await cust.getByText("<b>Thanks</b>", { exact: false }).waitFor();
  if ((await cust.locator("b").count()) > 0) throw new Error("message markup was rendered as HTML");
  await cust.getByText("Sending…").waitFor({ state: "detached", timeout: 10000 });
  await audit(cust, "booking page with chat open");
  await shot(cust, "customer-chat");
  await work.reload({ waitUntil: "networkidle" });
  await work.getByRole("button", { name: /^Chat with/ }).click();
  await work.getByText("Please bring a ladder.", { exact: false }).waitFor({ timeout: 15000 });
  await work.getByLabel(/Message the customer/).fill("Will do, see you soon.");
  await work.getByRole("button", { name: "Send message" }).click();
  await cust.getByText("Will do, see you soon.").waitFor({ timeout: 15000 }); // arrives by polling
  await cust.reload({ waitUntil: "networkidle" });
  await cust.getByRole("button", { name: "Chat with Rahim Uddin" }).click();
  await cust.getByText("Please bring a ladder.", { exact: false }).waitFor();
  await cust.getByText("Will do, see you soon.").waitFor();
});

// Arrival and start are only offered close to the appointment: move this booking's window (scratch database only).
PSQL(`UPDATE booking SET "startAt" = (now() AT TIME ZONE 'UTC') + interval '10 minutes', "endAt" = (now() AT TIME ZONE 'UTC') + interval '70 minutes' WHERE id='${bookingId}'`);

await step("professional reports arrival; the customer sees it labelled as self-reported", async () => {
  await work.reload({ waitUntil: "networkidle" });
  await work.getByRole("button", { name: "I have arrived" }).click();
  await work.getByText(/does not check your location/).waitFor();
  await work.getByRole("button", { name: "Yes, I have arrived" }).click();
  await work.getByText("The customer has been told you arrived.").waitFor();
  if ((await work.getByRole("button", { name: "I have arrived" }).count()) > 0) throw new Error("arrive offered twice");
  await cust.goto(url, { waitUntil: "networkidle" });
  await cust.getByText("Professional arrived").first().waitFor();
  await cust.getByText(/reported by the professional \(location is not verified\)/).waitFor();
});
await step("work finished: customer sees payment due, no review form and no way to complete without paying", async () => {
  await work.getByRole("button", { name: "Start job" }).click();
  await work.getByRole("button", { name: "Start job" }).last().click();
  await work.getByText("Job started.").waitFor();
  await work.getByRole("button", { name: "Mark job finished" }).click();
  await work.getByRole("button", { name: "Mark finished" }).click();
  await work.getByText(/Marked as finished/).waitFor();
  await cust.reload({ waitUntil: "networkidle" });
  await cust.getByText("The work is finished: payment is due").waitFor();
  await cust.getByRole("heading", { name: "Payment due" }).waitFor();
  await cust.getByRole("link", { name: "Pay now" }).waitFor();
  for (const forbidden of [/Your review/, /Confirm work is complete/]) if ((await cust.getByText(forbidden).count()) > 0) throw new Error(`unexpected: ${forbidden}`);
  const r = await call(customerCookies, "POST", `/bookings/${bookingId}/review`, { rating: 5 });
  if (r.status !== 422) throw new Error(`review before payment gave ${r.status}`);
  await audit(cust, "booking page, payment due");
  await shot(cust, "customer-payment-due");
  await work.getByText(/completes after the customer.s payment is verified/).waitFor();
});
await step("the checkout page shows the server-side amount and the available provider state", async () => {
  await cust.getByRole("link", { name: "Pay now" }).click();
  await cust.getByRole("heading", { name: "Pay for your booking" }).waitFor();
  await cust.getByText("৳500").first().waitFor();
});

// SIMULATED verified payment (scratch database only; not a real bKash payment).
PSQL(`INSERT INTO payment (id, reference, "bookingId", "customerId", provider, status, "amountBdt", "providerPaymentId", "providerTransactionId", "succeededAt", "updatedAt")
      SELECT gen_random_uuid()::text, 'FINWF' || substr(md5(id), 1, 20), id, "customerId", 'BKASH', 'SUCCEEDED', "agreedAmountBdt", 'QA-' || id, 'QATRX-' || id, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC' FROM booking WHERE id='${bookingId}'`);
PSQL(`UPDATE booking SET status='COMPLETED', "completedAt"=(now() AT TIME ZONE 'UTC') WHERE id='${bookingId}'`);

await step("after (simulated) verified payment the customer can review, and the review reaches the professional's profile", async () => {
  await cust.goto(url, { waitUntil: "networkidle" });
  await cust.getByText("Your review").first().waitFor();
  await cust.getByLabel("5 stars").check({ force: true });
  await cust.getByLabel("Your review (optional)").fill("Called ahead and fixed it in half an hour.");
  await cust.getByRole("button", { name: "Post review" }).click();
  await cust.getByText("Your review is now public").waitFor();
  await work.reload({ waitUntil: "networkidle" });
  await work.getByText("Customer review").waitFor();
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(`${BASE}/workers/${seed.slug}`, { waitUntil: "networkidle" });
  await anon.getByText("Called ahead and fixed it in half an hour.").waitFor();
  await anon.getByText("Nadia").first().waitFor();
  await shot(anon, "public-profile");
});
await step("a stranger cannot review that booking", async () => {
  const r = await call(strangerCookies, "POST", `/bookings/${bookingId}/review`, { rating: 1 });
  if (r.status !== 404) throw new Error(`stranger review gave ${r.status}`);
});

await browser.close();
const failed = results.filter((r) => r.startsWith("FAIL"));
const out = { results, consoleErrors: [...new Set(consoleErrors)] };
writeFileSync(new URL("./workflow-result.json", import.meta.url), JSON.stringify(out, null, 2));
console.log(results.join("\n"));
console.log(`console errors: ${out.consoleErrors.length}`);
for (const e of out.consoleErrors) console.log(`  ${e}`);
process.exit(failed.length ? 1 : 0);
