// Botanical illustrations drawn as inline SVG, so every herb has its own artwork.
// The drawing style depends on the part of the plant used, with small variations
// derived from the herb's id so no two herbs look exactly alike.

const Art = (() => {
  const FOLIAGE = "#5b7d55";
  const INK = "rgba(35, 48, 42, 0.55)";

  const FLOWER_STYLE = {
    lavender: "spike", hyssop: "spike", "st-johns-wort": "daisy",
    elderflower: "cluster", yarrow: "cluster", meadowsweet: "cluster", linden: "cluster",
    "red-clover": "globe", hops: "globe", clove: "cluster",
    rose: "rose", hibiscus: "cup", saffron: "cup", violet: "cup", passionflower: "daisy"
  };
  const ROOT_STYLE = { ginger: "rhizome", turmeric: "rhizome", garlic: "bulb" };

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Simple seeded random number generator.
  function rng(seed) {
    let s = seed || 1;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
    const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  const f = (n) => n.toFixed(1);

  function leaf(x, y, angle, len, width, color) {
    return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})">
      <path d="M0 0 C${f(width)} ${f(-len * 0.3)} ${f(width * 0.7)} ${f(-len * 0.8)} 0 ${f(-len)} C${f(-width * 0.7)} ${f(-len * 0.8)} ${f(-width)} ${f(-len * 0.3)} 0 0Z" fill="${color}" stroke="${shade(color, -0.3)}" stroke-width="0.8"/>
      <path d="M0 -2 L0 ${f(-len * 0.88)}" stroke="${shade(color, -0.35)}" stroke-width="0.8" opacity="0.7"/>
    </g>`;
  }

  function quad(p0, p1, p2, t) {
    const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    return [a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]];
  }

  function stem(p0, p1, p2, color = FOLIAGE, w = 2.2) {
    return `<path d="M${p0[0]} ${p0[1]} Q${f(p1[0])} ${f(p1[1])} ${f(p2[0])} ${f(p2[1])}" fill="none" stroke="${shade(color, -0.25)}" stroke-width="${w}" stroke-linecap="round"/>`;
  }

  // Leafy sprig: used for leaf herbs and as foliage on others.
  function sprig(r, color, opts = {}) {
    const sway = (r() - 0.5) * 50;
    const p0 = opts.base || [100, 184], p2 = opts.tip || [100 - sway * 0.4, 26];
    const p1 = [100 + sway, (p0[1] + p2[1]) / 2];
    const pairs = opts.pairs || 5 + Math.floor(r() * 3);
    const broad = 0.38 + r() * 0.3;
    let out = stem(p0, p1, p2, color);
    for (let i = 0; i < pairs; i++) {
      const t = 0.18 + (i / pairs) * 0.78;
      const [x, y] = quad(p0, p1, p2, t);
      const len = (opts.len || 46) * (1 - t * 0.55);
      const spread = 48 + r() * 16;
      out += leaf(x, y, -spread, len, len * broad, shade(color, (r() - 0.5) * 0.15));
      out += leaf(x, y, spread, len, len * broad, shade(color, (r() - 0.5) * 0.15));
    }
    const [tx, ty] = p2;
    out += leaf(tx, ty + 4, (r() - 0.5) * 20, 22, 22 * broad, color);
    return out;
  }

  function drawLeaf(h, r) {
    return sprig(r, h.color);
  }

  function flowerHead(style, x, y, color, r) {
    const dark = shade(color, -0.35);
    let out = "";
    if (style === "spike") {
      for (let i = 0; i < 9; i++) {
        const yy = y + 30 - i * 7, w = 7 - i * 0.45;
        out += `<ellipse cx="${f(x - w * 0.6)}" cy="${f(yy)}" rx="${f(w)}" ry="4.5" fill="${color}" stroke="${dark}" stroke-width="0.6"/>`;
        out += `<ellipse cx="${f(x + w * 0.6)}" cy="${f(yy - 3)}" rx="${f(w)}" ry="4.5" fill="${shade(color, 0.12)}" stroke="${dark}" stroke-width="0.6"/>`;
      }
    } else if (style === "cluster") {
      for (let i = 0; i < 22; i++) {
        const a = r() * Math.PI, d = r() * 30;
        const cx = x + Math.cos(a) * d * 1.2 - 0, cy = y - Math.sin(a) * d * 0.7 + 8;
        out += `<line x1="${x}" y1="${y + 18}" x2="${f(cx)}" y2="${f(cy)}" stroke="${shade(FOLIAGE, 0.1)}" stroke-width="0.6"/>`;
      }
      for (let i = 0; i < 26; i++) {
        const a = r() * Math.PI, d = 8 + r() * 26;
        const cx = x + Math.cos(a) * d * 1.2, cy = y - Math.sin(a) * d * 0.7 + 8;
        out += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(3.2 + r() * 1.6)}" fill="${color}" stroke="${dark}" stroke-width="0.5"/>`;
      }
    } else if (style === "globe") {
      for (let i = 0; i < 30; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 18;
        out += `<ellipse cx="${f(x + Math.cos(a) * d)}" cy="${f(y + Math.sin(a) * d)}" rx="4" ry="6" transform="rotate(${f(a * 57)} ${f(x + Math.cos(a) * d)} ${f(y + Math.sin(a) * d)})" fill="${shade(color, (r() - 0.5) * 0.25)}" stroke="${dark}" stroke-width="0.5"/>`;
      }
    } else if (style === "cup") {
      out += `<path d="M${x - 26} ${y - 12} Q${x - 30} ${y + 18} ${x} ${y + 22} Q${x + 30} ${y + 18} ${x + 26} ${y - 12} Q${x + 14} ${y + 2} ${x} ${y - 20} Q${x - 14} ${y + 2} ${x - 26} ${y - 12}Z" fill="${color}" stroke="${dark}" stroke-width="0.9"/>`;
      out += `<path d="M${x} ${y - 16} Q${x - 4} ${y + 6} ${x} ${y + 20}" stroke="${dark}" stroke-width="0.8" fill="none" opacity="0.6"/>`;
      out += `<circle cx="${x}" cy="${y + 4}" r="4" fill="${shade(color, -0.45)}"/>`;
    } else if (style === "rose") {
      for (let ring = 3; ring >= 1; ring--) {
        const n = ring * 3 + 2;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * 360 + ring * 20;
          out += `<ellipse cx="${x}" cy="${y - ring * 6}" rx="${8 + ring * 3}" ry="${6 + ring * 4}" transform="rotate(${a} ${x} ${y})" fill="${shade(color, (3 - ring) * 0.1)}" stroke="${dark}" stroke-width="0.6"/>`;
        }
      }
      out += `<circle cx="${x}" cy="${y}" r="6" fill="${shade(color, -0.2)}"/>`;
    } else {
      const n = 8 + Math.floor(r() * 7);
      const len = 22 + r() * 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 360;
        out += `<ellipse cx="${x}" cy="${f(y - len / 2 - 4)}" rx="${f(5 + r() * 2)}" ry="${f(len / 2)}" transform="rotate(${f(a)} ${x} ${y})" fill="${shade(color, (r() - 0.5) * 0.12)}" stroke="${dark}" stroke-width="0.6"/>`;
      }
      out += `<circle cx="${x}" cy="${y}" r="10" fill="${shade(color, -0.3)}" stroke="${dark}" stroke-width="0.6"/>`;
      for (let i = 0; i < 10; i++) {
        const a = r() * Math.PI * 2, d = r() * 7;
        out += `<circle cx="${f(x + Math.cos(a) * d)}" cy="${f(y + Math.sin(a) * d)}" r="1" fill="${shade(color, -0.55)}"/>`;
      }
    }
    return out;
  }

  function drawFlower(h, r) {
    const style = FLOWER_STYLE[h.id] || "daisy";
    const sway = (r() - 0.5) * 30;
    const head = [100 + sway * 0.5, style === "spike" ? 52 : 70];
    let out = stem([100, 186], [100 + sway, 130], head);
    out += leaf(100 + sway * 0.4, 150, -55, 40, 15, FOLIAGE);
    out += leaf(100 + sway * 0.6, 126, 52, 34, 13, shade(FOLIAGE, 0.08));
    if (r() > 0.4) {
      out += stem([100 + sway * 0.6, 140], [70, 120], [62, 96], FOLIAGE, 1.6);
      out += `<g transform="translate(62 96) scale(0.62) translate(-62 -96)">${flowerHead(style, 62, 96, shade(h.color, 0.15), rng(hash(h.id + "b")))}</g>`;
    }
    out += flowerHead(style, head[0], head[1], h.color, r);
    return out;
  }

  function drawRoot(h, r) {
    const style = ROOT_STYLE[h.id] || "taproot";
    const dark = shade(h.color, -0.35);
    let out = "";
    // Foliage tuft above the ground line.
    for (let i = 0; i < 5; i++) {
      const a = -50 + i * 25 + (r() - 0.5) * 10;
      out += leaf(100, 98, a, 46 + r() * 22, 12 + r() * 6, shade(FOLIAGE, (r() - 0.5) * 0.15));
    }
    out += `<path d="M30 100 Q100 94 170 100" stroke="${INK}" stroke-width="1" fill="none" stroke-dasharray="3 4"/>`;
    if (style === "rhizome") {
      const knobs = [[100, 118, 22, 14], [72, 126, 16, 11], [128, 128, 18, 12], [56, 140, 12, 9], [146, 144, 13, 9], [92, 140, 14, 10]];
      knobs.forEach(([x, y, rx, ry]) => {
        out += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${h.color}" stroke="${dark}" stroke-width="0.9"/>`;
        out += `<path d="M${x - rx * 0.6} ${y - 2} q${rx * 0.6} 4 ${rx * 1.2} 0" stroke="${dark}" stroke-width="0.6" fill="none" opacity="0.6"/>`;
      });
    } else if (style === "bulb") {
      out += `<path d="M100 104 C60 112 58 172 100 176 C142 172 140 112 100 104Z" fill="${h.color}" stroke="${dark}" stroke-width="1"/>`;
      for (let i = -2; i <= 2; i++) {
        out += `<path d="M100 106 Q${100 + i * 16} 140 ${100 + i * 9} 174" stroke="${dark}" stroke-width="0.7" fill="none" opacity="0.6"/>`;
      }
      for (let i = 0; i < 9; i++) {
        out += `<path d="M${90 + i * 2.5} 176 q${(r() - 0.5) * 16} 6 ${(r() - 0.5) * 10} 12" stroke="${dark}" stroke-width="0.6" fill="none"/>`;
      }
    } else {
      const lean = (r() - 0.5) * 20;
      out += `<path d="M86 102 C84 130 ${96 + lean} 160 ${100 + lean} 190 C${106 + lean} 160 116 130 114 102Z" fill="${h.color}" stroke="${dark}" stroke-width="1"/>`;
      for (let i = 0; i < 7; i++) {
        const y = 112 + i * 10, side = i % 2 ? 1 : -1, x = 100 + lean * (i / 7) + side * (12 - i * 1.2);
        out += `<path d="M${f(x)} ${y} q${side * 10} 4 ${side * (16 + r() * 8)} ${f(10 + r() * 6)}" stroke="${dark}" stroke-width="0.7" fill="none"/>`;
        out += `<path d="M${f(100 + lean * (i / 7) - 8)} ${y + 3} l14 -1" stroke="${dark}" stroke-width="0.5" opacity="0.5"/>`;
      }
    }
    return out;
  }

  function drawSeed(h, r) {
    const dark = shade(h.color, -0.35);
    let out = sprig(r, FOLIAGE, { base: [100, 120], tip: [104, 30], pairs: 3, len: 34 });
    // Bowl
    out += `<path d="M42 132 Q100 196 158 132Z" fill="#efe6d4" stroke="${INK}" stroke-width="1"/>`;
    out += `<ellipse cx="100" cy="132" rx="58" ry="9" fill="#e4d8bf" stroke="${INK}" stroke-width="1"/>`;
    for (let i = 0; i < 38; i++) {
      const x = 52 + r() * 96;
      const mound = 1 - Math.pow((x - 100) / 50, 2);
      const y = 132 - r() * 14 * Math.max(mound, 0.1);
      out += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="4.6" ry="2.6" transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})" fill="${shade(h.color, (r() - 0.5) * 0.3)}" stroke="${dark}" stroke-width="0.5"/>`;
    }
    for (let i = 0; i < 6; i++) {
      const x = 40 + r() * 120, y = 176 + r() * 10;
      out += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="4.4" ry="2.5" transform="rotate(${f(r() * 180)} ${f(x)} ${f(y)})" fill="${h.color}" stroke="${dark}" stroke-width="0.5"/>`;
    }
    return out;
  }

  function drawBerry(h, r) {
    const dark = shade(h.color, -0.4);
    let out = stem([36, 178], [70, 70], [160, 40], "#7a5a3c", 3);
    out += leaf(70, 108, -20, 44, 17, FOLIAGE);
    out += leaf(104, 72, 70, 42, 16, shade(FOLIAGE, 0.08));
    out += leaf(140, 48, 20, 34, 13, FOLIAGE);
    const clusters = [[86, 112], [128, 84]];
    clusters.forEach(([cx, cy]) => {
      const n = 5 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const bx = cx + (r() - 0.5) * 34, by = cy + 18 + r() * 28;
        out += `<line x1="${cx}" y1="${cy}" x2="${f(bx)}" y2="${f(by)}" stroke="#7a5a3c" stroke-width="0.8"/>`;
        const rad = 7 + r() * 4;
        out += `<circle cx="${f(bx)}" cy="${f(by)}" r="${f(rad)}" fill="${shade(h.color, (r() - 0.5) * 0.2)}" stroke="${dark}" stroke-width="0.8"/>`;
        out += `<circle cx="${f(bx - rad * 0.35)}" cy="${f(by - rad * 0.35)}" r="${f(rad * 0.25)}" fill="#fff" opacity="0.55"/>`;
      }
    });
    return out;
  }

  function drawBark(h, r) {
    const dark = shade(h.color, -0.35);
    let out = leaf(140, 70, 30, 50, 18, FOLIAGE) + leaf(140, 70, -20, 40, 15, shade(FOLIAGE, 0.1));
    [[-18, 120], [-8, 138], [-28, 156]].forEach(([a, y], i) => {
      const x = 46 + i * 6;
      out += `<g transform="rotate(${a + (r() - 0.5) * 6} 100 ${y})">
        <rect x="${x}" y="${y - 9}" width="110" height="18" rx="9" fill="${h.color}" stroke="${dark}" stroke-width="1"/>
        <path d="M${x + 14} ${y - 4} L${x + 100} ${y - 4}" stroke="${shade(h.color, 0.25)}" stroke-width="1.4"/>
        <ellipse cx="${x + 110 - 9}" cy="${y}" rx="7" ry="9" fill="${shade(h.color, -0.15)}" stroke="${dark}" stroke-width="0.8"/>
        <path d="M${x + 101} ${y - 4} a4 4 0 1 1 -3 6" stroke="${dark}" stroke-width="0.8" fill="none"/>
      </g>`;
    });
    return out;
  }

  function drawMushroom(h) {
    const dark = shade(h.color, -0.35);
    let out = `<path d="M92 120 Q88 160 96 184 L108 184 Q112 160 106 120Z" fill="${shade(h.color, 0.2)}" stroke="${dark}" stroke-width="1"/>`;
    out += `<path d="M30 112 C34 56 166 50 172 112 C150 128 52 130 30 112Z" fill="${h.color}" stroke="${dark}" stroke-width="1.2"/>`;
    for (let i = 1; i <= 4; i++) {
      out += `<path d="M${30 + i * 9} ${112 - i * 2} C${40 + i * 8} ${62 + i * 10} ${160 - i * 8} ${58 + i * 10} ${172 - i * 9} ${112 - i * 2}" fill="none" stroke="${shade(h.color, 0.15 + i * 0.07)}" stroke-width="1.4"/>`;
    }
    out += `<path d="M36 114 C70 126 132 126 168 114" fill="none" stroke="${shade(h.color, 0.45)}" stroke-width="2.5"/>`;
    out += leaf(150, 186, 60, 30, 10, FOLIAGE) + leaf(54, 186, -60, 28, 10, shade(FOLIAGE, 0.1));
    return out;
  }

  const DRAW = { leaf: drawLeaf, flower: drawFlower, root: drawRoot, seed: drawSeed, berry: drawBerry, bark: drawBark, mushroom: drawMushroom };

  // Returns an SVG string. opts.bare skips the tinted background.
  function herb(h, opts = {}) {
    const r = rng(hash(h.id));
    const bg = opts.bare ? "" : `<rect width="200" height="200" fill="${shade(h.color, 0.86)}"/>
      <circle cx="100" cy="104" r="78" fill="${shade(h.color, 0.78)}"/>`;
    const art = (DRAW[h.part] || drawLeaf)(h, r);
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Illustration of ${h.name}" preserveAspectRatio="xMidYMid slice">${bg}${art}</svg>`;
  }

  return { herb, shade };
})();
