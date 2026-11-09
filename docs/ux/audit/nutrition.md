# Nutrition: first-time-user UX audit

Evidence: `before-{new,occasional,established}/shots` + `metrics.json`. Source: `src/app/(app)/nutrition/**`, `src/components/nutrition/**`. No fix touches a BADGE-BRANCH file.

**Tap counts (verified in source):**
- **Familiar food on the Recent card:** 1 tap from the Nutrition tab ("Add Banana again", `quick-relog.tsx`). The meal comes from the device clock (`mealForTime`: breakfast before 10:30). Confirmation is a green "Logged Banana." line under the list, and the ring updates. **No undo.** Removing it takes a scroll to the meal card, then trash, then confirm. This is well under 15 s.
- **Familiar food not in the top 4:** Add food → Recent tab (the default) → Add → close the sheet = 3 taps.
- **New food by search:** Add food → search field → type → pick → "How much?" (amount pre-filled) → Log food → close = 5 taps plus typing.
- **Barcode from the diary tile:** Scan barcode → Start camera → product page → scroll past score and ingredients → Add to Food Diary → Add to diary → back = 6 or more taps. The Add food sheet's own Scan tab does it in 4.
- **Saved meal:** scroll ~3 screens to MORE → open "Saved meals, recipes & my foods" → "N saved meals" → choose meal (it defaults to **Dinner**, `LogTemplateForm`) → Add = 4 taps plus scrolling. There is no Saved meals tab in the Add food sheet.
- **AI review gate:** `/api/ai/food-photo` and `/api/ai/label-photo` only return data. Rows are written only by `logFoodPhotoItemsAction` (the "Confirm and add to diary" button after editable review) and `logLabelFoodAction` (an explicit save). AI meal plans need `approveAiMealPlanAction`. **PASS.**

---

## /nutrition
- **Purpose / primary action:** the food diary. Log food (Add food / Scan barcode / Meal photo), with Recent foods underneath.
- **Understood immediately?** Partly. The first screen is good: logging first, then the calorie ring and the protein bar (`025-nutrition.png`). Below that it grows to 4.4 screens, 1,036 words and 125 controls (established).
- **Unnecessary:**
  - "kcal remaining" appears three times: the totals card, the "Calories remaining & today's estimate" hint, and a line inside Nutrients.
  - Recipes, Saved meals and Supplements are each linked twice (the "Saved meals…" group and "More tools").
  - "More tools" opens a 50-word Nutrition Score sales card.
  - "Done for the day? Mark day complete" sits above Breakfast, and also shows for a new member with nothing logged (`before-new/023-nutrition.png`).
- **Hidden functionality:**
  - A logged item is editable by tapping its name (`EditableMealItem`), but nothing shows that.
  - Saved meals cannot be reached from the Add food sheet.
  - Two different things are called "Quick add": the header sheet and the calories-only dialog.
- **Text / targets:**
  - 93 small texts. Item rows are 14px names with 12px amount and macro lines ("0.5 cup (40 g) · 150 kcal · P 5 · C 27 · F 3").
  - 25 small targets: "+250/500/750 ml" 81×36, "Undo" 84×36, "Quick add" 118×36, Copy buttons `min-h-9`.
- **States:**
  - New: a helpful empty line ("Nothing logged yet. Use "Add food"…"), but 4 empty meal cards plus 7 groups make 2.6 screens.
  - Occasional: Recent foods works.
  - Water shows "0.00 / 2.7L" in ml for a member who uses lb.
- **Relevance:** the Recent row says "same amount as last time" but shows only kcal ("White rice, cooked 308 kcal" is 1.5 cups). The amount is never shown.
- **Recommendation:**
  - Recent rows: "Banana · 1 medium · 105 kcal · P 1 g".
  - After a log: "Logged Banana to breakfast · Undo".
  - Move the day-mark card below the meals and hide it until food is logged.
  - Drop the duplicate remaining lines and links.
  - Give item rows a chevron and 14px summaries.

