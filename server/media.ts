import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import express, { type Express, type Request, type Response } from "express";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { createMediaUpload, updateMediaUpload } from "./db";
import { storagePut } from "./storage";

const MAX_UPLOAD_BYTES = 128 * 1024 * 1024;
const allowedMimeTypes = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"]);

function safeFilename(filename: string) {
  const normalized = filename.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 180);
  return normalized || "upload.mp4";
}

export function runFfmpeg(inputPath: string, outputPath: string) {
  return new Promise<void>((resolve, reject) => {
    const args = [
      "-y", "-threads", "1", "-i", inputPath,
      "-map", "0:v:0", "-map", "[surround]",
      "-filter_complex",
      "[0:a]aformat=channel_layouts=stereo,pan=7.1|FL=FL|FR=FR|FC=0.5*FL+0.5*FR|LFE=0.25*FL+0.25*FR|BL=0.6*FL|BR=0.6*FR|SL=0.45*FL+0.05*FR|SR=0.05*FL+0.45*FR[surround]",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "768k", "-ar", "48000", "-ac", "8",
      "-metadata", "comment=SurroundTube licensed 7.1 upmix",
      "-movflags", "+faststart", outputPath,
    ];
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => { stderr = `${stderr}${chunk.toString()}`.slice(-4000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || `ffmpeg exited with code ${code}`)));
  });
}

async function ownerFromRequest(req: Request) {
  try {
    const user = await sdk.authenticateRequest(req);
    return user && user.openId === ENV.ownerOpenId ? user : null;
  } catch {
    return null;
  }
}

export function registerMediaRoutes(app: Express) {
  app.post("/api/owner/media", expressRawVideo(), async (req: Request, res: Response) => {
    const owner = await ownerFromRequest(req);
    if (!owner) return res.status(403).json({ error: "Only the configured owner can upload media." });

    const mimeType = req.get("content-type")?.split(";")[0] ?? "application/octet-stream";
    const rawFilename = String(req.get("x-file-name") ?? "upload.mp4");
    let decodedFilename = rawFilename;
    try { decodedFilename = decodeURIComponent(rawFilename); } catch { /* keep raw filename */ }
    const filename = safeFilename(decodedFilename);
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) return res.status(400).json({ error: "Video body is empty." });
    if (body.length > MAX_UPLOAD_BYTES) return res.status(413).json({ error: "Video is larger than 128 MB." });
    if (!allowedMimeTypes.has(mimeType)) return res.status(415).json({ error: "Supported formats: MP4, WebM, MOV and MKV." });

    const id = await createMediaUpload({ ownerOpenId: owner.openId, originalFilename: filename, mimeType, sizeBytes: body.length, status: "processing" });
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "surroundtube-"));
    const inputPath = path.join(workDir, `input-${randomUUID()}${path.extname(filename) || ".mp4"}`);
    const outputPath = path.join(workDir, `processed-${randomUUID()}.mp4`);
    try {
      await fs.writeFile(inputPath, body);
      await runFfmpeg(inputPath, outputPath);
      const processed = await fs.readFile(outputPath);
      const stored = await storagePut(`owner-media/${owner.openId}/${id}-${filename.replace(/\.[^.]+$/, "")}-7.1.mp4`, processed, "video/mp4");
      await updateMediaUpload(id, { processedKey: stored.key, processedUrl: stored.url, status: "ready", errorMessage: null });
      return res.json({ id, status: "ready", filename, url: stored.url, audioLayout: "7.1" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Media processing failed";
      await updateMediaUpload(id, { status: "failed", errorMessage: message.slice(0, 2000) }).catch(() => undefined);
      return res.status(500).json({ id, status: "failed", error: "Video processing failed." });
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });
}

function expressRawVideo() {
  return express.raw({ type: ["video/*", "application/octet-stream"], limit: "128mb" });
}
