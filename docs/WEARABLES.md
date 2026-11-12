# Wearables and sleep: what the app can read, from where

Narrow Gate Fitness reads sleep from the phone's health platform, never from a watch directly. On iPhone that is
**Apple Health** (HealthKit); on Android it is **Health Connect**. Any watch, ring or band that writes its sleep into
that platform is covered the same way, which is why the app does not ship vendor integrations (no Oura, Garmin, Fitbit
or WHOOP API keys, no cloud-to-cloud sync). The app itself measures nothing.

Written 2026-10-24. Vendor behaviour changes; the "Verified" column says how each row was checked. Nothing below has
been exercised on a physical device yet (see `docs/SLEEP_DEVICE_CHECKLIST.md`).

## 1. The bridge

| | iPhone | Android |
|---|---|---|
| Platform | Apple Health (HealthKit) | Health Connect (Android 14+ built in; 9–13 via the Health Connect app) |
| Plugin | `@capgo/capacitor-health` 8.11.4, `dataType: "sleep"` plus `heartRate`, `heartRateVariability`, `respiratoryRate` | same plugin |
| Permission | HealthKit read authorization per type; iOS never tells an app a *read* was denied, the query just returns nothing | Health Connect read permission per record type; a denied type is reported |
| Sleep shape | `HKCategoryTypeIdentifierSleepAnalysis` samples: `inBed`, `asleepUnspecified`, `awake`, `asleepCore`, `asleepDeep`, `asleepREM`. The in-bed sample is an envelope that **overlaps** the stage samples; the stage samples don't overlap each other. The plugin maps `asleepCore` to `light`. | `SleepSessionRecord` with stage list (`AWAKE`, `AWAKE_IN_BED`→awake, `LIGHT`, `DEEP`, `REM`, `SLEEPING`→asleep, `OUT_OF_BED`, `UNKNOWN`) |
| HRV method | SDNN (ms) | RMSSD (ms) |
| Background delivery | HealthKit supports `enableBackgroundDelivery` with the `com.apple.developer.healthkit.background-delivery` entitlement, best effort, hourly at most for sleep | No push; an app schedules its own WorkManager job and reads the changes log |

How the app avoids double-counting (`src/lib/domain/sleep-import.ts`, unit-tested):

1. The in-bed envelope is never a stage: it sets the session's start and end only.
2. Samples within 30 minutes of each other form one night.
3. One stage writer per night: the source with light/deep/REM detail beats a bare asleep/awake record (a watch beats
   the phone), then the one with more minutes. Segments without a source name stay with the winner.
4. Same-source overlaps are clipped to the earlier interval, so stage totals can never exceed the night.
5. Overnight heart rate, HRV and breathing samples count for a night when their midpoint falls inside it; implausible
   values (HR outside 20–250, HRV outside 1–500 ms, breathing outside 4–60) are dropped, not averaged.
6. The server refuses a second import of the same platform record id and any session overlapping a stored one.

## 2. Compatibility matrix

"Shares to Apple Health / Health Connect" is what matters. If the row says yes, the device's nights appear in the app
once the member connects the platform; nothing else is needed. "Direct API" rows are listed only to record why the app
does not use them.

