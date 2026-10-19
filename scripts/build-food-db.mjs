// Builds a compact food database from the USDA FoodData Central "SR Legacy" CSV release (public domain).
// Usage: node scripts/build-food-db.mjs <unzipped-sr-legacy-dir> <out.json>
// Output: { v, source, cats: string[], foods: [fdcId, name, catIndex, kcal, protein, carbs, fat, fiber, sugar, sodiumMg, portions] }
// Nutrients are per 100 g; portions are [label, grams] household measures from USDA (e.g. ["1 cup, chopped", 160]).
import fs from "node:fs";
import path from "node:path";

const [dir, out] = process.argv.slice(2);
if (!dir || !out) throw new Error("usage: build-food-db.mjs <dir> <out.json>");

function findFile(name) {
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name === name) return p;
    }
  }
  throw new Error(`missing ${name}`);
}

// RFC 4180 CSV parser (quoted fields, doubled quotes, newlines inside quotes).
function* rows(file) {
  const text = fs.readFileSync(file, "utf8");
  let field = "", row = [], q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") yield row;
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); yield row; }
}
function table(name) {
  const it = rows(findFile(name));
  const head = it.next().value;
  const idx = Object.fromEntries(head.map((h, i) => [h, i]));
  return { idx, it };
}

const NUTRIENTS = { 1008: 0, 1003: 1, 1005: 2, 1004: 3, 1079: 4, 2000: 5, 1093: 6 }; // kcal, P, C, F, fiber, sugar, sodium
const SKIP_CATEGORIES = new Set(["Baby Foods"]);

const cats = new Map();
{ const { idx, it } = table("food_category.csv"); for (const r of it) cats.set(r[idx.id], r[idx.description]); }

const foods = new Map();
{
  const { idx, it } = table("food.csv");
  for (const r of it) {
    const cat = cats.get(r[idx.food_category_id]) || "Other";
    if (SKIP_CATEGORIES.has(cat)) continue;
    foods.set(r[idx.fdc_id], { id: +r[idx.fdc_id], name: r[idx.description], cat, n: [null, null, null, null, null, null, null], portions: [] });
  }
}
{
  const { idx, it } = table("food_nutrient.csv");
  for (const r of it) {
    const f = foods.get(r[idx.fdc_id]); if (!f) continue;
    const k = NUTRIENTS[r[idx.nutrient_id]]; if (k === undefined) continue;
    const v = parseFloat(r[idx.amount]); if (Number.isFinite(v)) f.n[k] = v;
  }
}
const units = new Map();
try { const { idx, it } = table("measure_unit.csv"); for (const r of it) units.set(r[idx.id], r[idx.name]); } catch { /* optional */ }
{
  const { idx, it } = table("food_portion.csv");
  for (const r of it) {
    const f = foods.get(r[idx.fdc_id]); if (!f) continue;
    const g = parseFloat(r[idx.gram_weight]); if (!(g > 0)) continue;
    const amount = parseFloat(r[idx.amount]) || 1;
    const unit = units.get(r[idx.measure_unit_id]);
    const mod = (r[idx.modifier] || "").trim();
    const desc = (r[idx.portion_description] || "").trim();
    let label = [amount, unit && unit !== "undetermined" ? unit : "", mod || (desc && desc !== "Quantity not specified" ? desc : "")].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (!label || /^[\d.]+$/.test(label)) continue;
    if (f.portions.some(p => p[0] === label)) continue;
    f.portions.push([label, Math.round(g * 10) / 10]);
  }
}

const catList = [...new Set([...foods.values()].map(f => f.cat))].sort();
const r1 = v => (v === null ? null : Math.round(v * 10) / 10);
const outFoods = [];
for (const f of foods.values()) {
  if (f.n[0] === null) continue; // no energy value
  const [kcal, p, c, fat, fib, sug, na] = f.n;
  outFoods.push([f.id, f.name, catList.indexOf(f.cat), Math.round(kcal), r1(p ?? 0), r1(c ?? 0), r1(fat ?? 0), r1(fib), r1(sug), na === null ? null : Math.round(na), f.portions.slice(0, 8)]);
}
outFoods.sort((a, b) => a[1].localeCompare(b[1]));
fs.writeFileSync(out, JSON.stringify({ v: 1, source: "USDA FoodData Central, SR Legacy (public domain)", cats: catList, foods: outFoods }));
console.log(`wrote ${outFoods.length} foods, ${catList.length} categories, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
