// Beauty and Praise — interactive behaviour

const today = new Date().toISOString().slice(0, 10);

// localStorage can be unavailable (private mode, blocked storage), so wrap it.
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }
};

// Pick an item that stays the same for the whole day.
function dailyPick(list) {
  const dayNumber = Math.floor(Date.now() / 86400000);
  return list[dayNumber % list.length];
}

/* ---------- Navigation ---------- */
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");
navToggle.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", open);
});
navLinks.addEventListener("click", (e) => {
  if (e.target.tagName === "A") {
    navLinks.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  }
});

/* ---------- Verse of the day ---------- */
const verse = dailyPick(VERSES);
document.getElementById("daily-verse").innerHTML =
  `“${verse.text}”<cite>— ${verse.ref}</cite>`;

/* ---------- Herbs ---------- */
const herbGrid = document.getElementById("herb-grid");
const herbSearch = document.getElementById("herb-search");
const herbFilters = document.getElementById("herb-filters");
const herbEmpty = document.getElementById("herb-empty");
let activeTag = "all";

const allTags = ["all", ...new Set(HERBS.flatMap((h) => h.tags))];
allTags.forEach((tag) => {
  const btn = document.createElement("button");
  btn.className = "chip" + (tag === "all" ? " active" : "");
  btn.textContent = tag;
  btn.dataset.tag = tag;
  btn.setAttribute("aria-pressed", tag === "all");
  herbFilters.appendChild(btn);
});

herbFilters.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  activeTag = btn.dataset.tag;
  herbFilters.querySelectorAll(".chip").forEach((c) => {
    const on = c === btn;
    c.classList.toggle("active", on);
    c.setAttribute("aria-pressed", on);
  });
  renderHerbs();
});
herbSearch.addEventListener("input", renderHerbs);

function renderHerbs() {
  const q = herbSearch.value.trim().toLowerCase();
  const matches = HERBS.filter((h) => {
    const tagOk = activeTag === "all" || h.tags.includes(activeTag);
    const text = [h.name, h.description, h.uses, ...h.tags].join(" ").toLowerCase();
    return tagOk && (!q || text.includes(q));
  });

  herbGrid.innerHTML = "";
  matches.forEach((h) => {
    const card = document.createElement("article");
    card.className = "card herb-card";
    card.innerHTML = `
      <div class="herb-emoji" aria-hidden="true">${h.emoji}</div>
      <h3>${h.name}</h3>
      <div class="tags">${h.tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
      <p>${h.description}</p>
      <details>
        <summary>How to use &amp; cautions</summary>
        <p><strong>Ways to enjoy:</strong> ${h.uses}</p>
        <p class="caution"><strong>Caution:</strong> ${h.caution}</p>
      </details>`;
    herbGrid.appendChild(card);
  });
  herbEmpty.hidden = matches.length > 0;
}
renderHerbs();

/* ---------- Reminder of the moment ---------- */
const tipText = document.getElementById("tip-text");
let tipIndex = Math.floor(Math.random() * REMINDERS.length);
function showTip() {
  tipText.classList.remove("fade");
  void tipText.offsetWidth; // restart animation
  tipText.textContent = REMINDERS[tipIndex];
  tipText.classList.add("fade");
}
document.getElementById("next-tip").addEventListener("click", () => {
  tipIndex = (tipIndex + 1) % REMINDERS.length;
  showTip();
});
showTip();

/* ---------- Daily checklist ---------- */
const checklistEl = document.getElementById("checklist");
const progressBar = document.getElementById("progress-bar");
const progressLabel = document.getElementById("progress-label");

let habits = store.get("bp-habits", DEFAULT_HABITS);
let done = store.get("bp-done", { date: today, items: [] });
if (done.date !== today) done = { date: today, items: [] };

function saveChecklist() {
  store.set("bp-habits", habits);
  store.set("bp-done", done);
}

function renderChecklist() {
  checklistEl.innerHTML = "";
  habits.forEach((habit, i) => {
    const li = document.createElement("li");
    const id = `habit-${i}`;
    const checked = done.items.includes(habit);
    li.innerHTML = `
      <input type="checkbox" id="${id}" ${checked ? "checked" : ""}>
      <label for="${id}"></label>
      <button class="remove" aria-label="Remove reminder">×</button>`;
    li.querySelector("label").textContent = habit;
    li.querySelector("input").addEventListener("change", (e) => {
      done.items = e.target.checked
        ? [...done.items, habit]
        : done.items.filter((h) => h !== habit);
      saveChecklist();
      updateProgress();
    });
    li.querySelector(".remove").addEventListener("click", () => {
      habits = habits.filter((_, j) => j !== i);
      done.items = done.items.filter((h) => h !== habit);
      saveChecklist();
      renderChecklist();
    });
    checklistEl.appendChild(li);
  });
  updateProgress();
}

function updateProgress() {
  const count = habits.filter((h) => done.items.includes(h)).length;
  const pct = habits.length ? (count / habits.length) * 100 : 0;
  progressBar.style.width = pct + "%";
  progressLabel.textContent = `${count} / ${habits.length}`;
}

document.getElementById("add-habit").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("habit-input");
  const value = input.value.trim();
  if (value && !habits.includes(value)) {
    habits.push(value);
    saveChecklist();
    renderChecklist();
  }
  input.value = "";
});
renderChecklist();

/* ---------- Water tracker ---------- */
const GOAL = 8;
const glassesEl = document.getElementById("glasses");
const waterCount = document.getElementById("water-count");
let water = store.get("bp-water", { date: today, count: 0 });
if (water.date !== today) water = { date: today, count: 0 };

function renderWater() {
  glassesEl.innerHTML = "";
  for (let i = 0; i < GOAL; i++) {
    const btn = document.createElement("button");
    btn.className = "glass" + (i < water.count ? " full" : "");
    btn.textContent = "💧";
    btn.setAttribute("aria-label", `Glass ${i + 1}`);
    btn.addEventListener("click", () => {
      // Clicking the last filled glass empties it; otherwise fill up to it.
      water.count = water.count === i + 1 ? i : i + 1;
      store.set("bp-water", water);
      renderWater();
    });
    glassesEl.appendChild(btn);
  }
  waterCount.textContent = water.count;
}
renderWater();

document.getElementById("year").textContent = new Date().getFullYear();
