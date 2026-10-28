/**
 * Per-sample trace of the held arms (swivel, pronation, elbow, what the forearm and wrist could not turn, contact):
 *   npx tsx scripts/anatomy/qa/trace-arms.mts <slug> [samples]
 */
import { readFileSync } from "node:fs";
import { EXERCISES } from "../../../src/data/exercises";
import { Skeleton3, type RigMeta } from "../../../src/lib/anatomy3d/body/skeleton";
import { makePerformer } from "../../../src/lib/anatomy3d/motion3d/perform";
import { specFor } from "../../../src/lib/anatomy3d/motion3d/specs";
const [slug, n = "24"] = process.argv.slice(2);
const meta = JSON.parse(readFileSync("public/anatomy/ecorche-rig.json", "utf8")) as RigMeta;
const sk = new Skeleton3(meta);
const perf = makePerformer(sk, EXERCISES.find((e) => e.slug === slug)!, specFor(slug!));
const rows: Record<string, string> = {};
type ArmTrace = { swivel: number; phi: number; theta: number; over: number; wristOver: number };
(globalThis as { __armTrace?: (s: string, d: ArmTrace) => void }).__armTrace = (s, d) => { rows[s] = `sw${d.swivel.toFixed(0).padStart(5)} ph${d.phi.toFixed(0).padStart(4)} el${d.theta.toFixed(0).padStart(4)} ov${d.over.toFixed(0).padStart(3)} wr${d.wristOver.toFixed(0).padStart(3)}`; };
const N = Number(n);
for (let i = 0; i < N; i++) perf.pose((i / N) * perf.duration);
for (let i = 0; i < N; i++) {
  for (const k of Object.keys(rows)) delete rows[k];
  const rep = perf.pose((i / N) * perf.duration);
  const c = Object.fromEntries(perf.contacts().map((x) => [x.side, `gap${x.gap.toFixed(1).padStart(5)} turn${x.turn.toFixed(0).padStart(4)}`]));
  const lim = Object.entries(rep.limits).filter(([k]) => !/wrist|pronation/.test(k)).map(([k, v]) => `${k}:${v.toFixed(0)}`).join(" ");
  console.log((i / N).toFixed(2), "| R", rows.R ?? "-", c.R ?? "", "| L", rows.L ?? "-", c.L ?? "", lim);
}
