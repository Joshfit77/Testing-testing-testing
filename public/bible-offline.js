/*
 * Offline Bible reader (public/bible-offline.html). Reads the Berean Standard Bible saved on this device: in a browser,
 * from the cache the "Save for offline" button fills (the service worker answers /bible/bsb/* from it); in the native
 * app, from the copy bundled with the app. It shows Scripture only: it never reads cookies, account data, highlights,
 * notes or journeys. Text is inserted with textContent, never as HTML. The words of Jesus are shown in red from
 * /bible/bsb/wj.json when it is saved too (and was built for this exact text); without it the text is shown plain.
 */
(function () {
  "use strict";
  var app = document.getElementById("app");
  var FONT_KEY = "ngf.bible.fontScale";
  var meta = null;
  var books = {};
  var redLetter; // undefined: not loaded yet; null: not available
  var native = location.protocol === "capacitor:" || (location.hostname === "localhost" && !location.port && /\.html$/.test(location.pathname));

  function slug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }
  function label(book, chapter) {
    return (book.id === "PSA" ? "Psalm" : book.name) + " " + chapter;
  }
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs)
      for (var k in attrs) {
        if (attrs[k] == null) continue;
        if (k === "text") e.textContent = attrs[k];
        else e.setAttribute(k, attrs[k]);
      }
    (children || []).forEach(function (c) {
      if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }
  function getJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
  }
  /** Verse text split at the red-letter offsets; out-of-range or overlapping spans are ignored, never guessed at. */
  function verseParts(t, spans) {
    if (!spans) return [t];
    var out = [];
    var at = 0;
    spans.forEach(function (s) {
      if (s[0] < at || s[1] <= s[0] || s[1] > t.length) return;
      if (s[0] > at) out.push(t.slice(at, s[0]));
      out.push(el("span", { class: "wj", text: t.slice(s[0], s[1]) }));
      at = s[1];
    });
    if (at < t.length) out.push(t.slice(at));
    return out;
  }
  function scale() {
    try {
      var s = Number(localStorage.getItem(FONT_KEY));
      return s >= 0.8 && s <= 1.8 ? s : 1;
    } catch {
      return 1;
    }
  }

  /** #john/3, or the Bible page the member was opening (/faith/bible/john/3) when the connection failed. */
  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    if (h === "books" || !meta) return { view: "books" };
    var m = h.match(/^([a-z0-9-]+)(?:\/(\d+))?$/) || location.pathname.match(/^\/faith\/bible\/([a-z0-9-]+)(?:\/(\d+))?\/?$/);
    if (!m) return { view: "books" };
    var book = meta.books.filter(function (b) { return slug(b.name) === m[1]; })[0];
    if (!book) return { view: "books" };
    var c = m[2] ? Number(m[2]) : 0;
    if (c >= 1 && c <= book.chapters) return { view: "chapter", book: book, chapter: c };
    return { view: "book", book: book };
  }

  function header(title, eyebrow, back) {
    var retry = native ? el("a", { class: "btn", href: "/error.html", text: "Try again" }) : el("button", { class: "btn", type: "button", text: "Try again" });
    if (!native) retry.addEventListener("click", function () { location.reload(); });
    return [
      el("div", { class: "bar" }, [back ? el("a", { class: "btn", href: back.href, text: "← " + back.text }) : el("span"), retry]),
      el("p", { class: "eyebrow", text: eyebrow }),
      el("h1", { text: title }),
    ];
  }
  function notice() {
    return el("p", { class: "notice", text: "You're offline. This is the Bible saved on this device. Your highlights, notes and journey are kept with your account and will be there when you're back online." });
  }
  function foot() {
    return el("p", { class: "foot", text: (meta && meta.attribution) || "Scripture quotations are from the Berean Standard Bible (BSB), public domain." });
  }

  function render() {
    var r = route();
    app.textContent = "";
    window.scrollTo(0, 0);
    if (r.view === "books") {
      header("Bible", "Berean Standard Bible").forEach(function (n) { app.appendChild(n); });
      app.appendChild(notice());
      ["OT", "NT"].forEach(function (t, i) {
        app.appendChild(el("h2", { text: i ? "New Testament" : "Old Testament" }));
        var list = el("ul", { class: "grid" });
        meta.books.slice(i ? 39 : 0, i ? 66 : 39).forEach(function (b) {
          list.appendChild(el("li", null, [el("a", { href: "#" + slug(b.name) }, [b.name, el("small", { text: String(b.chapters) })])]));
        });
        app.appendChild(list);
      });
    } else if (r.view === "book") {
      header(r.book.name, "Berean Standard Bible", { href: "#books", text: "Books" }).forEach(function (n) { app.appendChild(n); });
      app.appendChild(notice());
      var grid = el("ol", { class: "grid ch" });
      for (var c = 1; c <= r.book.chapters; c++) grid.appendChild(el("li", null, [el("a", { href: "#" + slug(r.book.name) + "/" + c, text: String(c) })]));
      app.appendChild(grid);
    } else {
      header(label(r.book, r.chapter), "Berean Standard Bible", { href: "#" + slug(r.book.name), text: r.book.name }).forEach(function (n) { app.appendChild(n); });
      app.appendChild(notice());
      var text = el("div", { class: "text", style: "--scale:" + scale() }, [el("p", { class: "notice", text: "Loading…" })]);
      app.appendChild(text);
      Promise.all([loadBook(r.book.id), loadRedLetter()]).then(
        function (loaded) {
          var data = loaded[0];
          var wj = (loaded[1] && loaded[1][r.book.id] && loaded[1][r.book.id][r.chapter]) || {};
          text.textContent = "";
          var verses = data.chapters[r.chapter - 1] || [];
          var gaps = (r.book.withoutText || []).filter(function (s) { return s.indexOf(r.chapter + ":") === 0; }).map(function (s) { return Number(s.split(":")[1]); });
          var rows = verses.map(function (v) { return { v: v[0], t: v[1] }; }).concat(gaps.map(function (g) { return { v: g, gap: true }; }));
          rows.sort(function (a, b) { return a.v - b.v; });
          rows.forEach(function (row) {
            if (row.gap) text.appendChild(el("p", { class: "gap" }, [el("sup", { text: String(row.v) }), "Verse " + row.v + " is not in the Berean Standard Bible’s main text; the translation gives it in a footnote, which this app does not show."]));
            else text.appendChild(el("p", { id: "v" + row.v }, [el("sup", { text: String(row.v) })].concat(verseParts(row.t, wj[row.v]))));
          });
          var idx = meta.books.indexOf(r.book);
          var prev = r.chapter > 1 ? [r.book, r.chapter - 1] : idx > 0 ? [meta.books[idx - 1], meta.books[idx - 1].chapters] : null;
          var next = r.chapter < r.book.chapters ? [r.book, r.chapter + 1] : idx < 65 ? [meta.books[idx + 1], 1] : null;
          var nav = el("nav", { class: "pn", "aria-label": "Chapters" }, [
            prev ? el("a", { href: "#" + slug(prev[0].name) + "/" + prev[1] }, [el("span", { text: "Previous" }), label(prev[0], prev[1])]) : el("span"),
            next ? el("a", { class: "next", href: "#" + slug(next[0].name) + "/" + next[1] }, [el("span", { text: "Next" }), label(next[0], next[1])]) : el("span"),
          ]);
          app.appendChild(nav);
          app.appendChild(foot());
        },
        function () {
          text.textContent = "";
          text.appendChild(el("p", { class: "notice", text: "This book isn't saved on this device. Open Bible → Save for offline when you're back online." }));
        },
      );
      return;
    }
    app.appendChild(foot());
  }

  function loadBook(id) {
    if (books[id]) return Promise.resolve(books[id]);
    return getJSON("/bible/bsb/books/" + id + ".json").then(function (b) {
      books[id] = b;
      return b;
    });
  }

  /** The words-of-Jesus offsets, only if built for this exact Bible text. Never fails: without them, no red. */
  function loadRedLetter() {
    if (redLetter !== undefined) return Promise.resolve(redLetter);
    return getJSON("/bible/bsb/wj.json").then(
      function (d) {
        redLetter = d && d.books && meta && d.bibleContentSha256 && d.bibleContentSha256 === meta.contentSha256 ? d.books : null;
        return redLetter;
      },
      function () {
        redLetter = null;
        return null;
      },
    );
  }

  window.addEventListener("hashchange", render);
  getJSON("/bible/bsb/meta.json").then(
    function (m) {
      meta = m;
      render();
    },
    function () {
      app.textContent = "";
      header("Bible", "Berean Standard Bible").forEach(function (n) { app.appendChild(n); });
      app.appendChild(el("p", { class: "notice", text: "The Bible isn't saved on this device yet. When you're back online, open Faith → Bible and choose Save for offline." }));
    },
  );
})();
