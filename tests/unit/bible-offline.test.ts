import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { BIBLE_BOOKS } from "@/lib/bible/books";
import { selectionReference, shareableText, verseRange, verseRuns } from "@/lib/bible/format";

const root = join(import.meta.dirname, "../..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("copy, share and references for selected verses", () => {
  it("groups verses into runs and cites them the usual way", () => {
    expect(verseRuns([18, 16, 17, 20, 16])).toEqual([
      [16, 18],
      [20, 20],
    ]);
    expect(verseRange(3, 5)).toEqual([3, 4, 5]);
    expect(selectionReference("JHN", 3, [16, 17, 18, 20])).toBe("John 3:16–18, 20");
    expect(selectionReference("PSA", 23, [1])).toBe("Psalm 23:1");
    expect(selectionReference("JUD", 1, [3])).toBe("Jude 3"); // one-chapter books are cited by verse
    expect(selectionReference("ROM", 8, [])).toBe("Romans 8");
  });

  it("shares the verses' exact words in order, then the reference and translation", () => {
    expect(shareableText("JHN", 11, [[35, "Jesus wept."]])).toBe("Jesus wept.\n— John 11:35 (BSB)");
    expect(
      shareableText("PSA", 23, [
        [2, "He makes me lie down in green pastures; He leads me beside quiet waters."],
        [1, "The LORD is my shepherd; I shall not want."],
      ]),
    ).toBe("The LORD is my shepherd; I shall not want. He makes me lie down in green pastures; He leads me beside quiet waters.\n— Psalm 23:1–2 (BSB)");
  });
});

// ------------------------------------------------------------------------------------------------- service worker

type Handler = (e: unknown) => void;
interface FakeCache {
  store: Map<string, Response>;
  match(req: Request | string, opts?: unknown): Promise<Response | undefined>;
  addAll(urls: string[]): Promise<void>;
  put(req: Request | string, res: Response): Promise<void>;
}

/** Load public/sw.js against stand-in service-worker globals and return a way to send it events. */
function loadServiceWorker() {
  const handlers: Record<string, Handler> = {};
  const caches = new Map<string, FakeCache>();
  const key = (r: Request | string) => new URL(typeof r === "string" ? r : r.url, "https://app.test").pathname;
  const open = async (name: string) => {
    let c = caches.get(name);
    if (!c) {
      const store = new Map<string, Response>();
      c = {
        store,
        match: async (r) => store.get(key(r))?.clone(),
        addAll: async (urls) => urls.forEach((u) => store.set(key(u), new Response(`cached ${u}`))),
        put: async (r, res) => void store.set(key(r), res),
      };
      caches.set(name, c);
    }
    return c;
  };
  const cachesApi = {
    open,
    keys: async () => [...caches.keys()],
    delete: async (name: string) => caches.delete(name),
    match: async (r: Request | string) => {
      for (const c of caches.values()) {
        const hit = await c.match(r);
        if (hit) return hit;
      }
      return undefined;
    },
  };
  const network = { online: true, calls: [] as string[] };
  const fetchFn = vi.fn(async (r: Request | string) => {
    network.calls.push(key(r));
    if (!network.online) throw new TypeError("Failed to fetch");
    return new Response(`network ${key(r)}`);
  });
  const self = { addEventListener: (t: string, h: Handler) => (handlers[t] = h), location: { origin: "https://app.test" }, skipWaiting: () => Promise.resolve(), clients: { claim: () => Promise.resolve() } };
  new Function("self", "caches", "fetch", read("public/sw.js"))(self, cachesApi, fetchFn);

  async function lifecycle(type: "install" | "activate") {
    let p: Promise<unknown> = Promise.resolve();
    handlers[type]!({ waitUntil: (x: Promise<unknown>) => (p = x) });
    await p;
  }
  async function request(path: string, mode: RequestMode | "navigate" = "cors"): Promise<Response | null> {
    let responded: Promise<Response> | null = null;
    const request = { url: `https://app.test${path}`, method: "GET", mode };
    handlers.fetch!({ request, respondWith: (r: Promise<Response>) => (responded = r) });
    return responded ? await responded : null;
  }
  return { lifecycle, request, caches, open, network };
}

