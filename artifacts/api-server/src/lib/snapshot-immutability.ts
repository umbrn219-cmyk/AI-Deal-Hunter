import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/** Protects snapshots even against accidental future UPDATE statements. */
export async function enforceSnapshotImmutability() {
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION guard_deal_snapshot() RETURNS trigger AS $$
    BEGIN
      IF OLD.snapshot IS DISTINCT FROM NEW.snapshot THEN
        RAISE EXCEPTION 'Deal snapshots are immutable; create a new observation';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS immutable_deal_snapshot ON deal_hunter_deals;
    CREATE TRIGGER immutable_deal_snapshot BEFORE UPDATE ON deal_hunter_deals
      FOR EACH ROW EXECUTE FUNCTION guard_deal_snapshot();
  `);
}
