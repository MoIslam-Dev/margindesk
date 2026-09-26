# MarginDesk

**Quote builder and project profitability tracker for freelancers and small studios.
Local-first, no account, no subscription.**

MarginDesk answers the two questions every small studio gets wrong: *what should I
charge?* and *did this project actually make money?* You build a quote with real
hours, rates, complexity multipliers and rush fees, watch the margin update as you
type, then turn an accepted quote into a project, log the time you actually spent,
and see which clients and projects are worth repeating.

Everything lives in your browser. There is no server to deploy, no account to create
and nothing to pay for.

---

## Table of contents

- [What problem does it solve](#what-problem-does-it-solve)
- [Who it is for](#who-it-is-for)
- [Features](#features)
- [Technology](#technology)
- [Installation](#installation)
- [Running MarginDesk](#running-margindesk)
- [Day-to-day use](#day-to-day-use)
- [Where the data lives](#where-the-data-lives)
- [Backups and restoring](#backups-and-restoring)
- [Printing](#printing)
- [Customising](#customising)
- [Deploying](#deploying)
- [Running the tests](#running-the-tests)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## What problem does it solve

Freelancers and two-to-five person studios usually run invoicing, a spreadsheet and
a notes app at the same time. None of them answer the profitable question:

- A quote is priced from a gut feeling, so the same job is quoted two different ways.
- Nobody notices a quote that quietly drops below the margin the business needs to
  survive.
- Hours are logged *after* invoicing, if at all, so the real hourly rate on a project
  is never known.
- A client who is profitable looks identical to one that consumed the quarter.

MarginDesk keeps quote, project and time entry in one place and makes margin a
number you see while you type, not a surprise at the end of the month.

## Who it is for

- Freelancers and small studios quoting **hourly or hybrid** design, photo, build
  and consulting work.
- Developers and agencies who want a **client-side** tool with no per-seat pricing.
- Anyone who needs their **own** data on their **own** machine, exportable as JSON
  and CSV at any time.

It is deliberately **not** an invoicing or accounting system: no tax engine, no
payment processing, no double-entry bookkeeping, no multi-currency conversion.

## Features

**Dashboard**

- Won-in-the-last-90-days revenue, open pipeline, win rate, blended margin and the
  real hourly rate as headline KPIs.
- Attention list: quotes about to expire, quotes past validity, overdue projects and
  projects running over budget.
- Pipeline breakdown by quote status and a six-month won-revenue chart.
- Recent activity across quotes, projects and time entries.

**Clients**

- Client records with contact details, address, notes and a lifetime summary
  (quotes, pipeline, won to date, win rate, average project margin).
- Search-as-you-type that keeps the caret in the field while the table filters.

**Quotes**

- Line items with description, detail, hours, rate, complexity multiplier, rush
  percentage and estimated direct cost.
- Percentage or fixed discount, tax rate, live subtotal/total, estimated hours,
  effective hourly rate, projected profit and projected margin — recalculated on
  every keystroke.
- A callout when the projected margin falls below your target.
- Status workflow: `draft → sent → accepted / declined`, plus automatic `expired`
  handling and validity dates.
- Auto-generated quote numbers (`FN-2026-007` style) per year from your prefix.
- Printable buyer document, and a one-click **Start project** that carries the hours
  across as the project budget.

**Projects**

- Budget hours, hourly rate, cost per hour and a progress bar from logged time.
- Time entries and direct costs (props, couriers, stock) tracked separately from
  your cost-per-hour rate.
- Real hourly rate, profit and margin per project, updated as you log.
- Status workflow: `active`, `on hold`, `completed`, plus linked quote and client.

**Reports**

- Revenue by month, revenue by client (with share) and project profitability with
  real rates, over a 3-, 6- or 12-month window.
- CSV export of the project table and a printable profitability report.

**Settings and data**

- Business details, owner details, quote prefix, payment terms and bank details —
  all used on the printed quote.
- Currency (18 supported), default hourly rate, cost per hour, rush default, quote
  validity days, tax label and rate, target margin, accent colour.
- JSON backup export/import, CSV export, one-click demo data load and a confirmed
  "delete everything".

**Craft**

- No build step, no bundler, no framework, no runtime dependencies.
- Keyboard-friendly: `Escape` closes modals and the print preview.
- Responsive from a 360px phone to a wide desktop; data tables scroll inside their
  card instead of stretching the page.
- Print stylesheets that hide the app chrome and print the document only.

## Technology

- Plain HTML, CSS and JavaScript (ES2020), served as static files.
- `localStorage` for persistence behind a small store module.
- UMD-style module boundaries so the same files run in the browser *and* under
  `node --test` with no mocking library.
- No dependencies at runtime and none for the tests. Node 18+ is only used to serve
  the folder and run the test suite.

## Installation

```bash
git clone https://github.com/MoIslam-Dev/margindesk.git
cd margindesk
```

That is the whole installation. There is nothing to build.

## Running MarginDesk

**Option 1 — just open the file.** Double-click `index.html`. MarginDesk is a static
app with no fetch calls, so `file://` works. This is the fastest way to try it.

**Option 2 — tiny static server** (recommended, and required if you use the print
dialog on some browsers):

```bash
npm start
# MarginDesk running at http://127.0.0.1:5173
```

```bash
# a different port, and reachable from your phone on the same Wi-Fi
node serve.js 8080 0.0.0.0
```

`serve.js` is a small dependency-free static file server. Any other static host works
just as well.

## Day-to-day use

1. **Clients → + New client.** A contact name or a company name is enough.
2. **Quotes → + New quote.** Pick the client, add line items, set hours and rate,
   and watch the margin. If it drops below target, raise the rate or cut hours
   before you send it.
3. **Save & mark sent.** The buyer gets a printable document; you track the status.
4. **Mark accepted → Start project.** The line-item hours become the project budget
   and the quote stays linked.
5. **Log time and costs as you work.** The progress bar, real hourly rate, profit
   and margin update live.
6. **Reports.** See which clients and projects are actually worth repeating, then
   export CSV for your own bookkeeping.

## Where the data lives

Everything is stored in your browser's `localStorage` under a single key:

```
margindesk.data.v1
```

That has some honest consequences:

- Data is per browser, per device. It does not sync.
- Data is per origin. If you serve the app on port `5173` and then on `8000`, those
  are two separate sets of data.
- Clearing site data, or using a private window, removes it.
- Nothing is ever sent anywhere. There is no network code in this app.

The storage key is shown in the sidebar footer and in **Settings → Your data** so you
always know where your data lives.

## Backups and restoring

**Settings → Export backup (JSON)** writes a complete snapshot: settings, clients,
quotes, projects and time entries.

**Settings → Import backup** reads one back. The file is validated before anything is
written, and a bad file is rejected with an error rather than a half-imported store.

CSV export is available for the project table and is meant for spreadsheets, not for
restoring. JSON is the backup format.

## Printing

- **Quote → Print / Save as PDF** opens a preview of the buyer document: your
  details, the client, every line item, totals, payment terms and signature block.
  The preview's **Print** button uses the browser's own print dialog, and the print
  stylesheet hides the sidebar, topbar and preview chrome.
- **Reports → Print report** does the same for the profitability report.

## Customising

- **Settings → Appearance** sets the accent colour; it is applied as a CSS variable
  to the whole app.
- **Settings → Business details** changes what is printed on quotes. Change it once
  and every future quote and printout uses it.
- **Settings → Money & rates** sets the defaults new quotes and projects start from.
  Each record can still be overridden.
- The palette lives at the top of `assets/css/styles.css` as CSS variables.

## Deploying

It is a static folder, so any static host works:

- **GitHub Pages** — push to the default branch, enable Pages for the repository
  root. Note that Pages serves over `https://`, which is a different origin from
  `file://` and from `localhost`, so it will have its own copy of the data.
- **Netlify / Cloudflare Pages / Vercel** — drop the folder in; no build command,
  no output directory to configure beyond the root.
- **Your own server** — copy the folder into any web root.

Because the data is per origin, decide up front where the app will live. Changing
host later means starting from a fresh (empty) store, so export a backup first.

## Running the tests

```bash
npm test        # or: node --test
```

```
ℹ tests 53
ℹ pass 53
ℹ fail 0
```

The suite covers the calculation engine (line totals, complexity and rush
multipliers, discounts, tax, margin, real hourly rates, local-calendar date maths),
the store (CRUD, status transitions, quote numbering, import/export validation,
storage-unavailable fallback) and the demo data (shape, referential integrity,
status counts).

The same files the browser loads are the files under test: `calc.js`, `store.js` and
`seed.js` are plain CommonJS/UMD modules, and the store is exercised with a
`localStorage` stand-in.

## Project structure

```
margindesk/
├── index.html            app shell, script order, modal and print hosts
├── serve.js              dependency-free static server
├── assets/
│   ├── css/styles.css    design tokens, layout, components, print styles
│   └── js/
│       ├── calc.js       all money maths: totals, margin, dates, reports
│       ├── util.js       DOM helpers, formatting, badges
│       ├── store.js      localStorage persistence and the public data API
│       ├── seed.js       the Fieldnote Studio demo dataset
│       ├── print.js      printable quote and report documents
│       ├── app.js        hash router, shell, modals, toasts, focus handling
│       └── views/        dashboard, clients, quotes, projects, reports, settings
└── test/
    ├── calc.test.js
    ├── store.test.js
    └── seed.test.js
```

`index.html` loads the scripts in dependency order: `calc` → `util` → `store` →
`seed` → `print` → `views` → `app`. There is no bundler, so that order matters.

## Troubleshooting

**The demo data is gone / everything is empty** — data is per origin. If you
switched between `file://`, `localhost:5173` and a deployed URL, each has its own
store. Load the demo again from **Settings → Load demo data**, or import a backup.

**My changes vanished** — a browser extension, private window or "clear site data"
removed the store. Keep exporting backups; that is the only copy.

**A number looks wrong (dates especially)** — MarginDesk stores user-facing dates as
local `YYYY-MM-DD` calendar dates and timestamps as ISO UTC. If you travel across
timezones the *date* fields are deliberately unchanged, so a quote issued on the 1st
stays on the 1st.

**The print dialog shows the whole app** — use the print button inside the preview.
The print stylesheet only applies while `body` carries the printing class, which the
preview sets.

**A table is cut off on a phone** — that is intended: tables scroll inside their
card. The page itself never scrolls sideways. If a page *does* scroll sideways, it is
a bug worth reporting.

**I cannot see my accents/diacritics** — everything is stored and printed as UTF-8.

## License

MIT — see [LICENSE](LICENSE). Use it in commercial work, modify it, resell it.
