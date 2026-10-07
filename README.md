# AI Deal Hunter

AI Deal Hunter is a price-rule dashboard for India-focused shopping workflows. The current version is a working demo: it stores tasks and observations in PostgreSQL, runs deterministic analysis over a synthetic catalog, records alerts, and can turn natural-language requests into reviewable task drafts using Gemini when the configured API account has model access.

## Important: demo-only catalog

The seeded products, prices, sellers, availability, histories, deals, and alerts are synthetic. The UI labels them as demo data. No retailer feed or marketplace API is connected. Marketplace selections are saved preferences only; they do not trigger retailer checks. Deal cards link to official Amazon.in and Flipkart search results, not verified product pages, and those sites do not share the demo prices.

The app does not place orders, access retailer accounts, or bypass access controls. It has no checkout automation.

## Run in Replit

The workspace starts the managed `artifacts/api-server` and `artifacts/deal-hunter` workflows. The API uses the project PostgreSQL database.

For a fresh development database:

```sh
pnpm --filter @workspace/db run push
```

The API seeds the synthetic starter catalog and ten editable sample tasks once when the catalog is empty. Run the complete TypeScript check with:

```sh
pnpm run typecheck
```

## Environment

- `DATABASE_URL`: provided by the Replit PostgreSQL database.
- `GEMINI_API_KEY`: optional for natural-language rule drafting. Add it using Replit Secrets. The backend uses it only for structured task parsing; it never returns or logs the key. Requests are sent to Google Gemini and billed by the Gemini account associated with that key.

The rest of the dashboard and deterministic mock scan work without Gemini. There is no fake AI fallback: if drafting is unavailable, the user can enter the structured fields manually. The parser currently targets `gemini-3.8-flash`.

## Current capabilities

- Create, edit, pause, and delete monitoring tasks.
- Draft a task from natural language; inspect and edit the structured result before saving.
- Scan the mock catalog, calculate observed-price changes, classify anomalies, and deduplicate alerts.
- Review deals and synthetic price history.
- Add and remove product/brand/category/keyword watchlist entries.
- Mark alerts as read.

## Known limitations

- No authentication or user-level data isolation. All tasks and activity are shared by this project. Do not publish this version for private or multi-user use until sign-in and server-side authorization are added.
- No live retailer adapters, push/email/Telegram/Discord/SMS providers, Android client, sale-event scheduler, imports/exports, or checkout preparation.
- No guarantee that any seeded example price resembles a real or currently available offer.

See `docs/` for the API contract, architecture, security boundary, and the checklist for adding an official marketplace adapter.
