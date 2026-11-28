#!/usr/bin/env node
/**
 * Builds the original-language layer for Biblical AI from STEPBible-Data (Tyndale House Cambridge / STEPBible.org,
 * CC BY 4.0, https://github.com/STEPBible/STEPBible-Data): the Hebrew/Aramaic OT (TAHOT, Leningrad Codex via
 * OpenScriptures/Westminster, ETCBC-based morphology), the Greek NT (TAGNT), the brief lexicons (TBESH: abridged BDB;
 * TBESG: Abbott-Smith and similar) and the morphology code expansions (TEHMC, TEGMC).
 *
 *   node scripts/build-original-languages.mjs <STEPBible-Data checkout> <out-dir>
 *
 * Nothing is typed by hand: every word, gloss, Strong's number, parsing and definition comes from those files. The
 * output is server-only (never served to browsers) and is a supplementary layer on the BSB: English Scripture always
 * comes from public/bible/bsb. Per book: <out>/books/<BOOK>.json.gz; lexicons and morphology tables alongside; meta.json
 * records the SHA-256 of every input file, the licence and the counts. tests/unit/original-languages.test.ts checks it.
 *
 * Text rules (recorded in meta.json):
 * - Greek: a word is in the main text when its type has an uppercase N (it is in NA27/28, SBL, WH or Tregelles, the
 *   critical-text family the BSB follows). Words found only in the TR/Byzantine or other editions are kept per verse
 *   as variants, with the editions that have them.
 * - Hebrew: Leningrad (L…) and Qere (Q…) words. LXX-derived additions (X) and other types are left out and counted.
 * - References are English versification (the BSB's); the Hebrew versification is kept where it differs.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error("usage: build-original-languages.mjs <STEPBible-Data checkout> <out-dir>");
  process.exit(1);
}

// STEPBible book abbreviations, in canonical order (the same 66-book order as src/data/bible/books.json).
const STEP = "Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro Ecc Sng Isa Jer Lam Ezk Dan Hos Jol Amo Oba Jon Mic Nam Hab Zep Hag Zec Mal Mat Mrk Luk Jhn Act Rom 1Co 2Co Gal Eph Php Col 1Th 2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jn 2Jn 3Jn Jud Rev".split(" ");
const books = JSON.parse(readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "..", "src", "data", "bible", "books.json"), "utf8"));
const bookList = Array.isArray(books) ? books : books.books;
if (bookList.length !== 66) throw new Error(`books.json: expected 66 books, got ${bookList.length}`);
const ID = new Map(STEP.map((s, i) => [s, bookList[i].id]));

const inputs = [];
function read(rel) {
  const file = path.join(src, rel);
  const buf = readFileSync(file);
  inputs.push({ file: rel, sha256: createHash("sha256").update(buf).digest("hex"), bytes: buf.length });
  return buf.toString("utf8").normalize("NFC");
}
function list(dir, prefix) {
  return readdirSync(path.join(src, dir)).filter((f) => f.startsWith(prefix) && f.endsWith(".txt")).sort().map((f) => path.join(dir, f));
}

// Book.Chapter.Verse, then optionally (Hebrew versification), [another English split] or {alternative placement}.
const REF = /^([1-3]?[A-Z][a-z]{1,2})\.(\d+)\.(\d+)(?:([(\[{])([^)\]}]*)[)\]}])?#(\d+)=(\S+)$/;
/** book → chapter → verse → { w: words[], v?: variants[], heb?: "ch.v", d?: note } (alt: words outside the main text, kept for verses that have none in it) */
const text = new Map();
/** Greek words whose verse is split differently in KJV-style versification: [ch, v, "ch.v", word, mainText]. */
const splits = {};
const counts = { greekWords: 0, hebrewWords: 0, aramaicWords: 0, greekVariants: 0, hebrewLeftOut: {}, verses: 0 };
function verseOf(book, ch, v) {
  let b = text.get(book);
  if (!b) text.set(book, (b = {}));
  b[ch] ??= {};
  b[ch][v] ??= { w: [] };
  return b[ch][v];
}

