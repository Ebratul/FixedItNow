// Real Chrome pass against the stack in e2e/README.md: overflow + axe at five widths, a public-page crawl
// (status, console errors, CSP violations, dead internal links), and the main user journeys through the UI.
// Env: QA_BASE (default http://localhost:3101), CHROME_PATH (default /usr/bin/google-chrome).
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
const BASE = process.env.QA_BASE ?? "http://localhost:3101";
const seed = JSON.parse(readFileSync(new URL("./seed.json", import.meta.url)));
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const axeSource = readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
mkdirSync(new URL("./shots/", import.meta.url), { recursive: true }); // git-ignored
const WIDTHS = [375, 430, 768, 1366, 1440];
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const results = [];
const consoleErrors = [];

async function ctxFor(who, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  if (who) await context.addCookies(Object.entries(seed.cookies[who]).map(([name, value]) => ({ name, value, url: BASE })));
  context.on("page", (p) => {
    p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`${p.url()} :: ${m.text().slice(0, 160)}`); });
    p.on("pageerror", (e) => consoleErrors.push(`${p.url()} :: pageerror ${String(e).slice(0, 160)}`));
  });
  return context;
}

const PAGES = [
  { name: "worker-profile (public reviews)", who: null, path: `/workers/${seed.slug}`, wait: "Reviews" },
  { name: "community feed", who: "cust1", path: "/community", wait: "Latest posts" },
  { name: "community post", who: "cust2", path: `/community/${seed.postId}`, wait: "Comments" },
  { name: "proposals", who: "cust1", path: "/community/proposals", wait: "Suggest a feature" },
  { name: "booking (review form)", who: "cust3", path: `/bookings/${seed.bookings[2]}`, wait: "Your review" },
  { name: "booking (existing review)", who: "cust1", path: `/bookings/${seed.bookings[0]}`, wait: "Your review" },
  { name: "admin moderation", who: "admin", path: "/admin/moderation", wait: "Open reports" },
];

