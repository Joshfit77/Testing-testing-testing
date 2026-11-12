# Body Scan (Pro)

Built on `claude/nine-features` as Stage 6. Route: My Progress → Body Scan (`/progress/body-scan`). It is separate from ordinary progress photos (its own tables and its own private bucket) and from the muscle map.

## What it does

- **Guided capture** (`/progress/body-scan/new`):
  - **Preparation:** a set-up screen covering lighting, distance and framing, pose and consistency (`SCAN_GUIDANCE` in `src/lib/domain/body-scan.ts`).
  - **Front and side photos are required, the rear photo is optional.** Each is taken with the live camera (`getUserMedia`) or uploaded.
  - **Camera aids:** a head-to-feet framing outline, an optional 10-second timer, a front/back camera switch, and a faint overlay of the previous scan's photo for the same view to help match the pose.
  - **Level indicator:** shown where the phone reports its orientation.
  - **Review:** every photo can be retaken before it's used.
  - **Measurements (optional):** body weight plus waist, chest, hips, arm and thigh, in the member's units.
- **Saving:**
  - Photos are resized to 1,600 px and re-encoded on the device, which also strips EXIF/location data.
  - They're uploaded to `body-scans/<uid>/<scan id>/<view>-<uuid>.jpg`, then the server checks every path and file before writing rows.
  - The scan id is created on the device, so a retry saves once.
  - Measurements go into the normal measurement history (`measurement_entries`) and the weight into `weight_entries`, so the existing progress pages see them too.
- **Dashboard:** scan history with thumbnails, a side-by-side comparison of any two scans (front, side or rear) with the time between them and the changes in weight and measurements, and 12-month charts of body weight and measurements.

## Body fat

Body Scan does **not** estimate body fat. An ordinary phone camera can't measure body fat or visceral fat, and the app never presents a visual guess as a measurement.

The vendor evaluation in `docs/APP_AUDIT.md` §9 (2026-10-22, not re-verified since) found:
- **Peer-reviewed validation against DXA:** only one option, Prism Labs. It uses a 360° video rather than front and side photos, and costs about $500 a month and up.
- **Bodygram, 3DLOOK and Spren:** vendor claims only.
- **Regulatory clearance:** none of them had any.

Nothing has been bought. Adding an estimate later would need all of the following:
1. Your approval and a data-processing agreement.
2. A separate consent that names the vendor.
3. The estimate shown with its documented error range and limitations, and labelled as a wellness estimate, not a medical measurement.
4. Never any visceral-fat claim.

## Privacy and security

| Requirement | How it's met |
| --- | --- |
| Explicit consent | A consent card before the first scan, recorded with its time in `profiles.body_scan_consent_at`. The database refuses uploads and scan rows without it (`can_add_body_scan()`). |
| Private storage | Private `body-scans` bucket (images only, 8 MB). Owner-only storage policies; no admin access. |
| Authenticated access | Images are shown through signed links that expire after 10 minutes, created with the member's own session. |
| Unauthorized access | Row-level security on `body_scans` and `body_scan_photos`. Path checks tie each photo to its owner's folder and its scan. Tested with another member and an admin (`tests/integration/body-scans.test.ts`). |
| Retention and deletion | Delete any scan (rows and files). "Withdraw consent and delete all scans" removes every scan and file and clears the consent. Members who downgrade can still view, export and delete. |
| Account deletion | The bucket is in `USER_STORAGE_BUCKETS` (files removed) and the tables cascade with the user. |
| Data export | Rows are in the export; photos are included as time-limited download links. |
| Third-party AI | Photos are never sent to the AI coach or any other service. A future provider would need its own, separate consent. |
| Plan | New scans need Pro, checked on the server (`canUseBodyScan`) and in the database (`has_plan('pro')`). |
| Abuse limits | 200 scans per member (a trigger under a per-member lock); 8 MB per file. |

## Tests

- **Unit** (`tests/unit/body-scan.test.ts`):
  - plan rule;
  - path ownership checks, including traversal and other scans or members;
  - comparison maths;
  - tilt;
  - the guidance never mentions body fat.
- **Database and storage** (`tests/integration/body-scans.test.ts`):
  - no upload or scan before consent, or on Plus;
  - owner-only reads, downloads and deletes; not even an admin can access scans;
  - one photo per view;
  - paths must match the scan;
  - deletion works after a downgrade or withdrawn consent;
  - account deletion.
- **Browser** (`e2e/body-scan.spec.ts`):
  - Plus is locked;
  - Pro consent;
  - upload with retake;
  - skipping the rear photo;
  - measurements;
  - a second scan with Chromium's fake camera, checking that the previous-scan overlay loads;
  - images actually load;
  - comparison with measurement changes;
  - delete one scan, then withdraw and delete all.

## Limitations

- **Native camera not tested on a phone.** Camera capture in the native iPhone and Android apps (WKWebView / Android WebView `getUserMedia`) and the level indicator haven't been tested on a physical phone.
- **Browser tests:** they use a fake camera and uploaded images.
- **No automatic retention period:** scans stay until the member deletes them.
- **No body-fat estimate:** see above.
