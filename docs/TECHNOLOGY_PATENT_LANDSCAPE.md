# Narrow Gate Fitness — Technology & Patent Landscape Review (Preliminary)
**Reviewed:** 2026-10-24 | **Code branch:** `claude/animated-opening-demo` | **Scope:** U.S.-focused technical comparison and representative patent claims. **Not** a patent freedom-to-operate (FTO) opinion. Google Patents status is unverified; check USPTO Patent Center and maintenance/continuation records. A patent publication is not proof of enforceable rights.

## Executive conclusion
No specific infringement established. The standard act of scanning UPC/EAN, querying an independently licensed food database, showing nutritional information, collecting smartphone GPS locations and reading consented HealthKit sleep data should not be treated as exclusive technology belonging to Yuka, Nike, Oura, Fitbit or Apple. However, patents may claim *particular combinations/algorithms* and independent claims must be compared element by element. Four areas deserve targeted attorney claim charts: **personalized ingredient/AI decisions**, **adaptive athlete prescriptions**, **route reconstruction/sensor-fusion**, and **wearable sleep-score models**.

## 1. Food scanning and chemical explanations (Yuka comparison)
**Actual pipeline:** `src/components/nutrition/barcode-scanner.tsx` uses Capacitor's native barcode scanner / ZXing browser libraries. Barcode → UPC/EAN product ID → `src/lib/open-food-facts.ts` and `src/lib/food-quality.ts` normalize Open Food Facts label/product records → display ingredients, allergens, additives, NOVA, Nutri-Score, thresholds and explanations. `src/lib/food-quality-ai.ts` optionally explains known facts relative to personal fitness goals. `src/lib/food-iq.ts` includes *experimental* original 0–100 nutrition-quality formula, server flag **off by default**. Code expressly avoids claiming that a barcode chemically tests food.
**Yuka publicly describes:** food scoring uses nutrition (60%), additives (30%) and organic certification (10%) with additional rules; product database comes from Yuka's user/brand contributions; case study identifies Scandit SDK. The app here uses Open Food Facts and its own scoring methodology rather than those exact weighting rules. Sources: https://help.yuka.io/l/en/article/c1zr4m81g1-yuka-terms-conditions-usa and https://www.scandit.com/resources/case-studies/yuka/
**Patent lead:** US20260196331A1, published application for personalized ingredient analysis with food capture, AI, ontological ingredient/health relationship inference and individualized compatibility. Review **independent claim 1 as a whole**; Narrow Gate's data-driven product-goal explanations merit comparison, but generic scanning alone is insufficient. Pending application—no proof of issued enforceable claim. https://patents.google.com/patent/US20260196331A1/en
**Exposure:** MEDIUM research priority (not infringement probability). Verify no Yuka content/code or Scandit proprietary SDK is incorporated. Audit OFF database/image license separately.

## 2. GPS running in pocket and map
**Actual pipeline:** `src/lib/native/location.ts` requests native background geolocation when recording and browser geolocation otherwise. `src/components/run/gps-recorder.tsx` displays route and pace. `src/lib/domain/gps-track.ts` rejects inaccurate/stale fixes, uses **constant-velocity Kalman smoothing for GPS observations**, omits distance across missing GPS gaps, and calculates splits. A phone carried in a pocket still reports GPS; native background permission/plugin is required for lock-screen recording. The reviewed code does **not establish independent Apple Watch GPS recording or direct watch GPS integration**.
**Patent leads:** 
- Fitbit US9730027B2, claims involve **back-filling** route before initial GPS fix based on other biometric/sensor readings, not merely drawing accepted GPS points. Narrow Gate documentation expressly says it counts no distance before first good fix and does not fill missing sections; potential material distinction, subject to claim chart. https://patents.google.com/patent/US9730027B2/en
- Nike US9122250B2 claims route-linked message-triggering and payload behavior; basic run route/pace is not sufficient alone. https://patents.google.com/patent/US9122250B2/en
- US20200149921A1 describes **two independent sensor hardware systems** and selecting/calibrating between their distance estimates. Current code appears GPS-only Kalman smoothing, **not** GPS plus an independent inertial-distance fusion method. https://patents.google.com/patent/US20200149921A1/en
- A separate publication US20240091590A1 discusses mapping routes with known path/map matching; compare only if future map-matching is added. https://patents.google.com/patent/US20240091590A1/en
**Exposure:** LOW–MEDIUM research priority for current GPS-only pipeline; rises if route backfill, watch sensor fusion or proprietary route suggestion is added. Technical validation still needed on actual locked iPhone, and review location permissions.

