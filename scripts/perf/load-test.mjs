// Usage (local only; creates and then deletes synthetic members):
//   node scripts/perf/load-test.mjs http://localhost:3000 http://127.0.0.1:54321 <anon key> <service key> 50 10 45
// Keys come from `npx supabase status -o env` (local demo keys). Never point it at a hosted project with real members.
// Controlled LOCAL load test: N virtual members, each signed in, requesting real pages and API routes in a loop.
// Usage: node load.mjs <baseUrl> <supabaseUrl> <anonKey> <serviceKey> <members> <concurrency> <seconds>
// Measures what THIS machine (app + local Supabase in Docker) does; it is not a production capacity figure.
const [base, sbUrl, anon, service, membersArg, concArg, secsArg] = process.argv.slice(2);
const MEMBERS = Number(membersArg ?? 20), CONC = Number(concArg ?? 10), SECS = Number(secsArg ?? 30);
const PASSWORD = "Load-Test-Pass-1";
const host = new URL(sbUrl).hostname;
// A hosted project (staging) only with an explicit opt-in: the test creates and deletes accounts there.
if (!["127.0.0.1", "localhost"].includes(host) && process.env.ALLOW_REMOTE_LOAD_TEST !== "1") {
  console.error(`Refusing to load-test ${host}: set ALLOW_REMOTE_LOAD_TEST=1 for a staging project (never production).`);
  process.exit(1);
}
const ref = host.split(".")[0];
const cookieName = `sb-${ref}-auth-token`;

async function json(url, init) {
  const r = await fetch(url, init);
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${url}: ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}
const admin = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };

async function makeMember(i) {
  const email = `load-${Date.now()}-${i}@example.test`;
  const u = await json(`${sbUrl}/auth/v1/admin/users`, { method: "POST", headers: admin, body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }) });
  // Onboarded, so the app pages render instead of redirecting to onboarding.
  await json(`${sbUrl}/rest/v1/profiles?id=eq.${u.id}`, { method: "PATCH", headers: { ...admin, Prefer: "return=minimal" }, body: JSON.stringify({ onboarding_completed_at: new Date().toISOString(), display_name: `Load ${i}` }) });
  const s = await json(`${sbUrl}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  const cookie = `${cookieName}=base64-${Buffer.from(JSON.stringify(s)).toString("base64url")}`;
  return { id: u.id, token: s.access_token, cookie };
}

const ROUTES = [
  { name: "GET /home", path: "/home", auth: "cookie" },
  { name: "GET /train", path: "/train", auth: "cookie" },
  { name: "GET /nutrition", path: "/nutrition", auth: "cookie" },
  { name: "GET /progress/overview", path: "/progress/overview", auth: "cookie" },
  { name: "GET /faith", path: "/faith", auth: "cookie" },
  { name: "GET /api/v1/workouts", path: "/api/v1/workouts", auth: "bearer" },
  { name: "GET /api/health", path: "/api/health", auth: "none" },
];

const stats = new Map(ROUTES.map((r) => [r.name, { lat: [], errors: 0, statuses: {} }]));
async function hit(member, route) {
  const headers = route.auth === "cookie" ? { cookie: member.cookie } : route.auth === "bearer" ? { authorization: `Bearer ${member.token}` } : {};
  const t0 = performance.now();
  let status = 0;
  try {
    const r = await fetch(base + route.path, { headers, redirect: "manual" });
    status = r.status;
    await r.arrayBuffer();
  } catch {
    status = -1;
  }
  const s = stats.get(route.name);
  s.lat.push(performance.now() - t0);
  s.statuses[status] = (s.statuses[status] ?? 0) + 1;
  if (status !== 200) s.errors++;
}

const pct = (a, p) => (a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : 0);

const members = [];
for (let i = 0; i < MEMBERS; i++) members.push(await makeMember(i));
console.log(`members ready: ${members.length}; concurrency ${CONC}; ${SECS}s`);
// Warm-up: one pass so first-compile costs don't count.
for (const r of ROUTES) await hit(members[0], r);
for (const s of stats.values()) { s.lat = []; s.errors = 0; s.statuses = {}; }

const end = Date.now() + SECS * 1000;
let total = 0;
await Promise.all(Array.from({ length: CONC }, async (_, w) => {
  let k = w;
  while (Date.now() < end) {
    const m = members[k % members.length];
    const r = ROUTES[k % ROUTES.length];
    await hit(m, r);
    total++;
    k += CONC;
  }
}));
console.log(`total requests ${total} in ${SECS}s = ${(total / SECS).toFixed(1)} req/s`);
console.log("route | n | p50 ms | p95 ms | p99 ms | non-200 | statuses");
for (const [name, s] of stats) {
  console.log(`${name} | ${s.lat.length} | ${pct(s.lat, 50).toFixed(0)} | ${pct(s.lat, 95).toFixed(0)} | ${pct(s.lat, 99).toFixed(0)} | ${s.errors} | ${JSON.stringify(s.statuses)}`);
}
// Clean up the synthetic members.
for (const m of members) await fetch(`${sbUrl}/auth/v1/admin/users/${m.id}`, { method: "DELETE", headers: admin });
