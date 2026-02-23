# Deploy Health Tracker (free)

Get a URL like `https://health-tracker-xxx.vercel.app` you can open on your phone or any device. No installation required—everything happens in the browser.

---

## Option A: Deploy from Vercel website (no Terminal/CLI)

### Step 1: Put your code on GitHub

1. Go to **https://github.com** and sign in (or create a free account).
2. Click the **+** (top right) → **New repository**.
3. Name it `health-tracker`, leave everything else default, click **Create repository**.
4. On your Mac, open **Terminal** and run:

```bash
cd /Users/frank/health-tracker
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/health-tracker.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. If it asks for a password, use a **Personal Access Token** instead (GitHub → Settings → Developer settings → Personal access tokens → Generate new token).

---

### Step 2: Connect Vercel to GitHub

1. Go to **https://vercel.com** and sign in (e.g. with Apple ID or GitHub).
2. Click **Add New…** → **Project**.
3. If asked to connect GitHub, click **Connect** and approve access.
4. In the list of repositories, find **health-tracker** and click **Import**.

---

### Step 3: Deploy

1. Leave all settings as they are (Vercel detects Next.js automatically).
2. Click **Deploy**.
3. Wait 1–2 minutes for the build to finish.
4. Click the **Visit** link. That’s your live app URL.

---

### Step 4: Use it on your phone

1. Open that URL in Safari on your iPhone.
2. Tap the Share button → **Add to Home Screen**.
3. It will appear like an app on your home screen.

---

### Updating the app later

1. Make your changes in the project.
2. In Terminal:
   ```bash
   cd /Users/frank/health-tracker
   git add .
   git commit -m "Update"
   git push
   ```
3. Vercel will automatically redeploy (usually within a minute).

---

## Option B: Deploy with Vercel CLI (if you can install it)

1. Install: `npm install -g vercel`
2. Log in: `vercel login`
3. Deploy: `cd /Users/frank/health-tracker` then `vercel`
4. Follow the prompts. You’ll get a URL when it’s done.

---

## Optional: Cross-device sync (Supabase)

To sync data across devices (e.g. iPhone and desktop):

1. Create a free project at **https://supabase.com**
2. In Supabase SQL Editor, run the contents of `supabase/schema.sql`
3. In Supabase → Authentication → URL Configuration, add your redirect URL: `https://your-app.vercel.app/auth/callback` (and `http://localhost:3000/auth/callback` for local dev)
4. In Vercel → Project → Settings → Environment Variables, add:
   - `NEXT_PUBLIC_SUPABASE_URL` (from Supabase project settings)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from Supabase API keys)
5. Redeploy. Sign in via the header to enable sync.

Without Supabase, the app works offline-only (local storage per device).

---

## Notes

- **Data is stored on each device** (IndexedDB). Your phone and laptop each have their own checklist. With Supabase, data syncs when signed in.
- **Free tier** on Vercel is enough for personal use.
- If you hit any step that doesn’t work, check that Git is installed (`git --version`) and that you’re in the right folder (`/Users/frank/health-tracker`).
