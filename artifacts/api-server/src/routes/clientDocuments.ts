import { Router } from "express";
import { db } from "@workspace/db";
import { clientDocumentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const storage = new ObjectStorageService();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any)?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

router.get("/clients/:clientId/documents", requireAuth, async (req, res) => {
  const clientId = parseInt(req.params.clientId);
  try {
    const docs = await db
      .select()
      .from(clientDocumentsTable)
      .where(eq(clientDocumentsTable.clientId, clientId))
      .orderBy(desc(clientDocumentsTable.createdAt));
    res.json(docs);
  } catch (err: any) {
    req.log.error({ err }, "Get client documents error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/clients/:clientId/documents", requireAuth, async (req, res) => {
  const clientId = parseInt(req.params.clientId);
  const { documentType, objectPath, fileName, fileSize } = req.body ?? {};
  if (!documentType || !objectPath || !fileName) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  try {
    const [doc] = await db
      .insert(clientDocumentsTable)
      .values({ clientId, documentType, objectPath, fileName, fileSize })
      .returning();
    res.status(201).json(doc);
  } catch (err: any) {
    req.log.error({ err }, "Save client document error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/clients/:clientId/documents/:docId", requireAuth, async (req, res) => {
  const docId = parseInt(req.params.docId);
  try {
    await db.delete(clientDocumentsTable).where(eq(clientDocumentsTable.id, docId));
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "Delete client document error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/storage/uploads/request-url", requireAuth, async (req, res) => {
  try {
    const uploadURL = await storage.getObjectEntityUploadURL();
    const objectPath = storage.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath });
  } catch (err: any) {
    req.log.error({ err }, "Request upload URL error");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

router.get("/storage/objects/{*objectPath}", requireAuth, async (req, res) => {
  const rawPath = "/objects/" + req.params.objectPath;
  try {
    const file = await storage.getObjectEntityFile(rawPath);
    const response = await storage.downloadObject(file);
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    const buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  } catch (err: any) {
    req.log.error({ err }, "Serve object error");
    res.status(404).json({ error: "Not found" });
  }
});

export default router;
