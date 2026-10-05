import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFor(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("channel router", () => {
  it("allows the public channel directory without login", async () => {
    await expect(appRouter.createCaller(contextFor(undefined)).channel.list()).resolves.toBeInstanceOf(Array);
  });

  it("protects channel ownership and subscriptions", async () => {
    const caller = appRouter.createCaller(contextFor(undefined));
    await expect(caller.channel.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.channel.subscriptions()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
