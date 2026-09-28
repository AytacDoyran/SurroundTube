import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createMediaComment, deleteMediaComment, deleteMediaUpload, getMediaSocialState, incrementMediaViews, listMediaUploads, listPublicMediaUploads, toggleMediaLike } from "./db";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const mediaIdInput = z.object({ id: z.number().int().positive() });

const shapeMedia = ({ id, ownerOpenId, originalFilename, processedUrl, mimeType, sizeBytes, viewsCount, status, errorMessage, createdAt, updatedAt }: Awaited<ReturnType<typeof listMediaUploads>>[number]) => ({
  id, ownerOpenId, originalFilename, processedUrl, mimeType, sizeBytes, viewsCount, status, errorMessage, createdAt, updatedAt,
});

const shapePublicMedia = ({ ownerOpenId: _ownerOpenId, ...media }: ReturnType<typeof shapeMedia>) => media;

export const mediaRouter = router({
  publicList: publicProcedure.query(async () => (await listPublicMediaUploads()).map(shapeMedia).map(shapePublicMedia)),
  list: protectedProcedure.query(async ({ ctx }) => (await listMediaUploads(ctx.user.openId)).map(shapeMedia)),
  social: publicProcedure.input(mediaIdInput).query(async ({ ctx, input }) => getMediaSocialState(input.id, ctx.user?.openId)),
  view: publicProcedure.input(mediaIdInput).mutation(async ({ input }) => {
    await incrementMediaViews(input.id);
    return { success: true } as const;
  }),
  like: protectedProcedure.input(mediaIdInput).mutation(async ({ ctx, input }) => ({ liked: await toggleMediaLike(input.id, ctx.user.openId) })),
  comment: protectedProcedure.input(z.object({ id: z.number().int().positive(), text: z.string().trim().min(1).max(2000) })).mutation(async ({ ctx, input }) => {
    const userName = ctx.user.name || ctx.user.email || "Kullanıcı";
    const commentId = await createMediaComment(input.id, ctx.user.openId, userName, input.text);
    return { id: commentId, success: true } as const;
  }),
  deleteComment: protectedProcedure.input(z.object({ commentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await deleteMediaComment(input.commentId, ctx.user.openId);
    return { success: true } as const;
  }),
  delete: protectedProcedure.input(mediaIdInput).mutation(async ({ ctx, input }) => {
    const ownRows = await listMediaUploads(ctx.user.openId);
    if (!ownRows.some((row) => row.id === input.id)) throw new TRPCError({ code: "FORBIDDEN", message: "You can only delete your own videos." });
    await deleteMediaUpload(input.id, ctx.user.openId);
    return { success: true } as const;
  }),
});
