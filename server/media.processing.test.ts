import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { runFfmpeg } from "./media";

const execFile = promisify(execFileCallback);

describe("media processing", () => {
  it("creates an 8-channel 7.1 audio stream from a stereo video", async () => {
    const workDir = await mkdtemp(path.join(os.tmpdir(), "surroundtube-test-"));
    const inputPath = path.join(workDir, "input.mp4");
    const outputPath = path.join(workDir, "output.mp4");
    try {
      await execFile("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc=size=128x72:rate=24", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "0.5", "-c:v", "libx264", "-c:a", "aac", "-pix_fmt", "yuv420p", inputPath]);
      await runFfmpeg(inputPath, outputPath);
      const probe = await execFile("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels,channel_layout", "-of", "json", outputPath]);
      const stream = JSON.parse(probe.stdout).streams[0];
      expect(stream.channels).toBe(8);
      expect(stream.channel_layout).toBe("7.1");
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }, 30000);
});