## /nutrition?add=1 (Add food sheet)
- **Purpose:** search, pick, set the amount, log.
- **Established:** opens on Recent / Frequent with gold Add buttons. Good.
- **New member:** opens on Search. Under the field are 25 raw USDA group chips, starting with "American Indian/Alaska Native Foods" (3,350 words, 339 controls; `before-new/024-nutrition-add=1.png`).
- **Header and tabs:** the header reads "For 2026-11-09" (an ISO date). The six tabs overflow and the last is cut to "M…".
- **After logging:** the sheet stays open with a status line at the top and no undo.
- **Source info:** preserved and good: "USDA FoodData Central (SR Legacy…)", "Built-in common foods… Typical values", plus USDA / Label / Estimate badges.
- **Recommendation:**
  - Show Popular foods first and put "Browse by type" behind a disclosure.
  - Move Manual to a "Can't find it? Enter it yourself" link so 5 tabs fit.
  - Format the date as "Today" or "Mon, Nov 9".
  - Add a Saved meals tab using the `templates` already loaded on the page.

## /nutrition/scanner
- **Purpose:** the "Narrow Gate Nutrition Score" product analyser. This is **not** logging, yet the diary's "Scan barcode" tile opens it.
- **Understood?** Partly. A member who wants to log a yoghurt meets a 45-word intro, a quality checklist and allergen filters.
- **Text / targets:** filter checkboxes are 16×16 (`quality-client.tsx` `size-4`; 20 small targets for Pro).
- **States:** Free sees "Personal filters… included with Pro All Access", which is calm and fine.
- **Recommendation:** point the diary tile to the Add food sheet's Scan tab (`?add=1&tab=scan`). Keep this screen under More tools. Make the checkbox rows `min-h-11` labels.

## /nutrition/photo
- **Purpose:** AI meal estimate, then review, then confirm.
- **Pro:** clear ("You check and correct every item before it's added"). The review gate is verified.
- **Free:** the third tile on the logging row leads to a lock ("Included with Pro All Access", `before-new/026-nutrition-photo.png`). It is a paywall in the middle of logging.
- **Demo note** card: DEMO-ONLY.
- **Camera / permission:** DEVICE.
- **Recommendation:** for Free, put a small "Pro" tag on the tile so the tap is expected. Alternatively, give the lock screen a secondary "Add food instead" link (→ `/nutrition?add=1`).

## /nutrition/label
- **Purpose:** check ingredients and log from the label.
- **Understood?** Partly. The macros needed to log are inside the optional disclosure "Nutrition from the label (optional)", whose summary is a 293×20 target.
- **Demo note:** DEMO-ONLY.
- **Recommendation:** rename it "Calories & macros (needed to log)" and give it `min-h-11`.

## /nutrition/insights
- **Purpose:** weekly averages, per-day results, top sources. Useful.
- **Noise:** every day carries a "Logged · not marked complete" pill (`insights/page.tsx:23`), which reads as a scolding.
- **New member:** seven "Not logged / No entries. Left out" rows. An empty state would be clearer.
- **Recommendation:** show a pill only for Complete or Fasted. When there are 0 logged days, show one line plus an "Add food" button.

## /nutrition/compare
- **With no product (established):** no h1, a lone notice, and a back link "Back to the product" that actually goes to the scanner.
- **Free:** locked. Reached only from a product, so low traffic.
- **Recommendation:** add the PageHeader "Compare products" and relabel the back link "Nutrition Score".

## /nutrition/recipes
- **Purpose:** your recipes plus ~28 app recipes. 3.9 screens.
- **Unnecessary:** the "App-made" pill repeats on every row even though the section header already says it.
- **Visuals / logging:** text only, and there is no logging action in the list.
- **Free:** locked. The More tools link gives no warning.
- **Recommendation:** drop the per-row pill and bold the kcal and protein. Mark Pro tools with a "Pro" tag in More tools and in `FoodToolsNav`.

## /nutrition/recipes/new
- A clear, short form (1.3 screens), with an actionable empty ingredients box.
- Free: locked.
- No change needed.

## /nutrition/recipes/app/oatmeal-banana-peanut-butter
- **Purpose:** recipe detail. It has good USDA badges per ingredient and a clear "Written for this app, not by a dietitian".
- **Missing action:** **no log action** (2 controls). The only route is "log them from your plan".
- **Recommendation:** add "Log a serving" (meal + servings) via `logFoodAction` with an `app:` source. `sourceKind` already handles `app:`, and `RecipeLogForm` shows the UI pattern.

