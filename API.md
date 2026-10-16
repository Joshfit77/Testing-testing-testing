# API boundary (web, PWA, native & future native clients)

The web app mostly uses **server actions**, which are CSRF-protected by Next.js origin checks. Domain logic lives in `src/server/services/*`. The same services back a small versioned JSON API under `/api/v1`, so a future fully native iOS/Android client can reuse them.

## Authentication

| Client | How |
| --- | --- |
| Browser / PWA / Capacitor shell | Supabase session cookie. State-changing requests must be same-origin (checked against `Origin` / `Sec-Fetch-Site`). |
| Native client (future) | `Authorization: Bearer <Supabase access token>`, obtained with the Supabase Swift/Kotlin SDK. Row Level Security applies exactly as for the web. |

Errors look like `{ "error": "<code>", "message"?: "<human readable>" }`, with the matching HTTP status. Successful `/api/v1` responses look like `{ "data": ... }`.

## Endpoints

### `GET /api/v1/me`

Returns the user's profile, effective plan, enabled features and monthly AI allowance.

### `GET /api/v1/programs`

Returns published library programs, each with a `locked` flag computed for the caller's plan.

### `GET /api/v1/workouts?before=<ISO date>&limit=<1-100>`

Returns completed workouts, newest first: `id`, `name`, `started_at`, `ended_at`, `total_volume_kg`, `paused_seconds`, `exercise_count`.

### `POST /api/v1/workouts`

Completes a workout. It's idempotent per `clientId`: a retry returns `200` with `alreadyCompleted: true`, and a first save returns `201`.

```json
{
  "clientId": "uuid generated on the device",
  "name": "Full Body A",
  "userProgramId": null,
  "programDayId": null,
  "startedAt": "2026-10-16T17:00:00Z",
  "endedAt": "2026-10-16T18:05:00Z",
  "pausedSeconds": 120,
  "notes": "",
  "exercises": [
    {
      "exerciseId": "uuid",
      "substitutedFromId": null,
      "notes": "",
      "skipped": false,
      "skipReason": null,
      "sets": [{ "reps": 5, "weightKg": 100, "durationSeconds": null, "rpe": 8, "isWarmup": false, "completed": true }]
    }
  ]
}
```

The response is `{ sessionId, volumeKg, records: [{ exerciseId, recordType, value, ... }], alreadyCompleted }`. All weights are in kilograms. Clients convert units for display.

### `POST /api/ai/chat`

```json
{ "conversationId": null, "message": "How should I progress my squat?", "mode": "chat" }
```

`mode: "plan"` (Pro plan) returns a validated plan proposal on `assistantMessage.proposal`. Proposals are saved to the user's programs only after explicit approval; on the web this happens through the approval UI in `/coach`.

Error codes and statuses:

| Code | Status |
| --- | --- |
| `not_configured` | 503 |
| `disabled` | 503 |
| `metering_unavailable` | 503 |
| `not_entitled` | 403 |
| `plan_not_entitled` | 403 |
| `quota` | 429 |
| `rate_limited` | 429 (with `Retry-After`) |
| `provider` | 502 |

### `GET /api/foods/search?q=<query>`

USDA FoodData Central search (Plus and Pro). Values are per 100 g. When food is logged, the server re-fetches its nutrition values by FDC ID.

### `GET /api/account/export`

Downloads all of the user's data as JSON (cookie session).

### `POST /api/stripe/webhook`

For Stripe only. The signature is verified against the raw body, and events are processed idempotently.
