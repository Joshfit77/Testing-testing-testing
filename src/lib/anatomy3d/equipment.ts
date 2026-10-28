import * as THREE from "three";
import type { Frame, PropDef, ResolvedProp, Vec } from "../exercise-motion/types";
import type { Joints3 } from "./rig";

/**
 * 3D equipment for the motions' props, in the Narrow Gate look: black steel frames and pads with gold detailing,
 * chrome bars. Each prop is built once in "plane space" (x = the motion's horizontal axis, y up, z across the picture)
 * and moved every frame from the motion's resolved positions, so it lines up with the reviewed 2D technique.
 */
const M = {
  steel: new THREE.MeshStandardMaterial({ color: "#c9ced4", metalness: 1, roughness: 0.22 }),
  knurl: new THREE.MeshStandardMaterial({ color: "#8d9298", metalness: 1, roughness: 0.45 }),
  black: new THREE.MeshStandardMaterial({ color: "#16171a", metalness: 0.65, roughness: 0.42 }),
  frame: new THREE.MeshStandardMaterial({ color: "#202226", metalness: 0.7, roughness: 0.38 }),
  pad: new THREE.MeshStandardMaterial({ color: "#0e0e0f", metalness: 0.1, roughness: 0.78 }),
  gold: new THREE.MeshStandardMaterial({ color: "#c9a54c", metalness: 1, roughness: 0.28 }),
  rubber: new THREE.MeshStandardMaterial({ color: "#121212", metalness: 0.2, roughness: 0.6 }),
  rope: new THREE.MeshStandardMaterial({ color: "#2b261c", metalness: 0.1, roughness: 0.85 }),
  cable: new THREE.MeshStandardMaterial({ color: "#9aa0a6", metalness: 0.9, roughness: 0.35 }),
  stone: new THREE.MeshStandardMaterial({ color: "#4a4844", metalness: 0.05, roughness: 0.9 }),
  wood: new THREE.MeshStandardMaterial({ color: "#2a2219", metalness: 0.1, roughness: 0.7 }),
  wall: new THREE.MeshStandardMaterial({ color: "#14120e", metalness: 0.2, roughness: 0.8 }),
};

export interface PropContext {
  frame: Frame;
  joints: Joints3;
  /** Plane-space x of the motion's centre (subtracted so the athlete stands at the origin). */
  centerX: number;
}

interface Built {
  obj: THREE.Object3D;
  update(rp: ResolvedProp, ctx: PropContext, toPlane: (w: THREE.Vector3) => THREE.Vector3): void;
}

// ---------------------------------------------------------------- shape helpers (plane space)
const box = (w: number, h: number, d: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material, seg = 12): THREE.Mesh {
  const len = a.distanceTo(b);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.max(0.01, len), seg), m);
  placeRod(mesh, a, b);
  return mesh;
}
function placeRod(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a);
  const len = dir.length();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.scale.set(1, len / Math.max(0.01, (mesh as THREE.Mesh).geometry instanceof THREE.CylinderGeometry ? ((mesh as THREE.Mesh).geometry as THREE.CylinderGeometry).parameters.height : 1), 1);
}
const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);

/** The plate face: matte black with gold rings, no lettering (drawn once, shared by every plate). */
let plateFace: THREE.MeshStandardMaterial | null = null;
function plateFaceMaterial(): THREE.MeshStandardMaterial | null {
  if (plateFace) return plateFace;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0d0d0e";
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "#c9a54c";
  for (const [r, w] of [[236, 10], [150, 4], [70, 6]] as const) {
    g.lineWidth = w;
    g.beginPath();
    g.arc(256, 256, r, 0, Math.PI * 2);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  plateFace = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.5, roughness: 0.45 });
  return plateFace;
}

/** A weight plate: black disc, gold rim and hub, axis along z. */
function plate(r: number, t = 4.5): THREE.Group {
  const g = new THREE.Group();
  const face = plateFaceMaterial();
  if (face)
    for (const k of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.CircleGeometry(r - 0.2, 48), face);
      f.position.z = (k * t) / 2 + k * 0.03;
      if (k < 0) f.rotation.y = Math.PI;
      g.add(f);
    }
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, t, 40), M.black);
  disc.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r - 0.6, 0.55, 8, 48), M.gold);
  rim.position.z = t / 2;
  const rim2 = rim.clone();
  rim2.position.z = -t / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.22, t + 0.6, 20), M.gold);
  hub.rotation.x = Math.PI / 2;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.62, 0.35, 6, 40), M.gold);
  ring.position.z = t / 2 + 0.05;
  g.add(disc, rim, rim2, hub, ring);
  return g;
}

