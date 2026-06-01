import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any)?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

router.get("/clients", requireAuth, async (req, res) => {
  try {
    const clients = await db.select().from(clientsTable).orderBy(clientsTable.createdAt);
    res.json(clients);
  } catch (err: any) {
    req.log.error({ err }, "Get clients error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/clients/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    res.json(client);
  } catch (err: any) {
    req.log.error({ err }, "Get client error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/clients", requireAuth, async (req, res) => {
  const { name, phone, documentType, idNumber, address, imageUrl } = req.body ?? {};
  if (!name || !phone || !documentType || !idNumber || !address) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  try {
    const [client] = await db.insert(clientsTable).values({ name, phone, documentType, idNumber, address, imageUrl }).returning();
    res.status(201).json(client);
  } catch (err: any) {
    req.log.error({ err }, "Create client error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/clients/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, phone, documentType, idNumber, address, imageUrl } = req.body ?? {};
  try {
    const [client] = await db.update(clientsTable).set({ name, phone, documentType, idNumber, address, imageUrl }).where(eq(clientsTable.id, id)).returning();
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }
    res.json(client);
  } catch (err: any) {
    req.log.error({ err }, "Update client error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/clients/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await db.delete(clientsTable).where(eq(clientsTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "Delete client error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
