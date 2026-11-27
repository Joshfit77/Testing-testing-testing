/**
 * Distance error of the current GPS tracking code on the controlled traces (tests/fixtures/gps-traces.ts):
 * mean (worst) over 20 seeds per scenario, as a Markdown table. See docs/GPS_ACCURACY.md.
 *
 *   npx tsx scripts/gps-accuracy-report.ts
 */
import { record } from "../tests/fixtures/gps-harness";
import { scenarios } from "../tests/fixtures/gps-traces";

const SEEDS = 20;
const pct = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1)}%`;
const rows = ["| Scenario | True distance | Error: mean (worst) |", "|---|---|---|"];
const names = scenarios(1).map((s) => s.name);
names.forEach((name, i) => {
  const errs: number[] = [];
  let truth = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const sc = scenarios(seed)[i]!;
    truth = sc.truth;
    const d = record(sc).distanceM;
    errs.push(truth > 0 ? (d - truth) / truth : d);
  }
  const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
  const worst = errs.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
  rows.push(`| ${name} | ${truth > 0 ? `${(truth / 1000).toFixed(2)} km` : "0 m"} | ${truth > 0 ? `${pct(mean)} (${pct(worst)})` : `${mean.toFixed(0)} m (${worst.toFixed(0)} m)`} |`);
});
console.log(rows.join("\n"));
