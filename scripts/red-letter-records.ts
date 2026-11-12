/**
 * Writes the red-letter records: docs/faith/red-letter/segments.csv (every red stretch: reference, offsets, basis,
 * verification status, the red words) and docs/faith/red-letter/VERIFICATION.md (totals, whole-Bible scan, register).
 *
 *   npm run bible:red-letter-records
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { RED_LETTER_REVIEW, SCAN_REVIEWED_NEW_TESTAMENT } from "../src/data/bible/red-letter-review";
import { scanUnmarkedSpeech, segmentRows, segmentsCsv, verificationMarkdown, type RedLetterData } from "../src/lib/bible/red-letter-records";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "public", "bible", "bsb");
const data = JSON.parse(readFileSync(path.join(dir, "wj.json"), "utf8")) as RedLetterData;
const load = (id: string) => JSON.parse(readFileSync(path.join(dir, "books", `${id}.json`), "utf8")).chapters;

const { rows, continuationGaps } = segmentRows(data, load);
const scan = scanUnmarkedSpeech(data, load);
writeFileSync(path.join(root, "docs/faith/red-letter/segments.csv"), segmentsCsv(rows));
writeFileSync(path.join(root, "docs/faith/red-letter/VERIFICATION.md"), verificationMarkdown(data, rows, continuationGaps, scan, RED_LETTER_REVIEW, SCAN_REVIEWED_NEW_TESTAMENT));
console.log(`${rows.length} stretches (${rows.filter((r) => r.status !== "verified").length} need review); scan: ${scan.newTestament.length} NT, ${scan.oldTestament.length} OT candidates.`);
