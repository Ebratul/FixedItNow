// Seeds a DISPOSABLE scratch database through the real HTTP API (via the Next rewrite) so the browser run sees real data.
// Needs: the stack from e2e/README.md, `psql` on PATH, and QA_DATABASE_URL pointing at the SCRATCH database
// (two things are done directly in SQL because they cannot be done through the API: marking the test accounts'
// email verified, and moving bookings to COMPLETED, which in real life needs the appointment time to pass).
// It refuses to run unless the database name ends in _qa.
import { execFileSync } from "node:child_process";
const BASE = process.env.QA_BASE ?? "http://localhost:3101";
const API = `${BASE}/api/v1`;
const PW = "correct-horse-battery";
const DB = process.env.QA_DATABASE_URL ?? "";
if (!/\/[A-Za-z0-9_]+_qa(\?.*)?$/.test(DB)) throw new Error("QA_DATABASE_URL must point at a scratch database whose name ends in _qa");
const PSQL = (sql) => execFileSync("psql", [DB, "-Atc", sql]).toString().trim();

class Client {
  cookies = new Map();
  async call(method, path, body) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { "content-type": "application/json", origin: BASE, cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ") },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json };
  }
}
async function user(email, name) {
  const c = new Client();
  const r = await c.call("POST", "/auth/sign-up/email", { name, email, password: PW });
  if (r.status !== 200) throw new Error(`signup ${email} ${r.status} ${JSON.stringify(r.body)}`);
  PSQL(`UPDATE "user" SET "emailVerified"=true WHERE email='${email}'`);
  const s = await c.call("POST", "/auth/sign-in/email", { email, password: PW });
  if (s.status !== 200) throw new Error(`signin ${email} ${s.status} ${JSON.stringify(s.body)}`);
  const me = await c.call("GET", "/me");
  return { c, id: me.body.user.id, email };
}
const ok = (r, what) => { if (r.status >= 300) throw new Error(`${what}: ${r.status} ${JSON.stringify(r.body)}`); return r.body; };

const out = {};
const admin = await user("qa-admin@example.com", "Admin Alam");
PSQL(`UPDATE "user" SET role='ADMIN' WHERE email='qa-admin@example.com'`);
const cust1 = await user("qa-asha@example.com", "Asha Rahman");
const cust2 = await user("qa-karim@example.com", "Karim Mia");
const cust3 = await user("qa-bina@example.com", "Bina Das");
const worker = await user("qa-worker@example.com", "Rahim Uddin");

ok(await worker.c.call("PUT", "/me/worker-profile", { displayName: "Rahim Uddin", headline: "Licensed electrician", bio: "Ten years of residential wiring, fan and light fitting across Dhaka.", experienceYears: 10, languages: ["Bangla", "English"], serviceAreas: ["Dhaka"], services: [{ categorySlug: "electrical", pricingModel: "FIXED", basePriceBdt: 500 }] }), "profile");
ok(await worker.c.call("POST", "/me/worker-profile/submit", {}), "submit");
const profileId = (await worker.c.call("GET", "/me")).body.worker.profile.id;
ok(await admin.c.call("POST", `/admin/workers/${profileId}/verification`, { decision: "VERIFIED" }), "verify");
const pub = ok(await worker.c.call("POST", "/me/worker-profile/publish", {}), "publish");
out.slug = pub.profile.slug;
ok(await worker.c.call("PUT", "/me/availability", { rules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinute: 480, endMinute: 1200 })) }), "availability");

// three bookings (different customers), then force COMPLETED in the scratch DB (the real flow needs the appointment time to pass)
const bookings = [];
for (const [i, cust] of [cust1, cust2, cust3].entries()) {
  const start = new Date(Date.now() + (3 + i) * 86_400_000); start.setUTCHours(4, 0, 0, 0); // 10:00 Dhaka
  const b = ok(await cust.c.call("POST", "/bookings", { workerId: profileId, categorySlug: "electrical", description: "Ceiling fan is noisy and slow.", serviceArea: "Dhaka", serviceAddress: "House 12, Road 5, Dhanmondi", startAt: start.toISOString(), durationMinutes: 60 }), "booking");
  ok(await worker.c.call("POST", `/bookings/${b.booking.id}/accept`, {}), "accept");
  PSQL(`UPDATE booking SET status='COMPLETED', "completedAt"=now() WHERE id='${b.booking.id}'`);
  bookings.push(b.booking.id);
}
out.bookings = bookings;
ok(await cust1.c.call("POST", `/bookings/${bookings[0]}/review`, { rating: 5, comment: "Quick, tidy and fair price. The fan runs silently now." }), "review1");
ok(await cust2.c.call("POST", `/bookings/${bookings[1]}/review`, { rating: 4, comment: "ভালো কাজ করেছেন, সময়মতো এসেছেন।" }), "review2");
// booking[2] left unreviewed so the review form can be exercised

const post = ok(await cust1.c.call("POST", "/community/posts", { title: "Which ceiling fan brand lasts longest?", body: "Our fan breaks every summer.\nAny recommendations for humid weather?" }), "post").post;
ok(await cust2.c.call("POST", `/community/posts/${post.id}/comments`, { body: "Try a fan with a copper-wound motor." }), "comment");
ok(await cust2.c.call("POST", `/community/posts/${post.id}/reactions`, { type: "LIKE" }), "like");
const spam = ok(await cust2.c.call("POST", "/community/posts", { title: "Cheap deals, call now", body: "Best price guaranteed! Call 01700000000 for a free quote." }), "spam").post;
ok(await cust3.c.call("POST", "/community/reports", { targetType: "POST", targetId: spam.id, reason: "SPAM", details: "Advertising" }), "report");
const reviewRow = PSQL(`SELECT id FROM review LIMIT 1`);
ok(await cust3.c.call("POST", `/reviews/${reviewRow}/report`, { reason: "FRAUD" }), "report review");
const prop = ok(await cust1.c.call("POST", "/feature-proposals", { title: "Add a dark theme", description: "Please add a dark theme for night time use." }), "proposal").proposal;
ok(await cust2.c.call("POST", `/feature-proposals/${prop.id}/vote`, {}), "vote");
out.postId = post.id; out.spamId = spam.id; out.proposalId = prop.id;
out.cookies = {};
for (const [name, u] of Object.entries({ admin, cust1, cust2, cust3, worker })) out.cookies[name] = Object.fromEntries(u.c.cookies);
console.log(JSON.stringify(out));
