import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

async function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any)?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

async function requireAdmin(req: any, res: any, next: any) {
  const userId = (req.session as any)?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  try {
    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user || user.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (!user) { res.status(401).json({ error: "Invalid username or password" }); return; }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) { res.status(401).json({ error: "Invalid username or password" }); return; }
    (req.session as any).userId = user.id;
    res.json({ id: user.id, username: user.username, role: user.role, displayName: user.displayName, createdAt: user.createdAt });
  } catch (err: any) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

router.get("/auth/me", async (req, res) => {
  const userId = (req.session as any)?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
    res.json({ id: user.id, username: user.username, role: user.role, displayName: user.displayName, createdAt: user.createdAt });
  } catch (err: any) {
    req.log.error({ err }, "Me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/users", requireAdmin, async (req, res) => {
  try {
    const users = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      role: usersTable.role,
      displayName: usersTable.displayName,
      createdAt: usersTable.createdAt,
    }).from(usersTable);
    res.json(users);
  } catch (err: any) {
    req.log.error({ err }, "List users error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/users", requireAdmin, async (req, res) => {
  const { username, password, displayName, role } = req.body ?? {};
  if (!username || !password || !displayName) {
    res.status(400).json({ error: "username, password, and displayName are required" });
    return;
  }
  try {
    const hashed = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      username, password: hashed, displayName, role: role ?? "staff",
    }).returning({ id: usersTable.id, username: usersTable.username, role: usersTable.role, displayName: usersTable.displayName, createdAt: usersTable.createdAt });
    res.status(201).json(user);
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Username already exists" }); return; }
    req.log.error({ err }, "Create user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/auth/users/:id/password", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { password } = req.body ?? {};
  if (!password || password.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters" });
    return;
  }
  try {
    const hashed = await bcrypt.hash(password, 10);
    const [user] = await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, id)).returning({ id: usersTable.id });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "Change password error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/auth/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const currentUserId = (req.session as any)?.userId;
  if (id === currentUserId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }
  try {
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "Delete user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
