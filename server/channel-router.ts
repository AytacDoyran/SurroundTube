import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createChannel, getOwnedChannel, listChannels, listSubscriptions, toggleChannelSubscription } from "./db";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const channelInput = z.object({
  name: z.string().trim().min(2).max(120),
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,40}$/),
  description: z.string().trim().max(1000).optional(),
});

export const channelRouter = router({
  list: publicProcedure.query(async () => listChannels()),
  mine: protectedProcedure.query(async ({ ctx }) => getOwnedChannel(ctx.user.openId) ?? null),
  subscriptions: protectedProcedure.query(async ({ ctx }) => listSubscriptions(ctx.user.openId)),
  create: protectedProcedure.input(channelInput).mutation(async ({ ctx, input }) => {
    const existing = await getOwnedChannel(ctx.user.openId);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Bu hesap zaten bir kanala sahip." });
    try {
      const id = await createChannel({ ownerOpenId: ctx.user.openId, name: input.name, handle: input.handle, description: input.description || null });
      return { id, name: input.name, handle: input.handle } as const;
    } catch (error) {
      throw new TRPCError({ code: "CONFLICT", message: "Bu kanal kullanıcı adı zaten kullanılıyor." , cause: error });
    }
  }),
  toggleSubscription: protectedProcedure.input(z.object({ channelId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const subscribed = await toggleChannelSubscription(input.channelId, ctx.user.openId);
    return { subscribed } as const;
  }),
});
