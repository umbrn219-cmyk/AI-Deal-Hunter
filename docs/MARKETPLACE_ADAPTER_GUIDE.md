# Marketplace adapter guide

No live marketplace adapter is included. Keep that boundary explicit until an official API, feed, or other permitted data source is approved.

For a future adapter:

1. Implement a marketplace-specific module behind a shared typed interface for search, product details, price, stock, seller, rating, and verified product URL.
2. Use only the marketplace's official or otherwise permitted access method. Do not bypass CAPTCHA, authentication, access controls, bot protections, or rate limits.
3. Validate and normalize every response before it reaches the deal engine. Preserve source timestamps, seller, variant, shipping, coupon, and availability conditions.
4. Record source observations separately from synthetic demo observations; never merge demo rows into live price history.
5. Respect published request limits, use bounded retries/backoff and caching, and mark an adapter degraded when its source fails.
6. Add adapter tests with fixtures; normal tests must not depend on live retailer access.
7. Only expose a retailer link if the adapter returned a verified URL for the matched product variant.

Do not label the marketplace as connected until access has been configured and a successful permitted request has been verified.
