import { and, desc, eq } from "drizzle-orm";
import {
  db,
  dealHunterDealsTable,
  dealHunterNotificationsTable,
  dealHunterPriceObservationsTable,
  dealHunterProductsTable,
  dealHunterScanRunsTable,
  dealHunterTasksTable,
} from "@workspace/db";

const STOP_WORDS = new Set([
  "a",
  "an",
  "any",
  "below",
  "becomes",
  "cheaper",
  "find",
  "for",
  "from",
  "goes",
  "if",
  "in",
  "less",
  "me",
  "more",
  "notify",
  "of",
  "on",
  "or",
  "price",
  "product",
  "than",
  "that",
  "the",
  "to",
  "under",
  "with",
  "alert",
  "drops",
  "normally",
  "costing",
  "historical",
  "discount",
  "observed",
  "drop",
  "possible",
  "critical",
  "anomaly",
  "ninety",
  "percent",
  "product",
  "sample",
]);

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function normalize(value: string): string {
  return value.toLocaleLowerCase("en-IN").replace(/[^a-z0-9]+/g, " ").trim();
}

function matchesTask(
  task: typeof dealHunterTasksTable.$inferSelect,
  product: typeof dealHunterProductsTable.$inferSelect,
  discount: number,
): boolean {
  const category = normalize(task.category);
  const broadCategory = ["all", "any", "custom", "electronics"].includes(
    category,
  );
  const productCategory = normalize(product.category);
  const categoryMatches =
    broadCategory ||
    productCategory.includes(category) ||
    category.includes(productCategory);

  const haystack = normalize(
    `${product.title} ${product.brand} ${product.model} ${product.category}`,
  );
  const categoryWords = new Set(category.split(" ").filter(Boolean));
  const queryTerms = normalize(task.query)
    .split(" ")
    .map(normalize)
    .filter(
      (term) =>
        term.length > 1 &&
        !STOP_WORDS.has(term) &&
        !categoryWords.has(term) &&
        !/^\d+$/.test(term),
    );
  const taskKeywords = task.keywords.map(normalize).filter(Boolean);
  const terms = taskKeywords.length > 0 ? taskKeywords : queryTerms;
  const keywordMatches =
    terms.length === 0 || terms.some((term) => haystack.includes(term));

  return (
    categoryMatches &&
    keywordMatches &&
    (task.maxPrice === null || product.currentPrice <= task.maxPrice) &&
    discount >= task.minDiscount &&
    product.rating >= task.minRating &&
    product.reviewCount >= task.minReviews
  );
}

function classify(discount: number, medianPrice: number, currentPrice: number) {
  if (medianPrice >= 50_000 && currentPrice <= 100) {
    return "critical_price_anomaly";
  }
  if (discount >= 95) return "possible_pricing_error";
  if (discount >= 90) return "price_anomaly";
  if (discount >= 70) return "extreme_deal";
  if (discount >= 50) return "great_deal";
  return "normal_deal";
}

