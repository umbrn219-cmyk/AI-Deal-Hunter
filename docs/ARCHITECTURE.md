# Architecture

The web artifact communicates with the shared Express API using generated React Query hooks. `lib/api-spec/openapi.yaml` is the API contract; generated Zod schemas validate request and response data.

## Data flow

1. The scheduler is currently a user-triggered mock scan, not a background service.
2. The scan reads the built-in synthetic catalog and active task rules.
3. Deterministic code compares the current synthetic price with stored synthetic observations.
4. Matching deals and observations are saved in PostgreSQL.
5. Alert fingerprints prevent repeat notifications for the same product and mock price.
6. The dashboard reads persisted tasks, deals, notifications, scan runs, and price points.

Natural-language drafting is separate from scan execution. Gemini returns structured JSON, which is validated against the generated schema. Drafts require user review; they cannot cause marketplace access or purchase actions.

## Main modules

- `artifacts/deal-hunter/`: dashboard, task editor, deal list, watchlist, notifications, and settings.
- `artifacts/api-server/src/routes/deal-hunter.ts`: HTTP endpoints and input/output validation.
- `artifacts/api-server/src/lib/deal-engine.ts`: deterministic matching, observed-price analysis, deal scoring, and alert deduplication.
- `artifacts/api-server/src/lib/seed-deal-hunter.ts`: idempotent setup of synthetic sample data.
- `lib/db/src/schema/`: task, product, price observation, deal, notification, watchlist, and scan-run tables.

The marketplace and notification layers are not yet integrations. Add each real marketplace as an isolated, permitted adapter after obtaining approved API/feed access.