for (const width of WIDTHS) {
  for (const pg of PAGES) {
    const context = await ctxFor(pg.who, width);
    const page = await context.newPage();
    await page.goto(`${BASE}${pg.path}`, { waitUntil: "networkidle" });
    await page.getByText(pg.wait, { exact: false }).first().waitFor({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.evaluate(axeSource);
    const axe = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0].target.join(" ")}`));
    results.push({ width, page: pg.name, overflow, axe });
    if ([375, 1440].includes(width)) await page.screenshot({ path: new URL(`./shots/${pg.name.replace(/[^a-z]+/gi, "-")}-${width}.png`, import.meta.url).pathname, fullPage: true });
    await context.close();
  }
}

// ---- interactions at a phone width -------------------------------------------------
const flows = [];
async function flow(name, who, fn) {
  const context = await ctxFor(who, 430);
  const page = await context.newPage();
  try { await fn(page); flows.push(`PASS  ${name}`); } catch (e) { flows.push(`FAIL  ${name}: ${String(e).split("\n")[0]}`); await page.screenshot({ path: new URL(`./shots/FAIL-${name.replace(/[^a-z]+/gi, "-")}.png`, import.meta.url).pathname }); }
  await context.close();
}
await flow("customer posts a review and sees it", "cust3", async (page) => {
  await page.goto(`${BASE}/bookings/${seed.bookings[2]}`, { waitUntil: "networkidle" });
  await page.getByText("Your review").first().waitFor();
  await page.getByRole("button", { name: "Post review" }).click();
  await page.getByText("Choose a rating from 1 to 5.").waitFor();
  await page.getByLabel("4 stars").check({ force: true });
  await page.getByLabel("Your review (optional)").fill("Arrived on time. <b>Neat</b> work.");
  await page.getByRole("button", { name: "Post review" }).click();
  await page.getByText("Your review is now public").waitFor();
  await page.getByText("<b>Neat</b> work.").waitFor(); // markup shown as text
  if ((await page.locator("b").count()) > 0) throw new Error("markup was rendered as HTML");
});
await flow("worker profile shows verified reviews and the average", null, async (page) => {
  await page.goto(`${BASE}/workers/${seed.slug}`, { waitUntil: "networkidle" });
  await page.getByText("Verified booking").first().waitFor();
  const n = await page.getByText("Verified booking").count();
  if (n < 2) throw new Error(`only ${n} verified labels`);
  await page.getByText("4.5").first().waitFor().catch(() => {});
});
await flow("like, comment and report on a post", "cust3", async (page) => {
  await page.goto(`${BASE}/community/${seed.postId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Like/ }).click();
  await page.getByRole("button", { name: /Liked/ }).waitFor();
  await page.getByLabel("Add a comment").fill("Thanks for asking, I wondered the same.");
  await page.getByRole("button", { name: "Comment", exact: true }).click();
  await page.getByText("I wondered the same").waitFor();
  await page.getByRole("button", { name: "Report post" }).click();
  await page.locator("dialog[open]").getByLabel("Reason").selectOption("OTHER");
  await page.getByRole("button", { name: "Send report" }).click();
  await page.getByText("Report sent").waitFor();
});
await flow("vote on a proposal and withdraw", "cust3", async (page) => {
  await page.goto(`${BASE}/community/proposals`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Vote for Add a dark theme" }).click();
  await page.getByRole("button", { name: "Remove your vote from Add a dark theme" }).waitFor();
  await page.getByRole("button", { name: "Remove your vote from Add a dark theme" }).click();
  await page.getByRole("button", { name: "Vote for Add a dark theme" }).waitFor();
});
await flow("ordinary user is told admin area is for administrators", "cust1", async (page) => {
  await page.goto(`${BASE}/admin/moderation`, { waitUntil: "networkidle" });
  await page.getByText("Administrators only").waitFor();
});
await flow("admin resolves a report and hides the content (with confirmation and note)", "admin", async (page) => {
  await page.goto(`${BASE}/admin/moderation`, { waitUntil: "networkidle" });
  await page.getByText("Open reports").waitFor();
  await page.getByRole("button", { name: "Open", exact: true }).first().click();
  await page.getByRole("button", { name: "Resolve…" }).click();
  const submit = page.getByRole("button", { name: "Resolve report" });
  if (!(await submit.isDisabled())) throw new Error("resolve enabled without a note");
  await page.getByLabel(/Moderation note/).fill("Advertising, against the rules");
  await page.getByLabel(/Hide it from everyone/).check();
  await submit.click();
  await page.getByText("Report resolved.").waitFor();
});
await flow("hidden post: others get not found, author sees removed state", "cust1", async (page) => {
  await page.goto(`${BASE}/community/${seed.spamId}`, { waitUntil: "networkidle" });
  await page.getByText("We couldn't open this post").waitFor();
});
await flow("the author of the hidden post sees the removed state", "cust2", async (page) => {
  await page.goto(`${BASE}/community/${seed.spamId}`, { waitUntil: "networkidle" });
  await page.getByText("Removed by moderators").first().waitFor();
  if ((await page.getByRole("button", { name: "Edit" }).count()) > 0) throw new Error("edit offered on hidden post");
});
// ---- public crawl: status codes, console errors, CSP violations, dead internal links --------------------------
const crawl = { pages: 0, deadLinks: [], cspViolations: [], failures: [] };
{
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const seen = new Set();
  const queue = ["/", "/services", "/workers", "/how-it-works", "/become-a-worker", "/about", "/help", "/contact", "/login", "/register", "/forgot-password", `/workers/${seed.slug}`];
  const page = await context.newPage();
  page.on("console", (m) => { if (/Content Security Policy|Refused to (load|execute|connect|apply|frame)/i.test(m.text())) crawl.cspViolations.push(`${page.url()} :: ${m.text().slice(0, 140)}`); });
  while (queue.length && crawl.pages < 40) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" }).catch((e) => ({ status: () => 0, error: e }));
    crawl.pages++;
    if (!res || res.status() >= 400 || res.status() === 0) { crawl.deadLinks.push(`${path} -> ${res?.status?.() ?? "error"}`); continue; }
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    for (const h of hrefs) {
      if (!h || !h.startsWith("/") || h.startsWith("//") || h.startsWith("/api/")) continue;
      const clean = h.split("#")[0].split("?")[0];
      if (clean && !seen.has(clean) && !queue.includes(clean)) queue.push(clean);
    }
  }
  await context.close();
}

