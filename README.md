# Pitchmade local waitlist

This repository contains the Pitchmade early-access landing page and its working local signup backend. Public deployment to Vercel is planned but is not configured yet. No email is sent automatically.

## Open it

1. Double-click **Start Pitchmade.cmd** in this folder.
2. Open **http://127.0.0.1:4173** for the landing page.
3. Open **http://127.0.0.1:4173/local-admin** for the signup list and **Download CSV**.
4. Keep the launcher window open while using it. Press Ctrl+C in that window to stop it.

Node is already installed on this computer. The launcher does not install anything. If a copy is already running, it prints the same links instead of starting a second server.

**Local means this computer only.** This address cannot be used in ads, emails to prospects or community posts. Publishing source code on GitHub does not host the site or its database.

## Where signups go

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

## Future publishing handoff

**Vercel status:** do not import this as a static-only site and assume signups work. The current hosted handler targets Cloudflare Workers/D1. Vercel needs a compatible server handler and a persistent hosted database before launch; the local SQLite file cannot serve as a durable Vercel database. No hosted signup storage has been connected yet. Keep credentials in server-side environment settings, never in this repository. The local owner page must not be exposed publicly.

The source is packaged for a supported server handler with a D1 database binding named `DB`. `.openai/hosting.json` deliberately has no project ID because no Site has been created. The public build embeds assets and never includes the local database or owner-view module.

Before publishing, obtain Seth's approval for the provider and public launch, register once, provision the database, apply the schema migration, configure a private `RATE_LIMIT_SALT`, and verify a browser signup against the hosted database. Then remove the synthetic test record and provide the live URL plus owner access instructions. Local test results are not proof of public hosting.

The database API follows [Cloudflare's D1 Worker binding documentation](https://developers.cloudflare.com/d1/worker-api/). The deployment helper and built-in storage contracts were inspected locally. A dependency-free handler was used to respect the project's no-install restriction.