| Device / app | Shares sleep to Apple Health | Shares sleep to Health Connect | Stages shared | Overnight HR / HRV / breathing | What the member must do | Verified | Limitations |
|---|---|---|---|---|---|---|---|
| **Apple Watch** (watchOS 9+) | Yes, natively (in-bed, core, deep, REM, awake) | n/a (no Android) | Yes | Heart rate yes; HRV (SDNN) yes, a few readings a night; respiratory rate yes (Series 3+ / SE) when Sleep Focus is on | Wear the watch to bed with Sleep tracking on; allow the app to read Sleep, Heart Rate, HRV, Respiratory Rate | Apple documentation (HealthKit sleep analysis categories). Not run on a device yet. | Stages need watchOS 9 and about 4 hours of sleep; the iPhone alone writes only in-bed |
| **Oura Ring** (Gen 3 / Ring 4) | Yes: sleep incl. stages through the Oura app | Yes, incl. stages | Yes | Heart rate and HRV written to Apple Health; Health Connect writes per Oura's current list | Oura app → Settings → Apple Health / Health Connect, allow Sleep | Oura help pages state both platforms and stages (web, Oct 2026). Not run on a device. | Oura syncs when its app opens; Health Connect fields may lag Apple Health |
| **Garmin** (Connect app) | Yes: sleep with stages since Garmin Connect iOS 4.71 | Announced for Health Connect (mid-2025); **not confirmed** which fields | Apple Health yes; Health Connect unconfirmed | Heart rate yes to Apple Health; HRV status is Garmin's own metric and is **not** written as HealthKit HRV | Garmin Connect → Settings → Apple Health, turn on Sleep | Garmin release notes and support forum (web). Health Connect support **unverified**. | Only nights synced from the watch to Garmin Connect appear |
| **Fitbit / Google Pixel Watch** | **No** native Apple Health sync (third-party bridge apps exist; not supported here) | Yes: the Fitbit app (and Pixel Watch) write sleep sessions with stages to Health Connect | Health Connect yes | Heart rate to Health Connect yes; HRV is in Fitbit's app, not Health Connect | Fitbit app → Health Connect → allow Sleep and Heart rate | Google Health Connect developer docs and Fitbit help (web). Not run on a device. | iPhone users with a Fitbit are not covered; the Fitbit Web API partner programme is closing to new apps (reconnection deadline 30 Oct 2026), another reason not to build a direct integration |
| **Samsung Galaxy Watch** (Samsung Health) | No | Yes: sleep incl. stages since Samsung Health 6.22.5, Android only | Yes | Heart rate yes; HRV not written | Samsung Health → Settings → Health Connect, allow Sleep | Samsung Health release notes (web). Not run on a device. | Android only |
| **WHOOP** (4.0 / MG) | Yes, sleep sessions | Yes, sleep sessions | **Reportedly not**: community reports say WHOOP writes the session without stage detail; unconfirmed either way | WHOOP writes heart rate; HRV to Apple Health is reported inconsistently | WHOOP app → More → Integrations → Apple Health / Health Connect | WHOOP support page lists both platforms; stage behaviour from community reports only. **Unverified.** | Nights appear as asleep without stages if the report holds; the app shows that honestly as "stage not given" |
| **Google Fit** | n/a | Being retired in favour of Health Connect | n/a | n/a | Use Health Connect | Google announcements | Not supported as a source |
| **Any other** watch or ring that writes sleep to the platform | as it writes | as it writes | as it writes | as it writes | Allow Sleep in that app's platform settings | Untested | The app shows the source name the platform gives, so the member can tell which device recorded a night |

Direct vendor APIs the app deliberately does **not** use: Oura Cloud API (OAuth, cloud-to-cloud, needs vendor
app approval), Garmin Health API (partner approval), Fitbit Web API (closing), WHOOP API (OAuth, partner terms),
Samsung Health SDK (partner programme). Each would mean the member's sleep passing through our server from a third
party, a second consent, and ongoing vendor review. The platform bridge covers every one of them on at least one
phone OS without any of that, so the honest answer to "do you support X" is: if X writes to Apple Health or Health
Connect, yes.

## 3. Automatic sync: what works, what is blocked

| Behaviour | Status | Where |
|---|---|---|
| Import recent nights on first connect (14 days) | Built | `SleepSourceCard` → `readRecentSleep(14)` → `importSleepAction` |
| Refresh when the app opens or comes back to the foreground, if the last sync is older than 30 minutes | Built (in the phone app only) | `SleepSourceCard` (`visibilitychange`) |
| Pull-to-refresh on the Sleep hub (phone app only) | Built | `components/platform/pull-to-refresh.tsx` |
| Sync now button | Built | `SleepSourceCard` |
| Last successful sync time, device and data source | Built, from `sleep_import_runs` and the connected platform on the profile | hub card, settings |
| Fill in overnight measurements for nights imported before the vitals columns existed | Built | import action (`updated` counter) |
| Revoked permission | Built: Android reports the denied types and the card says so; iOS returns no rows, so the card says nothing new was found and points to Settings → Health | `native-sleep.ts`, `SleepSourceCard` |
| Disconnect, optionally removing imported nights | Built | settings → Connected devices |
| **Background sync while the app is closed** | **Not built, blocked**: `@capgo/capacitor-health` 8.11.4 has no observer-query or background-delivery API, and Capacitor web code does not run when the app is closed. It needs a small native plugin: on iOS `HKObserverQuery` + `enableBackgroundDelivery` with the `healthkit.background-delivery` entitlement (best effort; iOS batches and delays wake-ups); on Android a WorkManager periodic job reading Health Connect's changes API. Either must then post to the server with the member's session, which means keeping a refresh token in the native keychain. | Design only; see `docs/SLEEP_PLAN.md` §7 |

Until background sync exists, "open the app in the morning and the night is there" holds as: open the app, the card
syncs within a second or two (the plugin reads locally; the import is one server call), then the night is there.

## 4. Privacy notes

- Reads happen on the phone; only the derived session (times, stages, per-night averages) is sent to our server, never
  raw heart-rate samples.
- Every row is owner-only under RLS; the AI coach sees figures only after the member's separate AI data consent,
  and the summary labels them as the device's readings.
- The phone's health records are never written or deleted by the app.
