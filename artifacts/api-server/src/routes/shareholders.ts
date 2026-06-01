import { Router } from "express";
import { db } from "@workspace/db";
import {
  shareholdersTable,
  dividendPaymentsTable,
  insertShareholderSchema,
  insertDividendSchema,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/shareholders", async (req, res) => {
  const shareholders = await db.select().from(shareholdersTable).orderBy(desc(shareholdersTable.createdAt));
  const totalShares = shareholders.reduce((s, sh) => s + sh.shares, 0);
  const result = shareholders.map((sh) => ({
    ...sh,
    percentage: totalShares > 0 ? ((sh.shares / totalShares) * 100).toFixed(2) : "0.00",
  }));
  res.json(result);
});

router.get("/shareholders/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [shareholder] = await db.select().from(shareholdersTable).where(eq(shareholdersTable.id, id));
  if (!shareholder) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const payments = await db
    .select()
    .from(dividendPaymentsTable)
    .where(eq(dividendPaymentsTable.shareholderId, id))
    .orderBy(desc(dividendPaymentsTable.paidAt));
  const totalPaid = payments.reduce((s, p) => s + parseFloat(p.amount), 0);
  const allShareholders = await db.select().from(shareholdersTable);
  const totalShares = allShareholders.reduce((s, sh) => s + sh.shares, 0);
  const percentage = totalShares > 0 ? ((shareholder.shares / totalShares) * 100).toFixed(2) : "0.00";
  res.json({ ...shareholder, percentage, payments, totalPaid });
});

router.post("/shareholders", async (req, res) => {
  const parsed = insertShareholderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: String(parsed.error) });
    return;
  }
  const [created] = await db.insert(shareholdersTable).values(parsed.data).returning();
  res.status(201).json(created);
});

router.put("/shareholders/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const parsed = insertShareholderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: String(parsed.error) });
    return;
  }
  const [updated] = await db.update(shareholdersTable).set(parsed.data).where(eq(shareholdersTable.id, id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

router.delete("/shareholders/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(shareholdersTable).where(eq(shareholdersTable.id, id));
  res.status(204).end();
});

router.get("/shareholders/:id/payments", async (req, res) => {
  const id = parseInt(req.params.id);
  const payments = await db
    .select()
    .from(dividendPaymentsTable)
    .where(eq(dividendPaymentsTable.shareholderId, id))
    .orderBy(desc(dividendPaymentsTable.paidAt));
  res.json(payments);
});

router.post("/shareholders/:id/payments", async (req, res) => {
  const shareholderId = parseInt(req.params.id);
  const parsed = insertDividendSchema.safeParse({ ...req.body, shareholderId });
  if (!parsed.success) {
    res.status(400).json({ error: String(parsed.error) });
    return;
  }
  const [created] = await db.insert(dividendPaymentsTable).values(parsed.data).returning();
  res.status(201).json(created);
});

router.delete("/shareholders/:shareholderId/payments/:paymentId", async (req, res) => {
  const paymentId = parseInt(req.params.paymentId);
  await db.delete(dividendPaymentsTable).where(eq(dividendPaymentsTable.id, paymentId));
  res.status(204).end();
});

export default router;
