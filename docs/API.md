# API

Base path: `/api`

## Deal Hunter endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/deal-hunter/dashboard` | Counts, scan status, recent deals, and alerts |
| GET, POST | `/deal-hunter/tasks` | List or create monitoring tasks |
| PATCH, DELETE | `/deal-hunter/tasks/{id}` | Update or delete a task |
| POST | `/deal-hunter/tasks/parse` | Convert natural language into a validated draft |
| GET | `/deal-hunter/deals` | List deals; optional `classification` filter |
| POST | `/deal-hunter/scan` | Scan only the built-in mock catalog (`source: "mock"`) |
| GET | `/deal-hunter/products/{id}/history` | List stored price observations |
| GET | `/deal-hunter/notifications` | List recent alerts |
| POST | `/deal-hunter/notifications/{id}/read` | Mark an alert as read |
| GET, POST | `/deal-hunter/watchlist` | List or add watchlist entries |
| DELETE | `/deal-hunter/watchlist/{id}` | Remove a watchlist entry |

Request and response schemas are maintained in `lib/api-spec/openapi.yaml`. Regenerate the TypeScript client and Zod schemas with:

```sh
pnpm --filter @workspace/api-spec run codegen
```

The scan endpoint does not accept retailer URLs or arbitrary code. A future live adapter should use a separate, explicitly permitted data source and should preserve the demo/live distinction.
