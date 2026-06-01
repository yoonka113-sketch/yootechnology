import { Router } from "express";
import { db } from "@workspace/db";
import { notaryRecordsTable, clientsTable } from "@workspace/db";
import { eq, desc, sql, gte, lte, and } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any)?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

function generateRefNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `REF-${y}${m}${d}-${rand}`;
}

router.get("/records/report", requireAuth, async (req, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  if (!from || !to) {
    res.status(400).json({ error: "from and to date params are required (YYYY-MM-DD)" });
    return;
  }
  try {
    const records = await db
      .select()
      .from(notaryRecordsTable)
      .where(and(gte(notaryRecordsTable.date, from), lte(notaryRecordsTable.date, to)))
      .orderBy(notaryRecordsTable.date);

    const [totals] = await db
      .select({
        totalJobs: sql<number>`count(*)::int`,
        totalEarned: sql<number>`coalesce(sum(amount::numeric), 0)::float`,
        totalPaid: sql<number>`coalesce(sum(case when status = 'paid' then amount::numeric else 0 end), 0)::float`,
        totalUnpaid: sql<number>`coalesce(sum(case when status = 'unpaid' then amount::numeric else 0 end), 0)::float`,
      })
      .from(notaryRecordsTable)
      .where(and(gte(notaryRecordsTable.date, from), lte(notaryRecordsTable.date, to)));

    res.json({ from, to, records, totals });
  } catch (err: any) {
    req.log.error({ err }, "Report error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/records", requireAuth, async (req, res) => {
  try {
    const { status, clientId } = req.query;
    const conditions: ReturnType<typeof eq>[] = [];
    if (status && status !== "all") conditions.push(eq(notaryRecordsTable.status, status as string));
    if (clientId) conditions.push(eq(notaryRecordsTable.clientId, parseInt(clientId as string)));
    const records = conditions.length
      ? await db.select().from(notaryRecordsTable).where(and(...conditions)).orderBy(desc(notaryRecordsTable.createdAt))
      : await db.select().from(notaryRecordsTable).orderBy(desc(notaryRecordsTable.createdAt));
    res.json(records);
  } catch (err: any) {
    req.log.error({ err }, "Get records error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/records/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [record] = await db.select().from(notaryRecordsTable).where(eq(notaryRecordsTable.id, id)).limit(1);
    if (!record) { res.status(404).json({ error: "Record not found" }); return; }
    res.json(record);
  } catch (err: any) {
    req.log.error({ err }, "Get record error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/records", requireAuth, async (req, res) => {
  const { clientId, workType, description, amount, date, status } = req.body ?? {};
  if (!clientId || !workType || !description || !date) {
    res.status(400).json({ error: "Missing required fields: clientId, workType, description, date" });
    return;
  }
  try {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, parseInt(clientId))).limit(1);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }

    let refNumber = generateRefNumber();
    let attempts = 0;
    while (attempts < 5) {
      const [existing] = await db.select({ id: notaryRecordsTable.id }).from(notaryRecordsTable).where(eq(notaryRecordsTable.refNumber, refNumber)).limit(1);
      if (!existing) break;
      refNumber = generateRefNumber();
      attempts++;
    }

    const [record] = await db.insert(notaryRecordsTable).values({
      refNumber,
      clientId: parseInt(clientId),
      clientName: client.name,
      workType,
      description,
      amount: String(amount ?? "0"),
      date,
      status: status ?? "unpaid",
    }).returning();
    res.status(201).json(record);
  } catch (err: any) {
    req.log.error({ err }, "Create record error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/records/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const { clientId, workType, description, amount, date, status } = req.body ?? {};
  try {
    let clientName: string | undefined;
    if (clientId) {
      const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, parseInt(clientId))).limit(1);
      if (client) clientName = client.name;
    }
    const [record] = await db.update(notaryRecordsTable).set({
      ...(clientId ? { clientId: parseInt(clientId) } : {}),
      ...(clientName ? { clientName } : {}),
      ...(workType ? { workType } : {}),
      ...(description ? { description } : {}),
      ...(amount !== undefined ? { amount: String(amount) } : {}),
      ...(date ? { date } : {}),
      ...(status ? { status } : {}),
    }).where(eq(notaryRecordsTable.id, id)).returning();
    if (!record) { res.status(404).json({ error: "Record not found" }); return; }
    res.json(record);
  } catch (err: any) {
    req.log.error({ err }, "Update record error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/records/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await db.delete(notaryRecordsTable).where(eq(notaryRecordsTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "Delete record error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