/** A barbell along local z (length 220 cm), plates outside the sleeves. */
function barbell(r: number, opts: { plates?: boolean; thick?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(opts.thick ?? 1.4, opts.thick ?? 1.4, 131, 16), M.knurl);
  shaft.rotation.x = Math.PI / 2;
  g.add(shaft);
  for (const k of [-1, 1]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 44, 16), M.steel);
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.z = k * 87;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 2.2, 20), M.gold);
    collar.rotation.x = Math.PI / 2;
    collar.position.z = k * 65.5;
    g.add(sleeve, collar);
    if (opts.plates !== false)
      for (let i = 0; i < 2; i++) {
        const p = plate(i === 0 ? r : r * 0.82, i === 0 ? 5 : 3.5);
        p.position.z = k * (70 + i * 5);
        g.add(p);
      }
  }
  return g;
}

function dumbbell(scale: number): THREE.Group {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 13, 12), M.knurl);
  handle.rotation.x = Math.PI / 2;
  g.add(handle);
  for (const k of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(5.6 * scale, 5.6 * scale, 7 * scale, 6), M.black);
    head.rotation.x = Math.PI / 2;
    head.position.z = k * (6.5 + 3.5 * scale);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(5.7 * scale, 5.7 * scale, 1.2, 6), M.gold);
    band.rotation.x = Math.PI / 2;
    band.position.z = k * 6.8;
    g.add(head, band);
  }
  return g;
}

function kettlebell(scale: number): THREE.Group {
  const g = new THREE.Group();
  const bell = new THREE.Mesh(new THREE.SphereGeometry(9 * scale, 24, 18), M.black);
  bell.position.y = -11 * scale;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(5.2 * scale, 1.2, 10, 24, Math.PI), M.black);
  handle.position.y = -3 * scale;
  const logo = new THREE.Mesh(new THREE.TorusGeometry(4 * scale, 0.4, 6, 24), M.gold);
  logo.position.set(0, -11 * scale, 8.6 * scale);
  g.add(bell, handle, logo);
  return g;
}

function bench(len: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const top = box(len, 7, 28, M.pad);
  top.position.y = h - 3.5;
  const trim = box(len - 2, 0.8, 28.4, M.gold);
  trim.position.y = h - 7.2;
  g.add(top, trim);
  for (const k of [-1, 1]) {
    const leg = box(5, h - 7, 22, M.frame);
    leg.position.set(k * (len / 2 - 9), (h - 7) / 2, 0);
    const foot = box(7, 3, 42, M.frame);
    foot.position.set(k * (len / 2 - 9), 1.5, 0);
    g.add(leg, foot);
  }
  return g;
}

function curveTube(points: THREE.Vector3[], r: number, m: THREE.Material): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), r, 8, false), m);
}
function replaceTube(holder: THREE.Group, points: THREE.Vector3[], r: number, m: THREE.Material) {
  for (const c of holder.children) (c as THREE.Mesh).geometry?.dispose();
  holder.clear();
  if (points.length >= 2) holder.add(curveTube(points, r, m));
}

// ---------------------------------------------------------------- builders

type Builder = (def: PropDef, view: Frame["view"]) => Built;
const P2 = (v: Vec, cx: number, z = 0) => V(v[0] - cx, v[1], z);

const handsPlane = (ctx: PropContext, toPlane: (w: THREE.Vector3) => THREE.Vector3) => ({
  R: toPlane(ctx.joints.R.hand),
  L: toPlane(ctx.joints.L.hand),
});

const fixed = (make: (def: PropDef) => THREE.Object3D, place?: (o: THREE.Object3D, rp: ResolvedProp, ctx: PropContext) => void): Builder => (def) => {
  const obj = make(def);
  return {
    obj,
    update(rp, ctx) {
      if (place) place(obj, rp, ctx);
      else obj.position.copy(P2(rp.at, ctx.centerX));
    },
  };
};