## 3. Sleep from Apple Health / Health Connect
**Actual pipeline:** `src/lib/native-sleep.ts` invokes `@capgo/capacitor-health`, requests consent, and reads platform sleep stage samples and optional overnight HR/HRV/respiratory-rate data. `src/lib/domain/sleep-score.ts` computes deterministic transparent components weighted duration 50, efficiency 20, timing 20, awakenings 10. `src/lib/domain/sleep-training.ts` compares user-reported recovery and logged training as **associations**, not causation. The code **does not itself detect sleep stages from sensor signals** and **does not yet prove Apple Watch standalone connectivity**; watches that write to Apple Health may appear indirectly.
**Patent leads:**
- Samsung US20250111944A1 claim 1 includes using **trained ML models** on wearable histories and profiles for sleep component scores. Narrow Gate's deterministic ramps are a significant apparent distinction; pending publication. https://patents.google.com/patent/US20250111944A1/en
- Oura US20230225676A1 describes sleep contributors in specification but its independent claims and status must be checked: don't assume all mentions of 'sleep score' are patented. https://patents.google.com/patent/US20230225676A1/en
**Exposure:** LOW–MEDIUM research priority for transparent scoring/import alone; higher if algorithm starts predicting stages or inferring illnesses/recovery from raw signals. Apple HealthKit terms, privacy and consent requirements are a **separate** compliance concern, not patent infringement.

## 4. Adaptive training / AI Coach
**Actual pipeline:** `src/lib/coach/`, `src/server/services/ai-coach.ts` and program builder provide personalized plans/recommendations; adjustments require user confirmation. Important to map exact use of completed sessions, sensor inputs, plan auto-adjustment and model predictions.
**Patent lead:** Nike's granted family from US20170266499A1 / US11177038B2 concerns adaptive athletic activity prescriptions including sensor-informed athlete progress and adjustments. Published description alone isn't enough. Counsel should map the exact current granted independent claims and continuations to Narrow Gate's actual program builder and post-workout adaptation. https://patents.google.com/patent/US11177038B2/en
**Exposure:** MEDIUM research priority: highest among exercise-related features, especially for future fully automatic individualized adjustments.

## 5. Body scans
**Actual pipeline:** `src/lib/domain/body-scan.ts`, `src/server/services/body-scan.ts`: front/side/back photos captured with guidance; users compare images and manually log measurements; photos stored privately with expiring signed URLs. Current inspected files **do not implement automatic body-fat estimation or reconstruct a 3D body model**. Consequently many patents directed at computational 3D estimation may not map to this implementation; review specifically if adding photogrammetry/AI body-fat inference.
**Exposure:** LOW research priority based on observed simple photo comparison.

## What this review does / does not prove
- ✓ Maps the code to representative published patent descriptions and some independent-claim language.
- ✓ Separates use of native/third-party SDK interfaces from internally invented sensor algorithms.
- ✗ Does not establish patent noninfringement, invalidity, enforceability, clearance, correct ownership, exhaustion or implied license.
- ✗ Not an exhaustive landscape; patents can be issued, continued, amended or have narrower claims than their abstracts.
- ✗ U.S.-focused, not an EU/UK/Canada/Australia rights search.
- ✗ Current branch's real-device behavior still needs verification.

## Patent counsel follow-up
Request a **U.S. software patent FTO review** prioritized by: (1) food/AI ingredient-personalization and nutrition-scoring, (2) adaptive training program updates, (3) GPS route smoothing/backfill/watch fusion, (4) sleep quality scoring and recovery, (5) optional body scan. For each candidate: current granted claims and continuations; status/maintenance/expiry; written claim-element mapping to file/function code; noninfringement distinctions and design-around options. Preserve dated architecture and source-code snapshots.
