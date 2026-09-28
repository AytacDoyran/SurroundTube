import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const youtubeConnections = mysqlTable("youtube_connections", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  scope: text("scope"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const mediaUploads = mysqlTable("media_uploads", {
  id: int("id").autoincrement().primaryKey(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }).notNull(),
  originalFilename: varchar("originalFilename", { length: 255 }).notNull(),
  processedKey: text("processedKey"),
  processedUrl: text("processedUrl"),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  viewsCount: int("viewsCount").default(0).notNull(),
  status: mysqlEnum("status", ["processing", "ready", "failed"]).default("processing").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const mediaLikes = mysqlTable("media_likes", {
  id: int("id").autoincrement().primaryKey(),
  mediaId: int("mediaId").notNull(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ uniqueMediaLike: uniqueIndex("media_likes_media_user_unique").on(table.mediaId, table.userOpenId) }));

export const mediaComments = mysqlTable("media_comments", {
  id: int("id").autoincrement().primaryKey(),
  mediaId: int("mediaId").notNull(),
  userOpenId: varchar("userOpenId", { length: 64 }).notNull(),
  userName: varchar("userName", { length: 255 }).notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type YoutubeConnection = typeof youtubeConnections.$inferSelect;
export type InsertYoutubeConnection = typeof youtubeConnections.$inferInsert;
export type MediaUpload = typeof mediaUploads.$inferSelect;
export type InsertMediaUpload = typeof mediaUploads.$inferInsert;
export type MediaLike = typeof mediaLikes.$inferSelect;
export type MediaComment = typeof mediaComments.$inferSelect;
