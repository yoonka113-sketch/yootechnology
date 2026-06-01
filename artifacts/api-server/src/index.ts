import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { usersTable, clientsTable, notaryRecordsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seed() {
  try {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
    if (count > 0) return;

    logger.info("Empty database detected — seeding initial data...");

    const hashed = await bcrypt.hash("admin123", 10);
    await db.insert(usersTable).values({ username: "admin", password: hashed, role: "admin", displayName: "Administrator" });

    const [unknown, yonis, mohamed, abdinasir] = await db.insert(clientsTable).values([
      { name: "Unknown",                      phone: "",                documentType: "National ID", idNumber: "",            address: "" },
      { name: "Yonis Ali Abdalla",            phone: "+252 615548206", documentType: "National ID", idNumber: "21597735699", address: "Zona Key Hodan, Mogadishu Somalia" },
      { name: "Mohamed Rashid Haji Mohamed",  phone: "+252617707571",  documentType: "National ID", idNumber: "21597736582", address: "Barmudo Howl-wadaag Mogadishu Somalia" },
      { name: "Abdinasir Abdulkadir Ibrahim", phone: "12345",          documentType: "National ID", idNumber: "986612",      address: "Hodan" },
    ]).returning();

    await db.insert(notaryRecordsTable).values([
      { refNumber: "XNQ/12/4144",           clientId: abdinasir!.id, clientName: "Abdinasir Abdulkadir Ibrahim", workType: "Power of Attorney",     description: "Wakaalad Gaar Ah",                                                    amount: "100", date: "2026-05-13", status: "paid" },
      { refNumber: "XNQ/B12/2026",          clientId: unknown!.id,   clientName: "Unknown",                      workType: "Agreement",             description: "Heshiis Laba Dhinac",                                                 amount: "95",  date: "2026-05-13", status: "paid" },
      { refNumber: "XNQ/B12/254158/2026",   clientId: mohamed!.id,   clientName: "Mohamed Rashid Haji Mohamed",  workType: "Statutory Declaration", description: "Macamiilkan waxa loo sameeyey warqad cadaynaysaa milkiyad stationary",  amount: "50",  date: "2026-05-05", status: "paid" },
      { refNumber: "XNQ/B12/606CEB7B/2026", clientId: yonis!.id,     clientName: "Yonis Ali Abdalla",            workType: "Agreement",             description: "Heshis Dhisme shirkad cusub loo yaqaano MIDSAN TECH",                 amount: "100", date: "2026-05-12", status: "paid" },
      { refNumber: "3C093C5C",              clientId: unknown!.id,   clientName: "Unknown",                      workType: "Affidavit",             description: "waxa loo qabtay shaqo cadeen ganacsi",                                amount: "150", date: "2026-05-12", status: "paid" },
    ]);

    logger.info("Seed complete — admin user and all data created");
  } catch (err) {
    logger.error({ err }, "Seed error (non-fatal)");
  }
}

seed().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
});