describe("service worker: the offline Bible", () => {
  it("keeps the saved Bible across service-worker updates, and still clears old app caches", async () => {
    const sw = loadServiceWorker();
    await sw.open("ngf-v0-static");
    await sw.open("ngf-bible-v1");
    await sw.lifecycle("activate");
    expect([...sw.caches.keys()]).toEqual(["ngf-bible-v1"]);
  });

  it("offline, a Bible page opens the saved offline reader; other pages show the offline notice", async () => {
    const sw = loadServiceWorker();
    await sw.lifecycle("install");
    sw.network.online = false;
    // Not saved yet: the usual offline page.
    expect(await (await sw.request("/faith/bible/john/3", "navigate"))!.text()).toBe("cached /offline.html");
    const bible = await sw.open("ngf-bible-v1");
    await bible.put("/bible-offline.html", new Response("offline reader"));
    expect(await (await sw.request("/faith/bible/john/3", "navigate"))!.text()).toBe("offline reader");
    expect(await (await sw.request("/faith/bible", "navigate"))!.text()).toBe("offline reader");
    expect(await (await sw.request("/faith/journal", "navigate"))!.text()).toBe("cached /offline.html");
    expect(await (await sw.request("/home", "navigate"))!.text()).toBe("cached /offline.html");
  });

  it("online, pages always come from the network and are never stored", async () => {
    const sw = loadServiceWorker();
    await sw.lifecycle("install");
    expect(await (await sw.request("/faith/bible/john/3", "navigate"))!.text()).toBe("network /faith/bible/john/3");
    for (const c of sw.caches.values()) expect([...c.store.keys()].some((k) => k.startsWith("/faith"))).toBe(false);
  });

  it("serves the saved Bible text from the device, and from the network when it isn't saved", async () => {
    const sw = loadServiceWorker();
    expect(await (await sw.request("/bible/bsb/books/JHN.json"))!.text()).toBe("network /bible/bsb/books/JHN.json");
    const bible = await sw.open("ngf-bible-v1");
    await bible.put("/bible/bsb/books/JHN.json", new Response("saved John"));
    sw.network.online = false;
    expect(await (await sw.request("/bible/bsb/books/JHN.json"))!.text()).toBe("saved John");
  });
});

// ------------------------------------------------------------------------------------------------- offline reader

