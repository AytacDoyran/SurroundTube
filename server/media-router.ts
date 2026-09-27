import { TRPCError } from "@trpc/server";
import { deleteMediaUpload, listMediaUploads, listPublicMediaUploads } from "./db";
import { ENV } from "./_core/env";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";

const ownerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ENV.ownerOpenId || ctx.user.openId !== ENV.ownerOpenId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only the configured owner can access private media." });
  }
  return next();
});

const shapeMedia = ({ id, originalFilename, processedUrl, mimeType, sizeBytes, status, errorMessage, createdAt, updatedAt }: Awaited<ReturnType<typeof listMediaUploads>>[number]) => ({
  id, originalFilename, processedUrl, mimeType, sizeBytes, status, errorMessage, createdAt, updatedAt,
});

export const mediaRouter = router({
  publicList: publicProcedure.query(async () => (await listPublicMediaUploads()).map(shapeMedia)),
  list: ownerProcedure.query(async ({ ctx }) => (await listMediaUploads(ctx.user.openId)).map(shapeMedia)),
  delete: ownerProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await deleteMediaUpload(input.id, ctx.user.openId);
    return { success: true } as const;
  }),
});