const BUILDERS: Partial<Record<PropDef["kind"], Builder>> = {
  barbell: (def, view) => {
    const front = def.variant === "front";
    const bar = barbell(def.size ?? 22.5, { plates: def.variant !== "empty", thick: def.variant === "axle" ? 2.5 : 1.4 });
    if (front) bar.rotation.y = Math.PI / 2;
    return {
      obj: bar,
      update(rp, ctx, toPlane) {
        if (front && view === "front") {
          const h = handsPlane(ctx, toPlane);
          bar.position.set(rp.at[0] - ctx.centerX, rp.at[1], (h.R.z + h.L.z) / 2);
        } else bar.position.copy(P2(rp.at, ctx.centerX));
      },
    };
  },
  plate: fixed((def) => plate(def.size ?? 22.5, 5)),
  dumbbell: (def) => {
    const g = new THREE.Group();
    const db = dumbbell(def.size ?? 1);
    g.add(db);
    return {
      obj: g,
      update(rp, ctx, toPlane) {
        const hand = toPlane(ctx.joints[def.follow === "handL" ? "L" : "R"].hand);
        g.position.copy(hand);
        // Handle across the fist: along z for an overhand / underhand grip, along the motion plane for a neutral grip.
        const fore = toPlane(ctx.joints[def.follow === "handL" ? "L" : "R"].hand).sub(toPlane(ctx.joints[def.follow === "handL" ? "L" : "R"].elbow));
        if (def.orient === "profile") {
          const a = Math.atan2(fore.y, fore.x);
          g.rotation.set(0, Math.PI / 2, 0);
          g.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), a);
        } else g.rotation.set(0, 0, 0);
        if (def.angle !== undefined && def.orient !== "profile") g.rotation.z = (def.angle * Math.PI) / 180;
        void rp;
      },
    };
  },
  kettlebell: (def) => {
    const kb = kettlebell(def.size ?? 1);
    return {
      obj: kb,
      update(rp, ctx, toPlane) {
        if (def.follow) {
          const j = ctx.joints[def.follow === "handL" ? "L" : "R"];
          const hand = toPlane(j.hand);
          const fore = hand.clone().sub(toPlane(j.elbow)).normalize();
          kb.position.copy(hand);
          if (def.orient === "vertical") kb.quaternion.identity();
          else kb.quaternion.setFromUnitVectors(V(0, -1, 0), fore);
        } else kb.position.copy(P2(rp.at, ctx.centerX));
      },
    };
  },
  bench: fixed((def) => new THREE.Group().add(bench(def.w ?? 110, 0)), (o, rp, ctx) => {
    const g = o as THREE.Group;
    if (!g.userData.h || g.userData.h !== rp.at[1]) {
      g.clear();
      g.add(bench((g.userData.w as number) ?? 110, rp.at[1]));
      g.userData.h = rp.at[1];
    }
    g.position.set(rp.at[0] - ctx.centerX, 0, 0);
  }),
  inclineBench: (def) => {
    const g = new THREE.Group();
    const ang = ((def.angle ?? 35) * Math.PI) / 180;
    const back = def.w ?? 78;
    const seat = def.h ?? 30;
    const dir = def.variant === "right" ? 1 : -1;
    return {
      obj: g,
      update(rp, ctx) {
        if (!g.children.length) {
          const at = P2(rp.at, 0);
          const top = V(at.x + dir * Math.cos(ang) * back, at.y + Math.sin(ang) * back);
          const bp = box(back, 7, 28, M.pad);
          bp.position.copy(at.clone().add(top).multiplyScalar(0.5)).add(V(0, -3.5));
          bp.rotation.z = dir * ang;
          const sp = box(seat, 7, 28, M.pad);
          sp.position.set(at.x - (dir * seat) / 2, at.y - 3.5, 0);
          g.add(bp, sp, rod(V(at.x - dir * seat * 0.6, at.y - 8), V(at.x - dir * seat * 0.8, 0), 2.2, M.frame), rod(V(at.x, at.y - 8), V(at.x + dir * 22, 0), 2.2, M.frame), rod(V(top.x, top.y - 6), V(top.x, 0), 2, M.frame));
        }
        g.position.set(-ctx.centerX, 0, 0);
      },
    };
  },
  rack: fixed((def) => {
    const g = new THREE.Group();
    for (const k of [-1, 1]) {
      const up = box(7, 215, 7, M.frame);
      up.position.set(0, 107.5, k * 62);
      const stripe = box(0.6, 200, 7.2, M.gold);
      stripe.position.set(3.7, 107.5, k * 62);
      const base = box(70, 4, 8, M.frame);
      base.position.set(0, 2, k * 62);
      g.add(up, stripe, base);
    }
    const top = box(7, 6, 131, M.frame);
    top.position.set(0, 212, 0);
    g.add(top);
    g.userData.pins = def.h ?? 0;
    return g;
  }, (o, rp, ctx) => {
    o.position.set(rp.at[0] - ctx.centerX, 0, 0);
    if (!o.userData.hooks) {
      for (const k of [-1, 1]) {
        const hook = box(9, 3, 6, M.gold);
        hook.position.set(5, rp.at[1], k * 62);
        o.add(hook);
        if (o.userData.pins) {
          const pin = box(80, 2.6, 2.6, M.steel);
          pin.position.set(0, o.userData.pins as number, k * 62);
          o.add(pin);
        }
      }
      o.userData.hooks = true;
    }
  }),
  pullupBar: fixed((def) => {
    const g = new THREE.Group();
    g.add(rod(V(0, 0, -70), V(0, 0, 70), 1.6, M.steel));
    for (const k of [-1, 1]) g.add(rod(V(0, 0, k * 70), V(-(def.w ?? 45), 6, k * 70), 2.6, M.frame), rod(V(-(def.w ?? 45), 6, k * 70), V(-(def.w ?? 45), -260, k * 70), 3, M.frame));
    return g;
  }),
  dipBars: fixed((def) => {
    const g = new THREE.Group();
    const w = def.w ?? 56;
    for (const k of [-1, 1]) {
      g.add(rod(V(-w / 2, 0, k * 26), V(w / 2, 0, k * 26), 2.4, M.steel));
      g.add(rod(V(-w / 2 + 6, 0, k * 26), V(-w / 2 + 2, -300, k * 26), 2.6, M.frame), rod(V(w / 2 - 6, 0, k * 26), V(w / 2 - 2, -300, k * 26), 2.6, M.frame));
    }
    return g;
  }, (o, rp, ctx) => {
    o.position.set(rp.at[0] - ctx.centerX, rp.at[1], 0);
    o.children.forEach((c) => {
      c.userData.clip ??= true;
    });
  }),
  cableTower: fixed((def) => {
    const g = new THREE.Group();
    const h = def.h ?? 210;
    const t = box(24, h, 30, M.frame);
    t.position.y = h / 2;
    const stack = box(16, 60, 18, M.black);
    stack.position.set(0, 36, 0);
    const trim = box(24.4, 1, 30.4, M.gold);
    trim.position.y = h - 4;
    g.add(t, stack, trim);
    return g;
  }),
  cable: (def) => {
    const g = new THREE.Group();
    return {
      obj: g,
      update(rp, ctx, toPlane) {
        if (!rp.to) return;
        const h = handsPlane(ctx, toPlane);
        const z = (h.R.z + h.L.z) / 2;
        replaceTube(g, [P2(rp.at, ctx.centerX), P2(rp.to, ctx.centerX, z)], 0.35, M.cable);
        void def;
      },
    };
  },
  band: () => {
    const g = new THREE.Group();
    return {
      obj: g,
      update(rp, ctx, toPlane) {
        if (!rp.to) return;
        const h = handsPlane(ctx, toPlane);
        const a = P2(rp.at, ctx.centerX);
        const b = P2(rp.to, ctx.centerX, (h.R.z + h.L.z) / 2);
        const sag = Math.max(0, 14 - a.distanceTo(b) / 6);
        replaceTube(g, [a, a.clone().add(b).multiplyScalar(0.5).add(V(0, -sag)), b], 0.9, M.gold);
      },
    };
  },
  box: fixed((def) => {
    const w = def.w ?? 60;
    const h = def.h ?? 50;
    const g = new THREE.Group();
    const b = box(w, h, 46, M.wood);
    b.position.y = h / 2;
    const trim = box(w + 0.4, 0.8, 46.4, M.gold);
    trim.position.y = h - 5;
    g.add(b, trim);
    return g;
  }, (o, rp, ctx) => o.position.set(rp.at[0] - ctx.centerX, 0, 0)),
  chair: fixed(() => {
    const g = new THREE.Group();
    const seat = box(42, 6, 40, M.pad);
    seat.position.set(-21, -3, 0);
    g.add(seat, rod(V(-3, -6, 16), V(-3, -300, 16), 1.3, M.frame), rod(V(-3, -6, -16), V(-3, -300, -16), 1.3, M.frame), rod(V(-39, -6, 16), V(-39, -300, 16), 1.3, M.frame), rod(V(-39, -6, -16), V(-39, -300, -16), 1.3, M.frame));
    const back = box(4, 42, 40, M.pad);
    back.position.set(-43, 22, 0);
    back.rotation.z = -0.1;
    g.add(back);
    return g;
  }, (o, rp, ctx) => {
    o.position.set(rp.at[0] - ctx.centerX, rp.at[1], 0);
    o.children.forEach((c) => {
      if (c.position.y < -100) c.position.y = -rp.at[1] / 2;
    });
  }),
  wall: fixed((def) => {
    const w = box(30, 240, 260, M.wall);
    w.position.set(def.variant === "left" ? -15 : 15, 120, 0);
    const line = box(0.6, 240, 260, M.gold);
    line.position.set(def.variant === "left" ? 0.3 : -0.3, 120, 0);
    return new THREE.Group().add(w, line);
  }, (o, rp, ctx) => o.position.set(rp.at[0] - ctx.centerX, 0, 0)),
  sled: fixed((def) => {
    const g = new THREE.Group();
    const base = box(80, 4, 50, M.frame);
    base.position.y = 3;
    const post = rod(V(0, 3), V(0, 30), 2, M.steel);
    const p = plate(21, 5);
    p.position.y = 26;
    p.rotation.y = Math.PI / 2;
    g.add(base, post, p);
    if (def.variant === "push") for (const k of [-1, 1]) g.add(rod(V(-22, 6, k * 20), V(-34, 100, k * 20), 1.8, M.frame));
    return g;
  }, (o, rp, ctx) => o.position.set(rp.at[0] - ctx.centerX, 0, 0)),
  sandbag: fixed((def) => {
    const w = def.w ?? 46;
    const h = def.h ?? 26;
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(h / 2, Math.max(1, w - h), 8, 16), M.rope);
    m.rotation.z = Math.PI / 2 + ((def.angle ?? 0) * Math.PI) / 180;
    return new THREE.Group().add(m);
  }),
  medball: fixed((def) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(def.size ?? 12, 24, 18), M.rubber));
    const seam = new THREE.Mesh(new THREE.TorusGeometry((def.size ?? 12) * 1.001, 0.25, 6, 40), M.gold);
    g.add(seam);
    return g;
  }),
  yoke: fixed(() => {
    const g = new THREE.Group();
    g.add(rod(V(0, 0, -58), V(0, 0, 58), 2.4, M.frame));
    for (const k of [-1, 1]) {
      g.add(rod(V(0, 0, k * 58), V(0, -200, k * 58), 2.8, M.frame));
      const p = plate(20, 5);
      p.position.set(0, -170, k * 66);
      g.add(p);
    }
    return g;
  }, (o, rp, ctx) => {
    o.position.set(rp.at[0] - ctx.centerX, rp.at[1], 0);
    o.children.forEach((c) => {
      if (c.position.y === -170) c.position.y = -(rp.at[1] - 33);
    });
  }),
  farmerHandle: (def) => {
    const g = new THREE.Group();
    const L = def.w ?? 120;
    const make = () => {
      const h = new THREE.Group();
      h.add(rod(V(-L / 2, 0), V(L / 2, 0), 2.2, M.frame));
      for (const k of [-1, 1]) {
        const p = plate(20, 5);
        p.position.x = k * (L / 2 - 6);
        p.rotation.y = Math.PI / 2;
        h.add(p);
      }
      return h;
    };
    const r = make();
    const l = make();
    g.add(r, l);
    return {
      obj: g,
      update(rp, ctx, toPlane) {
        const h = handsPlane(ctx, toPlane);
        r.position.set(rp.at[0] - ctx.centerX, h.R.y, h.R.z);
        l.position.set(rp.at[0] - ctx.centerX, h.L.y, h.L.z);
      },
    };
  },
  trapBar: (def) => {
    const g = new THREE.Group();
    const hex = new THREE.Mesh(new THREE.TorusGeometry(34, 1.6, 8, 6), M.frame);
    hex.rotation.x = Math.PI / 2;
    g.add(hex);
    for (const k of [-1, 1]) {
      g.add(rod(V(-8, 2, k * 30), V(8, 2, k * 30), 1.6, M.knurl), rod(V(0, 0, k * 34), V(0, 0, k * 86), 2.5, M.steel));
      const p = plate(def.size ?? 22.5, 5);
      p.position.z = k * 72;
      g.add(p);
    }
    return { obj: g, update: (rp, ctx) => g.position.copy(P2(rp.at, ctx.centerX)) };
  },
  stone: fixed((def) => new THREE.Mesh(new THREE.SphereGeometry(def.size ?? 23, 24, 18), M.stone)),
  platform: fixed((def) => {
    const b = box(def.w ?? 50, def.h ?? 120, 60, M.wood);
    b.position.y = (def.h ?? 120) / 2;
    return new THREE.Group().add(b);
  }, (o, rp, ctx) => o.position.set(rp.at[0] - ctx.centerX, 0, 0)),
  log: fixed((def) => {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(def.size ?? 15, def.size ?? 15, 150, 28), M.black);
    c.rotation.x = Math.PI / 2;
    for (const k of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry((def.size ?? 15) + 0.2, 0.5, 6, 32), M.gold);
      ring.position.z = k * 74;
      g.add(ring);
    }
    g.add(c);
    return g;
  }),
  keg: fixed((def) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry((def.w ?? 36) / 2, (def.w ?? 36) / 2, def.h ?? 50, 28), M.steel);
    c.rotation.x = Math.PI / 2;
    return new THREE.Group().add(c);
  }),
  jumpRope: () => {
    const g = new THREE.Group();
    return {
      obj: g,
      update(rp, ctx, toPlane) {
        const h = handsPlane(ctx, toPlane);
        const far = P2(rp.at, ctx.centerX, 0);
        replaceTube(g, [h.R, V(far.x, far.y, h.R.z * 0.6), far, V(far.x, far.y, h.L.z * 0.6), h.L], 0.35, M.rope);
      },
    };
  },
  heavyBag: fixed((def) => {
    const g = new THREE.Group();
    const h = def.h ?? 105;
    const bag = new THREE.Mesh(new THREE.CylinderGeometry((def.w ?? 36) / 2, (def.w ?? 36) / 2, h, 28), M.pad);
    bag.position.y = -h / 2;
    const band = new THREE.Mesh(new THREE.CylinderGeometry((def.w ?? 36) / 2 + 0.2, (def.w ?? 36) / 2 + 0.2, 3, 28), M.gold);
    band.position.y = -h * 0.2;
    g.add(bag, band, rod(V(0, 0), V(0, 120), 0.4, M.cable));
    return g;
  }),
  battleRope: () => {
    const g = new THREE.Group();
    return {
      obj: g,
      update(rp, ctx, toPlane) {
        const h = handsPlane(ctx, toPlane);
        const anchor = P2(rp.at, ctx.centerX, 0);
        const pts: THREE.Vector3[] = [];
        const t = ctx.frame.cameraX * 0 + performance.now() / 1000;
        for (const hand of [h.R, h.L]) {
          pts.length = 0;
          for (let i = 0; i <= 10; i++) {
            const k = i / 10;
            const p = hand.clone().lerp(anchor, k);
            p.y = hand.y * (1 - k) + anchor.y * k + Math.sin(k * 9 - t * 9) * 6 * (1 - k);
            pts.push(p);
          }
        }
        for (const c of g.children) (c as THREE.Mesh).geometry?.dispose();
        g.clear();
        for (const hand of [h.R, h.L]) {
          const line: THREE.Vector3[] = [];
          for (let i = 0; i <= 10; i++) {
            const k = i / 10;
            const p = hand.clone().lerp(anchor, k);
            p.y = hand.y * (1 - k) + anchor.y * k + Math.sin(k * 9 - t * 9) * 6 * (1 - k);
            line.push(p);
          }
          g.add(curveTube(line, 1.6, M.rope));
        }
      },
    };
  },
  rower: () => {
    const g = new THREE.Group();
    const rail = box(170, 4, 10, M.frame);
    const fly = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 14, 32), M.black);
    fly.rotation.x = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(22, 0.6, 6, 40), M.gold);
    const seat = box(26, 5, 26, M.pad);
    g.add(rail, fly, ring, seat);
    return {
      obj: g,
      update(rp, ctx) {
        const x = rp.at[0] - ctx.centerX;
        fly.position.set(x, 30, 0);
        ring.position.set(x, 30, 7.2);
        rail.position.set(x - 85, 22, 0);
        if (rp.to) seat.position.set(rp.to[0] - ctx.centerX, rp.to[1] - 3, 0);
      },
    };
  },
  bike: () => {
    const g = new THREE.Group();
    const seat = box(24, 5, 18, M.pad);
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 10, 36), M.black);
    fan.rotation.x = Math.PI / 2;
    const base = box(125, 4, 40, M.frame);
    g.add(seat, fan, base);
    return {
      obj: g,
      update(rp, ctx) {
        const s = P2(rp.at, ctx.centerX);
        seat.position.set(s.x, s.y - 2.5, 0);
        fan.position.set(s.x + 70, 40, 0);
        base.position.set(s.x + 32, 2, 0);
        if (!g.userData.post) {
          g.add(rod(V(s.x - 4, s.y - 6), V(s.x - 22, 3), 2, M.frame), rod(V(s.x - 6, s.y - 4), V(s.x + 12, 36), 2, M.frame), rod(V(s.x + 12, 36), V(s.x + 66, 44), 2, M.frame));
          g.userData.post = true;
        }
      },
    };
  },
  landmine: () => {
    const g = new THREE.Group();
    return {
      obj: g,
      update(rp, ctx, toPlane) {
        if (!rp.to) return;
        const h = handsPlane(ctx, toPlane);
        const a = P2(rp.at, ctx.centerX);
        const b = P2(rp.to, ctx.centerX, (h.R.z + h.L.z) / 2);
        const dir = b.clone().sub(a).normalize();
        const end = b.clone().addScaledVector(dir, 30);
        for (const c of g.children) (c as THREE.Mesh).geometry?.dispose();
        g.clear();
        g.add(rod(a, end, 1.6, M.steel));
        const p = plate(20, 5);
        p.position.copy(end.clone().addScaledVector(dir, -6));
        p.quaternion.setFromUnitVectors(V(0, 0, 1), dir);
        g.add(p);
      },
    };
  },
  abWheel: fixed((def) => {
    const r = def.size ?? 10;
    const g = new THREE.Group();
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 6, 28), M.black);
    w.rotation.x = Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.5, 6, 28), M.gold);
    g.add(w, ring, rod(V(0, 0, -16), V(0, 0, 16), 1.2, M.steel));
    return g;
  }, (o, rp, ctx) => o.position.set(rp.at[0] - ctx.centerX, (o.children[0] as THREE.Mesh).geometry instanceof THREE.CylinderGeometry ? ((o.children[0] as THREE.Mesh).geometry as THREE.CylinderGeometry).parameters.radiusTop : 10, 0)),
  mat: fixed((def) => {
    const w = def.w ?? 180;
    const m = box(w, 1.6, 62, M.pad);
    m.position.y = 0.8;
    const edge = box(w, 0.4, 62.6, M.gold);
    edge.position.y = 0.2;
    return new THREE.Group().add(m, edge);
  }, (o, rp, ctx) => o.position.set(rp.at[0] - ctx.centerX, 0, 0)),
  cone: fixed((def) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(7, def.h ?? 16, 20), M.gold);
    c.position.y = (def.h ?? 16) / 2;
    return new THREE.Group().add(c);
  }, (o, rp, ctx) => o.position.set(rp.at[0] - ctx.centerX, 0, 0)),
  ladder: fixed((def) => {
    const g = new THREE.Group();
    const w = def.w ?? 300;
    for (let x = -w / 2; x <= w / 2; x += 45) {
      const rung = box(2, 0.6, 45, M.gold);
      rung.position.set(x, 0.3, 0);
      g.add(rung);
    }
    for (const k of [-1, 1]) {
      const side = box(w, 0.5, 1.4, M.gold);
      side.position.set(0, 0.3, k * 22.5);
      g.add(side);
    }
    return g;
  }, (o, rp, ctx) => o.position.set(rp.at[0] - ctx.centerX, 0, 0)),
  stairs: fixed((def) => {
    const g = new THREE.Group();
    const sw = def.w ?? 30;
    const sh = def.h ?? 18;
    for (let i = 0; i < 5; i++) {
      const st = box(sw, sh * (i + 1), 110, M.wood);
      st.position.set(i * sw + sw / 2, (sh * (i + 1)) / 2, 0);
      const nose = box(sw, 0.8, 110.4, M.gold);
      nose.position.set(i * sw + sw / 2, sh * (i + 1), 0);
      g.add(st, nose);
    }
    return g;
  }, (o, rp, ctx) => o.position.set(rp.at[0] - ctx.centerX, 0, 0)),
  rope: () => {
    const g = new THREE.Group();
    return {
      obj: g,
      update(rp, ctx) {
        if (!rp.to) return;
        const a = P2(rp.at, ctx.centerX);
        const b = P2(rp.to, ctx.centerX);
        replaceTube(g, [a, V((a.x + b.x) / 2, Math.min(a.y, b.y) - 8), b], 1.4, M.rope);
      },
    };
  },
  hurdleLine: fixed((def) => {
    const l = box(def.w ?? 8, 0.4, 60, M.gold);
    l.position.set((def.w ?? 8) / 2, 0.2, 0);
    return new THREE.Group().add(l);
  }, (o, rp, ctx) => o.position.set(rp.at[0] - ctx.centerX, 0, 0)),
  pad: fixed((def) => box(def.w ?? 30, def.h ?? 4, 40, M.pad)),
  hyper: () => {
    const g = new THREE.Group();
    return {
      obj: g,
      update(rp, ctx) {
        if (g.children.length || !rp.to) return;
        const a = P2(rp.at, ctx.centerX);
        const f = P2(rp.to, ctx.centerX);
        const hip = box(26, 8, 34, M.pad);
        hip.position.copy(a);
        hip.rotation.z = Math.atan2(f.y - a.y, f.x - a.x) + Math.PI / 2;
        const roller = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 36, 20), M.pad);
        roller.rotation.x = Math.PI / 2;
        roller.position.copy(f);
        g.add(hip, roller, rod(a.clone().add(V(0, -6)), f.clone().add(V(0, -5)), 2.4, M.frame), rod(f.clone().add(V(0, -5)), V(f.x - 10, 3), 2.4, M.frame), rod(a.clone().add(V(0, -6)), V(a.x + 10, 3), 2.4, M.frame));
      },
    };
  },
};

