import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getYoutubeConnection } from "./db";
import { createYoutubeAuthUrl, getYoutubeAccessToken } from "./youtube-oauth";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const searchInput = z.object({
  query: z.string().trim().min(1).max(100),
  maxResults: z.number().int().min(1).max(25).default(8),
});

async function youtubeRequest(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`https://www.googleapis.com/youtube/v3${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload
      ? JSON.stringify((payload as { error?: unknown }).error)
      : "YouTube işlemi başarısız oldu";
    throw new TRPCError({ code: response.status === 401 ? "UNAUTHORIZED" : "BAD_REQUEST", message });
  }
  return payload;
}

export const youtubeRouter = router({
  search: publicProcedure.input(searchInput).query(async ({ input }) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "YouTube API anahtarı henüz yapılandırılmadı." });
    }
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", String(input.maxResults));
    url.searchParams.set("q", input.query);
    url.searchParams.set("safeSearch", "moderate");
    url.searchParams.set("key", apiKey);
    const response = await fetch(url);
    const payload = (await response.json()) as {
      pageInfo?: { totalResults?: number; resultsPerPage?: number };
      items?: Array<{ id?: { videoId?: string }; snippet?: Record<string, unknown> }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new TRPCError({ code: response.status === 403 ? "FORBIDDEN" : "BAD_REQUEST", message: payload.error?.message ?? "YouTube araması başarısız oldu." });
    }
    return { items: (payload.items ?? []).filter((item) => Boolean(item.id?.videoId)), pageInfo: payload.pageInfo };
  }),

  authUrl: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      return { url: await createYoutubeAuthUrl(ctx.req, ctx.user.openId) };
    } catch (error) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "Google OAuth yapılandırması eksik" });
    }
  }),

  connection: protectedProcedure.query(async ({ ctx }) => {
    const connection = await getYoutubeConnection(ctx.user.openId);
    return { connected: Boolean(connection), scope: connection?.scope ?? null };
  }),

  like: protectedProcedure.input(z.object({ videoId: z.string().min(1).max(32) })).mutation(async ({ ctx, input }) => {
    const token = await getYoutubeAccessToken(ctx.user.openId);
    await youtubeRequest(`/videos/rate?id=${encodeURIComponent(input.videoId)}&rating=like`, token, { method: "POST" });
    return { success: true } as const;
  }),

  subscribe: protectedProcedure.input(z.object({ channelId: z.string().min(1).max(64) })).mutation(async ({ ctx, input }) => {
    const token = await getYoutubeAccessToken(ctx.user.openId);
    await youtubeRequest("/subscriptions?part=snippet", token, {
      method: "POST",
      body: JSON.stringify({ snippet: { resourceId: { kind: "youtube#channel", channelId: input.channelId } } }),
    });
    return { success: true } as const;
  }),

  comment: protectedProcedure.input(z.object({ videoId: z.string().min(1).max(32), text: z.string().trim().min(1).max(10000) })).mutation(async ({ ctx, input }) => {
    const token = await getYoutubeAccessToken(ctx.user.openId);
    await youtubeRequest("/commentThreads?part=snippet", token, {
      method: "POST",
      body: JSON.stringify({ snippet: { videoId: input.videoId, topLevelComment: { snippet: { textOriginal: input.text } } } }),
    });
    return { success: true } as const;
  }),
});
