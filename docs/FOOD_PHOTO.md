# Meal photo (AI food-photo recognition, Pro)

Built on `claude/nine-features` as Stage 7. Route: Food → Meal photo (`/nutrition/photo`).

## Flow

1. **Gating:** Pro, or a grandfathered subscription with an AI allowance, checked on the server. Members must have given the general AI consent and a **separate meal-photo consent** (`profiles.food_photo_consent_at`), which names Anthropic's Claude and says the photo isn't stored.
2. **Capture:** take a photo (the phone camera, via `capture="environment"`) or choose one from the library. A preview allows retake or replacement. The member also picks the meal and can add a note ("cooked in olive oil").
3. **Upload:**
   - The photo is resized to 1,024 px and re-encoded as JPEG on the device, which removes location data and keeps image tokens (cost) low.
   - It goes over HTTPS to `POST /api/ai/food-photo`, which needs a signed-in session or token and a same-origin request, accepts at most 5 MB, and checks the real image type from the file's bytes.
   - **The server re-encodes it again** (`src/server/services/image-prep.ts`, sharp): turned upright from its EXIF orientation, fitted inside 1,024 px, JPEG, every bit of metadata removed. So a client that skips the phone's step still can't send location data or a huge image. A photo that can't be decoded is refused (415).
   - The server sends it once to the fast model (Claude Haiku) through `withAiRequest` (kind `food_photo`), with **one attempt and a 40-second timeout** inside the route's 60-second limit. A timeout, an unreadable answer or a refusal gives a clear message and **releases the reservation**, so it isn't charged. **The image is never written to storage or the database.**
4. **Estimate:** each visible food gets a name, visible ingredients, a portion in words, grams when judgeable, calories, protein, carbs, fat and a confidence level. The model also says whether the photo is blurry, dark or cuts the food off, and whether the main item is a packaged product. The server (`normalizeFoodPhoto`):
   - clamps numbers;
   - flags calories that disagree with the macros (4/4/9);
   - always asks about oil or butter and about sauces or dressings;
   - asks about portions when any item is uncertain;
   - **drops any "visible ingredient" that names an additive or chemical** (E-numbers, preservatives, colourings, sweeteners, MSG, nitrites…). A meal photo can't show them, and the model is told never to name them. Additive information only ever comes from a product's ingredient list (barcode or label).
