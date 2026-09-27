import { and, eq, desc, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, youtubeConnections, InsertYoutubeConnection, mediaUploads, InsertMediaUpload } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getYoutubeConnection(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(youtubeConnections).where(eq(youtubeConnections.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertYoutubeConnection(connection: InsertYoutubeConnection) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(youtubeConnections).values(connection).onDuplicateKeyUpdate({
    set: { accessToken: connection.accessToken, refreshToken: connection.refreshToken, scope: connection.scope, expiresAt: connection.expiresAt, updatedAt: new Date() },
  });
}

export async function createMediaUpload(upload: InsertMediaUpload) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(mediaUploads).values(upload);
  return Number(result[0].insertId);
}

export async function updateMediaUpload(id: number, values: Partial<InsertMediaUpload>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(mediaUploads).set({ ...values, updatedAt: new Date() }).where(eq(mediaUploads.id, id));
}

export async function listMediaUploads(ownerOpenId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mediaUploads).where(eq(mediaUploads.ownerOpenId, ownerOpenId)).orderBy(desc(mediaUploads.createdAt));
}

export async function listPublicMediaUploads() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mediaUploads).where(and(eq(mediaUploads.status, "ready"), isNotNull(mediaUploads.processedUrl))).orderBy(desc(mediaUploads.createdAt));
}

export async function deleteMediaUpload(id: number, ownerOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(mediaUploads).where(and(eq(mediaUploads.id, id), eq(mediaUploads.ownerOpenId, ownerOpenId)));
}
