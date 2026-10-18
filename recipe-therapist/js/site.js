(function () {
  const S = window.SITE;
  const page = document.body.dataset.page;

  // ---------- Request list (the "no checkout" basket) ----------
  const KEY = "rt-request";
  const memory = { list: [] };
  function loadList() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return memory.list; }
  }
  function saveList(list) {
    memory.list = list;
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* private mode: keep in memory */ }
    updateCount();
  }
  function addToList(id, size) {
    const list = loadList();
    const hit = list.find((r) => r.id === id && r.size === size);
    if (hit) hit.qty += 1; else list.push({ id, size, qty: 1 });
    saveList(list);
  }
  function findItem(id) { return window.MENU.find((m) => m.id === id); }

  // ---------- Header & footer ----------
  const links = [
    ["index.html", "Home", "home"],
    ["menu.html", "Menu", "menu"],
    ["meal-plans.html", "Meal Plans", "plans"],
    ["index.html#about", "About", "about"],
  ];
  const header = document.querySelector("[data-site-header]");
  if (header) {
    header.className = "site-header";
    header.innerHTML = `
      <div class="wrap">
        <a class="brand" href="index.html">The Recipe <span>Therapist</span></a>
        <button class="menu-toggle" aria-label="Open menu" aria-expanded="false">&#9776;</button>
        <nav class="nav" aria-label="Main">
          ${links.map(([href, label, key]) => `<a href="${href}"${key === page ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
          <a class="btn small" href="order.html"${page === "order" ? ' aria-current="page"' : ""}>Order request <span class="request-count" hidden></span></a>
        </nav>
      </div>`;
    const toggle = header.querySelector(".menu-toggle");
    const nav = header.querySelector(".nav");
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) nav.classList.remove("open"); });
  }

  const footer = document.querySelector("[data-site-footer]");
  if (footer) {
    footer.className = "site-footer";
    const social = [
      S.youtube && `<a href="${S.youtube}" target="_blank" rel="noopener">YouTube</a>`,
      S.instagram && `<a href="${S.instagram}" target="_blank" rel="noopener">Instagram</a>`,
    ].filter(Boolean).join("");
    footer.innerHTML = `
      <div class="wrap">
        <div>
          <div class="brand">The Recipe <span>Therapist</span></div>
          <div>${S.owner} &middot; ${S.area}</div>
          <div><a href="mailto:${S.email}">${S.email}</a>${S.phone ? ` &middot; <a href="tel:${S.phone.replace(/[^\d+]/g, "")}">${S.phone}</a>` : ""}</div>
        </div>
        <div class="links">
          <a href="menu.html">Menu</a><a href="meal-plans.html">Meal Plans</a><a href="order.html">Order request</a>${social}
        </div>
      </div>
      <div class="wrap" style="margin-top:16px">&copy; ${new Date().getFullYear()} ${S.businessName}. Made fresh to order.</div>`;
  }

  function updateCount() {
    const n = loadList().reduce((a, r) => a + r.qty, 0);
    document.querySelectorAll(".request-count").forEach((el) => {
      el.textContent = n;
      el.hidden = n === 0;
    });
  }
  updateCount();

  // ---------- Toast ----------
  let toastTimer;
  function toast(html) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.innerHTML = html;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Menu page ----------
  function itemCard(m) {
    const tags = (m.tags || []).map((t) => `<span class="tag${t === "Top seller" ? " top" : ""}">${esc(t)}</span>`).join("");
    const photo = m.photo ? `<img src="${esc(m.photo)}" alt="${esc(m.name)}" loading="lazy">` : esc(m.name.charAt(0));
    const sizes = m.sizes && m.sizes.length
      ? `<select aria-label="Size for ${esc(m.name)}">${m.sizes.map((s) => `<option>${esc(s)}</option>`).join("")}</select>`
      : "";
    const price = m.price ? `<span class="price">${esc(m.price)}</span>` : `<span class="price ask">Ask for pricing</span>`;
    return `
      <article class="item" data-id="${esc(m.id)}">
        <div class="item-photo">${photo}</div>
        <div class="item-body">
          ${tags ? `<div class="tags">${tags}</div>` : ""}
          <h3>${esc(m.name)}</h3>
          <p>${esc(m.description || "")}</p>
          <div class="item-foot">${price}${sizes}</div>
          <div class="item-foot"><button class="btn small add" type="button">Add to request</button></div>
        </div>
      </article>`;
  }

  if (page === "menu") {
    const groups = document.getElementById("menu-groups");
    const filters = document.getElementById("filters");
    const search = document.getElementById("search");
    const cats = window.MENU_CATEGORIES;
    let active = new URLSearchParams(location.search).get("c") || "all";
    if (active !== "all" && !cats[active]) active = "all";

    filters.insertAdjacentHTML("afterbegin",
      [["all", "All"], ...Object.entries(cats)].map(([k, v]) => `<button class="chip" type="button" data-cat="${k}" aria-pressed="${k === active}">${v}</button>`).join(""));

    function render() {
      const q = search.value.trim().toLowerCase();
      const html = Object.entries(cats)
        .filter(([k]) => active === "all" || active === k)
        .map(([k, label]) => {
          const items = window.MENU.filter((m) => m.category === k && (!q || (m.name + " " + (m.description || "") + " " + (m.tags || []).join(" ")).toLowerCase().includes(q)));
          if (!items.length) return "";
          return `<section class="menu-group"><h2>${label}</h2><div class="menu-grid">${items.map(itemCard).join("")}</div></section>`;
        }).join("");
      groups.innerHTML = html || `<p class="empty">Nothing matches that search. Try another word, or <a href="order.html">ask Celene</a> — she takes special requests.</p>`;
    }
    render();

    filters.addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      active = b.dataset.cat;
      filters.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      render();
    });
    search.addEventListener("input", render);

    groups.addEventListener("click", (e) => {
      const b = e.target.closest(".add");
      if (!b) return;
      const card = b.closest(".item");
      const sel = card.querySelector("select");
      const m = findItem(card.dataset.id);
      addToList(m.id, sel ? sel.value : "");
      b.textContent = "Added ✓";
      b.classList.add("added");
      setTimeout(() => { b.textContent = "Add to request"; b.classList.remove("added"); }, 1400);
      toast(`${esc(m.name)} added. <a href="order.html">Finish your request →</a>`);
    });
  }

  // ---------- Order page ----------
  if (page === "order") {
    const form = document.getElementById("order-form");
    const listEl = document.getElementById("req-list");
    const emptyEl = document.getElementById("req-empty");
    const status = document.getElementById("form-status");

    // Earliest date = today + notice days
    const date = form.elements.date;
    const min = new Date();
    min.setDate(min.getDate() + S.noticeDays);
    date.min = min.toISOString().slice(0, 10);
    document.querySelectorAll("[data-notice]").forEach((el) => (el.textContent = S.noticeDays));

    // Preselect request type from ?type=
    const t = new URLSearchParams(location.search).get("type");
    if (t) {
      const radio = form.querySelector(`input[name="type"][value="${CSS.escape(t)}"]`);
      if (radio) radio.checked = true;
    }

    function syncType() {
      const type = form.elements.type.value;
      form.querySelectorAll("[data-show-for]").forEach((el) => {
        el.classList.toggle("hidden", !el.dataset.showFor.split(" ").includes(type));
      });
    }
    form.addEventListener("change", (e) => { if (e.target.name === "type") syncType(); });
    syncType();

    function renderList() {
      const list = loadList().filter((r) => findItem(r.id));
      emptyEl.classList.toggle("hidden", list.length > 0);
      listEl.innerHTML = list.map((r, i) => {
        const m = findItem(r.id);
        return `<li>
          <span class="name">${esc(m.name)}${r.size ? `<span class="size">${esc(r.size)}</span>` : ""}</span>
          <input type="number" min="1" max="99" value="${r.qty}" data-i="${i}" aria-label="Quantity of ${esc(m.name)}">
          <button type="button" class="remove" data-i="${i}" aria-label="Remove ${esc(m.name)}">&times;</button>
        </li>`;
      }).join("");
    }
    renderList();

    listEl.addEventListener("input", (e) => {
      if (!e.target.matches("input")) return;
      const list = loadList();
      const n = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1));
      list[e.target.dataset.i].qty = n;
      saveList(list);
    });
    listEl.addEventListener("click", (e) => {
      const b = e.target.closest(".remove");
      if (!b) return;
      const list = loadList();
      list.splice(Number(b.dataset.i), 1);
      saveList(list);
      renderList();
    });

    function summary() {
      const f = form.elements;
      const items = loadList().filter((r) => findItem(r.id)).map((r) => `- ${r.qty} × ${findItem(r.id).name}${r.size ? ` (${r.size})` : ""}`);
      const diets = [...form.querySelectorAll('input[name="diet"]:checked')].map((d) => d.value);
      const lines = [
        `Request type: ${f.type.value}`,
        `Name: ${f.name.value}`,
        `Email: ${f.email.value}`,
        `Phone: ${f.phone.value || "-"}`,
        `Date needed: ${f.date.value}`,
        `Pickup or delivery: ${f.fulfil.value}`,
        f.fulfil.value === "Delivery" ? `Delivery town: ${f.town.value || "-"}` : null,
        `Guests / servings: ${f.guests.value || "-"}`,
        f.type.value === "Meal plan" ? `Household size: ${f.household.value || "-"}` : null,
        f.type.value === "Meal plan" ? `Meals per week: ${f.meals.value || "-"}` : null,
        diets.length ? `Dietary needs: ${diets.join(", ")}` : null,
        "",
        "Items:",
        items.length ? items.join("\n") : "- (none selected)",
        "",
        `Notes: ${f.notes.value || "-"}`,
      ];
      return lines.filter((l) => l !== null).join("\n");
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const body = summary();
      const subject = `${form.elements.type.value} request from ${form.elements.name.value} for ${form.elements.date.value}`;
      status.className = "form-status";

      if (S.formEndpoint) {
        status.textContent = "Sending…";
        try {
          const res = await fetch(S.formEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ _subject: subject, email: form.elements.email.value, message: body }),
          });
          if (!res.ok) throw new Error(res.status);
          status.textContent = `Thank you! Celene will reply within a day or two to confirm details and pricing.`;
          status.classList.add("ok");
          saveList([]);
          renderList();
          form.reset();
          syncType();
        } catch {
          status.textContent = `Sorry, that didn't go through. Please email ${S.email} directly.`;
          status.classList.add("err");
        }
      } else {
        location.href = `mailto:${S.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        status.textContent = "Your email app should open with your request filled in — just press Send.";
        status.classList.add("ok");
      }
    });
  }

  // Fill any [data-email] links
  document.querySelectorAll("[data-email]").forEach((a) => { a.href = `mailto:${S.email}`; a.textContent = S.email; });
})();
