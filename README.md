# Daily Content App

A password-gated page with any number of admin-editable sections, each showing different
content depending on the day of the week or a fixed-length rotating cycle — plus a
"Nighttime" mode that fully replaces the page after 10 PM to encourage winding down.

## What's in here

- `index.html` — the public page: password gate → section tabs → today's content, or the
  Nighttime takeover if it's late
- `admin.html` + `js/admin.js` — the editor (sign-in required): add/rename/reorder/delete
  sections, edit every day's content, edit the Nighttime checklist and questions
- `js/schedule.js` — the date logic (which weekday, which cycle day, is it nighttime)
- `js/colors.js` — the fully automatic color logic (see below)
- `js/parts.js` — shared rendering for the three content types
- `js/firebase-config.js` — **you fill this in** with your Firebase project's keys
- `firestore.rules` — security rules to paste into your Firebase project
- `css/styles.css` — all styling (light silver background, Times New Roman throughout)

No build step — plain HTML/JS, works straight from GitHub Pages, Firebase Hosting, or any static host.

## How it's structured

**Sections** are fully generic and admin-managed — add as many as you want, rename them,
reorder them (↑/↓ in admin), or delete them. Each section is one of three types:
- **Day-of-week**: different content for Monday–Sunday.
- **Cycle**: a fixed-length rotation (e.g. 15 days) starting from a date you set as "Day 1,"
  repeating forever after.
- **Static**: the same content all the time — not linked to any date. Useful for something
  that doesn't need to change day to day.

On the public page, section names appear as **tabs at the top** — visitors pick one section
to view at a time, rather than scrolling through all of them stacked.

**Each day (or cycle day) holds any number of "parts,"** and each part is one of five types,
chosen per-part in admin:
- **Plain text** — a line or paragraph.
- **Heading** — a single line, shown large and bold, for breaking up a page.
- **Divider** — a plain visual rule with no content, for separating groups of parts.
- **Checklist** — a list of items with checkboxes; visitors can check them off. Completing
  every item triggers a confetti burst, and each check/uncheck is logged to Firestore by date
  for later review in admin (see "Reviewing past data" below).
- **Dropdown questions** — a list of questions, each with its own set of answer options.

If a day has more than one part, visitors move between them by tapping/clicking the left or
right edge of the screen (shown as small tick marks at the bottom).

**Nighttime** is separate from the section system. After 10 PM local time (for the visitor),
the entire page collapses to just this: a checklist, then a set of dropdown questions —
nothing else. It always has exactly these two parts; only their *contents* are editable.

**Color is fully automatic for day-of-week and cycle sections, and for Nighttime** — not
something you set day-by-day:
- Day-of-week sections default to rotating Monday→Sunday through blue, purple, pink, blue,
  purple, pink, blue. Admin can switch any day-of-week section to a **Rainbow** style instead —
  7 evenly spaced colors starting at red on Monday, the same idea as the cycle sweep but fixed
  to a 7-day week.
- Cycle sections sweep the full color spectrum starting at red on Day 1, evenly spaced across
  however many days are in the cycle, wrapping back to red when it repeats.
- Nighttime is always a dark magenta — and the password gate itself tints magenta too, if it's
  already past 10 PM when someone loads the page.

**Static sections are the one place color IS editable** — since they're not tied to a day or
cycle position, admin has a color picker for each one (any hex color), so you can set and
change it freely without it needing to mean anything about the calendar.

**Confetti**: finishing every item in a checklist triggers a confetti burst — blue/purple/pink
during the day, magenta at night. It's purely a visual moment; checkbox states aren't saved
per se (they don't persist for the *visitor* between visits) — but see History below.

## Reviewing past data

Every checklist check and dropdown answer on the public page is logged to Firestore by date.
In admin, the **"Review past data"** panel has two buttons:
- **Load history** — fetches everything recorded so far and shows it in a table (date, section,
  item/question, response), and populates a year dropdown based on what's actually there.
  Nothing loads automatically; you choose when to look.
- **Export to Excel (.xlsx)** — pick a year from the dropdown, then export just that year as its
  own workbook (filename like `daily-content-history-2026.xlsx`). Each workbook has **one tab
  per month** within that year (named "08", "09", etc.), and within each month's tab, entries
  are grouped into a labeled block per date — a "Date: ..." header, a column header row, that
  date's responses, then a blank row before the next date. A different year is a genuinely
  different file — exporting 2027 later won't touch or reference the 2026 file at all. Runs
  entirely in your browser via the free SheetJS library — no server, no extra cost.

This is **on-demand, not automatic** — nothing updates a file for you overnight. If you later
want a file (or Google Sheet) that updates itself daily with zero clicks, that's a real step up
in infrastructure: it needs Firebase Cloud Functions, which requires upgrading from the free
Spark plan to the pay-as-you-go Blaze plan, plus either cloud storage (for a static Excel file)
or a Google Sheets API integration (for something that updates in place). Worth doing later if
the on-demand export starts to feel like a chore — just a bigger lift than what's here now.

**Security note on history**: recording a response happens from the public page, without the
visitor being signed in — there's no per-visitor account system in this app. That means the
Firestore rule allowing writes to the `responses` collection is open (`allow write: if true`),
the same tradeoff already made for the password gate. Reading history back is still restricted
to your signed-in admin account.

## One-time setup

### 1. Create a Firebase project
Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.

### 2. Add a Web App
**Project settings → General → Your apps → Add app → Web.**
Copy the `firebaseConfig` object into `js/firebase-config.js`, replacing the placeholders.

### 3. Enable Firestore
**Build → Firestore Database → Create database** (production mode is fine).
Then in the **Rules** tab, paste in `firestore.rules` and **Publish**.

### 4. Enable Email/Password sign-in
**Build → Authentication → Sign-in method → Email/Password → Enable.**
Then **Users → Add user** with your own email and a strong password — this is the only
account that can sign in to `admin.html`. There's no public sign-up.

### 5. Set up your content
Deploy (next step), open `admin.html`, sign in, then:
- Set the gate password
- Fill in the Nighttime checklist and questions
- Add your sections and their content — for any cycle section, set its **start date** (Day 1)

### 6. Deploy
Push this folder to GitHub and enable **GitHub Pages** (Settings → Pages), or connect it to
**Firebase Hosting** with `firebase deploy` if you'd rather keep everything in one place.

## A note on the password gate

This is a **casual privacy gate**, not strong security. The password is stored in Firestore
and checked in the visitor's browser, so someone inspecting network traffic or querying
Firestore directly could read it without ever seeing the lock screen. Fine for keeping casual
visitors out, not for protecting sensitive data from someone determined to get in. A Cloud
Function–based check is the upgrade path if that ever matters — happy to build that later.

## Extending it later

- **Add/reorder/delete a section**: all from the admin page, no code changes needed.
- **Add a day to a cycle**: open that section, click "+ Add day" (this also lengthens the
  cycle and shifts its color sweep to match).
- **Add a part**: pick its type (text, checklist, or dropdown) — the editor adapts to match.
