// Real Chrome pass over the ADMIN panel against the stack in e2e/README.md (scratch database, never production).
// Crawls every admin page as a super administrator (overflow, axe, console errors), proves a restricted admin and an
// ordinary user are refused, then drives the main flows through the UI: private document view, user suspension, roles,
// categories, support round-trip, announcement banner, audit verification, settings, AI knowledge sync.
// Needs e2e/seed.json (from seed.mjs), QA_BASE and QA_DATABASE_URL (database name must end in _qa).
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { deflateSync } from "node:zlib";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.QA_BASE ?? "http://localhost:3101";
const API = `${BASE}/api/v1`;
const DB = process.env.QA_DATABASE_URL ?? "";
if (!/\/[A-Za-z0-9_]+_qa(\?.*)?$/.test(DB)) throw new Error("QA_DATABASE_URL must point at a scratch database whose name ends in _qa");
const vis = (loc) => loc.locator("visible=true").first(); // hidden duplicates (desktop sidebar on a phone, kept-alive previous route) must not satisfy a wait
const PSQL = (sql) => execFileSync("psql", [DB, "-Atc", sql]).toString().trim();
const seed = JSON.parse(readFileSync(new URL("./seed.json", import.meta.url)));
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const axeSource = readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
mkdirSync(new URL("./shots/", import.meta.url), { recursive: true });
const PW = "correct-horse-battery";

