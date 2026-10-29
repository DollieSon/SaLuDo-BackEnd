import { describe, it, expect, afterEach } from "vitest";
import { Readable } from "stream";
import request from "supertest";
import { getApp, createUser, login, createCandidate, bearer } from "./helpers";
import { UserRole } from "../Models/User";
import {
  getVideoAnalysisMaxBytes,
  readStreamWithLimit,
} from "../routes/middleware/uploadSecurity";

const MB = 1024 * 1024;

afterEach(() => {
  delete process.env.VIDEO_ANALYSIS_MAX_MB;
});

describe("getVideoAnalysisMaxBytes", () => {
  it("defaults to 100 MB", () => {
    expect(getVideoAnalysisMaxBytes()).toBe(100 * MB);
  });

  it("can be overridden with VIDEO_ANALYSIS_MAX_MB", () => {
    process.env.VIDEO_ANALYSIS_MAX_MB = "250";
    expect(getVideoAnalysisMaxBytes()).toBe(250 * MB);
  });

  it("ignores invalid overrides", () => {
    process.env.VIDEO_ANALYSIS_MAX_MB = "lots";
    expect(getVideoAnalysisMaxBytes()).toBe(100 * MB);
  });
});

describe("readStreamWithLimit", () => {
  const chunks = (count: number, size: number) =>
    Readable.from(Array.from({ length: count }, () => Buffer.alloc(size, 1)));

  it("reads a stream within the limit", async () => {
    const buffer = await readStreamWithLimit(chunks(4, 100), 1000);
    expect(buffer?.length).toBe(400);
  });

  it("stops as soon as the limit is exceeded", async () => {
    const buffer = await readStreamWithLimit(chunks(20, 100), 1000);
    expect(buffer).toBeNull();
  });
});

describe("POST /videos/introduction/:videoId/process", () => {
  // Minimal ISO media header (passes the upload's magic-byte check)
  const fakeMp4 = Buffer.concat([
    Buffer.from([0, 0, 0, 0x18]),
    Buffer.from("ftypisom"),
    Buffer.alloc(4096, 0),
  ]);

  it("refuses videos above the analysis limit before calling Gemini", async () => {
    const user = await createUser(UserRole.HR_USER);
    const { accessToken } = await login(user);
    const candidateId = await createCandidate([user.userId]);

    const upload = await request(getApp())
      .post(`/api/candidates/${candidateId}/videos/introduction/upload`)
      .set(bearer(accessToken))
      .attach("video", fakeMp4, { filename: "intro.mp4", contentType: "video/mp4" });
    expect(upload.status).toBe(201);
    const videoId = upload.body.data.fileId;

    process.env.VIDEO_ANALYSIS_MAX_MB = "0.001"; // ~1 KB
    const res = await request(getApp())
      .post(`/api/candidates/${candidateId}/videos/introduction/${videoId}/process`)
      .set(bearer(accessToken));

    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/too large for AI analysis/);
  });
});
