import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFor(openId: string): TrpcContext {
  const now = new Date();
  return {
    user: { id: 1, openId, email: "test@example.com", name: "Test", loginMethod: "test", role: "admin", createdAt: now, updatedAt: now, lastSignedIn: now },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("media owner access", () => {
  it("rejects a non-owner from the private media list", async () => {
    const caller = appRouter.createCaller(contextFor("not-the-configured-owner"));
    await expect(caller.media.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
