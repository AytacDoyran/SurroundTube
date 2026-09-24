import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("youtube.search", () => {
  it("requires a server-side YouTube API key", async () => {
    const previous = process.env.YOUTUBE_API_KEY;
    delete process.env.YOUTUBE_API_KEY;

    await expect(
      appRouter.createCaller(createContext()).youtube.search({
        query: "ambient music",
        maxResults: 4,
      }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    if (previous === undefined) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = previous;
  });
});
