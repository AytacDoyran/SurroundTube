import type { Express, Request } from "express";
import { jwtVerify, SignJWT } from "jose";
import { getYoutubeConnection, upsertYoutubeConnection } from "./db";

const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";
const encoder = new TextEncoder();

function secretKey() {
  const secret = process.env.JWT_SECRET ?? process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required for OAuth state signing");
  return encoder.encode(secret);
}

function externalOrigin(req: Request) {
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  return `${protocol}://${req.get("host")}`;
}

export function youtubeCallbackUrl(req: Request) {
  return `${externalOrigin(req)}/api/youtube/oauth/callback`;
}

export async function createYoutubeAuthUrl(req: Request, openId: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID is not configured");
  const state = await new SignJWT({ openId, redirectUri: youtubeCallbackUrl(req) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secretKey());
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", youtubeCallbackUrl(req));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YOUTUBE_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

async function exchangeCode(code: string, redirectUri: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const payload = (await response.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? "Google OAuth token exchange failed");
  }
  return payload;
}

export async function refreshYoutubeToken(openId: string, refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const payload = (await response.json()) as { access_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string };
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description ?? payload.error ?? "Google token refresh failed");
  await upsertYoutubeConnection({
    openId,
    accessToken: payload.access_token,
    refreshToken,
    scope: payload.scope ?? YOUTUBE_SCOPE,
    expiresAt: new Date(Date.now() + (payload.expires_in ?? 3600) * 1000),
  });
  return payload.access_token;
}

export async function getYoutubeAccessToken(openId: string) {
  const connection = await getYoutubeConnection(openId);
  if (!connection) throw new Error("YouTube hesabı bağlı değil");
  if (connection.expiresAt && connection.expiresAt.getTime() > Date.now() + 60_000) return connection.accessToken;
  if (!connection.refreshToken) throw new Error("YouTube erişimi sona erdi; hesabı yeniden bağla");
  return refreshYoutubeToken(openId, connection.refreshToken);
}

export function registerYoutubeOAuthRoutes(app: Express) {
  app.get("/api/youtube/oauth/callback", async (req, res) => {
    const { code, state, error } = req.query;
    if (error) {
      res.redirect(`/?youtube=error&reason=${encodeURIComponent(String(error))}`);
      return;
    }
    if (typeof code !== "string" || typeof state !== "string") {
      res.redirect("/?youtube=error&reason=missing_callback_parameters");
      return;
    }
    try {
      const { payload } = await jwtVerify(state, secretKey());
      const openId = typeof payload.openId === "string" ? payload.openId : null;
      const redirectUri = typeof payload.redirectUri === "string" ? payload.redirectUri : youtubeCallbackUrl(req);
      if (!openId) throw new Error("Invalid OAuth state");
      const tokens = await exchangeCode(code, redirectUri);
      const previous = await getYoutubeConnection(openId);
      await upsertYoutubeConnection({
        openId,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? previous?.refreshToken ?? null,
        scope: tokens.scope ?? YOUTUBE_SCOPE,
        expiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
      });
      res.redirect("/?youtube=connected");
    } catch (callbackError) {
      console.error("[YouTube OAuth] callback failed", callbackError);
      res.redirect(`/?youtube=error&reason=${encodeURIComponent("oauth_failed")}`);
    }
  });
}
