// Real Chrome: email sign-up with a one-time code, the unverified-login path, the standalone verify page,
// and overflow/axe on the auth pages. Needs the stack from e2e/README.md started with MAIL_TRANSPORT=console
// and the API's output written to QA_BACKEND_LOG (the dev mail transport prints each code there; production
// never does: the console transport is refused outside development).
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
const BASE = process.env.QA_BASE ?? "http://localhost:3101";
const LOG = process.env.QA_BACKEND_LOG;
if (!LOG) throw new Error("QA_BACKEND_LOG must point at the API's log file");
const axeSource = readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const results = [];
const PASSWORD = "correct-horse-battery";
const stamp = Date.now().toString(36);

/** The most recent 6-digit code mailed to `email`, read from the dev mail log. */
function latestCode(email) {
  const text = readFileSync(LOG, "utf8");
  const blocks = text.split("[dev mail] verify-otp to ").slice(1).filter((b) => b.startsWith(email));
  const last = blocks.at(-1);
  return last ? /\n\s{4}(\d{6})\n/.exec(last)?.[1] : undefined;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitForCode(email, before) {
  for (let i = 0; i < 40; i++) {
    const code = latestCode(email);
    if (code && code !== before) return code;
    await sleep(250);
  }
  throw new Error("no code appeared in the dev mail log");
}
async function flow(name, fn, width = 430) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  try { await fn(page, context); results.push(`PASS  ${name}`); } catch (e) { results.push(`FAIL  ${name}: ${String(e).split("\n")[0]}`); }
  await context.close();
}
async function register(page, email, password = PASSWORD) {
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
  await page.getByLabel("Full name", { exact: true }).fill("Otp Tester");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByText("Enter your verification code").waitFor();
}

const a = `otp-a-${stamp}@example.com`;
await flow("sign up -> code step shown, no account data in the URL, resend is on cooldown", async (page) => {
  await register(page, a);
  if (page.url().includes("otp-a") || page.url().includes("token")) throw new Error("account data in URL");
  const resend = page.getByRole("button", { name: /Send a new code in/ });
  if (!(await resend.isDisabled())) throw new Error("resend not on cooldown");
  if ((await page.getByRole("button", { name: "Verify email" }).isEnabled())) throw new Error("verify enabled without a code");
});
await flow("wrong code is refused with a clear message; correct code signs in and lands on onboarding", async (page, ctx) => {
  const email = `otp-b-${stamp}@example.com`;
  await register(page, email);
  const code = await waitForCode(email);
  const wrong = code === "000000" ? "000001" : "000000";
  await page.getByLabel("6-digit code", { exact: true }).fill(wrong);
  await page.getByRole("button", { name: "Verify email" }).click();
  await page.getByText(/code or password isn't right/).waitFor();
  const before = await ctx.cookies();
  if (before.some((c) => c.name.includes("session_token"))) throw new Error("session exists before verification");
  await page.getByLabel("6-digit code", { exact: true }).fill(`${code.slice(0, 3)} ${code.slice(3)}`); // pasted with a space
  await page.getByRole("button", { name: "Verify email" }).click();
  await page.waitForURL(/\/onboarding/);
  const cookies = await ctx.cookies();
  const session = cookies.find((c) => c.name.includes("session_token"));
  if (!session || !session.httpOnly) throw new Error("session cookie missing or not HttpOnly");
  await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
  await page.getByText(email).first().waitFor();
});
await flow("replaying a used code fails", async (page) => {
  const email = `otp-c-${stamp}@example.com`;
  await register(page, email);
  const code = await waitForCode(email);
  const second = await page.context().newPage();
  await page.getByLabel("6-digit code", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Verify email" }).click();
  await page.waitForURL(/\/onboarding/);
  await second.goto(`${BASE}/verify-email`, { waitUntil: "networkidle" });
  await second.getByLabel("Email", { exact: true }).fill(email);
  await second.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await second.getByLabel("6-digit code", { exact: true }).fill(code);
  await second.getByRole("button", { name: "Verify email" }).click();
  await second.getByText(/code or password isn't right/).waitFor();
});
await flow("closed the tab: log in -> code step -> verify (unverified login path)", async (page) => {
  const email = `otp-d-${stamp}@example.com`;
  await register(page, email);
  const first = await waitForCode(email);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByText("Enter your verification code").waitFor();
  // the first code is still the current one (the server's per-address cooldown refused to rotate it)
  await page.getByLabel("6-digit code", { exact: true }).fill(first);
  await page.getByRole("button", { name: "Verify email" }).click();
  await page.waitForURL(/\/(account|onboarding)/);
});
await flow("standalone verify page: a code without the password is refused", async (page) => {
  const email = `otp-e-${stamp}@example.com`;
  await register(page, email);
  const code = await waitForCode(email);
  await page.goto(`${BASE}/verify-email`, { waitUntil: "networkidle" });
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-different-password-123");
  await page.getByLabel("6-digit code", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Verify email" }).click();
  await page.getByText(/code or password isn't right/).waitFor();
});
await flow("Google button is honest when Google is not configured, and OAuth errors show safe text", async (page) => {
  await page.goto(`${BASE}/login?error=account_not_linked`, { waitUntil: "networkidle" });
  await page.getByText(/connect Google from your account page/).waitFor();
  await page.goto(`${BASE}/login?error=state_mismatch`, { waitUntil: "networkidle" });
  await page.getByText(/sign-in session expired/).waitFor();
});
await flow("protected pages redirect to login when signed out", async (page) => {
  await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/login\?next=%2Faccount/);
});

// overflow + axe, including the code step (register -> code)
const widths = [375, 430, 768, 1366, 1440];
const audit = [];
for (const width of widths) {
  for (const [name, path, setup] of [
    ["login", "/login"], ["register", "/register"], ["verify-email page", "/verify-email"],
    ["register: code step", "/register", async (page, w) => register(page, `otp-w${w}-${stamp}@example.com`)],
  ]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    if (setup) await setup(page, width);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.evaluate(axeSource);
    const axe = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations.map((v) => `${v.id} x${v.nodes.length}`));
    audit.push({ width, name, overflow, axe });
    await context.close();
  }
}
await browser.close();
console.log(results.join("\n"));
console.log(`overflow/axe: ${audit.length} checks, overflow=${audit.filter((a) => a.overflow > 0).length}, axe violations=${audit.filter((a) => a.axe.length).length}`);
for (const a of audit.filter((x) => x.overflow > 0 || x.axe.length)) console.log(`  ${a.width}px ${a.name}: overflow=${a.overflow} axe=${a.axe}`);
process.exitCode = results.some((r) => r.startsWith("FAIL")) || audit.some((a) => a.overflow > 0 || a.axe.length) ? 1 : 0;
