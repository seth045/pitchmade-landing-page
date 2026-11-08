# Pitchmade waitlist

This repository contains the Pitchmade early-access landing page and signup backend. Hosting uses Cloudflare Pages and a private D1 database on the free plan. No email is sent automatically.

## Hosted site

Address: https://pitchmade-landing-page.pages.dev

Live signups are stored in Cloudflare D1, database **pitchmade-waitlist**, table **waitlist**. They are not sent to an inbox or stored in GitHub. Sign in to Cloudflare, open **Storage & databases → D1 SQLite Database → pitchmade-waitlist → Explore Data**, then select **waitlist** to view them. Only authorized Cloudflare account users can use that dashboard. The local owner page below displays local records only; it does not sync with Cloudflare.

The site has no public signup-list endpoint. Visitors receive a private deletion link for their own new signup. Save exports securely; they contain personal information.

## Open it

1. Double-click **Start Pitchmade.cmd** in this folder.
2. Open **http://127.0.0.1:4173** for the landing page.
3. Open **http://127.0.0.1:4173/local-admin** for the signup list and **Download CSV**.
4. Keep the launcher window open while using it. Press Ctrl+C in that window to stop it.

Node is already installed on this computer. The launcher does not install anything. If a copy is already running, it prints the same links instead of starting a second server.

**Local means this computer only.** This address cannot be used in ads, emails to prospects or community posts. Publishing source code on GitHub does not host the site or its database.

## Where local test signups go

Emails, optional platform/feedback, signup time, consent version and campaign tags are stored in **.local/waitlist.sqlite**, a database file in this project. Closing the browser or restarting the server does not delete them. Do not delete `.local` if it contains signups you want to keep.

The owner page reads that database directly. Its CSV download can be opened in Excel or imported into Google Sheets manually. The app does not connect to either service. Exported spreadsheet cells are protected against formula injection.

The `.local` folder and CSV exports are private local runtime data, excluded from source publishing. The only local secret is generated automatically for anti-spam rate limiting; do not share `.local/rate-secret`. The owner view exists only in the local server and is not included in the hosted build.

## What works

- A responsive page using Pitchmade's logo, Paper & Rust colors and editorial typography.
- An honest early-access proposition, sample deck, product explanation and FAQ.
- Server-side email and consent validation; optional platform and feedback.
- Case-insensitive email deduplication without overwriting the original feedback.
- A success message only after the server confirms storage.
- Visible errors and retry when storage or networking fails.
- A private removal link for each new signup; it deletes that signup and feedback.
- A local owner list and CSV export.
- Optional `utm_source`, `utm_medium` and `utm_campaign` capture. Example: `http://127.0.0.1:4173/?utm_source=community&utm_medium=post&utm_campaign=early-access`.

No account, payment, confirmation email, advertising tracker, automatic outreach, or working deck-generation feature is included. The sample deck and brands are clearly labelled as illustrative. No launch date, product price, results or customer numbers are invented.

Save the private management link shown after signup. It is a deletion permission, not a public share link. Duplicate submissions do not issue a new deletion permission for an existing signup. Emails have not been independently verified by a confirmation email; this is an interest list, not a double-opt-in mailing system.

## Validation

`node --test tests/waitlist.test.mjs` checks validation, durable storage, duplicates, consent, request forgery protection, spam limits, failures, private deletion, data isolation and local exports.

`node scripts/check-browser.mjs` uses the installed Chrome browser and a running local server. It checks desktop and phone widths, actual form submission, the stored database record, invalid inputs, duplicate handling, network failure/retry, privacy and FAQ controls, and removal. It removes its synthetic signup after testing. Reports and screenshots are under `artifacts/local/`.

These tests use invented `example.test` or `example.invalid` addresses and do not send email.

## Cloudflare deployment

The GitHub `main` branch is connected to Cloudflare Pages. Build command: `node scripts/build.mjs`. Build output: `dist/cloudflare`. Framework: None. No external packages are needed. The generated `_worker.js` contains the server handler and public assets; never upload the repository root or `.local` as a website.

The Pages project uses a D1 binding named `DB` pointing to **pitchmade-waitlist** and an encrypted secret named `RATE_LIMIT_SALT`. The schema is in `drizzle/0000_waitlist.sql`; apply it only when creating a new empty database. Binding and secret changes require a new deployment. Keep credentials in server-side settings, never in this repository. `.openai/hosting.json` is retained for the alternate build format; no Sites project was created.

After each relevant deployment, verify a browser signup against the hosted database and remove the synthetic test record using its private deletion link. Local tests alone do not verify public hosting. Free-plan limits can temporarily stop new signups; the form reports an error instead of claiming they were saved. No paid upgrade or custom domain is configured.

The database API follows [Cloudflare's D1 Worker binding documentation](https://developers.cloudflare.com/d1/worker-api/). The deployment helper and built-in storage contracts were inspected locally. A dependency-free handler was used to respect the project's no-install restriction.