describe("offline reader page", () => {
  it("links books the same way the app does (its slug rule gives books.json's slugs for all 66)", () => {
    const js = read("public/bible-offline.js");
    expect(js).toContain('name.toLowerCase().replace(/[^a-z0-9]+/g, "-")');
    for (const b of BIBLE_BOOKS) expect(b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).toBe(b.slug);
  });

  it("loads only its own script and has a fixed policy that allows nothing else", async () => {
    const html = read("public/bible-offline.html");
    expect(html).not.toMatch(/<script>(?!\s*<\/script>)/); // no inline script
    expect(html).toContain('<script src="/bible-offline.js"></script>');
    const { OFFLINE_BIBLE_CSP } = await import("@/lib/security-headers");
    expect(OFFLINE_BIBLE_CSP).toContain("script-src 'self'");
    expect(OFFLINE_BIBLE_CSP).toContain("connect-src 'self'");
    expect(OFFLINE_BIBLE_CSP).not.toContain("unsafe-eval");
    expect(read("next.config.ts")).toMatch(/source: "\/bible-offline\.html", headers: \[\{ key: "Content-Security-Policy", value: OFFLINE_BIBLE_CSP \}\]/);
  });

  it("renders the chapter the member was opening, as text (never as HTML)", async () => {
    const meta = { attribution: "Scripture quotations are from the Berean Standard Bible (BSB), public domain.", books: BIBLE_BOOKS.map((b) => ({ id: b.id, name: b.name, chapters: b.chapters, withoutText: b.id === "JHN" ? ["5:4"] : [] })) };
    const chapters = Array.from({ length: 21 }, (_, i) => [[1, `Chapter ${i + 1} verse one.`]]);
    chapters[2] = [
      [16, "For God so loved the world."],
      [17, '<img src=x onerror="window.__pwned=1">'],
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string) => new Response(JSON.stringify(u.endsWith("meta.json") ? meta : { id: "JHN", name: "John", chapters }))),
    );
    document.body.innerHTML = '<main id="app"></main>';
    window.history.replaceState(null, "", "/faith/bible/john/3");
    new Function(read("public/bible-offline.js"))();
    await vi.waitFor(() => expect(document.querySelector("#v16")?.textContent).toContain("For God so loved the world."));
    expect(document.querySelector("h1")?.textContent).toBe("John 3");
    expect(document.querySelector("#v17")?.textContent).toContain("<img src=x");
    expect(document.querySelector("img")).toBeNull();
    expect(document.body.textContent).toContain("You're offline");
    expect(document.body.textContent).toContain("Berean Standard Bible (BSB), public domain");
    // Next goes to John 4 inside the page.
    const next = [...document.querySelectorAll("nav.pn a")].find((a) => a.textContent?.includes("John 4")) as HTMLAnchorElement;
    expect(next.getAttribute("href")).toBe("#john/4");
    vi.unstubAllGlobals();
  });

  it("shows the words of Jesus in red when the red-letter file matches the saved text, and plain when it doesn't", async () => {
    const meta = { contentSha256: "abc", books: BIBLE_BOOKS.map((b) => ({ id: b.id, name: b.name, chapters: b.chapters, withoutText: [] })) };
    const chapters = Array.from({ length: 21 }, (_, i) => [[1, `Chapter ${i + 1} verse one.`]]);
    chapters[10] = [
      [25, "Jesus said to her, “I am the resurrection and the life.”"],
      [35, "Jesus wept."],
    ];
    const open = async (wjChecksum: string) => {
      const wj = { bibleContentSha256: wjChecksum, books: { JHN: { 11: { 25: [[19, 56]] } } } };
      vi.stubGlobal(
        "fetch",
        vi.fn(async (u: string) => new Response(JSON.stringify(u.endsWith("meta.json") ? meta : u.endsWith("wj.json") ? wj : { id: "JHN", name: "John", chapters }))),
      );
      document.body.innerHTML = '<main id="app"></main>';
      window.history.replaceState(null, "", "/faith/bible/john/11");
      new Function(read("public/bible-offline.js"))();
      await vi.waitFor(() => expect(document.querySelector("#v25")?.textContent).toContain("resurrection"));
    };
    await open("abc");
    expect([...document.querySelectorAll("#v25 .wj")].map((e) => e.textContent)).toEqual(["“I am the resurrection and the life.”"]);
    expect(document.querySelector("#v25")?.textContent).toBe("25Jesus said to her, “I am the resurrection and the life.”");
    expect(document.querySelector("#v35 .wj")).toBeNull();
    // Built for different text: offsets could colour the wrong words, so nothing is red.
    await open("something-else");
    expect(document.querySelector(".wj")).toBeNull();
    expect(document.querySelector("#v25")?.textContent).toBe("25Jesus said to her, “I am the resurrection and the life.”");
    vi.unstubAllGlobals();
  });
});

describe("native app", () => {
  it("bundles the offline Bible at sync and offers it from the offline page", () => {
    const cfg = read("capacitor.config.ts");
    expect(cfg).toContain('cpSync(join(process.cwd(), "public", "bible", "bsb"), join(process.cwd(), "native-shell", "bible", "bsb"), { recursive: true })');
    expect(cfg).toContain('["bible-offline.html", "bible-offline.js"]');
    expect(read("native-shell/error.html")).toContain('<a href="bible-offline.html"');
    expect(read(".gitignore")).toContain("native-shell/bible/");
  });
});
