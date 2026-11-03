// Native launch screens: plain #090909, no gate. The only gate is the web opening (src/lib/opening.ts); a gold arch
// on the native splash meant a member saw one gate, then another (launch-critical item 3, docs/OPENING.md).
// Rewrites every iOS / Android splash image at its own size. Run after anything regenerates the native assets
// (e.g. `npx capacitor-assets generate`): node scripts/native/blank-splash.mjs
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

export const SPLASH_BACKGROUND = { r: 9, g: 9, b: 9 }; // #090909, capacitor.config.ts backgroundColor

export function splashImages(root = process.cwd()) {
  const out = [];
  const ios = path.join(root, "ios/App/App/Assets.xcassets/Splash.imageset");
  for (const f of readdirSync(ios)) if (f.endsWith(".png")) out.push(path.join(ios, f));
  const res = path.join(root, "android/app/src/main/res");
  for (const d of readdirSync(res)) {
    const f = path.join(res, d, "splash.png");
    if (d.startsWith("drawable") && statSync(path.join(res, d)).isDirectory() && readdirSync(path.join(res, d)).includes("splash.png")) out.push(f);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const file of splashImages()) {
    const { width, height } = await sharp(file).metadata();
    await sharp({ create: { width, height, channels: 3, background: SPLASH_BACKGROUND } }).png({ compressionLevel: 9 }).toFile(`${file}.tmp`);
    const { renameSync } = await import("node:fs");
    renameSync(`${file}.tmp`, file);
    console.log(`${path.relative(process.cwd(), file)} ${width}x${height}`);
  }
}
