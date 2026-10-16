/**
 * Bulk-uploads exercise demonstration media from a folder to the `exercise-media` bucket and records
 * them in public.exercise_media.
 *
 *   npm run videos:import -- <folder> --license "AI-generated, owned by Narrow Gate Fitness" --attribution "Narrow Gate Fitness" [--dry-run] [--replace]
 *
 * Files must be named `<exercise-slug>.(mp4|webm|jpg|jpeg|png|webp)`. Each file is stored at
 * `<slug>/<slug>.<ext>` (re-running overwrites the same object and updates its row).
 * --replace also removes the exercise's OTHER uploaded media of the same type (rows and files).
 * Links to external media (YouTube etc.) are never touched.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from the environment or .env.local).
 * The service-role key bypasses RLS — run this only on a trusted machine and never commit the key.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { EXERCISES } from "../src/data/exercises";
import { EXERCISE_MEDIA_BUCKET, EXERCISE_MEDIA_MAX_BYTES, EXERCISE_MEDIA_TYPES, mediaExtension } from "../src/lib/exercise-media";

const USAGE = `Usage: npm run videos:import -- <folder> --license "<license>" --attribution "<attribution>" [--dry-run] [--replace]

  <folder>        Folder containing <exercise-slug>.mp4 / .webm / .jpg / .png / .webp files
  --license       License text shown to users (required), e.g. "AI-generated, owned by Narrow Gate Fitness"
  --attribution   Attribution shown to users (required), e.g. "Narrow Gate Fitness"
  --dry-run       Validate and print the plan without uploading or writing anything
  --replace       Also delete this exercise's other uploaded media of the same type (video or image)`;

function fail(message: string): never {
  console.error(`Error: ${message}\n\n${USAGE}`);
  process.exit(1);
}

function loadEnvFile() {
  for (const file of [".env.local", ".env"]) {
    const p = path.resolve(process.cwd(), file);
    if (!existsSync(p)) continue;
    try {
      process.loadEnvFile(p); // never overrides variables already set in the environment
    } catch (err) {
      console.warn(`Couldn't read ${file}: ${(err as Error).message}`);
    }
  }
}

interface PlannedFile {
  file: string;
  slug: string;
  ext: keyof typeof EXERCISE_MEDIA_TYPES;
  bytes: number;
  storagePath: string;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      license: { type: "string" },
      attribution: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      replace: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }
  const folder = positionals[0];
  if (!folder) fail("Pass the folder that contains the media files.");
  const license = values.license?.trim() ?? "";
  const attribution = values.attribution?.trim() ?? "";
  if (license.length < 2 || license.length > 200) fail("--license is required (2–200 characters).");
  if (!attribution || attribution.length > 200) fail("--attribution is required (up to 200 characters).");
  const dryRun = values["dry-run"];
  const dir = path.resolve(folder);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) fail(`Folder not found: ${dir}`);

  loadEnvFile();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  if (!supabase && !dryRun) fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (environment or .env.local).");

  // Exercise slugs → ids/names: from the database when connected, otherwise from the bundled catalog (dry run only).
  const exercises = new Map<string, { id: string | null; name: string }>();
  if (supabase) {
    const { data, error } = await supabase.from("exercises").select("id, slug, name");
    if (error) fail(`Couldn't read exercises: ${error.message}`);
    for (const e of data ?? []) exercises.set(e.slug as string, { id: e.id as string, name: e.name as string });
  } else {
    console.log("No Supabase credentials found — dry run validates slugs against src/data/exercises.ts.\n");
    for (const e of EXERCISES) exercises.set(e.slug, { id: null, name: e.name });
  }

  const planned: PlannedFile[] = [];
  const skipped: string[] = [];
  for (const file of readdirSync(dir).sort()) {
    const full = path.join(dir, file);
    if (!statSync(full).isFile() || file.startsWith(".")) continue;
    const ext = mediaExtension(file);
    const slug = file.slice(0, file.lastIndexOf(".")).toLowerCase();
    if (!ext) {
      skipped.push(`${file}: unsupported file type (use mp4, webm, jpg, png or webp)`);
      continue;
    }
    if (!exercises.has(slug)) {
      skipped.push(`${file}: no exercise with slug "${slug}"`);
      continue;
    }
    const bytes = statSync(full).size;
    if (bytes > EXERCISE_MEDIA_MAX_BYTES) {
      skipped.push(`${file}: ${(bytes / 1024 / 1024).toFixed(1)} MB is over the 50 MB limit`);
      continue;
    }
    if (bytes === 0) {
      skipped.push(`${file}: empty file`);
      continue;
    }
    const normalizedExt = ext === "jpeg" ? "jpg" : ext;
    planned.push({ file, slug, ext, bytes, storagePath: `${slug}/${slug}.${normalizedExt}` });
  }
  const dupes = planned.filter((p, i) => planned.findIndex((q) => q.storagePath === p.storagePath) !== i);
  if (dupes.length) fail(`More than one file maps to the same path: ${dupes.map((d) => d.file).join(", ")}`);

  console.log(`${dryRun ? "[dry run] " : ""}${planned.length} file(s) to import from ${dir}${values.replace ? " (replacing other uploaded media of the same type)" : ""}`);
  for (const p of planned) console.log(`  ${p.file} → ${EXERCISE_MEDIA_BUCKET}/${p.storagePath} (${EXERCISE_MEDIA_TYPES[p.ext].mediaType}, ${(p.bytes / 1024 / 1024).toFixed(1)} MB)`);

  const results = { inserted: 0, updated: 0, removed: 0, failed: [] as string[] };
  if (!dryRun && supabase) {
    for (const p of planned) {
      const ex = exercises.get(p.slug)!;
      const type = EXERCISE_MEDIA_TYPES[p.ext];
      try {
        const body = readFileSync(path.join(dir, p.file));
        const { error: upErr } = await supabase.storage
          .from(EXERCISE_MEDIA_BUCKET)
          .upload(p.storagePath, body, { contentType: type.mime, upsert: true, cacheControl: "3600" });
        if (upErr) throw new Error(`upload: ${upErr.message}`);

        const row = { media_type: type.mediaType, license, attribution, alt_text: `${ex.name} demonstration` };
        const { data: existing, error: selErr } = await supabase.from("exercise_media").select("id").eq("exercise_id", ex.id).eq("storage_path", p.storagePath);
        if (selErr) throw new Error(`lookup: ${selErr.message}`);
        if (existing && existing.length) {
          const { error } = await supabase.from("exercise_media").update(row).in("id", existing.map((r) => r.id as string));
          if (error) throw new Error(`update: ${error.message}`);
          results.updated++;
        } else {
          const { error } = await supabase.from("exercise_media").insert({ ...row, exercise_id: ex.id, storage_path: p.storagePath });
          if (error) throw new Error(`insert: ${error.message}`);
          results.inserted++;
        }

        if (values.replace) {
          const { data: others, error } = await supabase
            .from("exercise_media")
            .select("id, storage_path")
            .eq("exercise_id", ex.id)
            .eq("media_type", type.mediaType)
            .not("storage_path", "is", null)
            .neq("storage_path", p.storagePath);
          if (error) throw new Error(`replace lookup: ${error.message}`);
          if (others?.length) {
            const { error: delErr } = await supabase.from("exercise_media").delete().in("id", others.map((o) => o.id as string));
            if (delErr) throw new Error(`replace delete: ${delErr.message}`);
            const { error: rmErr } = await supabase.storage.from(EXERCISE_MEDIA_BUCKET).remove(others.map((o) => o.storage_path as string));
            if (rmErr) console.warn(`  ${p.file}: rows replaced but old files weren't removed: ${rmErr.message}`);
            results.removed += others.length;
          }
        }
        console.log(`  ✓ ${p.file}`);
      } catch (err) {
        results.failed.push(`${p.file}: ${(err as Error).message}`);
        console.log(`  ✗ ${p.file}: ${(err as Error).message}`);
      }
    }
  }

  console.log("\nSummary");
  if (dryRun) console.log(`  Would import:       ${planned.length}`);
  else {
    console.log(`  New media rows:     ${results.inserted}`);
    console.log(`  Updated media rows: ${results.updated}`);
    if (values.replace) console.log(`  Replaced (removed): ${results.removed}`);
    console.log(`  Failed:             ${results.failed.length}`);
  }
  console.log(`  Skipped:            ${skipped.length}`);
  for (const s of skipped) console.log(`    - ${s}`);
  for (const f of results.failed) console.log(`    ! ${f}`);
  if (planned.length) console.log("\nReminder: review every clip for correct form before it goes live — imported media is visible to users immediately.");
  if (results.failed.length) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
