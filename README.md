# Health Tracker

Personal daily health tick-box tracker. Local-first, no backend, no auth. Tracks medication, lunch, water, and light movement with optional reminders.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app redirects to `/today`.

## Features

- **Today (`/today`)**: Tick boxes for medication (Dex #1–3, Bupropion), lunch, afternoon snack, water (goal + quick add/undo), workout, walk. Daily summary with calm, non-judgmental copy.
- **Settings (`/settings`)**: Enable/disable reminders, weekday-only, water goal and interval, lunch and medication times, test notification, reset today.
- **Reminders**: Client-side scheduler (every 60s). Optional browser notifications; in-app banners as fallback. Weekdays only, quiet hours 20:00–07:00, 45‑min cooldown. Medication and lunch at set times; water every N minutes in configured window. Max 2 banners visible; “More reminders (n)” for the rest. Actions: Mark as taken, Snooze 30/60 min; water banner has +250 ml quick action.
- **Persistence**: IndexedDB via `idb-keyval`. All data stays on device. Works offline after first load.

## Tech

- Next.js 14 (App Router), TypeScript, Tailwind CSS
- `idb-keyval` for IndexedDB
- No backend, no auth, no analytics

## Build

```bash
npm run build
npm start
```
