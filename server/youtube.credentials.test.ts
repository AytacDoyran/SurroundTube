import { describe, expect, it } from "vitest";

describe("YouTube credentials", () => {
  it("accepts the configured API key for a lightweight read request", async () => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    expect(apiKey, "YOUTUBE_API_KEY secret is missing").toBeTruthy();

    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "id");
    url.searchParams.set("id", "M7lc1UVf-VE");
    url.searchParams.set("key", apiKey!);

    const response = await fetch(url);
    const payload = (await response.json()) as { items?: Array<{ id?: string }>; error?: { message?: string } };

    expect(response.ok, payload.error?.message ?? "YouTube API rejected the configured key").toBe(true);
    expect(payload.items?.some((item) => item.id === "M7lc1UVf-VE")).toBe(true);
  }, 15000);
});
