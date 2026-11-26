// Controlled LOCAL load test: N virtual members, each signed in, requesting real pages and API routes in a loop.
// Measures what THIS machine (app + local Supabase in Docker) does; it is not a production capacity figure.
//
// Usage (creates synthetic members and always deletes them again, even when the run fails or is interrupted):
//   eval "$(npx supabase status -o env | sed 's/^/export /')"   # local demo keys into ANON_KEY / SERVICE_ROLE_KEY
//   SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
//     node scripts/perf/load-test.mjs http://localhost:3000 http://127.0.0.1:54321 50 10 45
// Keys are read from the environment, never from the command line (where they would show in the process list and
// shell history). Never point it at a hosted project with real members.
import { randomBytes } from "node:crypto";

const args = process.argv.slice(2);
if (args.length > 5) {
  console.error("Keys are no longer taken as arguments: set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in the environment.\n" +
    "Usage: node scripts/perf/load-test.mjs <baseUrl> <supabaseUrl> <members> <concurrency> <seconds>");
  process.exit(1);
}
const [base, sbUrl, membersArg, concArg, secsArg] = args;
const anon = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !sbUrl || !anon || !service) {
  console.error("Usage: SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/perf/load-test.mjs <baseUrl> <supabaseUrl> <members> <concurrency> <seconds>");
  process.exit(1);
}
const MEMBERS = Number(membersArg ?? 20), CONC = Number(concArg ?? 10), SECS = Number(secsArg ?? 30);
// A fresh random password per run: the synthetic accounts can't be signed into by anyone who read this file.
const PASSWORD = `Lt-${randomBytes(18).toString("base64url")}-9a`;
const RUN = randomBytes(4).toString("hex");
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

/** Creates member i and records it in `members` the moment it exists, so cleanup finds it even if a later step fails. */
async function makeMember(i) {
  const email = `load-${RUN}-${i}@example.test`;
  const u = await json(`${sbUrl}/auth/v1/admin/users`, { method: "POST", headers: admin, body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }) });
  const member = { id: u.id, token: null, cookie: null };
  members.push(member);
  // Onboarded, so the app pages render instead of redirecting to onboarding.
  await json(`${sbUrl}/rest/v1/profiles?id=eq.${u.id}`, { method: "PATCH", headers: { ...admin, Prefer: "return=minimal" }, body: JSON.stringify({ onboarding_completed_at: new Date().toISOString(), display_name: `Load ${i}` }) });
  const s = await json(`${sbUrl}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  member.token = s.access_token;
  member.cookie = `${cookieName}=base64-${Buffer.from(JSON.stringify(s)).toString("base64url")}`;
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
async function cleanUp() {
  const ids = members.splice(0).map((m) => m.id);
  for (const id of ids) await fetch(`${sbUrl}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: admin }).catch(() => undefined);
  if (ids.length) console.log(`removed ${ids.length} synthetic members (run ${RUN})`);
}
// Ctrl-C only asks the run to stop: the loops below check `interrupted`, and the finally block removes every member
// created so far (including one whose creation was in flight). A second Ctrl-C exits at once.
let interrupted = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (interrupted) process.exit(130);
    interrupted = true;
    console.error(`${signal}: stopping; the synthetic members are removed before exit (press again to quit now)…`);
  });
}

try {
  for (let i = 0; i < MEMBERS && !interrupted; i++) await makeMember(i);
  const ready = members.filter((m) => m.token);
  if (!interrupted && ready.length) {
    console.log(`members ready: ${ready.length}; concurrency ${CONC}; ${SECS}s`);
    // Warm-up: one pass so first-compile costs don't count.
    for (const r of ROUTES) await hit(ready[0], r);
    for (const s of stats.values()) { s.lat = []; s.errors = 0; s.statuses = {}; }

    const end = Date.now() + SECS * 1000;
    let total = 0;
    await Promise.all(Array.from({ length: CONC }, async (_, w) => {
      let k = w;
      while (Date.now() < end && !interrupted) {
        const m = ready[k % ready.length];
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
  }
} finally {
  // Always remove the synthetic members: after a normal run, an error part-way through, or Ctrl-C.
  await cleanUp();
  if (interrupted) process.exit(130);
}