/** Seated / lying machines: a black frame with pads, built around the seat (`at`) and the moving point (`to`). */
function machine(kind: PropDef["kind"], def: PropDef): Built {
  const g = new THREE.Group();
  const moving = new THREE.Group();
  const cable = new THREE.Group();
  g.add(moving, cable);
  let built = false;
  return {
    obj: g,
    update(rp, ctx, toPlane) {
      const at = P2(rp.at, ctx.centerX);
      const to = rp.to ? P2(rp.to, ctx.centerX) : null;
      const h = handsPlane(ctx, toPlane);
      if (!built) {
        built = true;
        const seat = box(36, 7, 34, M.pad);
        const frameBase = box(150, 4, 50, M.frame);
        frameBase.position.set(at.x + 20, 2, 0);
        g.add(frameBase);
        switch (kind) {
          case "legPress": {
            const lean = ((def.angle ?? -45) * Math.PI) / 180;
            const back = box(62, 7, 40, M.pad);
            back.position.set(at.x - Math.sin(-lean) * 31, at.y + Math.cos(lean) * 31, 0);
            back.rotation.z = -lean;
            seat.position.set(at.x + 14, at.y - 4, 0);
            g.add(back, seat, rod(V(at.x + 10, at.y - 8), V(at.x + 10, 3), 3, M.frame));
            break;
          }
          case "hackSquat": {
            const ang = ((def.angle ?? 70) * Math.PI) / 180;
            const top = at.clone().add(V(Math.cos(Math.PI - ang) * 160, Math.sin(ang) * 160));
            for (const k of [-1, 1]) g.add(rod(at.clone().setZ(k * 24), top.clone().setZ(k * 24), 2.6, M.frame));
            const plat = box(48, 4, 50, M.frame);
            plat.position.set(at.x + 18, 9, 0);
            plat.rotation.z = 0.12;
            g.add(plat);
            break;
          }
          case "legExtension":
          case "seatedLegCurl": {
            seat.position.set(at.x - 18, at.y - 4, 0);
            const back = box(6, 55, 36, M.pad);
            back.position.set(at.x - 38, at.y + 26, 0);
            g.add(seat, back, rod(V(at.x - 18, at.y - 8), V(at.x - 18, 3), 3, M.frame));
            break;
          }
          case "legCurl": {
            const padL = box(130, 8, 36, M.pad);
            padL.position.set(at.x + 65, at.y - 4, 0);
            g.add(padL, rod(V(at.x + 60, at.y - 8), V(at.x + 60, 3), 3, M.frame));
            break;
          }
          case "chestPress":
          case "latPulldown":
          case "cableRowSeat":
          case "calfMachine": {
            seat.position.set(at.x, at.y - 4, 0);
            g.add(seat, rod(V(at.x, at.y - 8), V(at.x, 3), 3, M.frame));
            if (kind === "chestPress") {
              const back = box(6, 60, 36, M.pad);
              back.position.set(at.x - 18, at.y + 30, 0);
              g.add(back);
            }
            if (kind === "latPulldown") {
              const tower = box(14, 240, 14, M.frame);
              tower.position.set(at.x + 30, 120, 0);
              const thigh = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 34, 16), M.pad);
              thigh.rotation.x = Math.PI / 2;
              thigh.position.set(at.x + 18, at.y + 18, 0);
              g.add(tower, thigh);
            }
            if (kind === "cableRowSeat") {
              const plateF = box(4, 30, 40, M.frame);
              plateF.position.set(at.x + (def.w ?? 92), 20, 0);
              g.add(plateF);
            }
            break;
          }
        }
        const trim = box(150.4, 0.6, 50.4, M.gold);
        trim.position.set(at.x + 20, 4.2, 0);
        g.add(trim);
      }
      // Moving parts: the foot sled, pads and handles follow `to` / the hands.
      for (const c of moving.children) (c as THREE.Mesh).geometry?.dispose();
      moving.clear();
      for (const c of cable.children) (c as THREE.Mesh).geometry?.dispose();
      cable.clear();
      if (!to) return;
      switch (kind) {
        case "legPress": {
          const plateM = box(8, 50, 60, M.black);
          plateM.position.copy(to);
          plateM.rotation.z = Math.PI / 4;
          moving.add(plateM);
          break;
        }
        case "hackSquat": {
          const pads = box(16, 10, 44, M.pad);
          pads.position.copy(to);
          moving.add(pads);
          break;
        }
        case "legExtension":
        case "seatedLegCurl":
        case "legCurl":
        case "calfMachine": {
          const roller = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 34, 18), M.pad);
          roller.rotation.x = Math.PI / 2;
          roller.position.copy(to);
          moving.add(roller, rod(at, to, 1.8, M.frame));
          break;
        }
        case "chestPress": {
          for (const hand of [h.R, h.L]) moving.add(rod(hand.clone().add(V(0, 8)), hand.clone().add(V(0, -8)), 1.6, M.steel));
          break;
        }
        case "latPulldown": {
          const bar = rod(V(to.x, to.y, -55), V(to.x, to.y, 55), 1.5, M.steel);
          moving.add(bar);
          cable.add(rod(V(to.x, to.y), V(at.x + 22, 236), 0.35, M.cable));
          break;
        }
        case "cableRowSeat": {
          const handle = rod(V(to.x, to.y, -10), V(to.x, to.y, 10), 1.5, M.steel);
          moving.add(handle);
          cable.add(rod(V(to.x, to.y), V(at.x + (def.w ?? 92) - 6, 12), 0.35, M.cable));
          break;
        }
      }
    },
  };
}