// Greek NT. Columns: Word & Type | Greek (translit) | English | dStrongs=Grammar | Dictionary form=Gloss | editions | ...
for (const rel of list("Translators Amalgamated OT+NT", "TAGNT")) {
  for (const line of read(rel).split(/\r?\n/)) {
    const cols = line.split("\t");
    const m = cols[0]?.match(REF);
    if (!m) continue;
    const [, step, ch, v, bracket, other, , type] = m;
    const book = ID.get(step);
    if (!book) throw new Error(`Unknown book ${step} in ${rel}`);
    const gm = cols[1].trim().match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    const surface = (gm ? gm[1] : cols[1]).trim();
    const translit = gm ? gm[2].trim() : "";
    const [strong, morph = ""] = cols[3].trim().split("=");
    const lemma = (cols[4] ?? "").split("=")[0].trim();
    const word = [surface, translit, cols[2].trim(), strong.trim(), morph.trim(), lemma];
    const verse = verseOf(book, Number(ch), Number(v));
    if (bracket === "[" && other) (splits[book] ??= []).push([Number(ch), Number(v), other, word, /N/.test(type)]);
    if (/N/.test(type)) {
      verse.w.push(word);
      counts.greekWords++;
    } else {
      (verse.v ??= []).push([surface, (cols[5] ?? "").trim()]);
      (verse.alt ??= []).push(word);
      counts.greekVariants++;
    }
  }
}

// Hebrew/Aramaic OT. Columns: Eng (Heb) Ref & Type | Hebrew | Transliteration | Translation | dStrongs | Grammar | ...
for (const rel of list("Translators Amalgamated OT+NT", "TAHOT")) {
  for (const line of read(rel).split(/\r?\n/)) {
    const cols = line.split("\t");
    const m = cols[0]?.match(REF);
    if (!m) continue;
    const [, step, ch, v, bracket, other, , type] = m;
    const heb = bracket === "(" ? other : undefined;
    const book = ID.get(step);
    if (!book) throw new Error(`Unknown book ${step} in ${rel}`);
    if (!/^[LQ]/.test(type)) {
      counts.hebrewLeftOut[type] = (counts.hebrewLeftOut[type] ?? 0) + 1;
      const strongs = cols[4].trim();
      (verseOf(book, Number(ch), Number(v)).alt ??= []).push([cols[1].trim(), cols[2].trim(), cols[3].trim(), strongs, cols[5].trim(), strongs.match(/\{([^}]+)\}/)?.[1] ?? strongs.split("/")[0]]);
      continue;
    }
    const strongs = cols[4].trim();
    // The word's main lexical entry is the one in braces (prefixes and suffixes are the others).
    const main = strongs.match(/\{([^}]+)\}/)?.[1] ?? strongs.split("/")[0];
    const morph = cols[5].trim();
    const word = [cols[1].trim(), cols[2].trim(), cols[3].trim(), strongs, morph, main];
    const verse = verseOf(book, Number(ch), Number(v));
    if (heb && heb !== `${ch}.${v}`) verse.heb = heb.replace(/^[1-3]?[A-Za-z]{2,3}\./, "");
    verse.w.push(word);
    if (morph.startsWith("A")) counts.aramaicWords++;
    else counts.hebrewWords++;
  }
}

