// Builds the premium 2.5D exercise demonstrations from the source folder into public/exercise-demos/<slug>/ and
// writes src/data/exercise-demos.json (the manifest the app reads).
//
//   node scripts/exercise-demos/build.mjs [assets/exercise-demos-src] [--only slug,slug]
//
// Source layout, one folder per exercise slug (assets/exercise-demos-src/<slug>/):
//   loop.mp4|mov|webm|gif      a rendered loop (one rep, seamless)            → mode "video"
//   frames/0001.png …          a rendered frame sequence (24–30 fps, one rep)   → mode "sequence"
//   start.png, finish.png …    rendered phase stills in order (any names, sorted; meta.json names them) → "keyframes"
//   poster.png                 a still used as the poster (optional; else the first frame)
//   angles/side/loop.mp4       a second camera angle (any name), with an optional poster.*
//   meta.json                  { "status": "stand-in" | "review" | "approved", "version": 1, "source": "which model",
//                                "note": "…", "highlighted": ["biceps"], "mainAngle": "Front",
//                                "phases": [{ "label": "Start", "t": 0 }, { "label": "Curl", "t": 1.2 }],
//                                "review": { "character": "PASS", "form": "NOT REVIEWED", "equipment": "", "highlighting": "", "playback": "", "mobile": "" } }
// Output per slug: poster.webp (1200×900), thumb.webp (480×360), loop.mp4 + loop.webm (video and sequence modes),
// phase-N.webp (keyframes mode), all letterboxed to 4:3 on #0a0a0a. Every clip (and every extra angle) also gets:
//   loop-half.mp4 + loop-half.webm   the 0.5× version: the same frames, each held twice as long (nothing invented)
//   scrub/001.webp …                 evenly spaced frames of one rep, for scrubbing with a finger (≤ 60, ≤ 400 px wide)
// Checks: the loop's seam (first vs last frame), file sizes (each mp4 ≤ 2.5 MB), dimensions. Every file is
// overwritten; nothing outside the slug's folder is touched.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith("--only")) ?? "").split("=")[1]?.split(",").filter(Boolean) ?? (args.includes("--only") ? args[args.indexOf("--only") + 1]?.split(",") : null);
const SRC = path.resolve(ROOT, args.find((a) => !a.startsWith("--") && a !== only?.join(",")) ?? "assets/exercise-demos-src");
// Overridable for a dry run outside the app (the web paths in the manifest stay /exercise-demos/...).
const OUT = process.env.EXERCISE_DEMOS_OUT ? path.resolve(process.env.EXERCISE_DEMOS_OUT) : path.join(ROOT, "public/exercise-demos");
const MANIFEST = process.env.EXERCISE_DEMOS_MANIFEST ? path.resolve(process.env.EXERCISE_DEMOS_MANIFEST) : path.join(ROOT, "src/data/exercise-demos.json");
const W = 1200, H = 900, BG = "#0a0a0a";
const MAX_MP4 = 2.5 * 1024 * 1024;
const FIT = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG}`;

const ff = (a) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...a], { stdio: ["ignore", "pipe", "inherit"] });
const probe = (f) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", f]).toString());
const size = (f) => (fs.existsSync(f) ? fs.statSync(f).size : 0);
const still = (input, out, w, h) => ff(["-i", input, "-vf", `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${BG}`, "-frames:v", "1", "-q:v", "85", out]);
/** Mean absolute difference between two same-size images, 0..255 (ffmpeg's psnr is awkward here; PIL is simpler). */
const seam = (a, b) => Number(execFileSync("python3", ["-I", "-c", `
from PIL import Image, ImageChops, ImageStat
a=Image.open('${a}').convert('L'); b=Image.open('${b}').convert('L').resize(a.size)
print(ImageStat.Stat(ImageChops.difference(a,b)).mean[0])`]).toString().trim());

/** The clip's frame rate as ffmpeg writes it ("30/1"). */
const rate = (f) => probe(f).streams.find((x) => x.codec_type === "video").r_frame_rate;
/**
 * The 0.5× version of a clip: every frame held twice as long at the clip's own frame rate, so the slow version shows
 * exactly the real frames (no interpolation: in-between frames made by a model or by motion estimation warp the
 * equipment). H.264 for iPhone (faststart, no audio) and VP9 for browsers without H.264.
 */
function halfSpeed(src, fitx, fps, outDir, base, native) {
  const vf = `${fitx},fps=${fps},setpts=2.0*PTS,fps=${fps}`;
  const mp4 = path.join(outDir, `${base}.mp4`), webm = path.join(outDir, `${base}.webm`);
  ff(["-i", src, "-an", "-vf", vf, "-c:v", "libx264", "-profile:v", "high", "-crf", native ? "18" : "26", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
  ff(["-i", src, "-an", "-vf", vf, "-c:v", "libvpx-vp9", "-crf", native ? "24" : "34", "-b:v", "0", "-row-mt", "1", "-deadline", "good", "-pix_fmt", "yuv420p", webm]);
  return { mp4, webm, durationMs: Math.round(Number(probe(mp4).format.duration) * 1000) };
}
/**
 * Frames for scrubbing with a finger: evenly spaced through one rep (frame k is at k/count of the clip), small WebPs the
 * player preloads on the first touch so dragging never waits on the video decoder.
 */
function scrubFrames(mp4, outDir, sub, slug) {
  const dir = path.join(outDir, sub);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const p = probe(mp4), st = p.streams.find((x) => x.codec_type === "video"), dur = Number(p.format.duration);
  const count = Math.max(12, Math.min(60, Math.round(dur * 15)));
  const fw = Math.min(st.width, 400) & ~1;
  ff(["-i", mp4, "-vf", `fps=${(count / dur).toFixed(5)},scale=${fw}:-2`, "-frames:v", String(count), "-c:v", "libwebp", "-quality", "70", path.join(dir, "%03d.webp")]);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".webp")).sort();
  const fh = Math.round((st.height * fw) / st.width / 2) * 2;
  return { scrub: { base: `/exercise-demos/${slug}/${sub}/`, count: files.length, width: fw, height: fh }, bytes: files.reduce((a, f) => a + size(path.join(dir, f)), 0) };
}

const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : { version: 1, frame: { width: W, height: H }, demos: {} };
manifest.frame = { width: W, height: H };
const slugs = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter((d) => fs.statSync(path.join(SRC, d)).isDirectory() && !d.startsWith("_") && (!only || only.includes(d))) : [];
if (!slugs.length) console.log(`no sources in ${SRC}`);
// A full build mirrors the source folders: an exercise whose folder is gone leaves the manifest (its old files stay
// on disk until removed by hand, so nothing is deleted silently).
if (!only) for (const slug of Object.keys(manifest.demos)) if (!slugs.includes(slug)) { delete manifest.demos[slug]; console.log(`${slug}: no source folder; removed from the manifest`); }
const report = [];
for (const slug of slugs) {
  const dir = path.join(SRC, slug);
  const outDir = path.join(OUT, slug);
  fs.mkdirSync(outDir, { recursive: true });
  const meta = fs.existsSync(path.join(dir, "meta.json")) ? JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")) : {};
  // fit "native": keep the source's own size and shape (no letterbox); otherwise 1200x900 letterboxed on #0a0a0a.
  let w = W, h = H, FITX = FIT;
  const files = fs.readdirSync(dir).filter((f) => !f.startsWith("."));
  const loop = files.find((f) => /^loop\.(mp4|mov|webm|gif|m4v)$/i.test(f));
  const framesDir = fs.existsSync(path.join(dir, "frames")) ? path.join(dir, "frames") : null;
  const stills = files.filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && !/^poster\./i.test(f)).sort();
  const posterSrc = files.find((f) => /^poster\.(png|jpe?g|webp)$/i.test(f));
  const web = (f) => `/exercise-demos/${slug}/${f}`;
  const asset = { mode: "poster", status: meta.status ?? "review", version: meta.version ?? 1, source: meta.source, mainAngle: meta.mainAngle, poster: web("poster.webp"), thumb: web("thumb.webp"), width: W, height: H, loop: meta.loop !== false, phases: [], highlighted: meta.highlighted ?? [], note: meta.note, review: meta.review, flags: meta.flags, checks: {} };
  const tmp = fs.mkdtempSync(path.join(outDir, ".tmp-"));
  try {
    let loopSrc = null;
    if (loop) {
      asset.mode = "video";
      loopSrc = path.join(dir, loop);
    } else if (framesDir) {
      asset.mode = "sequence";
      const seq = fs.readdirSync(framesDir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
      if (!seq.length) throw new Error("frames/ is empty");
      const list = path.join(tmp, "frames.txt");
      const fps = meta.fps ?? 30;
      fs.writeFileSync(list, seq.map((f) => `file '${path.join(framesDir, f).replace(/'/g, "'\\''")}'\nduration ${(1 / fps).toFixed(5)}`).join("\n") + "\n");
      loopSrc = path.join(tmp, "seq.mp4");
      ff(["-f", "concat", "-safe", "0", "-i", list, "-vf", FIT, "-r", String(fps), "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", loopSrc]);
    } else if (stills.length) {
      asset.mode = "keyframes";
    }
    if (loopSrc && meta.fit === "native") {
      const st = probe(loopSrc).streams.find((x) => x.codec_type === "video");
      w = st.width; h = st.height; FITX = `scale=${w}:${h}`;
      asset.width = w; asset.height = h;
    }
    if (loopSrc) {
      const mp4 = path.join(outDir, "loop.mp4"), webm = path.join(outDir, "loop.webm");
      const vs = probe(loopSrc).streams.find((x) => x.codec_type === "video");
      const iphoneReady = vs && vs.codec_name === "h264" && vs.pix_fmt === "yuv420p" && size(loopSrc) <= MAX_MP4;
      if (meta.encode === "copy" && iphoneReady) {
        // The owner's file as delivered: the same video bytes, audio dropped if any, moov moved to the front for streaming.
        ff(["-i", loopSrc, "-map", "0:v:0", "-c", "copy", "-movflags", "+faststart", mp4]);
        asset.checks.copied = true;
      } else {
        ff(["-i", loopSrc, "-an", "-vf", `${FITX},fps=30`, "-c:v", "libx264", "-profile:v", "high", "-crf", meta.fit === "native" ? "20" : "26", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
      }
      // WebM (VP9) second, for browsers without H.264 (Safari and Chrome play the MP4 first).
      ff(["-i", loopSrc, "-an", "-vf", `${FITX},fps=30`, "-c:v", "libvpx-vp9", "-crf", meta.fit === "native" ? "24" : "34", "-b:v", "0", "-row-mt", "1", "-deadline", "good", "-pix_fmt", "yuv420p", webm]);
      const p = probe(mp4);
      asset.mp4 = web("loop.mp4"); asset.webm = web("loop.webm");
      asset.durationMs = Math.round(Number(p.format.duration) * 1000);
      asset.checks.mp4Bytes = size(mp4); asset.checks.webmBytes = size(webm);
      const half = halfSpeed(loopSrc, FITX, rate(mp4), outDir, "loop-half", meta.fit === "native");
      asset.slow = { mp4: web("loop-half.mp4"), webm: web("loop-half.webm"), durationMs: half.durationMs };
      asset.checks.slowMp4Bytes = size(half.mp4); asset.checks.slowWebmBytes = size(half.webm);
      const sf = scrubFrames(mp4, outDir, "scrub", slug);
      asset.scrub = sf.scrub; asset.checks.scrubBytes = sf.bytes;
      ff(["-i", mp4, "-vf", FITX, "-frames:v", "1", path.join(tmp, "first.png")]);
      ff(["-sseof", "-0.05", "-i", mp4, "-vf", FITX, "-frames:v", "1", "-update", "1", path.join(tmp, "last.png")]);
      asset.checks.seam = Number(seam(path.join(tmp, "first.png"), path.join(tmp, "last.png")).toFixed(2));
      still(posterSrc ? path.join(dir, posterSrc) : path.join(tmp, "first.png"), path.join(outDir, "poster.webp"), w, h);
      asset.phases = (meta.phases ?? []).map((ph, i) => {
        const f = `phase-${i + 1}.webp`;
        ff(["-ss", String(ph.t ?? 0), "-i", mp4, "-vf", FITX, "-frames:v", "1", "-q:v", "85", path.join(outDir, f)]);
        return { label: ph.label, src: web(f), t: ph.t ?? 0 };
      });
      if (asset.checks.mp4Bytes > MAX_MP4) report.push(`${slug}: loop.mp4 is ${(asset.checks.mp4Bytes / 1e6).toFixed(1)} MB (limit 2.5 MB)`);
      if (asset.checks.slowMp4Bytes > MAX_MP4) report.push(`${slug}: loop-half.mp4 is ${(asset.checks.slowMp4Bytes / 1e6).toFixed(1)} MB (limit 2.5 MB)`);
      if (Math.abs(asset.slow.durationMs - 2 * asset.durationMs) > 120) report.push(`${slug}: the 0.5× version is ${asset.slow.durationMs} ms, not twice ${asset.durationMs} ms`);
      if (asset.checks.seam > 6 && asset.loop) report.push(`${slug}: loop seam ${asset.checks.seam} (first and last frames differ; the loop will visibly jump). Set "loop": false in meta.json to play once with Replay.`);
    } else if (asset.mode === "keyframes") {
      asset.phases = stills.map((f, i) => {
        const out = `phase-${i + 1}.webp`;
        still(path.join(dir, f), path.join(outDir, out), W, H);
        return { label: meta.phases?.[i]?.label ?? f.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase()), src: web(out) };
      });
      still(posterSrc ? path.join(dir, posterSrc) : path.join(dir, stills[0]), path.join(outDir, "poster.webp"), W, H);
    } else if (posterSrc) {
      still(path.join(dir, posterSrc), path.join(outDir, "poster.webp"), W, H);
    } else {
      throw new Error("nothing to build: add loop.*, frames/, phase stills or poster.*");
    }
    // Extra camera angles: <slug>/angles/<name>/loop.* (+ poster.*), each encoded like the main clip.
    const anglesDir = path.join(dir, "angles");
    if (fs.existsSync(anglesDir)) {
      asset.angles = [];
      for (const name of fs.readdirSync(anglesDir).sort()) {
        const ad = path.join(anglesDir, name);
        const al = fs.readdirSync(ad).find((f) => /^loop\.(mp4|mov|webm|gif|m4v)$/i.test(f));
        if (!al) { report.push(`${slug}: angle ${name} has no loop.*`); continue; }
        const base = `angle-${name}`;
        // Fitted into the main clip's frame (same size and shape, padded if the view's shape differs), so switching
        // views never resizes the player.
        const AFIT = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${BG}`;
        const native = meta.fit === "native";
        ff(["-i", path.join(ad, al), "-an", "-vf", `${AFIT},fps=30`, "-c:v", "libx264", "-profile:v", "high", "-crf", native ? "20" : "26", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(outDir, `${base}.mp4`)]);
        ff(["-i", path.join(ad, al), "-an", "-vf", `${AFIT},fps=30`, "-c:v", "libvpx-vp9", "-crf", native ? "24" : "34", "-b:v", "0", "-row-mt", "1", "-pix_fmt", "yuv420p", path.join(outDir, `${base}.webm`)]);
        const ap = fs.readdirSync(ad).find((f) => /^poster\.(png|jpe?g|webp)$/i.test(f));
        if (ap) still(path.join(ad, ap), path.join(outDir, `${base}.webp`), w, h); else ff(["-i", path.join(outDir, `${base}.mp4`), "-frames:v", "1", path.join(outDir, `${base}.webp`)]);
        const amp4 = path.join(outDir, `${base}.mp4`);
        const half = halfSpeed(path.join(ad, al), AFIT, rate(amp4), outDir, `${base}-half`, native);
        const sf = scrubFrames(amp4, outDir, `scrub-${name}`, slug);
        asset.angles.push({ label: name.replace(/^\w/, (c) => c.toUpperCase()), poster: web(`${base}.webp`), mp4: web(`${base}.mp4`), webm: web(`${base}.webm`), durationMs: Math.round(Number(probe(amp4).format.duration) * 1000), slow: { mp4: web(`${base}-half.mp4`), webm: web(`${base}-half.webm`), durationMs: half.durationMs }, scrub: sf.scrub });
      }
    }
    // Thumb: 480x360 for lists; a 4:3 crop of the poster when meta.thumbCrop = [x, y, w, h] (in poster pixels).
    if (meta.thumbCrop) {
      const [cx, cy, cw, ch] = meta.thumbCrop;
      ff(["-i", path.join(outDir, "poster.webp"), "-vf", `crop=${cw}:${ch}:${cx}:${cy},scale=480:360`, "-frames:v", "1", "-q:v", "85", path.join(outDir, "thumb.webp")]);
    } else still(path.join(outDir, "poster.webp"), path.join(outDir, "thumb.webp"), 480, 360);
    asset.checks.posterBytes = size(path.join(outDir, "poster.webp"));
    manifest.demos[slug] = asset;
    console.log(`${slug}: ${asset.mode} · ${asset.status}${asset.durationMs ? ` · ${asset.durationMs} ms` : ""}${asset.checks.mp4Bytes ? ` · mp4 ${(asset.checks.mp4Bytes / 1e6).toFixed(2)} MB · webm ${(asset.checks.webmBytes / 1e6).toFixed(2)} MB · seam ${asset.checks.seam}` : ""}${asset.slow ? ` · 0.5× ${asset.slow.durationMs} ms, mp4 ${(asset.checks.slowMp4Bytes / 1e6).toFixed(2)} MB · scrub ${asset.scrub.count} frames ${(asset.checks.scrubBytes / 1e6).toFixed(2)} MB` : ""}${asset.angles?.length ? ` · ${asset.angles.length + 1} angles` : ""} · ${asset.phases.length} phase stills`);
  } catch (e) {
    report.push(`${slug}: FAILED ${e.message}`);
    delete manifest.demos[slug];
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest: ${Object.keys(manifest.demos).length} demos → ${path.relative(ROOT, MANIFEST)}`);
if (report.length) { console.log("ATTENTION:\n  " + report.join("\n  ")); process.exitCode = 1; }
