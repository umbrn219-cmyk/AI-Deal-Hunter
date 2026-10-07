# AI Deal Hunter

An India-focused deal-monitoring dashboard for managing price rules and reviewing historical-price alerts from a clearly labeled synthetic catalog.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/deal-hunter run dev` — run the web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` (Replit-managed PostgreSQL) and `GEMINI_API_KEY` (natural-language task drafting)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/deal-hunter/` — React/Vite dashboard.
- `artifacts/api-server/src/routes/deal-hunter.ts` — validated deal-monitoring endpoints.
- `artifacts/api-server/src/lib/deal-engine.ts` — mock-catalog matching, price analysis, and alert deduplication.
- `artifacts/api-server/src/lib/seed-deal-hunter.ts` — synthetic starter tasks, products, and price observations.
- `lib/api-spec/openapi.yaml` — source of truth for API contracts.
- `lib/db/src/schema/` — PostgreSQL tables.

## Architecture decisions

- This first slice scans only the built-in mock catalog; retailer selections are preferences, not active integrations.
- Stored product URLs remain null until an approved marketplace adapter supplies a verified destination. Deal cards instead link to official retailer search results and warn that sample prices are not live.
- Every seeded product, price, deal, and alert is synthetic and labeled as demo data.
- Gemini converts natural-language text to a draft rule, validates the structured output, and requires user review before saving.
- Task and catalog data are shared by this project; account authentication and user-level isolation are not yet implemented.

## Product

Users can create and edit monitoring tasks, draft a rule from natural language, scan the mock catalog, inspect price history and anomaly scores, manage a watchlist, and review deduplicated alerts.

## User preferences

Keep all mock-marketplace content visibly labeled as synthetic. Never present it as a real retailer offer, and never automate checkout or payment.

## Gotchas

- Add and document a permitted official marketplace adapter before enabling real retailer monitoring.
- Do not publish for private or multi-user use until authentication and per-user authorization are implemented.
- Gemini request text is sent to Google using the configured Gemini API key. Never log or expose the key.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `README.md` and `docs/` for setup, API, security boundaries, and adapter extension guidance.
