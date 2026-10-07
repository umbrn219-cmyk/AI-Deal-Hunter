import { count } from "drizzle-orm";
import {
  db,
  dealHunterPriceObservationsTable,
  dealHunterProductsTable,
  dealHunterScanRunsTable,
  dealHunterTasksTable,
} from "@workspace/db";
import { runMockScan } from "./deal-engine";

const demoTasks = [
  ["iPhone under ₹10,000", "iPhone 15", "Smartphone", ["iPhone", "Apple"], 10000, 0],
  ["Smartphone under ₹1,000", "Any smartphone", "Smartphone", [], 1000, 0],
  ["Headphones under ₹500", "Headphones", "Headphones", ["headphones"], 500, 0],
  ["Smartwatch under ₹1,000", "Smartwatch", "Smartwatch", ["smartwatch"], 1000, 0],
  ["Laptop under ₹15,000", "Laptop", "Laptop", ["laptop"], 15000, 0],
  ["AC under ₹20,000", "AC", "AC", [], 20000, 0],
  ["Water purifier under ₹5,000", "Water purifier", "Water purifier", ["purifier"], 5000, 0],
  ["TV under ₹10,000", "TV", "TV", [], 10000, 0],
  ["Above 90% observed drop", "Any product with a 90% observed drop", "Any", [], null, 90],
  ["Critical price anomaly", "Any possible critical price anomaly", "Any", [], null, 90],
] as const;

const demoProducts = [
  {
    title: "Apple iPhone 15 · 128GB · Black",
    category: "Smartphone",
    brand: "Apple",
    model: "iPhone 15 128GB",
    currentPrice: 9999,
    rating: 4.5,
    reviewCount: 12000,
    historicalPrices: [64900, 62999, 61999, 59999, 58999],
  },
  {
    title: "Samsung Galaxy M35 · 128GB",
    category: "Smartphone",
    brand: "Samsung",
    model: "Galaxy M35",
    currentPrice: 1499,
    rating: 4.2,
    reviewCount: 8400,
    historicalPrices: [19999, 18999, 17999, 17499, 16999],
  },
  {
    title: "boAt Rockerz 450 Wireless Headphones",
    category: "Headphones",
    brand: "boAt",
    model: "Rockerz 450",
    currentPrice: 399,
    rating: 4.1,
    reviewCount: 86000,
    historicalPrices: [2999, 2499, 2299, 2199, 1999],
  },
  {
    title: "Samsung Galaxy Watch6 · 44mm",
    category: "Smartwatch",
    brand: "Samsung",
    model: "Galaxy Watch6 44mm",
    currentPrice: 999,
    rating: 4.4,
    reviewCount: 5500,
    historicalPrices: [30999, 28999, 26999, 24999, 22999],
  },
  {
    title: "Apple MacBook Air · M2 · 13-inch",
    category: "Laptop",
    brand: "Apple",
    model: "MacBook Air M2",
    currentPrice: 14999,
    rating: 4.7,
    reviewCount: 4200,
    historicalPrices: [99900, 94900, 89900, 84900, 79900],
  },
  {
    title: "Voltas 1.5 Ton 3 Star Inverter AC",
    category: "AC",
    brand: "Voltas",
    model: "1.5 Ton Inverter AC",
    currentPrice: 19999,
    rating: 4.2,
    reviewCount: 3900,
    historicalPrices: [44990, 42990, 39990, 38990, 36990],
  },
  {
    title: "Kent Grand Plus RO Water Purifier",
    category: "Water purifier",
    brand: "Kent",
    model: "Grand Plus",
    currentPrice: 4999,
    rating: 4.3,
    reviewCount: 6800,
    historicalPrices: [13999, 12999, 11999, 10999, 9999],
  },
  {
    title: "TCL 55-inch 4K UHD Smart TV",
    category: "TV",
    brand: "TCL",
    model: "55-inch 4K UHD",
    currentPrice: 9999,
    rating: 4.1,
    reviewCount: 2900,
    historicalPrices: [44990, 41990, 38990, 35990, 32990],
  },
  {
    title: "Sony WH-1000XM5 Wireless Headphones",
    category: "Headphones",
    brand: "Sony",
    model: "WH-1000XM5",
    currentPrice: 11999,
    rating: 4.6,
    reviewCount: 9600,
    historicalPrices: [29990, 27990, 25990, 23990, 21990],
  },
  {
    title: "NVIDIA RTX 4080 Super Graphics Card",
    category: "GPU",
    brand: "NVIDIA",
    model: "RTX 4080 Super",
    currentPrice: 1,
    rating: 4.8,
    reviewCount: 1700,
    historicalPrices: [119999, 114999, 109999, 104999, 99999],
  },
] as const;

export async function seedDealHunter(): Promise<void> {
  const [productCount] = await db
    .select({ value: count() })
    .from(dealHunterProductsTable);

  if (productCount.value === 0) {
    const tasks = demoTasks.map(
      ([name, query, category, keywords, maxPrice, minDiscount], index) => ({
        name,
        query,
        category,
        keywords: [...keywords],
        maxPrice,
        minDiscount,
        minRating: index === 0 ? 4 : 0,
        minReviews: 0,
        marketplaces: ["Amazon.in", "Flipkart"],
        priority: index === 0 || index > 7 ? "high" : "normal",
      }),
    );
    await db.insert(dealHunterTasksTable).values(tasks);

    const baseDate = Date.now();
    for (const product of demoProducts) {
      const [inserted] = await db
        .insert(dealHunterProductsTable)
        .values({
          title: product.title,
          category: product.category,
          brand: product.brand,
          model: product.model,
          currentPrice: product.currentPrice,
          rating: product.rating,
          reviewCount: product.reviewCount,
          marketplace: "Mock catalog",
          seller: "Synthetic seller",
          productUrl: null,
          stockStatus: "Demo availability",
        })
        .returning();
      const observations = product.historicalPrices.map((price, index) => ({
        productId: inserted.id,
        price,
        observedAt: new Date(baseDate - (product.historicalPrices.length - index) * 86_400_000),
      }));
      await db
        .insert(dealHunterPriceObservationsTable)
        .values(observations);
    }
  }

  const [scanCount] = await db
    .select({ value: count() })
    .from(dealHunterScanRunsTable);
  if (scanCount.value === 0) {
    await runMockScan();
  }
}