5. **Database values where they fit:** each item's search term is looked up in the app's bundled USDA database on the server (no network, no AI; `matchStrength`/`bestMatch` in `src/lib/domain/food-photo.ts`).
   - A **strong** match must meet all of these:
     - every word of the term is in the food's name;
     - its main food word (before the first comma) is in the term, so "caesar salad" never becomes a dressing;
     - it adds no identity words ("toast" isn't French toast);
     - it isn't a brand;
     - it's in an as-eaten state, not raw meat, dry pasta, a mix or a can (unless the term says so);
     - it isn't a mixed dish such as lasagna, pizza or soup;
     - it isn't a low-fat or diet variant.

     A strong match **starts** as that database food at the photo's estimated weight, labelled "Amount estimated from the photo", with one tap back to the estimate.
   - A **weak** match is only offered ("Closest database food: … Use its values").
   - Checked against the bundled data for 50 common foods (unit test). Most map sensibly; known misses are listed under Limitations.
6. **Correct:**
   - Every field is editable, and items can be removed or added.
   - **Changing an estimate's grams rescales its calories and macros.** Editing a number by hand makes that the new basis.
   - A database item's amount can be changed.
   - Any item can be swapped for a **database food** (USDA, Open Food Facts or the member's own foods), with the search pre-filled and the amount starting at the photo's grams.
   - One-tap extras (olive oil, butter, ranch or Italian dressing in tsp or tbsp) use the app's USDA records.
   - The meal and the date can be changed on the review screen. The date can be today or earlier.
   - The screen says "Estimated from a photo, not measured", and that ingredients, additives and allergens can't be seen in a photo.
   - A blurry or dark photo gets a note and a "Use another photo" button. A packaged product links to the barcode scanner and the label check.
7. **Confirm:** nothing is saved until the member taps "Confirm and add to diary".
   - Photo estimates are stored as diary entries marked as estimates (`source = 'photo'`, "estimated from a photo" in the amount).
   - Database foods are recomputed on the server from the database. When their amount is still the photo's estimate, the entry is also marked as an estimate ("amount estimated from a photo").
   - **No duplicates:** each review has one id, and each saved row gets a stable id derived from it (`meal_items.client_id`), so a retried or double-sent save adds nothing twice. Future dates are refused on the server.

## Limits and cost

- **Allowance:** each analysis counts as one of the 150 monthly Pro AI messages, under the same race-free reservation.
- **Daily cap:** at most **20 photo analyses in 24 hours**, enforced inside `reserve_ai_usage` under the per-member lock (migration `20261024000032_food_photos.sql`).
- **Per-minute limit:** the existing one applies.
- **Failures:** a failed provider call, a timeout or an unreadable answer releases its reservation.
- **Cost per photo (estimate, not measured):** about **$0.0006** on the fast model for a 1,024 × 768 photo with a typical answer, and at most about $0.009 if the whole 2,000-token answer allowance were used. That's about $0.06 per 100 photos, or about $0.011 for a member's 20-photo daily cap. The figures come from `scripts/ai-eval/food-photo.ts --estimate`, using the prices recorded in `scripts/ai-eval/pricing.ts` (read 2026-11-02). No live call has been made, so real token use isn't measured.
- **Non-food photos are charged:** the model still ran. The 20-a-day cap bounds the cost.

## Tests

- **Unit** (`tests/unit/food-photo.test.ts`): normalisation, questions, non-food photos, byte sniffing (an SVG is rejected), and quick-add weights that match the bundled USDA records' own measures.
- **Database** (`tests/integration/food-photo.test.ts`):
  - no analysis or reservation without photo consent;
  - only the member can set their own consent;
  - 23 simultaneous photo reservations produce exactly 20 successes, and chat stays allowed;
  - photo entries are owner-only.
- **Browser** (`e2e/coach.spec.ts`, against a mock Anthropic API):
  - Plus is locked;
  - both consents;
  - upload and preview;
  - the request carries one base64 JPEG and the note, on Haiku;
  - questions include oil and portions;
  - the low-confidence item and the calorie mismatch are flagged and corrected;
  - the olive-oil quick-add gives 119 kcal for 1 tbsp;
  - a database swap with undo;
  - confirm, then the diary shows the estimates and the database values.

## Evaluation harness (`scripts/ai-eval/food-photo.ts`)

- **Same code path as production:** the same instructions and answer schema, server image preparation, normalisation and USDA matching.
- **Scoring:** each answer is scored against weighed ground truth in a `manifest.json`:
  - calorie error %;
  - item recall;
  - "no additives named";
  - non-food recognised;
  - poor photo flagged;
  - packaged product flagged;
  - sent at most 1,024 px with metadata removed.
- **Modes:**
  - `--estimate`: no network.
  - `--self-test`: a scripted local stand-in, through the budget proxy. 13 of 13 checks passed on 2026-11-03. **These aren't evaluation results.**
  - `--live --confirm-spend --max-usd`: needs `AI_EVAL_ANTHROPIC_API_KEY` and a folder of weighed meal photos whose use is allowed.
- **No live evaluation has been run.** This environment has no API key, and live spend needs the owner's approval.

## Limitations

- **Estimate quality is untested.** The real model's estimates haven't been checked: tests use a mock AI, and accuracy depends on the photo, lighting and hidden ingredients.
  - Independent research found photo-calorie apps underestimated meals by about a third on average (an NIH study presented at NUTRITION 2026, via a news summary; not verified here). Expect the same risk; the review screen exists for it.
- **Database matching is word-based.** Known misses from the 50-food check:
  - "spaghetti" matches spinach spaghetti (the bundled data has no plain cooked spaghetti in the top results);
  - generic words such as "cereal" can match a specific cereal.

  The matched name is always shown and one tap goes back to the estimate.
- **Phone camera not tested.** The camera capture input hasn't been tested on a physical iPhone or Android phone.
- **Anthropic's retention:** described by its own API terms, not by this app.
