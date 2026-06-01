import { Router } from "express";
import { db } from "@workspace/db";
import { notaryRecordsTable, clientsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any)?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

router.get("/dashboard/stats", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    const [clientCount] = await db.select({ count: sql<number>`count(*)::int` }).from(clientsTable);
    const [totals] = await db.select({
      totalJobs: sql<number>`count(*)::int`,
      totalEarned: sql<number>`coalesce(sum(amount::numeric), 0)::float`,
      totalPaid: sql<number>`coalesce(sum(case when status = 'paid' then amount::numeric else 0 end), 0)::float`,
      totalUnpaid: sql<number>`coalesce(sum(case when status = 'unpaid' then amount::numeric else 0 end), 0)::float`,
    }).from(notaryRecordsTable);

    const [monthTotals] = await db.select({
      thisMonthJobs: sql<number>`count(*)::int`,
      thisMonthEarned: sql<number>`coalesce(sum(amount::numeric), 0)::float`,
    }).from(notaryRecordsTable).where(
      sql`date >= ${monthStart} and date <= ${monthEnd}`
    );

    const recentRecords = await db
      .select({
        id: notaryRecordsTable.id,
        refNumber: notaryRecordsTable.refNumber,
        clientName: clientsTable.name,
        workType: notaryRecordsTable.workType,
        amount: notaryRecordsTable.amount,
        status: notaryRecordsTable.status,
        date: notaryRecordsTable.date,
      })
      .from(notaryRecordsTable)
      .leftJoin(clientsTable, eq(notaryRecordsTable.clientId, clientsTable.id))
      .orderBy(sql`${notaryRecordsTable.id} desc`)
      .limit(5);

    const workTypeDist = await db
      .select({
        workType: notaryRecordsTable.workType,
        count: sql<number>`count(*)::int`,
      })
      .from(notaryRecordsTable)
      .groupBy(notaryRecordsTable.workType)
      .orderBy(sql`count(*) desc`);

    res.json({
      totalClients: clientCount?.count ?? 0,
      totalJobs: totals?.totalJobs ?? 0,
      totalEarned: totals?.totalEarned ?? 0,
      totalPaid: totals?.totalPaid ?? 0,
      totalUnpaid: totals?.totalUnpaid ?? 0,
      thisMonthJobs: monthTotals?.thisMonthJobs ?? 0,
      thisMonthEarned: monthTotals?.thisMonthEarned ?? 0,
      recentRecords: recentRecords.map((r) => ({
        id: r.id,
        refNumber: r.refNumber,
        clientName: r.clientName ?? "Unknown",
        workType: r.workType,
        amount: r.amount,
        status: r.status,
        date: r.date,
      })),
      workTypeDistribution: workTypeDist.map((w) => ({
        workType: w.workType,
        count: w.count,
      })),
    });
  } catch (err: any) {
    req.log.error({ err }, "Dashboard stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
