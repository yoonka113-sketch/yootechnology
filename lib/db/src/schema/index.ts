import { pgTable, serial, text, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("admin"),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  documentType: text("document_type").notNull(),
  idNumber: text("id_number").notNull(),
  address: text("address").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const notaryRecordsTable = pgTable("notary_records", {
  id: serial("id").primaryKey(),
  refNumber: text("ref_number").notNull().unique(),
  clientId: integer("client_id").references(() => clientsTable.id, { onDelete: "cascade" }),
  clientName: text("client_name").notNull(),
  workType: text("work_type").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  date: date("date").notNull(),
  status: text("status").notNull().default("unpaid"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const documentTypesTable = pgTable("document_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const clientDocumentsTable = pgTable("client_documents", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  documentType: text("document_type").notNull(),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const shareholdersTable = pgTable("shareholders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  shares: integer("shares").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const dividendPaymentsTable = pgTable("dividend_payments", {
  id: serial("id").primaryKey(),
  shareholderId: integer("shareholder_id").notNull().references(() => shareholdersTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
  paidAt: date("paid_at").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true });
export const insertRecordSchema = createInsertSchema(notaryRecordsTable).omit({ id: true, createdAt: true });
export const insertShareholderSchema = createInsertSchema(shareholdersTable).omit({ id: true, createdAt: true });
export const insertDividendSchema = createInsertSchema(dividendPaymentsTable).omit({ id: true, createdAt: true });

export type User = typeof usersTable.$inferSelect;
export type Client = typeof clientsTable.$inferSelect;
export type NotaryRecord = typeof notaryRecordsTable.$inferSelect;
export type DocumentType = typeof documentTypesTable.$inferSelect;
export type ClientDocument = typeof clientDocumentsTable.$inferSelect;
export type Shareholder = typeof shareholdersTable.$inferSelect;
export type DividendPayment = typeof dividendPaymentsTable.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type InsertRecord = z.infer<typeof insertRecordSchema>;
export type InsertShareholder = z.infer<typeof insertShareholderSchema>;
export type InsertDividend = z.infer<typeof insertDividendSchema>;
