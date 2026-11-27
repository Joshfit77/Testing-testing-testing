"""Corrects a supplied exercise clip without inventing motion: cut to a clean span of real frames, grade the colours
toward the approved character (dark graphite body, black shorts, near-black backdrop, gold kept), and close the loop
with a short crossfade between the span's matching end poses. Also analyses a clip (frame jumps, loop seam) and draws a
labelled timeline for the reviewer.

  python3 -I scripts/exercise-demos/correct.py analyze <clip.mp4> <outdir>
  python3 -I scripts/exercise-demos/correct.py make <clip.mp4> <out.mp4> --span 43:117 [--crossfade 8 | --pingpong] [--no-grade]

Frame numbers are 1-based, as ffmpeg numbers extracted frames. Nothing here moves a limb: every output frame is a
source frame, graded, or (only in the crossfade) a blend of two source frames in nearly the same pose.
"""
import argparse, os, shutil, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageStat


def frames_of(clip, tmp):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-i", clip, "-vsync", "0", f"{tmp}/%04d.png"], check=True)
    return sorted(f for f in os.listdir(tmp) if f.endswith(".png"))


def small(path):
    im = Image.open(path).convert("L")
    return im.resize((max(1, im.size[0] // 4), max(1, im.size[1] // 4)))


def diff(a, b):
    return ImageStat.Stat(ImageChops.difference(a, b)).mean[0]


def grade(im, dark=0.62, gamma=2.0, desat=0.18):
    rgb = np.asarray(im.convert("RGB")).astype(np.float32) / 255.0
    hsv = np.asarray(im.convert("HSV")).astype(np.float32) / 255.0
    h, s, v = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
    hue_w = np.clip(1 - np.abs(h - 38) / 30, 0, 1)
    need = 0.28 - 0.24 * np.clip((v - 0.72) / 0.22, 0, 1)  # the glow's hot centre is pale: brighter needs less saturation
    sat_w = np.clip((s - need) / 0.2, 0, 1)
    val_w = np.clip((v - 0.30) / 0.25, 0, 1)
    # close the mask (dilate then erode, 13 px) so the glow's white-hot core counts as gold, not a pale hole
    gm = Image.fromarray((hue_w * sat_w * val_w * 255).astype(np.uint8))
    gm = gm.filter(ImageFilter.MaxFilter(13)).filter(ImageFilter.MinFilter(13)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(2))
    gold = (np.asarray(gm).astype(np.float32) / 255.0)[..., None]
    lum = (0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2])[..., None]
    graphite = dark * np.power(np.clip(lum + (rgb - lum) * desat, 0, 1), gamma) * np.array([1.0, 0.985, 0.95])
    out = gold * np.clip(rgb * 1.05, 0, 1) + (1 - gold) * graphite
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8))


def analyze(clip, outdir):
    os.makedirs(outdir, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        names = frames_of(clip, tmp)
        sm = [small(f"{tmp}/{n}") for n in names]
        steps = [diff(sm[i], sm[i + 1]) for i in range(len(sm) - 1)]
        med = float(np.median(steps))
        jumps = [(i + 1, round(d, 1)) for i, d in enumerate(steps) if d > max(6.0, 4 * med)]
        print(f"frames {len(names)}, median step {med:.2f}, loop seam (last vs first) {diff(sm[-1], sm[0]):.2f}")
        print("jumps (frame n -> n+1):", jumps or "none")
        picks = list(range(0, len(names), 6))
        tw = 120; th = round(tw * sm[0].size[1] / sm[0].size[0]); cols = 20
        rows = (len(picks) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * (tw + 4), rows * (th + 16)), "black"); d = ImageDraw.Draw(sheet)
        for k, i in enumerate(picks):
            x, y = (k % cols) * (tw + 4), (k // cols) * (th + 16)
            sheet.paste(Image.open(f"{tmp}/{names[i]}").convert("RGB").resize((tw, th)), (x, y + 14))
            d.text((x + 2, y + 1), f"{i + 1} ({i / 30:.1f}s)", fill=(255, 220, 120))
        sheet.save(f"{outdir}/timeline.png")
        print(f"timeline: {outdir}/timeline.png")


def make(clip, out, span, k, do_grade, fps=30, pingpong=False):
    with tempfile.TemporaryDirectory() as tmp:
        names = frames_of(clip, tmp)
        a, b = (int(x) for x in span.split(":")) if span else (1, len(names))
        src = [Image.open(f"{tmp}/{names[i - 1]}").convert("RGB") for i in range(a, b + 1)]
        n = len(src)
        if pingpong:
            # forward through the span, then the same real frames in reverse (no blends): a lift becomes its lowering and
            # the loop closes exactly where it began. Use only for movements whose reverse is the same movement.
            seq = src + src[-2:0:-1]
        else:
            if k * 2 >= n:
                sys.exit("span too short for the crossfade")
            seq = src[k:]  # the loop starts after the first k frames; the last k blend into them
            for j in range(k):
                w = (j + 1) / (k + 1)
                seq[len(seq) - k + j] = Image.blend(seq[len(seq) - k + j], src[j], w)
        if do_grade:
            seq = [grade(f) for f in seq]
        od = f"{tmp}/out"; os.makedirs(od)
        for i, f in enumerate(seq):
            f.save(f"{od}/{i + 1:04d}.png")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", f"{od}/%04d.png", "-c:v", "libx264", "-profile:v", "high",
                        "-crf", "17", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out], check=True)
        sm = [small(f"{od}/{i + 1:04d}.png") for i in range(len(seq))]
        steps = [diff(sm[i], sm[i + 1]) for i in range(len(sm) - 1)]
        print(f"{out}: {len(seq)} frames ({len(seq) / fps:.2f} s), loop seam {diff(sm[-1], sm[0]):.2f}, median step {np.median(steps):.2f}, max step {max(steps):.2f}, {os.path.getsize(out) / 1e6:.2f} MB")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("cmd", choices=["analyze", "make"])
    p.add_argument("clip"); p.add_argument("out")
    p.add_argument("--span"); p.add_argument("--crossfade", type=int, default=8); p.add_argument("--no-grade", action="store_true"); p.add_argument("--pingpong", action="store_true")
    o = p.parse_args()
    if o.cmd == "analyze":
        analyze(o.clip, o.out)
    else:
        make(o.clip, o.out, o.span, o.crossfade, not o.no_grade, pingpong=o.pingpong)
