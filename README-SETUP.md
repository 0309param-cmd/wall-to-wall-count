# Setup & Deployment Guide

This app runs on Firebase's free Spark plan using **Realtime Database** (not Firestore —
Firestore now requires a linked billing card even for free usage; Realtime Database does not).
Follow these steps in order.

---

## Step 1 — Create a Firebase Project

1. Go to https://console.firebase.google.com and sign in with any Google account.
2. Click **Add project**, give it a name (e.g. `wall-to-wall-count`), finish the wizard.

---

## Step 2 — Enable Authentication

1. In the left menu, click **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Email/Password**.

---

## Step 3 — Enable Realtime Database

1. In the left menu, click **Build → Realtime Database → Create Database**.
2. Choose a location, click **Next**.
3. Choose **Start in locked mode** (we'll paste in the real rules in Step 6). Click **Enable**.
4. Note the **database URL** shown at the top of the page — looks like
   `https://wall-to-wall-count-default-rtdb.firebaseio.com` (or with a region in the middle).
   You'll need this in Step 4.

*(`firestore.rules` in this folder is unused/deprecated — ignore it. `database.rules.json` is the real one.)*

---

## Step 4 — Get Your Firebase Config

1. In the left menu, click the ⚙️ gear icon → **Project settings**.
2. Scroll to **Your apps**, click the **</> (Web)** icon to register a web app.
3. Give it any nickname, click **Register app**.
4. Copy the `firebaseConfig` values shown (`apiKey`, `authDomain`, `projectId`, etc.).
5. Open **firebase-config.js** in this folder and paste your real values in, replacing the placeholders —
   including `databaseURL` from Step 3.4 above.

---

## Step 5 — Add Your Users

Each PDA user needs a login. Firebase's Email/Password auth needs an email-style address,
so usernames are created as `username@warehouse.local` behind the scenes — your users only ever
type the plain username (e.g. `rakesh`) on the login screen; the app adds the rest automatically.

1. In Firebase Console → **Authentication → Users → Add user**.
2. Enter the email as `<username>@warehouse.local` (e.g. `rakesh@warehouse.local`) and set a password.
3. Repeat for all 25 users (add one more with a name like `supervisor1@warehouse.local` for Dashboard access).

---

## Step 6 — Set Realtime Database Security Rules

1. In Firebase Console → **Realtime Database → Rules** tab.
2. Delete the existing content and paste in the contents of **database.rules.json** (in this folder).
3. Click **Publish**.

This ensures only your logged-in users can read/write count data, and that submitted lines can
never be edited or deleted after the fact (create-only) — nobody else can access it.

---

## Step 7 — Load Your SKU Master List (3,000 SKUs)

1. Open your SKU Excel sheet. Create/keep 3 columns exactly named: `code`, `description`, `qtyPerBox`.
2. In Excel: **File → Save As → CSV (Comma delimited)**.
3. Open **admin-sku-converter.html** in this folder (double-click it, opens in your browser — no install needed)
   and upload that CSV.
4. Click **Download sku-master.json** — this replaces the placeholder file of the same name.
5. Move the downloaded `sku-master.json` into this project folder, overwriting the sample one.

You'll re-run this step any time the SKU list changes — just re-upload the new CSV and redeploy (Step 8).

---

## Step 8 — Deploy (Free Hosting)

You'll need Node.js installed once (free, from nodejs.org). Then, in a terminal, inside this folder:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
```
When `firebase init` asks questions, answer:
- "What do you want to use as your public directory?" → type `.` (this current folder)
- "Configure as a single-page app?" → `No`
- "Set up automatic builds with GitHub?" → `No`
- If it asks to overwrite `index.html` → `No`

Then deploy:
```bash
firebase deploy --only hosting
```

You'll get a live URL like `https://wall-to-wall-count.web.app` — that's the link every PDA opens in Chrome.

**To push an update later** (bug fix, new SKU list, etc.), just run `firebase deploy --only hosting` again —
every device gets the update the next time they open/refresh the app.

---

## Step 9 — Install on Each PDA

The PDA app (`index.html`) has only **Count** and **Verify** tabs — the Dashboard is a
separate page (`dashboard.html`) meant for a supervisor's PC or tablet, not the handheld PDAs.

1. On each PDA, open the deployed URL (e.g. `https://wall-to-wall-count.web.app`) in Chrome.
2. Tap Chrome's menu (⋮) → **Add to Home screen**.
3. From then on, users tap the home-screen icon like a normal app — full screen, no browser bar.
4. Log in with the username/password created in Step 5.

## Step 10 — Open the Dashboard (Supervisor)

On a PC, laptop, or tablet, open `https://wall-to-wall-count.web.app/dashboard.html` and log in
with a supervisor account (created the same way as Step 5). This shows the live, auto-updating
table of every submission with filters and the Export to Excel button — it's not on the PDAs.

---

## Notes

- **Cost:** Realtime Database's free Spark quota is 1 GB storage and 10 GB of downloads per month.
  At 25 users and normal warehouse counting volume, you'll stay well within this — genuinely $0,
  no billing account, no card needed anywhere in this setup.
- **Offline scanning:** if a PDA loses signal mid-count, the app retries the write automatically
  once the connection returns during the same session.
- **Re-counts:** the same Pallet ID/Location can be submitted multiple times; nothing is overwritten
  (the rules enforce create-only), so the Dashboard and Verify tabs show every submission for full
  audit history.