// The BSB's own verses decide, until nothing changes:
// - a verse with text in the BSB but no words here takes the words that the other versification ([…]) assigns to it
//   (2 Corinthians 13:13–14);
// - a verse number the BSB doesn't have (with text) gives its words to the BSB verse before it, which holds them
//   (Revelation 12:18 is the end of the BSB's 12:17; 3 John 15 the end of its verse 14);
// - a verse with no main-text words takes the words outside the main text, marked as disputed (Mark 16:9–20,
//   John 7:53–8:11, Joshua 21:36–37).
const BSB = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "public", "bible", "bsb", "books");
counts.movedBySplit = 0;
counts.mergedIntoPrevious = [];
counts.disputedVerses = [];
for (const b of bookList) {
  const chapters = text.get(b.id);
  if (!chapters) continue;
  const bsb = JSON.parse(readFileSync(path.join(BSB, `${b.id}.json`), "utf8"));
  const hasText = (ch, vn) => Boolean(bsb.chapters[ch - 1]?.find(([n]) => n === vn)?.[1]);
  for (let changed = true; changed; ) {
    changed = false;
    bsb.chapters.forEach((verses, ci) => {
      const ch = ci + 1;
      for (const [vn, t] of verses) {
        if (!t) continue;
        const verse = verseOf(b.id, ch, vn);
        if (verse.w.length) continue;
        const moved = (splits[b.id] ?? []).filter(([c0, v0, other, word, main]) => main && other === `${ch}.${vn}` && chapters[c0][v0].w.includes(word));
        for (const [c0, v0, , word] of moved) {
          chapters[c0][v0].w = chapters[c0][v0].w.filter((w) => w !== word);
          verse.w.push(word);
          counts.movedBySplit++;
          changed = true;
        }
      }
    });
    for (const [chKey, verses] of Object.entries(chapters)) {
      const ch = Number(chKey);
      for (const [vKey, verse] of Object.entries(verses)) {
        const vn = Number(vKey);
        if (vn === 0 || !verse.w.length || hasText(ch, vn)) continue;
        const prev = Object.keys(verses).map(Number).filter((n) => n < vn && n > 0 && hasText(ch, n)).sort((x, y) => y - x)[0];
        if (prev === undefined) throw new Error(`${b.id} ${ch}:${vn} has words but no BSB verse to hold them`);
        verses[prev].w.push(...verse.w);
        verse.w = [];
        counts.mergedIntoPrevious.push(`${b.id} ${ch}:${vn} → ${ch}:${prev}`);
        changed = true;
      }
    }
  }
  bsb.chapters.forEach((verses, ci) => {
    const ch = ci + 1;
    for (const [vn, t] of verses) {
      const verse = verseOf(b.id, ch, vn);
      if (!t || verse.w.length || !verse.alt?.length) continue;
      verse.w = verse.alt;
      verse.d = bookList.indexOf(b) >= 39 ? "Not in the main critical text (NA/SBL bracket or omit it); shown from the editions that include it." : "Not in the Leningrad Codex; shown from other Hebrew manuscripts.";
      delete verse.v;
      counts.disputedVerses.push(`${b.id} ${ch}:${vn}`);
    }
  });
  for (const ch of Object.values(chapters))
    for (const [vKey, verse] of Object.entries(ch)) {
      delete verse.alt;
      if (!verse.w.length && !verse.v) delete ch[vKey];
    }
}

