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

describe("media access", () => {
  it("rejects anonymous users from the private media list", async () => {
    const caller = appRouter.createCaller(contextFor(undefined));
    await expect(caller.media.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
