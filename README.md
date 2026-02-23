# Health Tracker

Personal daily health tick-box tracker. Local-first, no backend, no auth. Tracks medication, lunch, water, and light movement with optional reminders.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app redirects to `/today`.

## Features

- **Today (`/today`)**: Tick boxes for medication (Dexamphetamine (3x daily), Bupropion), lunch, afternoon snack, water (goal + quick add/undo), workout, walk. Optional Peloton sync to auto-populate workout minutes. Daily summary with calm, non-judgmental copy.
- **Settings (`/settings`)**: Enable/disable reminders, weekday-only, water goal and interval, lunch and medication times, test notification, reset today.
- **Reminders**: Client-side scheduler (every 60s). Optional browser notifications; in-app banners as fallback. Weekdays only, quiet hours 20:00–07:00, 45‑min cooldown. Medication and lunch at set times; water every N minutes in configured window. Max 2 banners visible; “More reminders (n)” for the rest. Actions: Mark as taken, Snooze 30/60 min; water banner has +250 ml quick action.
- **Persistence**: IndexedDB via `idb-keyval`. All data stays on device. Works offline after first load.

## Tech

- Next.js 14 (App Router), TypeScript, Tailwind CSS
- `idb-keyval` for IndexedDB
- No backend, no auth, no analytics

## Peloton integration (optional)

Connect your Peloton account to auto-populate workout minutes on the Today page.

1. **Settings-based** (recommended): Sign in, go to Settings → Peloton, enter your Peloton email and password, then Save & connect. Requires:
   - `PELOTON_CREDENTIALS_ENCRYPTION_KEY` in your environment (generate with `openssl rand -base64 32`)
   - Run the `peloton_connections` SQL from `supabase/schema.sql` in your Supabase project
2. **Env vars**: Set `PELOTON_USERNAME` and `PELOTON_PASSWORD` in `.env.local` as a fallback (single user, less secure)

Workouts auto-sync when the day is empty, or use "Sync from Peloton" in the Movement section. Multiple workouts per day (e.g. bike + strength) are supported and displayed with individual durations.

## Build

```bash
npm run build
npm start
```