// ---------------------------------------------------------------- tiny API client (cookie jar)
class Client {
  constructor(cookies = {}) { this.cookies = new Map(Object.entries(cookies)); }
  async call(method, path, body, headers = {}) {
    const raw = body instanceof Uint8Array;
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { ...(raw ? {} : { "content-type": "application/json" }), origin: BASE, cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "), ...headers },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
      redirect: "manual",
    });
    for (const c of res.headers.getSetCookie()) { const [pair] = c.split(";"); const i = pair.indexOf("="); this.cookies.set(pair.slice(0, i), pair.slice(i + 1)); }
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json };
  }
}
async function newUser(email, name) {
  const c = new Client();
  const r = await c.call("POST", "/auth/sign-up/email", { name, email, password: PW });
  if (r.status !== 200) throw new Error(`signup ${email}: ${r.status}`);
  PSQL(`UPDATE "user" SET "emailVerified"=true WHERE email='${email}'`);
  const s = await c.call("POST", "/auth/sign-in/email", { email, password: PW });
  if (s.status !== 200) throw new Error(`signin ${email}: ${s.status}`);
  return { c, id: (await c.call("GET", "/me")).body.user.id, email, name };
}
const must = (r, what) => { if (r.status >= 300) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.body)}`); return r.body; };

function png(size = 48) { // a real, decodable PNG (so the browser can render it)
  const crc = (buf) => { let c, crcv = 0xffffffff; for (const b of buf) { c = (crcv ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcv = (crcv >>> 8) ^ c; } return (crcv ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  const rows = []; for (let y = 0; y < size; y++) { const row = [0]; for (let x = 0; x < size; x++) row.push((x * 5 + y) & 255, (y * 5) & 255, 128); rows.push(Buffer.from(row)); }
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]));
}

// ---------------------------------------------------------------- extra real data through the real API
const admin = new Client(seed.cookies.admin);
const cust1 = new Client(seed.cookies.cust1);
const limited = await newUser("qa-support@example.com", "Sara Support");
PSQL(`UPDATE "user" SET role='ADMIN', "adminRoleId"=(SELECT id FROM admin_role WHERE key='support_agent') WHERE email='qa-support@example.com'`);
const victim = await newUser("qa-victim@example.com", "Vic Victim");
const pendingWorker = await newUser("qa-pending@example.com", "Pia Pending");
must(await pendingWorker.c.call("PUT", "/me/worker-profile", { displayName: "Pia Pending", headline: "Painter", bio: "Interior painting and wall finishing in Dhaka, ten years of experience.", experienceYears: 10, languages: ["Bangla"], serviceAreas: ["Dhaka"], services: [{ categorySlug: "painting", pricingModel: "QUOTE" }] }), "pending profile");
must(await pendingWorker.c.call("PUT", "/me/worker-profile/documents/NID_FRONT", png(), { "content-type": "image/png" }), "upload doc");
must(await pendingWorker.c.call("POST", "/me/worker-profile/submit", {}), "submit");
const pendingProfileId = (await pendingWorker.c.call("GET", "/me")).body.worker.profile.id;
const ticket = must(await cust1.call("POST", "/support/tickets", { category: "GENERAL", subject: "My profile photo will not save", body: "Every time I press save nothing happens on my phone." }), "ticket").ticket;
const sup = PSQL(`SELECT id FROM service_category WHERE slug='painting'`);

// ---------------------------------------------------------------- browser
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const consoleErrors = [];
async function ctxFor(cookies, width = 1366) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  if (cookies) await context.addCookies(Object.entries(Object.fromEntries(cookies instanceof Map ? cookies : Object.entries(cookies))).map(([name, value]) => ({ name, value, url: BASE })));
  context.on("page", (p) => {
    p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`${p.url()} :: ${m.text().slice(0, 200)}`); });
    p.on("pageerror", (e) => consoleErrors.push(`${p.url()} :: pageerror ${String(e).slice(0, 200)}`));
  });
  return context;
}

const PAGES = [
  ["/admin", "Dashboard"], ["/admin/system", "Operations"], ["/admin/users", "Users"], [`/admin/users/${victim.id}`, "Vic Victim"], ["/admin/roles", "Admin roles"],
  ["/admin/workers?x=1", "Worker applications"], [`/admin/workers/${pendingProfileId}`, "Pia Pending"], ["/admin/categories", "Service categories"],
  ["/admin/bookings", "Bookings"], [`/admin/bookings/${seed.bookings[0]}`, "Booking"], ["/admin/disputes", "Disputes"], ["/admin/payments", "Payments"],
  ["/admin/finance", "Financial reports"], ["/admin/support", "Support"], [`/admin/support/${ticket.id}`, "profile photo"], ["/admin/moderation", "Moderation"],
  ["/admin/ai", "AI assistant"], ["/admin/announcements", "Announcements"], ["/admin/audit", "Audit log"], ["/admin/settings", "Settings"],
  ["/account/support", "Support"], ["/account/support/new", "New"], ["/account/notifications", "Notifications"],
];
const results = [];
for (const width of [375, 1366]) {
  for (const [path, wait] of PAGES) {
    const user = path.startsWith("/account") ? seed.cookies.cust1 : seed.cookies.admin;
    const context = await ctxFor(user, width);
    const page = await context.newPage();
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await vis(page.getByText(wait, { exact: false })).waitFor({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    const h1 = await page.locator("h1:visible").count();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.evaluate(axeSource);
    const axe = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0].target.join(" ")}`));
    const failedText = await page.getByText(/Something went wrong|couldn't|Try again/i).count();
    const culprits = overflow > 0 ? await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(e).position !== "fixed").slice(0, 4).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 60)}`)) : [];
    results.push({ width, path, h1, overflow, axe, failedText, culprits });
    await page.screenshot({ path: new URL(`./shots/admin-${path.replace(/[^a-z0-9]+/gi, "-")}-${width}.png`, import.meta.url).pathname, fullPage: true });
    await context.close();
  }
}

// ---------------------------------------------------------------- flows
const flows = [];
async function flow(name, cookies, fn, width = 1366) {
  const context = await ctxFor(cookies, width);
  const page = await context.newPage();
  try { await fn(page); flows.push(`PASS  ${name}`); } catch (e) { flows.push(`FAIL  ${name}: ${String(e).split("\n")[0]}`); await page.screenshot({ path: new URL(`./shots/FAIL-${name.replace(/[^a-z]+/gi, "-")}.png`, import.meta.url).pathname, fullPage: true }); }
  await context.close();
}
const go = async (page, path, text) => { await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" }); if (text) await vis(page.getByText(text, { exact: false })).waitFor({ timeout: 15000 }); };

await flow("ordinary user is told the admin area is for administrators", seed.cookies.cust1, async (page) => { await go(page, "/admin", "Administrators only"); });
await flow("restricted admin (support agent) sees only their sections and is refused elsewhere", new Map(limited.c.cookies), async (page) => {
  await go(page, "/admin/support", "Support");
  const nav = await page.locator("nav[aria-label='Admin sections']").first().innerText();
  if (/Financial reports|Admin roles|Settings|Audit log/.test(nav)) throw new Error(`restricted nav shows forbidden sections: ${nav.replace(/\n/g, "|")}`);
  await go(page, "/admin/finance", "cannot open this page");
  const status = (await limited.c.call("GET", "/admin/finance/summary")).status;
  if (status !== 403) throw new Error(`direct API call answered ${status}`);
});
await flow("dashboard shows real counts", seed.cookies.admin, async (page) => {
  await go(page, "/admin", "Needs attention");
  const users = Number(PSQL(`SELECT count(*) FROM "user"`));
  await vis(page.getByText(String(users), { exact: true })).waitFor({ timeout: 5000 });
});
await flow("document viewer: nothing loads until View; the image renders; the view is audited", seed.cookies.admin, async (page) => {
  await go(page, `/admin/workers/${pendingProfileId}`, "Documents");
  const before = Number(PSQL(`SELECT count(*) FROM audit_log WHERE action='worker.document.view'`));
  if ((await page.locator("img[src*='/documents/']").count()) !== 0) throw new Error("image requested before the click");
  await page.getByRole("button", { name: /^View/ }).first().click();
  const img = page.locator("img[src*='/documents/NID_FRONT']");
  await img.waitFor({ timeout: 10000 });
  await page.waitForFunction(() => { const i = document.querySelector("img[src*='/documents/']"); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 10000 });
  const after = Number(PSQL(`SELECT count(*) FROM audit_log WHERE action='worker.document.view'`));
  if (after !== before + 1) throw new Error(`audit rows ${before} -> ${after}`);
});
await flow("approve a worker application with a note-free approval", seed.cookies.admin, async (page) => {
  await go(page, `/admin/workers/${pendingProfileId}`, "Documents");
  await page.getByRole("button", { name: /Approve/ }).first().click();
  const dlg = page.locator("dialog[open]");
  if (await dlg.count()) await dlg.getByRole("button", { name: /Approve|Confirm/ }).last().click();
  await page.waitForTimeout(1200);
  const st = PSQL(`SELECT "verificationStatus" FROM worker_profile WHERE id='${pendingProfileId}'`);
  if (st !== "VERIFIED") throw new Error(`status ${st}`);
});
await flow("suspend a user from the UI (reason required) and their session dies", seed.cookies.admin, async (page) => {
  await go(page, `/admin/users/${victim.id}`, "Vic Victim");
  await page.getByRole("button", { name: /Suspend/ }).first().click();
  const submit = page.locator("dialog[open]").getByRole("button", { name: /Suspend/ }).last();
  if (!(await submit.isDisabled())) throw new Error("suspend enabled without a reason");
  await page.locator("dialog[open]").getByLabel(/Reason/).fill("Repeated abusive messages to professionals");
  await submit.click();
  await vis(page.getByText(/suspended/i)).waitFor({ timeout: 10000 });
  if ((await victim.c.call("GET", "/me")).status !== 401) throw new Error("session still valid");
});
await flow("create a custom role with the permission matrix", seed.cookies.admin, async (page) => {
  await go(page, "/admin/roles", "Admin roles");
  await page.getByRole("button", { name: /New role|Create role/ }).first().click();
  await page.getByLabel(/^Key/).fill("qa_reader");
  await page.getByLabel(/^Name/).fill("QA reader");
  await page.getByLabel(/^Description/).fill("Reads users and audit only");
  await page.getByLabel(/View users/).check();
  await page.getByRole("button", { name: /Create role|Save role|Save/ }).last().click();
  await vis(page.getByText("QA reader")).waitFor({ timeout: 10000 });
  if (PSQL(`SELECT array_to_string(permissions, ',') FROM admin_role WHERE key='qa_reader'`) !== "users.read") throw new Error("permissions not stored as chosen");
});
await flow("categories: add a subcategory", seed.cookies.admin, async (page) => {
  await go(page, "/admin/categories", "Service categories");
  await page.getByRole("button", { name: /Add (a )?(sub)?category|New category/i }).first().click();
  await page.getByLabel(/^Name/).fill("QA Wall Putty");
  await page.getByLabel(/^Description/).fill("Surface preparation before painting");
  await page.getByLabel(/Parent/i).selectOption({ label: "Painting" });
  await page.getByRole("button", { name: /Create|Save/ }).last().click();
  await vis(page.getByText("QA Wall Putty")).waitFor({ timeout: 10000 });
  if (PSQL(`SELECT count(*) FROM service_category c JOIN service_category p ON p.id=c."parentId" WHERE c.slug='qa-wall-putty' AND p.slug='painting'`) !== "1") throw new Error("subcategory not linked to its parent");
});
await flow("support round trip: staff reply reaches the user, internal note does not", seed.cookies.admin, async (page) => {
  await go(page, `/admin/support/${ticket.id}`, "profile photo");
  await page.getByRole("checkbox", { name: /Internal note/ }).check();
  await page.getByRole("textbox", { name: /Internal note|Reply to the requester/ }).fill("Private: looks like the upload limit.");
  await page.getByRole("button", { name: /Add internal note/ }).click();
  await vis(page.getByText("upload limit")).waitFor({ timeout: 10000 });
  await page.getByRole("checkbox", { name: /Internal note/ }).uncheck();
  await page.getByRole("textbox", { name: /Reply to the requester|Internal note/ }).fill("Please try a smaller photo (under 3 MB).");
  await page.getByRole("button", { name: /Send reply/ }).click();
  await vis(page.getByText("smaller photo")).waitFor({ timeout: 10000 });
  const mine = await cust1.call("GET", `/support/tickets/${ticket.id}`);
  const text = JSON.stringify(mine.body);
  if (!text.includes("smaller photo") || text.includes("upload limit")) throw new Error("user sees wrong messages");
});
await flow("user sees the staff reply as a notification", seed.cookies.cust1, async (page) => {
  await go(page, "/account/notifications", "Notifications");
  await vis(page.getByText(/New reply on your request/)).waitFor({ timeout: 10000 });
});
await flow("announcement: create, publish with confirmation, visible to an anonymous visitor", seed.cookies.admin, async (page) => {
  await go(page, "/admin/announcements", "Announcements");
  await page.getByRole("button", { name: /New announcement|Create announcement/ }).first().click();
  const form = page.locator("form[aria-label='New announcement']");
  await form.getByLabel(/^Title/).fill("Scheduled maintenance on Friday");
  await form.getByLabel(/^Message/).fill("The site will be read-only for 30 minutes on Friday night.");
  await form.getByRole("button", { name: /Save|Create|draft/i }).last().click();
  await vis(page.getByText("Scheduled maintenance on Friday")).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /^Publish/ }).first().click();
  await page.locator("dialog[open]").getByRole("button", { name: /Publish/ }).last().click();
  await page.waitForTimeout(1200);
  const anon = await (await ctxFor(null)).newPage();
  await anon.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await vis(anon.getByText("Scheduled maintenance on Friday")).waitFor({ timeout: 10000 });
});
await flow("audit log lists the actions and the hash chain verifies", seed.cookies.admin, async (page) => {
  await go(page, "/admin/audit", "Audit log");
  await vis(page.getByText("worker.verification.review")).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /Verify/ }).first().click();
  await vis(page.getByText(/chain is (valid|intact)|valid/i)).waitFor({ timeout: 10000 });
});
await flow("settings: change requires a reason and is recorded", seed.cookies.admin, async (page) => {
  await go(page, "/admin/settings", "Settings");
  const before = Number(PSQL(`SELECT count(*) FROM audit_log WHERE action='setting.update'`));
  const input = page.getByRole("spinbutton", { name: /Commission rate/i });
  await input.fill("750");
  await page.getByRole("button", { name: /Review change/ }).and(page.locator(":enabled")).first().click();
  const dlg = page.locator("dialog[open]");
  const go2 = dlg.getByRole("button", { name: /Change|Confirm|Save/ }).last();
  if (!(await go2.isDisabled())) throw new Error("setting change enabled without a reason");
  await dlg.getByLabel(/Reason/).fill("QA run: pilot commission rate");
  await go2.click();
  await page.waitForTimeout(1200);
  if (Number(PSQL(`SELECT count(*) FROM audit_log WHERE action='setting.update'`)) !== before + 1) throw new Error("no audit row");
});
await flow("AI knowledge: write, publish, sync, in sync with the running Python service", seed.cookies.admin, async (page) => {
  await go(page, "/admin/ai", "AI assistant");
  await page.getByRole("button", { name: /New document|Add document/ }).first().click();
  await page.getByLabel(/^Slug/).fill("qa-tipping");
  await page.getByLabel(/^Title/).fill("Tipping a professional");
  await page.getByLabel(/in-app|path|URL/i).first().fill("/help");
  await page.getByLabel(/^Text/).fill("# Tipping a professional\nTipping is optional. FixedItNow never adds a tip to the price; it is agreed between you and the professional.");
  await page.getByRole("button", { name: /Create|Save/ }).last().click();
  await vis(page.getByText("Tipping a professional")).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /^Publish/ }).first().click();
  await page.locator("dialog[open]").getByRole("button", { name: /Publish/ }).last().click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /Sync now/ }).click();
  await page.locator("dialog[open]").getByRole("button", { name: /Sync/ }).last().click();
  await vis(page.getByText(/up to date|in sync/i)).waitFor({ timeout: 15000 });
});
await flow("phone: admin navigation opens and reaches a page", seed.cookies.admin, async (page) => {
  await go(page, "/admin", "Dashboard");
  await page.getByRole("button", { name: "Open admin menu" }).click();
  await page.locator("dialog[open]").getByRole("link", { name: "Users" }).click();
  await page.getByRole("heading", { name: "Users", level: 1 }).waitFor({ timeout: 10000 });
}, 390);

await browser.close();
writeFileSync(new URL("./admin-result.json", import.meta.url), JSON.stringify({ results, flows, consoleErrors }, null, 1));
const bad = results.filter((r) => r.overflow > 0 || r.axe.length || r.h1 !== 1 || r.failedText);
console.log(`pages checked: ${results.length}; with findings: ${bad.length}`);
for (const r of bad) console.log(`  ${r.width}px ${r.path}  h1=${r.h1} overflow=${r.overflow}${r.culprits?.length ? " (" + r.culprits.join(" | ") + ")" : ""} errorText=${r.failedText}${r.axe.length ? "\n      axe: " + r.axe.join("\n           ") : ""}`);
console.log(flows.join("\n"));
console.log(`console errors: ${consoleErrors.length}`);
for (const e of [...new Set(consoleErrors)].slice(0, 15)) console.log("  " + e);
void sup; void must; void admin;