const MACHINES = new Set<PropDef["kind"]>(["legPress", "hackSquat", "legExtension", "seatedLegCurl", "legCurl", "chestPress", "latPulldown", "cableRowSeat", "calfMachine"]);

export interface EquipmentSet {
  group: THREE.Group;
  update(frame: Frame, joints: Joints3): void;
  kinds: string[];
  dispose(): void;
}

/**
 * Builds every prop of a motion. `basis` maps plane space to world space: side-view motions keep x forward and z across;
 * front-view motions put the plane's x across the athlete (their left = -Z) and depth forward.
 */
export function makeEquipment(props: PropDef[], view: Frame["view"], centerX: number): EquipmentSet {
  const group = new THREE.Group();
  if (view === "front") group.matrix.makeBasis(V(0, 0, -1), V(0, 1, 0), V(1, 0, 0));
  group.matrixAutoUpdate = false;
  const inv = group.matrix.clone().invert();
  const toPlane = (w: THREE.Vector3) => w.clone().applyMatrix4(inv);
  const built = props.map((def) => {
    const b = MACHINES.has(def.kind) ? machine(def.kind, def) : (BUILDERS[def.kind] ?? fixed(() => new THREE.Group()))(def, view);
    group.add(b.obj);
    return { def, b };
  });
  return {
    group,
    kinds: props.map((p) => p.kind),
    update(frame, joints) {
      const ctx: PropContext = { frame, joints, centerX };
      for (const { def, b } of built) {
        const rp = frame.props.find((r) => r.def === def || r.def.id === def.id);
        if (rp) b.update(rp, ctx, toPlane);
      }
    },
    dispose() {
      group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    },
  };
}
