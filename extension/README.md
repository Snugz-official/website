# Snugz Chrome extension

## 1. One-time Supabase setup
1. Supabase → **SQL Editor** → New query → paste everything from `../supabase/schema.sql` → **Run**.
2. Supabase → **Authentication → Sign In / Providers → Email**:
   - For testing, turn **"Confirm email" off** so new accounts can log in straight away.
   - Turn it back **on** before launch (users then get a confirmation email first).
3. Supabase → **Authentication → URL Configuration**: set Site URL to `http://localhost:5500` for now (later `https://snugz.in`).

## 2. Load the extension in Chrome (developer mode)
1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** → choose this `extension` folder
4. Pin Snugz from the puzzle-piece menu

## 3. Try it
1. Start the website preview (port 5500) and create an account on `onboarding.html`, finishing all steps.
2. Click the Snugz icon in Chrome → log in with the same email and password.
3. Open a shirt or jeans product on Myntra or Flipkart → open its **Size Chart** → the Snugz card shows your size, and the matching size button gets a purple ring.

## Files
| File | What it does |
|---|---|
| `manifest.json` | Chrome settings: runs on myntra.com and flipkart.com, talks only to your Supabase project |
| `config.js` | Supabase URL + publishable key, website URL |
| `snugz-api.js` | Log in / read fit profile (same file as `website/js/snugz-api.js`, keep them identical) |
| `popup.*` | The toolbar popup: log in, see your fit, refresh, log out |
| `content.js` | Runs on product pages: finds the size chart, shows the card |
| `match.js` | The size-picking logic (chest, shoulder, sleeve / waist, length + fit preference) |
| `test/mock-product.html` | Fake product page for testing without Myntra/Flipkart |

## Known limits (v0.1)
- Reads size charts that are real tables on the page. Some Flipkart products show the size chart as an **image**, which can't be read. Snugz then asks you to check the chart manually.
- If Myntra or Flipkart change their page design, `content.js` may need small updates.
- Google sign-in is not set up yet (email + password only).
