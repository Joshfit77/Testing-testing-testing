# Meal photo (AI food-photo recognition, Pro)

Built on `claude/nine-features` as Stage 7. Route: Food → Meal photo (`/nutrition/photo`).

## Flow

1. **Gating:** Pro, or a grandfathered subscription with an AI allowance, checked on the server. Members must have given the general AI consent and a **separate meal-photo consent** (`profiles.food_photo_consent_at`), which names Anthropic's Claude and says the photo isn't stored.
2. **Capture:** take a photo (the phone camera, via `capture="environment"`) or choose one from the library. A preview allows retake or replacement. The member also picks the meal and can add a note ("cooked in olive oil").
3. **Upload:**
   - The photo is resized to 1,024 px and re-encoded as JPEG on the device, which removes location data and keeps image tokens (cost) low.
   - It goes over HTTPS to `POST /api/ai/food-photo`, which needs a signed-in session or token and a same-origin request, accepts at most 5 MB, and checks the real image type from the file's bytes.
   - The server sends it once to the fast model (Claude Haiku) through `withAiRequest` (kind `food_photo`). **The image is never written to storage or the database.**
4. **Estimate:** each visible food gets a name, visible ingredients, a portion in words, grams when judgeable, calories, protein, carbs, fat and a confidence level. The server (`normalizeFoodPhoto`):
   - clamps numbers;
   - flags calories that disagree with the macros (4/4/9);
   - always asks about oil or butter and about sauces or dressings;
   - asks about portions when any item is uncertain.
5. **Correct:** every field is editable and items can be removed or added. Any item can be swapped for a **database food** (USDA, Open Food Facts or the member's own foods), with the search pre-filled. One-tap extras (olive oil, butter, ranch or Italian dressing in tsp or tbsp) use the app's USDA records. The screen says "Estimated from a photo, not measured".
6. **Confirm:** nothing is saved until the member taps "Confirm and add to diary".
   - Photo estimates are stored as diary entries marked as estimates (`source = 'photo'`, "estimated from a photo" in the amount).
   - Database foods are recomputed on the server from the database.

## Limits and cost

- **Allowance:** each analysis counts as one of the 150 monthly Pro AI messages, under the same race-free reservation.
- **Daily cap:** at most **20 photo analyses in 24 hours**, enforced inside `reserve_ai_usage` under the per-member lock (migration `20261024000032_food_photos.sql`).
- **Per-minute limit:** the existing one applies.
- **Failures:** a failed provider call releases its reservation.

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

## Limitations

- **Estimate quality is untested.** The real model's estimates haven't been checked: tests use a mock AI, and accuracy depends on the photo, lighting and hidden ingredients.
- **Phone camera not tested.** The camera capture input hasn't been tested on a physical iPhone or Android phone.
- **Anthropic's retention:** described by its own API terms, not by this app.