## /nutrition/planner
- **Purpose:** a week of meals.
- **First screen (3.1 screens):** a disclaimer, "Planning for", an **AI meal plan** form (Start, Days, Focus, Notes plus 60 words of caveats), a **Make a plan** form, and Planner settings. That is two competing generators.
- **Targets:** "(change)" is 17×20.
- **Recommendation:** one primary "Generate a week", with "Draft with AI instead" as a secondary disclosure. Collapse settings and caveats.

## /nutrition/grocery
- **Empty state:** actionable ("No meal plan yet. Make a plan first, or add items by hand").
- **Cost card:** ~50 words explaining why there is *no* cost estimate ("We don't have a sourced, dated price table…").
- **Recommendation:** delete the Cost card (`grocery/page.tsx:106`).

## /nutrition/saved-meals
- **Purpose:** reuse meals. It is free, and the empty state explains how to save one.
- **Label mismatch:** the text says "use **Save as meal**", but the diary disclosure is labelled "Save breakfast to log again".
- **Default name:** "Breakfast 2026-11-09".
- **Recommendation:**
  - Use one label, "Save as meal", on both screens.
  - Default the name to "Breakfast, Nov 9".
  - Default the log meal to `mealForTime`.

## /nutrition/supplements
- **Purpose:** education plus a daily stack.
- **Length:** 9.3 screens and 1,221 words. Every card shows Dose, Timing and Cautions expanded (`supplements-client.tsx:156-162`).
- **Targets:** filter chips are 36px (29 small targets).
- **Recommendation:** follow the Diets pattern. Each card shows name, evidence, one line and Add to stack, with dose, timing and cautions in a `<details>`. Make the chips `min-h-11`.

## /nutrition/diets
- Good model: expandable cards, "Your diet" tag, a disclaimer at the bottom. 2.6 screens.
- No change needed.

## /nutrition/product/3017620422003
- **In capture:** "Couldn't look that up", because Open Food Facts was unreachable (DEMO-ONLY environment).
- **App issues:**
  - There is no "Try again" button.
  - "Go to the food diary" lands on the diary, not on manual entry.
  - Both links are 20px tall.
  - When the page works, "Add to Food Diary" sits below the score and ingredient sections and always logs to *today*.
- **Recommendation:**
  - Add a "Try again" button.
  - Link to `/nutrition?add=1`.
  - Make the links `min-h-11`.

---

## Ranked issues

