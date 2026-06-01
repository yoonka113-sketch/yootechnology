import { Router } from "express";
import { db } from "@workspace/db";
import { documentTypesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any)?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

router.get("/document-types", requireAuth, async (req, res) => {
  try {
    const types = await db.select().from(documentTypesTable).orderBy(documentTypesTable.name);
    res.json(types);
  } catch (err: any) {
    req.log.error({ err }, "Get document types error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/document-types", requireAuth, async (req, res) => {
  const { name } = req.body ?? {};
  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    const [type] = await db.insert(documentTypesTable).values({ name: name.trim() }).returning();
    res.status(201).json(type);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Document type already exists" });
      return;
    }
    req.log.error({ err }, "Create document type error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/document-types/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await db.delete(documentTypesTable).where(eq(documentTypesTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "Delete document type error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
