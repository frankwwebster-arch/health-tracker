# Peloton Setup – Step-by-Step Guide

This guide walks you through connecting your Peloton account so the health tracker can auto-fill your workout minutes.

**Important:** For any terminal command in this guide, you must be in the project folder first. Run:

```bash
cd health-tracker
```

(Or `cd ~/health-tracker` if that’s where your project lives.)

**How to restart the app** (you’ll need this whenever you change `.env.local`):

1. In the terminal where the app is running, press **Ctrl + C** to stop it
2. Run: `cd health-tracker` then `npm run dev`

---

## Part 1: Generate an Encryption Key

You need a secret key so your Peloton password can be stored safely.

### Step 1.1: Open Terminal

- **Mac**: Press `Cmd + Space`, type `Terminal`, press Enter
- **Windows**: Press `Win + R`, type `cmd`, press Enter

### Step 1.2: Run This Command

```bash
openssl rand -base64 32
```

### Step 1.3: Copy the Output

You’ll see a long random string like:

```
K7x9mP2vQ4nR8sT1wY3zA5bC6dE0fG2hI4jK8lM1nO3pQ=
```

**Copy the whole thing** (you’ll paste it in Part 3). Keep it secret and don’t change it later, or saved Peloton credentials won’t work anymore.

---

## Part 2: Add the Peloton Table in Supabase

### Step 2.1: Open Supabase

1. Go to [supabase.com](https://supabase.com) and sign in
2. Open your health tracker project

### Step 2.2: Open the SQL Editor

1. In the left sidebar, click **SQL Editor**
2. Click **New query**

### Step 2.3: Paste and Run the Peloton SQL

1. Open the file `supabase/schema.sql` in your project
2. Find the section that starts with `-- Peloton connection credentials`
3. Copy everything from that line down to the end of the file
4. Paste it into the Supabase SQL Editor
5. Click **Run** (or press Cmd/Ctrl + Enter)

You should see something like “Success. No rows returned.”

---

## Part 3: Add Environment Variables

### Step 3.1: Create or Edit `.env.local`

1. In your project folder, look for a file named `.env.local`
2. If it doesn’t exist, create a new file and name it `.env.local`
3. Open it in your editor

### Step 3.2: Add These Lines

Add or update these lines (replace the placeholder with your real key from Part 1):

```
# Peloton encryption key (paste the output from Part 1)
PELOTON_CREDENTIALS_ENCRYPTION_KEY=K7x9mP2vQ4nR8sT1wY3zA5bC6dE0fG2hI4jK8lM1nO3pQ=
```

If you already have Supabase vars in `.env.local`, just add this block below them. Don’t remove anything that’s already there.

### Step 3.3: Save the File

Save `.env.local` and close it.

---

## Part 4: Restart the App

### Step 4.1: Stop the Dev Server

If the app is running, stop it:

- In the terminal where `npm run dev` is running, press `Ctrl + C`

### Step 4.2: Start It Again

Make sure you’re in the project folder, then run:

```bash
cd health-tracker
npm run dev
```

Environment variables are only loaded when the app starts, so a restart is required.

---

## Part 5: Connect Peloton in the App

### Step 5.1: Sign In

1. Open the app in your browser (usually [http://localhost:3000](http://localhost:3000))
2. Sign in (if you use Supabase auth)

### Step 5.2: Open Settings

1. Go to **Settings** (from the menu or header)
2. Scroll to the **Peloton** section

### Step 5.3: Enter Your Peloton Details

1. Enter your **Peloton email** (the one you use to log into the Peloton app)
2. Enter your **Peloton password**
3. Click **Save & connect**

### Step 5.4: Check the Result

- If it works, you’ll see something like “Connected as jo***”
- If it fails, you’ll see an error message — double-check your email and password

### Step 5.5: Test the Connection (Optional)

Click **Test connection** to confirm everything is working.

---

## Part 6: Use Peloton in the App

### Auto-Sync

When you open the **Today** page and the workout field is empty, the app will try to fetch your Peloton workouts for that date.

### Manual Sync

1. Go to **Today**
2. In the **Movement** section, find the **Workout** card
3. Click **Sync from Peloton**
4. Your workouts for that date will appear (e.g. “Cycling: 20 min”, “Strength: 15 min”)

---

## Troubleshooting

| Problem | What to try |
|--------|-------------|
| “Peloton encryption key not configured” | Add `PELOTON_CREDENTIALS_ENCRYPTION_KEY` to `.env.local` and restart the app |
| “Sign in to connect Peloton” | Sign in to the app first, then go to Settings → Peloton |
| “Peloton login failed” | Check your Peloton email and password; try logging in at [onepeloton.com](https://www.onepeloton.com) |
| “No workouts for this date” | Peloton may not have workouts for that date, or they may be in a different timezone |
| Supabase SQL error | Make sure you ran the Peloton section of `schema.sql` (from the Peloton comment to the end) |

---

## Quick reference: Restart the app

1. In the terminal where the app is running, press **Ctrl + C**
2. Run: `cd health-tracker`
3. Run: `npm run dev`

---

## Deploying to Production (e.g. Vercel)

If you deploy the app:

1. In your hosting dashboard (e.g. Vercel), open **Settings → Environment Variables**
2. Add `PELOTON_CREDENTIALS_ENCRYPTION_KEY` with the same value you used locally
3. Redeploy the app

The Peloton table in Supabase is shared across environments, so you don’t need to run the SQL again.
