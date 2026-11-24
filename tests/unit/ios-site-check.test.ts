import { spawn, spawnSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * scripts/ios-verify/check-site.py runs in the TestFlight job before anything is signed or uploaded: the website the
 * iPhone app will load must answer, carry the current opening, and serve exactly the commit being built. A missing or
 * different commit stops the build. Here the script runs against a local stand-in for the website.
 */
const SCRIPT = join(process.cwd(), "scripts/ios-verify/check-site.py");
const python = spawnSync("python3", ["--version"]).status === 0;
const BUILT = "0123456789abcdef0123456789abcdef01234567";
const OPENING = '<button data-intro-enter>Enter Narrow Gate</button><p>small is the gate and narrow the way</p>';

/** What the stand-in website answers; each test sets it. */
let site: { health: unknown; healthStatus: number; home: string };
let server: Server;
let base = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/api/health") {
      res.writeHead(site.healthStatus, { "Content-Type": "application/json" });
      res.end(JSON.stringify(site.health));
    } else {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(site.home);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

/** Runs python3 without blocking, so the stand-in website (in this process) can answer it. */
function run(args: string[]): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    // Local requests go straight to the stand-in, never through a proxy.
    const env = { ...process.env, NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost" };
    const child = spawn("python3", args, { env });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (status) => resolve({ ok: status === 0, out }));
  });
}
/** Runs the check against the local stand-in (http on 127.0.0.1 is allowed only through this test entry point). */
function checkLocal(expected = BUILT) {
  const code = `import importlib.util, sys
spec = importlib.util.spec_from_file_location("check_site", sys.argv[1])
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
m.main(sys.argv[2], sys.argv[3], allow_http=True)`;
  return run(["-c", code, SCRIPT, base, expected]);
}
/** Runs the script exactly as the workflow does. */
const checkCli = (url: string, expected = BUILT) => run([SCRIPT, url, expected]);
const healthy = (commit: string | null) => ({ ok: true, data: { app: "narrow-gate-fitness", commit } });

describe.skipIf(!python)("TestFlight website check (scripts/ios-verify/check-site.py)", () => {
  it("passes when the site serves exactly the commit being built", async () => {
    site = { health: healthy(BUILT), healthStatus: 200, home: OPENING };
    const r = await checkLocal();
    expect(r.out).toContain("ok   the site serves the commit being built (0123456789ab)");
    expect(r.ok).toBe(true);
    // Upper-case ids from a host are the same commit.
    site = { health: healthy(BUILT.toUpperCase()), healthStatus: 200, home: OPENING };
    expect((await checkLocal()).ok).toBe(true);
  });

  it("fails when the site doesn't say which commit it serves", async () => {
    for (const commit of [null, ""]) {
      site = { health: healthy(commit), healthStatus: 200, home: OPENING };
      const r = await checkLocal();
      expect(r.ok).toBe(false);
      expect(r.out).toContain("doesn't say which commit it serves");
    }
  });

  it("fails when the site serves a different commit (before: only a warning)", async () => {
    site = { health: healthy("fedcba9876543210fedcba9876543210fedcba98"), healthStatus: 200, home: OPENING };
    const r = await checkLocal();
    expect(r.ok).toBe(false);
    expect(r.out).toContain("serves commit fedcba987654, but this build is from 0123456789ab");
  });

  it("fails for a site without the current opening, without a health check, or that isn't this app", async () => {
    site = { health: healthy(BUILT), healthStatus: 200, home: "<p>an older home page</p>" };
    expect((await checkLocal()).out).toContain("doesn't serve the current opening");
    site = { health: { error: "not found" }, healthStatus: 404, home: OPENING };
    expect((await checkLocal()).out).toContain("/api/health did not answer");
    site = { health: { ok: true, data: { app: "something-else", commit: BUILT } }, healthStatus: 200, home: OPENING };
    expect((await checkLocal()).out).toContain("isn't Narrow Gate Fitness");
  });

  it("as the workflow runs it: refuses http, local and placeholder addresses, and a short commit id", async () => {
    expect((await checkCli(base)).out).toContain("must be the https:// address");
    expect((await checkCli("https://localhost:3000")).out).toContain("placeholder or local address");
    expect((await checkCli("https://staging.example")).out).toContain("placeholder or local address");
    expect((await checkCli("https://staging.narrowgate.app", "0123456")).out).toContain("isn't a full commit id");
  });
});
