# Vercel Environment Variables – Step-by-Step

## 1. Open Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click your **health-tracker** project

## 2. Go to Environment Variables

1. Click **Settings** (top tab)
2. In the left sidebar, click **Environment Variables**

## 3. Add Each Variable

For each row below, click **Add New** (or **Add**), then:

- **Key**: paste the name exactly as shown
- **Value**: copy from your `.env.local` file (the part after the `=`)

---

### Variable 1

**Key** (paste exactly):
```
NEXT_PUBLIC_SUPABASE_URL
```

**Value**: Copy from `.env.local` — the part after `NEXT_PUBLIC_SUPABASE_URL=`

---

### Variable 2

**Key** (paste exactly):
```
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**Value**: Copy from `.env.local` — the part after `NEXT_PUBLIC_SUPABASE_ANON_KEY=`

---

### Variable 3

**Key** (paste exactly):
```
PELOTON_CREDENTIALS_ENCRYPTION_KEY
```

**Value**: Copy from `.env.local` — the part after `PELOTON_CREDENTIALS_ENCRYPTION_KEY=`

---

## 4. Save

- Click **Save** after each variable
- For "Environment", leave all three checked (Production, Preview, Development) or at least check **Production**

## 5. Redeploy

After adding variables:

1. Go to the **Deployments** tab
2. Click the **⋯** (three dots) on the latest deployment
3. Click **Redeploy**

Or: push a new commit to trigger a fresh deploy.
