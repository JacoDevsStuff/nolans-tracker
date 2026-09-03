# Nolans Install Tracker — Deployment Guide

Follow these steps once and the app will be live at a permanent URL
that every consultant, co-ordinator, and the developer can open in
any browser. No Claude usage once it's deployed.

---

## What you need (both are free)

| Service | What it does | Sign up |
|---------|-------------|---------|
| **Supabase** | Stores all project data, pushes live updates to every tab | supabase.com |
| **Vercel** | Hosts the web app and gives you the URL | vercel.com |

---

## Step 1 — Set up Supabase (5 minutes)

1. Go to **supabase.com** → sign up → **New project**
2. Give it a name (e.g. "nolans-tracker"), pick a region close to you
   (Europe West is fine), set any database password, click **Create project**
3. Wait ~1 minute for the project to spin up
4. In the left sidebar click **SQL Editor** → **New query**
5. Open the file `supabase-setup.sql` from this folder, copy the entire
   contents, paste into the editor, and click **Run**
   - You should see "Success. No rows returned"
6. In the left sidebar click **Project Settings** → **API**
7. Copy two values — you'll need them in Step 3:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (long string under "Project API keys")

---

## Step 2 — Deploy to Vercel (5 minutes)

### Option A — Drag and drop (easiest, no GitHub needed)

1. Install Node.js from **nodejs.org** if you don't have it
   (just download and run the installer — click Next through everything)
2. Open a terminal / command prompt in this folder:
   - Windows: hold Shift, right-click the folder → "Open PowerShell window here"
   - Mac: right-click the folder → "New Terminal at Folder"
3. Run: `npm install`
4. Run: `npm run build`
   - This creates a `dist/` folder
5. Go to **vercel.com** → sign up → on the dashboard click **Add New → Project**
6. Scroll down and click **"Deploy from file upload"** (or drag the `dist` folder
   directly onto the Vercel dashboard if that option appears)
7. Upload the entire `dist` folder

### Option B — Vercel CLI (slightly faster for future updates)

```bash
npm install
npx vercel --prod
```
Follow the prompts — log in, create a new project, accept all defaults.

---

## Step 3 — Add your Supabase keys to Vercel (2 minutes)

After deploying you'll land on your project page in Vercel.

1. Click **Settings** → **Environment Variables**
2. Add these two variables:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | Your Supabase Project URL from Step 1 |
| `VITE_SUPABASE_ANON_KEY` | Your anon public key from Step 1 |

3. Click **Save**
4. Go to **Deployments** → click the three dots on the latest deployment
   → **Redeploy** (this bakes the env vars in)

Your app is now live at the URL Vercel gave you (e.g. `nolans-tracker.vercel.app`).
Share that URL with your team.

---

## Updating the app later

When you want to add a feature:

1. Make changes to the code
2. Run `npm run build`
3. Redeploy:
   - Option A: upload the new `dist` folder to Vercel again
   - Option B: run `npx vercel --prod` again

---

## PINs (change these in `src/App.jsx` near the top)

| PIN | Name | Access |
|-----|------|--------|
| 0001 | Jaco | Consultant — view + post notes |
| 0002 | James | Consultant — view + post notes |
| 0003 | Trent | Consultant — view + post notes |
| 0004 | Theo | Consultant — view + post notes |
| 0005 | Co-ordinator | Dates, status, material, snags, scheduling |
| 2222 | Developer | Full access including creating/deleting projects |

To change a PIN: open `src/App.jsx`, find the `USERS` object near the
top, edit the PIN numbers, save, rebuild and redeploy.

---

## How live updates work

Supabase uses PostgreSQL realtime. When the co-ordinator drags a job
onto the calendar, every other open tab (consultants' phones, your
laptop) sees the update within about 1 second automatically — no
manual refresh needed.

---

## Troubleshooting

**Blank screen after deploying**
→ The env vars aren't set. Double-check Step 3 and redeploy.

**"Missing Supabase env vars" in the browser console**
→ Same issue — env vars not saved or not redeployed after saving.

**Data not saving**
→ Check that you ran the SQL in Step 1 and that Row Level Security
policy was created (you should see it in Supabase → Authentication → Policies).

**Want a custom domain** (e.g. `tracker.nolans.co.za`)
→ Vercel → Settings → Domains → add your domain and follow their DNS instructions.
