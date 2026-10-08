// Turns a food's photograph into an oil painting, right in the visitor's browser.
//
// The photo is smoothed into flat strokes of color (a Kuwahara filter, the classic "oil paint"
// effect), warmed and deepened like old varnish, given raised brush texture, and laid on a
// fine canvas weave. Finished paintings are kept for the visit, so filtering the food guide
// never repaints the same food twice.
const OilPaint = (() => {
  const done = new Map();

  // Kuwahara: each pixel takes the average color of whichever of its four neighboring squares
  // is the most even in tone. Summed-area tables keep it fast at any brush size.
  function kuwahara(px, w, h, r) {
    const W = w + 1, n = W * (h + 1);
    const sR = new Float64Array(n), sG = new Float64Array(n), sB = new Float64Array(n), sL = new Float64Array(n), sQ = new Float64Array(n);
    for (let y = 0; y < h; y++) {
      let aR = 0, aG = 0, aB = 0, aL = 0, aQ = 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, R = px[i], G = px[i + 1], B = px[i + 2], L = 0.299 * R + 0.587 * G + 0.114 * B;
        aR += R; aG += G; aB += B; aL += L; aQ += L * L;
        const j = (y + 1) * W + x + 1, k = y * W + x + 1;
        sR[j] = sR[k] + aR; sG[j] = sG[k] + aG; sB[j] = sB[k] + aB; sL[j] = sL[k] + aL; sQ[j] = sQ[k] + aQ;
      }
    }
    const out = new Uint8ClampedArray(px.length);
    const box = (s, x0, y0, x1, y1) => s[y1 * W + x1] - s[y0 * W + x1] - s[y1 * W + x0] + s[y0 * W + x0];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let best = Infinity, bx0 = 0, by0 = 0, bx1 = 0, by1 = 0, bn = 1;
        for (let q = 0; q < 4; q++) {
          const x0 = Math.max(0, q & 1 ? x : x - r), x1 = Math.min(w, (q & 1 ? x + r : x) + 1);
          const y0 = Math.max(0, q & 2 ? y : y - r), y1 = Math.min(h, (q & 2 ? y + r : y) + 1);
          const c = (x1 - x0) * (y1 - y0), m = box(sL, x0, y0, x1, y1) / c;
          const v = box(sQ, x0, y0, x1, y1) / c - m * m;
          if (v < best) { best = v; bx0 = x0; by0 = y0; bx1 = x1; by1 = y1; bn = c; }
        }
        const i = (y * w + x) * 4;
        out[i] = box(sR, bx0, by0, bx1, by1) / bn;
        out[i + 1] = box(sG, bx0, by0, bx1, by1) / bn;
        out[i + 2] = box(sB, bx0, by0, bx1, by1) / bn;
        out[i + 3] = 255;
      }
    }
    return out;
  }

  // Blends each stroke softly into its neighbors so no square edges show.
  function soften(px, w, h) {
    const out = new Uint8ClampedArray(px.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        for (let ch = 0; ch < 3; ch++) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const yy = Math.min(h - 1, Math.max(0, y + dy));
            for (let dx = -1; dx <= 1; dx++) sum += px[(yy * w + Math.min(w - 1, Math.max(0, x + dx))) * 4 + ch];
          }
          out[i + ch] = px[i + ch] * 0.4 + (sum / 9) * 0.6;
        }
        out[i + 3] = 255;
      }
    }
    return out;
  }

  // Varnish warmth, richer color, raised brush texture, darkened edges and canvas weave.
  function finish(px, w, h) {
    const lum = new Float32Array(w * h);
    for (let p = 0, i = 0; p < w * h; p++, i += 4) lum[p] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const cx = w / 2, cy = h / 2, maxD = Math.hypot(cx, cy);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x, i = p * 4;
        let R = px[i], G = px[i + 1], B = px[i + 2];
        const L = lum[p];
        // richer color
        R = L + (R - L) * 1.32; G = L + (G - L) * 1.32; B = L + (B - L) * 1.32;
        // gentle contrast and a warm, amber varnish
        R = (R - 128) * 1.08 + 128 + 10; G = (G - 128) * 1.08 + 128 + 3; B = (B - 128) * 1.08 + 128 - 14;
        // raised brush texture: light from the upper left catches the edges of each stroke
        const up = lum[Math.max(0, y - 1) * w + Math.max(0, x - 1)], dn = lum[Math.min(h - 1, y + 1) * w + Math.min(w - 1, x + 1)];
        const relief = (up - dn) * 0.45;
        // canvas weave
        const weave = ((x % 3 === 0) !== (y % 3 === 0) ? 3 : -2) + ((x * 7 + y * 13) % 5) - 2;
        // old-master shadows toward the edges
        const d = Math.hypot(x - cx, y - cy) / maxD, vig = 1 - 0.38 * d * d;
        px[i] = (R + relief + weave) * vig;
        px[i + 1] = (G + relief + weave) * vig;
        px[i + 2] = (B + relief + weave) * vig;
      }
    }
  }

  function loadImage(src) {
    return new Promise((ok, fail) => {
      const img = new Image();
      if (/^https?:/.test(src) && !src.startsWith(location.origin)) img.crossOrigin = "anonymous";
      img.onload = () => ok(img);
      img.onerror = fail;
      img.src = src;
    });
  }

  // Paints `src` at the given size (cropped to fill, like object-fit: cover) and resolves to an image URL.
  async function paint(src, width, height) {
    const id = `${src}|${width}x${height}`;
    if (done.has(id)) return done.get(id);
    const job = loadImage(src).then((img) => {
      const c = document.createElement("canvas");
      c.width = width; c.height = height;
      const g = c.getContext("2d", { willReadFrequently: true });
      const s = Math.max(width / img.naturalWidth, height / img.naturalHeight);
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      g.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
      const data = g.getImageData(0, 0, width, height);
      const brush = Math.max(3, Math.round(width / 110));
      let px = kuwahara(data.data, width, height, brush);
      px = kuwahara(px, width, height, Math.max(2, Math.round(brush / 2)));
      px = soften(px, width, height);
      finish(px, width, height);
      data.data.set(px);
      g.putImageData(data, 0, 0);
      return c.toDataURL("image/jpeg", 0.86);
    });
    done.set(id, job);
    job.catch(() => done.delete(id));
    return job;
  }

  return { paint };
})();