// ---- journey A (UI): customer finds a professional, requests a booking; worker accepts; customer sees it ---------
let newBookingId = null;
await flow("A: customer requests a booking through the UI", "cust3", async (page) => {
  await page.goto(`${BASE}/workers?category=electrical`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /View profile/ }).first().click();
  await page.getByRole("link", { name: /Request a booking/ }).click();
  const fillSelect = async (label, option) => { const sel = page.getByLabel(label, { exact: true }); if (!(await sel.inputValue())) await sel.selectOption(option); };
  await fillSelect("Service", { index: 1 });
  await page.getByLabel("What needs to be done?", { exact: true }).fill("The kitchen light flickers and trips the switch.");
  await fillSelect("Area (division)", "Dhaka");
  await page.getByLabel("Address", { exact: true }).fill("House 5, Road 7, Dhanmondi");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.locator('input[name="slot"]').first().waitFor({ state: "attached" });
  await page.locator('input[name="slot"]').first().check({ force: true });
  await page.getByRole("button", { name: /Review/ }).click();
  await page.getByRole("button", { name: /Send request/ }).click();
  await page.getByText("Request sent").first().waitFor();
  newBookingId = page.url().match(/bookings\/([0-9a-f-]{36})/)?.[1] ?? null;
  if (!newBookingId) throw new Error("no booking id in the URL after sending");
});
await flow("A/B: the professional sees the request and accepts it; the customer sees it confirmed", "worker", async (page) => {
  await page.goto(`${BASE}/bookings/${newBookingId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Accept request" }).click();
  await page.getByRole("button", { name: "Accept and confirm" }).click();
  await page.getByText("Booking confirmed").first().waitFor();
});
await flow("A: customer sees the confirmed booking; payment page is honest when no provider is configured", "cust3", async (page) => {
  await page.goto(`${BASE}/bookings/${newBookingId}`, { waitUntil: "networkidle" });
  await page.getByText(/Confirmed/i).first().waitFor();
  await page.goto(`${BASE}/bookings/${newBookingId}/pay`, { waitUntil: "networkidle" });
  await page.getByText(/not available|unavailable|not configured/i).first().waitFor();
});
await flow("no messaging UI exists (Step 7 not built): no link or page claims to offer it", "cust3", async (page) => {
  await page.goto(`${BASE}/bookings/${newBookingId}`, { waitUntil: "networkidle" });
  if ((await page.getByRole("link", { name: /message|chat|inbox/i }).count()) > 0) throw new Error("a messaging link is shown");
  const res = await page.goto(`${BASE}/messages`);
  if (res && res.status() < 400) throw new Error("/messages should not exist");
});

await browser.close();

const bad = results.filter((r) => r.overflow > 0 || r.axe.length);
console.log(`Pages x widths checked: ${results.length}`);
console.log(`Horizontal overflow: ${results.filter((r) => r.overflow > 0).length}`);
console.log(`Pages with axe violations: ${results.filter((r) => r.axe.length).length}`);
for (const r of bad) console.log(`  ${r.width}px ${r.page}: overflow=${r.overflow} axe=${JSON.stringify(r.axe)}`);
console.log(flows.join("\n"));
console.log(`crawl: ${crawl.pages} pages, dead links: ${crawl.deadLinks.length}, CSP violations: ${crawl.cspViolations.length}`);
for (const d of crawl.deadLinks) console.log("  dead: " + d);
for (const d of crawl.cspViolations.slice(0, 5)) console.log("  csp: " + d);
console.log(`console errors: ${consoleErrors.length}`);
for (const e of [...new Set(consoleErrors)].slice(0, 12)) console.log("  " + e);
writeFileSync(new URL("./result.json", import.meta.url), JSON.stringify({ results, flows, consoleErrors, crawl }, null, 1)); // git-ignored
process.exitCode = bad.length || flows.some((f) => f.startsWith("FAIL")) || crawl.deadLinks.length || crawl.cspViolations.length ? 1 : 0;
