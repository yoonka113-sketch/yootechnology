import { Router } from "express";
import { db } from "@workspace/db";
import { notaryRecordsTable, clientsTable } from "@workspace/db";
import { sql, and, gte, lte } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any)?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

// GET /api/reports/funds?granularity=daily&year=2026&month=05
// GET /api/reports/funds?granularity=monthly&year=2026
// GET /api/reports/funds?granularity=yearly
router.get("/reports/funds", requireAuth, async (req, res) => {
  const { granularity, year, month } = req.query as Record<string, string>;

  try {
    if (granularity === "daily") {
      if (!year || !month) {
        res.status(400).json({ error: "year and month required for daily granularity" });
        return;
      }
      const from = `${year}-${month.padStart(2, "0")}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const to = `${year}-${month.padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const rows = await db
        .select({
          period: notaryRecordsTable.date,
          jobs: sql<number>`count(*)::int`,
          earned: sql<number>`coalesce(sum(amount::numeric), 0)::float`,
          paid: sql<number>`coalesce(sum(case when status='paid' then amount::numeric else 0 end), 0)::float`,
          unpaid: sql<number>`coalesce(sum(case when status='unpaid' then amount::numeric else 0 end), 0)::float`,
        })
        .from(notaryRecordsTable)
        .where(and(gte(notaryRecordsTable.date, from), lte(notaryRecordsTable.date, to)))
        .groupBy(notaryRecordsTable.date)
        .orderBy(notaryRecordsTable.date);

      const [totals] = await db.select({
        jobs: sql<number>`count(*)::int`,
        earned: sql<number>`coalesce(sum(amount::numeric), 0)::float`,
        paid: sql<number>`coalesce(sum(case when status='paid' then amount::numeric else 0 end), 0)::float`,
        unpaid: sql<number>`coalesce(sum(case when status='unpaid' then amount::numeric else 0 end), 0)::float`,
      }).from(notaryRecordsTable).where(and(gte(notaryRecordsTable.date, from), lte(notaryRecordsTable.date, to)));

      res.json({ granularity, from, to, rows, totals });
      return;
    }

    if (granularity === "monthly") {
      if (!year) {
        res.status(400).json({ error: "year required for monthly granularity" });
        return;
      }
      const from = `${year}-01-01`;
      const to = `${year}-12-31`;

      const rows = await db
        .select({
          period: sql<string>`to_char(date::date, 'YYYY-MM')`,
          jobs: sql<number>`count(*)::int`,
          earned: sql<number>`coalesce(sum(amount::numeric), 0)::float`,
          paid: sql<number>`coalesce(sum(case when status='paid' then amount::numeric else 0 end), 0)::float`,
          unpaid: sql<number>`coalesce(sum(case when status='unpaid' then amount::numeric else 0 end), 0)::float`,
        })
        .from(notaryRecordsTable)
        .where(and(gte(notaryRecordsTable.date, from), lte(notaryRecordsTable.date, to)))
        .groupBy(sql`to_char(date::date, 'YYYY-MM')`)
        .orderBy(sql`to_char(date::date, 'YYYY-MM')`);

      const [totals] = await db.select({
        jobs: sql<number>`count(*)::int`,
        earned: sql<number>`coalesce(sum(amount::numeric), 0)::float`,
        paid: sql<number>`coalesce(sum(case when status='paid' then amount::numeric else 0 end), 0)::float`,
        unpaid: sql<number>`coalesce(sum(case when status='unpaid' then amount::numeric else 0 end), 0)::float`,
      }).from(notaryRecordsTable).where(and(gte(notaryRecordsTable.date, from), lte(notaryRecordsTable.date, to)));

      res.json({ granularity, year, rows, totals });
      return;
    }

    if (granularity === "yearly") {
      const rows = await db
        .select({
          period: sql<string>`to_char(date::date, 'YYYY')`,
          jobs: sql<number>`count(*)::int`,
          earned: sql<number>`coalesce(sum(amount::numeric), 0)::float`,
          paid: sql<number>`coalesce(sum(case when status='paid' then amount::numeric else 0 end), 0)::float`,
          unpaid: sql<number>`coalesce(sum(case when status='unpaid' then amount::numeric else 0 end), 0)::float`,
        })
        .from(notaryRecordsTable)
        .groupBy(sql`to_char(date::date, 'YYYY')`)
        .orderBy(sql`to_char(date::date, 'YYYY')`);

      const [totals] = await db.select({
        jobs: sql<number>`count(*)::int`,
        earned: sql<number>`coalesce(sum(amount::numeric), 0)::float`,
        paid: sql<number>`coalesce(sum(case when status='paid' then amount::numeric else 0 end), 0)::float`,
        unpaid: sql<number>`coalesce(sum(case when status='unpaid' then amount::numeric else 0 end), 0)::float`,
      }).from(notaryRecordsTable);

      res.json({ granularity, rows, totals });
      return;
    }

    res.status(400).json({ error: "granularity must be daily, monthly, or yearly" });
  } catch (err: any) {
    req.log.error({ err }, "Funds report error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/reports/clients
router.get("/reports/clients", requireAuth, async (req, res) => {
  try {
    const clients = await db
      .select({
        id: clientsTable.id,
        name: clientsTable.name,
        phone: clientsTable.phone,
        documentType: clientsTable.documentType,
        idNumber: clientsTable.idNumber,
        address: clientsTable.address,
        createdAt: clientsTable.createdAt,
        totalRecords: sql<number>`count(${notaryRecordsTable.id})::int`,
        totalEarned: sql<number>`coalesce(sum(${notaryRecordsTable.amount}::numeric), 0)::float`,
      })
      .from(clientsTable)
      .leftJoin(notaryRecordsTable, sql`${notaryRecordsTable.clientId} = ${clientsTable.id}`)
      .groupBy(clientsTable.id)
      .orderBy(clientsTable.name);

    res.json({ clients, total: clients.length });
  } catch (err: any) {
    req.log.error({ err }, "Clients report error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