| ID | Title | Impact | Evidence | Fix (smallest) | Files | Effort | Class |
|---|---|---|---|---|---|---|---|
| N1 | Diary "Scan barcode" tile opens the quality analyser, not logging | High | `025-nutrition.png` → `027-nutrition-scanner.png`; 6+ taps vs 4 | Tile → `/nutrition?add=1&tab=scan`; `AddFoodDialog` accepts an initial tab | `nutrition/page.tsx`, `nutrition-client.tsx` | S | APP |
| N2 | No undo after logging; delete is a hard delete | High | `relogItemAction`/`logFoodAction` return only a message; `deleteMealItemAction` deletes rows | Return the new item id; "Logged Banana to breakfast · Undo" calls `deleteMealItemAction` | `server/actions/nutrition.ts`, `quick-relog.tsx`, `diary-client.tsx`, `nutrition-client.tsx` | M | APP |
| N3 | Saved meals buried (4 taps + scroll), not in Add food, default Dinner | High | `036-…saved-meals.png`; `LogTemplateForm useState("dinner")` | Saved meals tab in `AddFoodDialog` (templates already fetched); default `mealForTime` | `nutrition-client.tsx`, `nutrition/page.tsx` | M | APP |
| N4 | Free member hits a Pro lock from the logging row and More tools | High (new) | `before-new/026-nutrition-photo.png`, 030–033, 037 locked | "Pro" tag on the Meal photo tile and locked tool links; "Add food instead" on the lock | `nutrition/page.tsx`, `nutrition-page.tsx` | S | APP |
| N5 | Recent row hides the amount it will log | Medium | `025-nutrition.png` "White rice 308 kcal" | Select `amount_label`; show "1.5 cup · 308 kcal · P 6 g" | `nutrition/page.tsx`, `lib/domain/diary.ts`, `quick-relog.tsx` | S | APP |
| N6 | Diary too long and repetitive (4.4 screens, 1,036 words) | Medium | metrics; `025-nutrition-full.jpg` | Remove duplicate remaining lines and links; day-mark below meals, only when food > 0; shrink the Nutrition Score card to a link | `nutrition/page.tsx`, `day-mark.tsx` | S | APP |
| N7 | New member's Add food opens on 25 raw USDA chips; tabs cut off | Medium | `before-new/024-…add=1.png`, 3,350 words | Popular foods first, categories behind a disclosure, Manual as a link | `nutrition-client.tsx` | S | APP |
| N8 | App recipes can't be logged; list repeats "App-made" | Medium | `039-app-recipe-full.jpg` (2 controls) | "Log a serving" via `logFoodAction` `app:` source; drop the per-row pill | `recipes/app/[slug]/page.tsx`, `recipes/page.tsx` | M | APP |
| N9 | Supplements education fully expanded (9.3 screens) | Medium | `037-…supplements-full.jpg`, 1,221 words | `<details>` per card, like Diets | `components/supplements/supplements-client.tsx` | S | APP |
| N10 | Planner shows two generators plus a settings form | Medium | `034-…planner-full.jpg` | One primary action; AI and settings collapsed | `planner/page.tsx`, `planner-client.tsx`, `ai-meal-plan.tsx` | M | APP |
| N11 | Logged-item rows and edit affordance too small and hidden | Medium | smallText 93; 12px summary | Summary `text-sm`, chevron on the row | `food-amount.tsx` | S | APP |
| N12 | Small targets (36px water/undo/quick add/copy/chips; 16–20px checkboxes and links) | Low | smallTargets 25 / 20 / 29 / 2 | `min-h-11` on these buttons and labels | `nutrition-client.tsx`, `diary-client.tsx`, `quality-client.tsx`, `label-check.tsx`, `product/[code]/page.tsx`, `planner/page.tsx` | S | APP |
| N13 | "Logged · not marked complete" on every insights day | Low | `030-…insights-full.jpg` | Badge only for Complete or Fasted | `insights/page.tsx` | S | APP |
| N14 | ISO dates in UI ("For 2026-11-09", history, planned list, saved-meal name) | Low | `026-…add=1.png` | `formatLongDate` / short weekday | `nutrition-client.tsx`, `nutrition/page.tsx` | S | APP |
| N15 | Grocery "Cost" card explains an absent feature | Low | `035-…grocery-full.jpg` | Delete the card | `grocery/page.tsx` | S | APP |
| N16 | Compare empty state: no h1, wrong back label | Low | `031-…compare.png` (h1 '') | PageHeader; back label "Nutrition Score" | `compare/page.tsx` | S | APP |
| N17 | Product lookup failure has no retry; diary link doesn't open entry | Low | `040-product.png` | "Try again" button; link `/nutrition?add=1` | `product/[code]/page.tsx` | S | APP (outage itself DEMO-ONLY) |
| N18 | Water "0.00 / 2.7L" in ml for an lb member | Low | `before-new/023-nutrition.png` | "0 of 2.7 L"; follow `units` | `nutrition-client.tsx` (WaterCard) | S | APP |
| N19 | Seeded built-in foods show a "Label" badge instead of "Estimate" | — | `025-nutrition-full.jpg`; `demo-seed.ts` sets `is_estimate: false` | Use the food's `is_estimate` in the seed | `src/server/demo-seed.ts` | S | DEMO-ONLY |
| N20 | Demo notes on photo and label; simulated AI results | — | `028`, `029` | none | — | — | DEMO-ONLY |
| N21 | Camera scan, photo capture, permission-denied flows | — | not capturable | test on phone | `barcode-scanner.tsx`, `food-photo-flow.tsx` | — | DEVICE |

Verified OK:
- The AI review gate (photo, label, AI plan).
- Water has undo.
- Removing a food asks for confirmation.
- Source labelling (USDA / Label / Estimate / Calculated, and the Open Food Facts attribution) is intact.
- Diets already uses expandable education.

## Summary
1. The diary's "Scan barcode" tile opens a product-analysis screen rather than logging, so barcode logging takes 6+ taps instead of 4 (N1).
2. Logging is fast (1 tap for a recent food) but has no undo. Removing an entry needs a scroll, trash and confirm (N2).
3. Saved meals are 4 taps plus a scroll away, missing from Add food, and default to Dinner (N3). App recipes can't be logged at all (N8).
4. Free members meet a Pro lock from the main logging row and from unmarked tool links (N4).
5. The diary, Supplements and Planner are long and repetitive (4.4 / 9.3 / 3.1 screens). Collapse the education and remove duplicates (N6, N9, N10).
