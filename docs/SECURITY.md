# Security and privacy boundaries

- `GEMINI_API_KEY` belongs in Replit Secrets, not source code, logs, or browser code.
- Natural-language task text is sent to Google Gemini for structured rule drafting when the user selects the draft action. The result is schema-validated and remains a draft until the user saves it.
- No request to the model can initiate scans, open retailer accounts, or place an order.
- No raw payment credentials are collected or stored.
- Inputs and outputs use schemas generated from the OpenAPI contract. User-provided values are passed as bound database values through Drizzle.
- The application currently has no sign-in or per-user authorization. The database contains shared project-level data. Do not treat this version as suitable for confidential monitoring or public multi-user use.
- All starter data is synthetic. A clearly identified mock price anomaly is not a real buying opportunity.

## Before enabling multiple users

Add a supported authentication provider, enforce authorization on every API operation, associate every user-owned row with a verified server-side user ID, and verify user isolation. Do not rely on hiding client-side pages as authorization.
