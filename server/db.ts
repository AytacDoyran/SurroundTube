import { and, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, youtubeConnections, InsertYoutubeConnection, channels, InsertChannel, channelSubscriptions, mediaUploads, InsertMediaUpload, mediaLikes, mediaComments } from "../drizzle/schema";
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

export async function getOwnedChannel(ownerOpenId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(channels).where(eq(channels.ownerOpenId, ownerOpenId)).limit(1);
  return rows[0];
}

export async function createChannel(channel: InsertChannel) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(channels).values(channel);
  return Number(result[0].insertId);
}

export async function listChannels() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(channels).orderBy(desc(channels.createdAt));
}

export async function listSubscriptions(userOpenId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ channel: channels, subscribedAt: channelSubscriptions.createdAt })
    .from(channelSubscriptions)
    .innerJoin(channels, eq(channelSubscriptions.channelId, channels.id))
    .where(eq(channelSubscriptions.userOpenId, userOpenId))
    .orderBy(desc(channelSubscriptions.createdAt));
}

export async function toggleChannelSubscription(channelId: number, userOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select({ id: channelSubscriptions.id }).from(channelSubscriptions)
    .where(and(eq(channelSubscriptions.channelId, channelId), eq(channelSubscriptions.userOpenId, userOpenId))).limit(1);
  if (existing.length) {
    await db.delete(channelSubscriptions).where(eq(channelSubscriptions.id, existing[0].id));
    return false;
  }
  await db.insert(channelSubscriptions).values({ channelId, userOpenId });
  return true;
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

export async function listMediaUploads(ownerOpenId?: string) {
  const db = await getDb();
  if (!db) return [];
  const query = ownerOpenId ? eq(mediaUploads.ownerOpenId, ownerOpenId) : undefined;
  return db.select().from(mediaUploads).where(query).orderBy(desc(mediaUploads.createdAt));
}

export async function listPublicMediaUploads() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mediaUploads).where(and(eq(mediaUploads.status, "ready"), isNotNull(mediaUploads.processedUrl))).orderBy(desc(mediaUploads.createdAt));
}

export async function deleteMediaUpload(id: number, ownerOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(mediaLikes).where(eq(mediaLikes.mediaId, id));
  await db.delete(mediaComments).where(eq(mediaComments.mediaId, id));
  await db.delete(mediaUploads).where(and(eq(mediaUploads.id, id), eq(mediaUploads.ownerOpenId, ownerOpenId)));
}

export async function incrementMediaViews(mediaId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(mediaUploads).set({ viewsCount: sql`${mediaUploads.viewsCount} + 1`, updatedAt: new Date() }).where(and(eq(mediaUploads.id, mediaId), eq(mediaUploads.status, "ready")));
}

export async function getMediaSocialState(mediaId: number, userOpenId?: string) {
  const db = await getDb();
  if (!db) return { viewsCount: 0, likeCount: 0, liked: false, comments: [] };
  const media = await db.select({ viewsCount: mediaUploads.viewsCount }).from(mediaUploads).where(eq(mediaUploads.id, mediaId)).limit(1);
  const likes = await db.select({ value: count() }).from(mediaLikes).where(eq(mediaLikes.mediaId, mediaId));
  const userLike = userOpenId ? await db.select({ id: mediaLikes.id }).from(mediaLikes).where(and(eq(mediaLikes.mediaId, mediaId), eq(mediaLikes.userOpenId, userOpenId))).limit(1) : [];
  const comments = await db.select().from(mediaComments).where(eq(mediaComments.mediaId, mediaId)).orderBy(desc(mediaComments.createdAt));
  return { viewsCount: media[0]?.viewsCount ?? 0, likeCount: Number(likes[0]?.value ?? 0), liked: userLike.length > 0, comments: comments.map(({ id, userName, text, createdAt, userOpenId: commentOwnerOpenId }) => ({ id, userName, text, createdAt, canDelete: commentOwnerOpenId === userOpenId })) };
}

export async function toggleMediaLike(mediaId: number, userOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select({ id: mediaLikes.id }).from(mediaLikes).where(and(eq(mediaLikes.mediaId, mediaId), eq(mediaLikes.userOpenId, userOpenId))).limit(1);
  if (existing.length) {
    await db.delete(mediaLikes).where(eq(mediaLikes.id, existing[0].id));
    return false;
  }
  try { await db.insert(mediaLikes).values({ mediaId, userOpenId }); return true; }
  catch { return true; }
}

export async function createMediaComment(mediaId: number, userOpenId: string, userName: string, text: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(mediaComments).values({ mediaId, userOpenId, userName, text });
  return Number(result[0].insertId);
}

export async function deleteMediaComment(commentId: number, userOpenId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(mediaComments).where(and(eq(mediaComments.id, commentId), eq(mediaComments.userOpenId, userOpenId)));
}
