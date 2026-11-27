import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Release safety rules for the GitHub workflows (checked as text, so no YAML library is needed):
 * - Apple signing secrets are read only by the TestFlight job, only under their TF_ names, and only inside the
 *   protected "testflight" environment (approval required, release branch only: set in GitHub's settings).
 * - The website check runs before the key is written or anything is archived, signed or uploaded.
 * - Every action is pinned to an exact commit; no workflow runs pull-request code with secrets.
 */
const DIR = join(process.cwd(), ".github/workflows");
const files = readdirSync(DIR).filter((f) => f.endsWith(".yml"));
const read = (f: string) => readFileSync(join(DIR, f), "utf8");
const ios = read("ios.yml");

/** The text of one job: from "  name:" to the next job at the same indentation. */
function job(text: string, name: string): string {
  const start = text.indexOf(`\n  ${name}:\n`);
  if (start < 0) throw new Error(`job ${name} not found`);
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[a-z0-9-]+:\n/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

describe("release workflows", () => {
  it("the TestFlight job runs in the protected environment and reads only TF_ signing secrets", () => {
    const tf = job(ios, "testflight");
    expect(tf).toMatch(/\n {4}environment:\n {6}name: testflight\n/);
    // Only the owner can start it, whatever the GitHub plan (required reviewers aren't offered on every plan).
    expect(tf).toMatch(/\n {4}if: github\.event_name == 'workflow_dispatch' && inputs\.job == 'testflight' && github\.triggering_actor == 'Joshfit77'\n/);
    const used = [...ios.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    expect(used.every((s) => s!.startsWith("TF_"))).toBe(true);
    // Every secret use is inside the TestFlight job.
    expect([...tf.matchAll(/secrets\.([A-Z0-9_]+)/g)].length).toBe(used.length);
    expect(ios).not.toContain("ASC_KEY_P8_BASE64");
  });

  it("no other workflow can read the signing secrets", () => {
    for (const f of files.filter((x) => x !== "ios.yml")) {
      const text = read(f);
      expect(text, f).not.toMatch(/secrets\.(TF_|ASC_|APPLE_)/);
    }
  });

  it("the website must serve the commit being built before the key is written or anything is archived", () => {
    const tf = job(ios, "testflight");
    const check = tf.indexOf('python3 scripts/ios-verify/check-site.py "$SERVER_URL" "$GITHUB_SHA"');
    expect(check).toBeGreaterThan(0);
    for (const later of ["Write the App Store Connect key", "Archive (automatic signing", "Check this build against App Store Connect", "xcodebuild -exportArchive"]) {
      expect(tf.indexOf(later), later).toBeGreaterThan(check);
    }
    // The old behaviour (a warning only) is gone.
    expect(tf).not.toContain("::warning::The site serves commit");
  });

  it("every action is pinned to a full commit id, and no workflow runs pull-request code with secrets", () => {
    for (const f of files) {
      const text = read(f);
      for (const m of text.matchAll(/uses:\s*([^\s#]+)/g)) expect(m[1], `${f}: ${m[1]}`).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
      expect(text, f).not.toContain("pull_request_target");
    }
  });
});