// Lexicons: eStrong | dStrong = | uStrong | lemma | transliteration | morph | gloss | definition (HTML)
function plain(html) {
  return html
    .replace(/<ref='[^']*'>([^<]*)<\/ref>/g, "$1")
    .replace(/<BR\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/_{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
const DEF_MAX = 1200;
function lexicon(rel, lang) {
  const out = {};
  for (const line of read(rel).split(/\r?\n/)) {
    const cols = line.split("\t");
    if (!/^[GH]\d{4}[A-Za-z]?$/.test(cols[0] ?? "")) continue;
    // The disambiguated key (column 2, "H0430G = a Name of", "H5921A =") is the one the text uses; the plain
    // number (column 1) is kept too, for its first entry, so a plain Strong's number can still be looked up.
    const key = (cols[1] ?? "").split("=")[0].trim();
    const def = plain(cols[7] ?? "");
    const entry = [cols[3]?.trim() ?? "", cols[4]?.trim() ?? "", cols[6]?.trim() ?? "", def.length > DEF_MAX ? `${def.slice(0, DEF_MAX).replace(/\s+\S*$/, "")} …` : def, cols[5]?.trim() ?? ""];
    if (/^[GH]\d{4}[A-Za-z]?$/.test(key)) out[key] ??= entry;
    out[cols[0].replace(/[a-z]$/, "")] ??= entry;
  }
  if (Object.keys(out).length < 5000) throw new Error(`${lang} lexicon: only ${Object.keys(out).length} entries`);
  return out;
}
const lexGreek = lexicon(list("Lexicons", "TBESG")[0], "Greek");
const lexHebrew = lexicon(list("Lexicons", "TBESH")[0], "Hebrew");

// Morphology code expansions, only for codes the text uses.
function morphTable(rel) {
  const out = {};
  for (const line of read(rel).split(/\r?\n/)) {
    const [code, desc] = line.split("\t");
    if (code && desc && /^[A-Z][A-Za-z0-9-]*$/.test(code.trim()) && /Function=/.test(desc)) out[code.trim()] ??= desc.trim().replace(/\s+;/g, ";").replace(/\s+/g, " ");
  }
  return out;
}
const greekCodes = morphTable(list("Morphology codes", "TEGMC")[0]);
const hebrewCodes = morphTable(list("Morphology codes", "TEHMC")[0]);
const usedGreek = {};
const usedHebrew = {};
for (const [book, chapters] of text) {
  const nt = bookList.findIndex((b) => b.id === book) >= 39;
  for (const ch of Object.values(chapters))
    for (const verse of Object.values(ch))
      for (const w of verse.w) {
        if (nt) {
          if (greekCodes[w[4]]) usedGreek[w[4]] = greekCodes[w[4]];
        } else {
          const lang = w[4][0];
          for (const seg of w[4].slice(1).split("/")) {
            const code = `${lang}${seg}`;
            if (hebrewCodes[code]) usedHebrew[code] = hebrewCodes[code];
          }
        }
      }
}

mkdirSync(path.join(out, "books"), { recursive: true });
const bookStats = [];
for (const b of bookList) {
  const chapters = text.get(b.id);
  if (!chapters) throw new Error(`No original-language text for ${b.id}`);
  let verses = 0;
  let words = 0;
  for (const ch of Object.values(chapters))
    for (const verse of Object.values(ch)) {
      verses++;
      words += verse.w.length;
    }
  counts.verses += verses;
  const lang = bookList.indexOf(b) >= 39 ? "greek" : "hebrew";
  writeFileSync(path.join(out, "books", `${b.id}.json.gz`), gzipSync(JSON.stringify({ id: b.id, lang, chapters }), { level: 9 }));
  bookStats.push({ id: b.id, lang, chapters: Object.keys(chapters).length, verses, words });
}
// Concordance: for each lexical entry (the main one of each word), how often it occurs and its first 40 verses.
const concordance = {};
for (const b of bookList) {
  const chapters = text.get(b.id);
  const nt = bookList.indexOf(b) >= 39;
  for (const [ch, verses] of Object.entries(chapters))
    for (const [v, verse] of Object.entries(verses)) {
      if (v === "0") continue;
      const seen = new Set();
      for (const w of verse.w) {
        const key = nt ? w[3] : w[5];
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const c = (concordance[key] ??= [0, []]);
        c[0]++;
        if (c[1].length < 40) c[1].push(`${b.id} ${ch}:${v}`);
      }
    }
}
const gz = (name, value) => writeFileSync(path.join(out, name), gzipSync(JSON.stringify(value), { level: 9 }));
gz("lexicon-greek.json.gz", lexGreek);
gz("lexicon-hebrew.json.gz", lexHebrew);
gz("morphology.json.gz", { greek: usedGreek, hebrew: usedHebrew });
gz("concordance.json.gz", concordance);

writeFileSync(
  path.join(out, "meta.json"),
  `${JSON.stringify(
    {
      name: "Original-language layer (Hebrew, Aramaic, Greek)",
      source: "STEPBible-Data, https://github.com/STEPBible/STEPBible-Data",
      licence: "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)",
      attribution: "Original-language data: STEP Bible (www.STEPBible.org), based on work by Tyndale House, Cambridge. CC BY 4.0.",
      changes: "Converted to per-book JSON; main-text selection, HTML stripped from lexicon entries and definitions shortened to 1,200 characters. No words, glosses or definitions were altered.",
      rules: {
        greekMainText: "word type contains uppercase N (NA27/28, SBL, WH or Tregelles)",
        hebrewMainText: "word type starts with L (Leningrad) or Q (Qere)",
        versification: "English (BSB); Hebrew versification kept in `heb` where it differs",
      },
      builtAt: new Date().toISOString(),
      inputs,
      counts,
      lexiconEntries: { greek: Object.keys(lexGreek).length, hebrew: Object.keys(lexHebrew).length },
      morphologyCodes: { greek: Object.keys(usedGreek).length, hebrew: Object.keys(usedHebrew).length },
      books: bookStats,
    },
    null,
    1,
  )}\n`,
);
console.log(JSON.stringify({ counts, lexicon: { greek: Object.keys(lexGreek).length, hebrew: Object.keys(lexHebrew).length } }));