export async function runMockScan(): Promise<{
  status: "completed" | "no_active_tasks";
  scannedProducts: number;
  matchedDeals: number;
  newAlerts: number;
  duplicateAlertsPrevented: number;
  durationMs: number;
  demo: true;
}> {
  const startedAt = Date.now();
  const [tasks, products] = await Promise.all([
    db.select().from(dealHunterTasksTable).where(eq(dealHunterTasksTable.active, true)),
    db.select().from(dealHunterProductsTable),
  ]);
  let matchedDeals = 0;
  let newAlerts = 0;
  let duplicateAlertsPrevented = 0;

  if (tasks.length > 0) {
    for (const product of products) {
      const history = await db
        .select()
        .from(dealHunterPriceObservationsTable)
        .where(eq(dealHunterPriceObservationsTable.productId, product.id))
        .orderBy(desc(dealHunterPriceObservationsTable.observedAt));
      const historicalPrices = history.map((point) => point.price);
      const historicalMedian = median(historicalPrices);
      const historicalLow =
        historicalPrices.length > 0
          ? Math.min(...historicalPrices)
          : product.currentPrice;
      const observedHigh =
        historicalPrices.length > 0
          ? Math.max(...historicalPrices)
          : product.currentPrice;
      const discount =
        historicalMedian > 0
          ? Math.max(
              0,
              ((historicalMedian - product.currentPrice) / historicalMedian) *
                100,
            )
          : 0;

      const matchedTasks = tasks.filter((task) =>
        matchesTask(task, product, discount),
      );
      if (matchedTasks.length === 0) continue;
      matchedDeals += 1;

      const latestObservation = history[0];
      if (
        !latestObservation ||
        Math.abs(latestObservation.price - product.currentPrice) > 0.01
      ) {
        await db.insert(dealHunterPriceObservationsTable).values({
          productId: product.id,
          price: product.currentPrice,
        });
      }

      const historicalDiscountPercent = Math.round(discount * 10) / 10;
      const belowObservedLow = product.currentPrice < historicalLow;
      const anomalyScore = Math.min(
        100,
        Math.round(discount * 0.78 + (belowObservedLow ? 14 : 0)),
      );
      const confidence = Math.max(
        55,
        Math.min(94, 62 + Math.min(20, historicalPrices.length * 4)),
      );
      const dealScore = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            historicalDiscountPercent * 0.55 + confidence * 0.45,
          ),
        ),
      );
      const classification = classify(
        historicalDiscountPercent,
        historicalMedian,
        product.currentPrice,
      );
      const fingerprint = `${product.id}:${product.currentPrice.toFixed(2)}`;
      const existingDeal = await db
        .select()
        .from(dealHunterDealsTable)
        .where(eq(dealHunterDealsTable.fingerprint, fingerprint))
        .limit(1);
      const deal =
        existingDeal[0] ??
        (
          await db
            .insert(dealHunterDealsTable)
            .values({
              fingerprint,
              productId: product.id,
              currentPrice: product.currentPrice,
              historicalMedian,
              historicalLow,
              observedHigh,
              realDiscountPercent: historicalDiscountPercent,
              historicalDiscountPercent,
              anomalyScore,
              confidence,
              dealScore,
              classification,
              matchedTaskNames: matchedTasks.map((task) => task.name),
            })
            .returning()
        )[0];

      const alertFingerprint = fingerprint;
      const existingNotification = await db
        .select({ id: dealHunterNotificationsTable.id })
        .from(dealHunterNotificationsTable)
        .where(eq(dealHunterNotificationsTable.fingerprint, alertFingerprint))
        .limit(1);
      if (existingNotification.length > 0) {
        duplicateAlertsPrevented += 1;
      } else {
        const critical = classification === "critical_price_anomaly";
        const anomaly = [
          "possible_pricing_error",
          "price_anomaly",
          "critical_price_anomaly",
        ].includes(classification);
        await db.insert(dealHunterNotificationsTable).values({
          fingerprint: alertFingerprint,
          title: critical
            ? "Critical demo price anomaly"
            : anomaly
              ? "Possible demo pricing anomaly"
              : "Demo rule match",
          message: critical
            ? `${product.title}: the mock price is far below its synthetic observed median. This is demo data, not a real offer.`
            : `${product.title}: mock price ₹${product.currentPrice.toLocaleString("en-IN")} versus synthetic observed median ₹${Math.round(historicalMedian).toLocaleString("en-IN")}.`,
          kind: anomaly ? "anomaly" : "deal",
          dealId: deal.id,
        });
        newAlerts += 1;
      }
    }
  }

  const durationMs = Math.max(1, Date.now() - startedAt);
  const status = tasks.length > 0 ? "completed" : "no_active_tasks";
  await db.insert(dealHunterScanRunsTable).values({
    status,
    scannedProducts: products.length,
    matchedDeals,
    newAlerts,
    duplicateAlertsPrevented,
    durationMs,
    demo: 1,
  });

  return {
    status,
    scannedProducts: products.length,
    matchedDeals,
    newAlerts,
    duplicateAlertsPrevented,
    durationMs,
    demo: true,
  };
}
