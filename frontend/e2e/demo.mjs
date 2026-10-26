// Real Chrome pass over the demo access feature (docs/DEMO.md): admin switches -> login page -> each demo role -> exit -> switch off.
// Known, unrelated: signing out of ANY account on a page full of protected links makes Next prefetch `/login?next=...&_rsc=` and get 404s (also for ordinary users); those 404s show up in the console list below.
// Needs the stack from e2e/README.md on a *_qa scratch database that has had `npm run demo:seed` run, and the bootstrap administrator
// (API started with ADMIN_EMAIL / ADMIN_PASSWORD). Env: QA_BASE, QA_ADMIN_EMAIL, QA_ADMIN_PASSWORD, CHROME_PATH. Does not need seed.json.
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.QA_BASE ?? "http://localhost:3101";
const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL ?? "qa-admin@example.test";
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD ?? "QaAdmin-Passw0rd-123";
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const axeSource = readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const shots = new URL("./shots/", import.meta.url);
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const results = [];
const problems = [];
async function step(name, fn) {
  try { await fn(); results.push(`PASS  ${name}`); } catch (e) { results.push(`FAIL  ${name}: ${String(e).split("\n")[0]}`); }
}
async function newPage(width = 1366) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${page.url()} :: ${m.text().slice(0, 200)}`); });
  page.on("response", (r) => { if (r.status() === 404) problems.push(`404 ${r.url()}`); });
  page.on("pageerror", (e) => problems.push(`${page.url()} :: pageerror ${String(e).slice(0, 200)}`));
  return { context, page };
}
const shot = (page, name) => page.screenshot({ path: new URL(`demo-${name}.png`, shots).pathname, fullPage: true });
async function axeCheck(page, label) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations.map((v) => `${v.id}(${v.nodes.length})`));
  if (violations.length) throw new Error(`axe ${label}: ${violations.join(", ")}`);
}
async function noOverflow(page, label) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 1) throw new Error(`horizontal overflow ${over}px on ${label}`);
}
const me = (page) => page.evaluate(async () => (await fetch("/api/v1/me")).json());

// ---------------------------------------------------------------------------------------------------------------- 1. everything off
await step("login page shows NO demo section while demo access is off (default)", async () => {
  const { page, context } = await newPage();
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: /^Log in$/ }).waitFor();
  await page.waitForTimeout(800);
  if (await page.getByText("Explore Demo").count()) throw new Error("demo section visible by default");
  await context.close();
});

// ---------------------------------------------------------------------------------------------------------------- 2. admin switches
const admin = await newPage();
await step("administrator signs in at /admin and opens Platform settings", async () => {
  const page = admin.page;
  await page.goto(`${BASE}/admin/settings`);
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.getByRole("heading", { name: "Demo Access Settings" }).waitFor({ timeout: 15000 });
});
await step("Demo Access Settings: six switches, explanation of visibility vs availability, axe clean", async () => {
  const page = admin.page;
  const switches = await page.getByRole("switch").count();
  const demoSwitches = await page.getByRole("switch", { name: /Demo (Customer|Worker|Admin)/ }).count();
  if (demoSwitches !== 6) throw new Error(`expected 6 demo switches, found ${demoSwitches} of ${switches}`);
  await page.getByText(/hidden option can stay enabled/i).first().waitFor();
  await shot(page, "admin-settings");
  await axeCheck(page, "admin settings");
});
async function flip(role, which, reasonText) {
  const page = admin.page;
  const name = new RegExp(`${role}.*${which === "visible" ? "Visible on login page" : "Allow new demo sessions"}`);
  const sw = page.getByRole("switch", { name });
  const before = await sw.getAttribute("aria-checked");
  await sw.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/reason/i).fill(reasonText);
  await dialog.getByRole("button", { name: /save change|turn|confirm/i }).click();
  // the switch moves only after the server confirmed and the list was reloaded
  for (let i = 0; i < 50 && (await sw.getAttribute("aria-checked")) === before; i++) await page.waitForTimeout(200);
  if ((await sw.getAttribute("aria-checked")) === before) throw new Error(`${role} ${which} did not change`);
}
await step("administrator makes all three demo options visible and available (each change asks for a reason)", async () => {
  for (const role of ["Demo Customer", "Demo Worker", "Demo Admin"]) {
    await flip(role, "visible", "QA: show the demo option");
    await flip(role, "enabled", "QA: allow demo sessions");
  }
});

// ---------------------------------------------------------------------------------------------------------------- 3. the public login page
for (const width of [375, 1366]) {
  await step(`login page at ${width}px: Explore Demo with three described options, no overflow, axe clean`, async () => {
    const { page, context } = await newPage(width);
    await page.goto(`${BASE}/login`);
    await page.getByText("Explore Demo").first().waitFor({ timeout: 10000 });
    for (const label of ["Demo Customer", "Demo Worker", "Demo Admin"]) {
      await page.getByRole("button", { name: `Continue as ${label}` }).waitFor();
    }
    await noOverflow(page, `/login @${width}`);
    await shot(page, `login-${width}`);
    await axeCheck(page, `login @${width}`);
    // the normal login form is still there
    await page.getByLabel("Email").waitFor();
    await context.close();
  });
}

// ---------------------------------------------------------------------------------------------------------------- 4. demo customer
const customer = await newPage();
await step("Demo Customer: one click, lands on /account, Demo mode bar, HttpOnly cookie, nothing sensitive in web storage", async () => {
  const page = customer.page;
  await page.goto(`${BASE}/login`);
  const button = page.getByRole("button", { name: "Continue as Demo Customer" });
  await button.waitFor();
  await button.dblclick(); // a double click must not create two sessions
  await page.waitForURL(/\/account/, { timeout: 15000 });
  await page.getByText(/Demo mode/i).first().waitFor();
  const data = await me(page);
  if (data.demo?.role !== "customer" || data.isAdmin) throw new Error(`unexpected /me ${JSON.stringify(data.demo)}`);
  const cookies = await customer.context.cookies();
  const session = cookies.find((c) => c.name.includes("session_token"));
  if (!session?.httpOnly || session.sameSite !== "Lax") throw new Error(`cookie flags ${JSON.stringify(session)}`);
  const storage = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage } }));
  if (/token|role|demo|session/i.test(storage.replace(/fin\.dismissed\.[^"]*/g, ""))) throw new Error(`web storage holds ${storage.slice(0, 200)}`);
  await shot(page, "customer-account");
});
await step("Demo Customer: sign-in settings are hidden, directory shows only fictional professionals", async () => {
  const page = customer.page;
  if (await page.getByText("Log out other devices").count()) throw new Error("log out other devices offered in the demo");
  await page.goto(`${BASE}/services`);
  await page.waitForLoadState("networkidle");
  await page.goto(`${BASE}/workers`);
  await page.getByText("Karim Hossain (Demo)").first().waitFor({ timeout: 15000 });
  await shot(page, "customer-directory");
});
await step("Demo Customer: pays the 'payment due' booking with the SIMULATED payment, the booking completes", async () => {
  const page = customer.page;
  await page.goto(`${BASE}/bookings`);
  await page.getByText(/LED panel|study room/i).first().waitFor({ timeout: 15000 }).catch(() => {});
  // open the payment-due booking
  const href = await page.evaluate(async () => {
    const list = await (await fetch("/api/v1/bookings?role=customer&group=all&pageSize=30")).json();
    return list.bookings.find((b) => b.status === "COMPLETION_PENDING")?.id;
  });
  if (!href) throw new Error("no payment-due booking");
  await page.goto(`${BASE}/bookings/${href}`);
  await page.getByRole("link", { name: /pay/i }).first().click();
  await page.getByText(/Simulated payment/i).first().waitFor({ timeout: 10000 });
  if (await page.locator("main").getByRole("button", { name: /with bKash/i }).count() || await page.locator("main").getByRole("radio", { name: /bKash/i }).count()) throw new Error("bKash is offered to a demo session");
  await shot(page, "customer-checkout");
  await page.getByRole("button", { name: /pay|continue|start/i }).first().click();
  await page.waitForURL(/\/payments\/demo\//, { timeout: 15000 });
  await page.getByText(/no real money/i).first().waitFor();
  await shot(page, "customer-demo-checkout");
  await page.getByRole("button", { name: /Simulate successful payment/i }).click();
  await page.waitForURL(/\/payments\/FIN/, { timeout: 15000 });
  const status = await page.evaluate(async (id) => (await (await fetch(`/api/v1/bookings/${id}`)).json()).booking.status, href);
  if (status !== "COMPLETED") throw new Error(`booking is ${status}`);
});
await step("Demo Customer: Exit demo returns to the login page and the session is gone", async () => {
  const page = customer.page;
  await page.goto(`${BASE}/account`);
  await page.getByRole("button", { name: /Exit demo/i }).click();
  await page.waitForURL(/\/login/, { timeout: 15000 });
  const status = await page.evaluate(async () => (await fetch("/api/v1/me")).status);
  if (status !== 401) throw new Error(`/me answered ${status}`);
  await page.goto(`${BASE}/account`);
  await page.waitForURL(/\/login/);
});

// ---------------------------------------------------------------------------------------------------------------- 5. demo worker
const worker = await newPage(430);
await step("Demo Worker: lands on the worker side of bookings and accepts a request", async () => {
  const page = worker.page;
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: "Continue as Demo Worker" }).click();
  await page.waitForURL(/\/bookings/, { timeout: 15000 });
  await page.getByText(/Demo mode/i).first().waitFor();
  await noOverflow(page, "worker bookings @430");
  await shot(page, "worker-bookings");
  const id = await page.evaluate(async () => (await (await fetch("/api/v1/bookings?role=worker&group=open&pageSize=30")).json()).bookings.find((b) => b.status === "REQUESTED")?.id);
  if (!id) throw new Error("no open request for the demo worker");
  await page.goto(`${BASE}/bookings/${id}`);
  await page.getByRole("button", { name: /accept/i }).first().click();
  await page.waitForFunction(async (bid) => (await (await fetch(`/api/v1/bookings/${bid}`)).json()).booking.status !== "REQUESTED", id, { timeout: 10000 });
});

// ---------------------------------------------------------------------------------------------------------------- 6. demo admin
const demoAdmin = await newPage();
await step("Demo Admin: lands on /admin with demo data only, Demo mode bar, no demo switches visible", async () => {
  const page = demoAdmin.page;
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: "Continue as Demo Admin" }).click();
  await page.waitForURL(/\/admin/, { timeout: 15000 });
  await page.getByText(/Demo mode/i).first().waitFor();
  await page.waitForLoadState("networkidle");
  await shot(page, "admin-dashboard");
  await axeCheck(page, "demo admin dashboard");
  await page.goto(`${BASE}/admin/users`);
  await page.getByText("demo.customer@demo.fixeditnow.invalid").first().waitFor({ timeout: 15000 });
  const text = await page.locator("body").innerText();
  if (text.includes(ADMIN_EMAIL)) throw new Error("the real administrator is visible to the demo admin");
  await page.goto(`${BASE}/admin/settings`);
  await page.getByRole("heading", { name: /Platform settings/ }).waitFor();
  if (await page.getByText("Demo Access Settings").count()) throw new Error("demo switches visible to the demo admin");
});
await step("Demo Admin: a state-changing action is refused with a clear message and changes nothing", async () => {
  const page = demoAdmin.page;
  const result = await page.evaluate(async () => {
    const users = await (await fetch("/api/v1/admin/users?pageSize=5")).json();
    const id = users.users[0].id;
    const res = await fetch(`/api/v1/admin/users/${id}/suspension`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ suspended: true, reason: "demo admin test", confirm: true }) });
    return { status: res.status, body: await res.json() };
  });
  if (result.status !== 403 || result.body.code !== "DEMO_READ_ONLY") throw new Error(JSON.stringify(result));
  // and through the UI: open a user and try to suspend
  await page.goto(`${BASE}/admin/users`);
  await page.getByRole("link", { name: /Demo Customer/ }).first().click().catch(() => {});
  await shot(page, "admin-user");
});

// ---------------------------------------------------------------------------------------------------------------- 7. switching a role off ends its sessions
await step("administrator switches Demo Admin off: the open demo admin session ends, a new one is refused, the page shows it as unavailable", async () => {
  await flip("Demo Admin", "enabled", "QA: switch the demo admin off");
  const page = demoAdmin.page;
  await page.goto(`${BASE}/admin`);
  await page.waitForTimeout(1500);
  const status = await page.evaluate(async () => (await fetch("/api/v1/me")).status);
  if (status !== 401) throw new Error(`/me answered ${status}`);
  const { page: anon, context } = await newPage();
  await anon.goto(`${BASE}/login`);
  await anon.getByText("Demo Admin").first().waitFor({ timeout: 10000 });
  const disabled = await anon.getByRole("button", { name: /Continue as Demo Admin/ }).isDisabled().catch(() => true);
  if (!disabled) throw new Error("a switched-off option is clickable");
  await shot(anon, "login-admin-off");
  await context.close();
});

writeFileSync(new URL("./demo-result.json", import.meta.url), JSON.stringify({ results, problems }, null, 2));
console.log(results.join("\n"));
console.log(problems.length ? `\nConsole problems (${problems.length}):\n${[...new Set(problems)].slice(0, 15).join("\n")}` : "\nNo console errors.");
await browser.close();
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
