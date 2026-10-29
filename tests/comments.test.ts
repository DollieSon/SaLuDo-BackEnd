import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { getApp, createUser, login, createCandidate, bearer } from "./helpers";
import { UserRole } from "../Models/User";

// Comments on a candidate follow the candidate's assignment rules
describe("comment access control", () => {
  let assignedToken: string;
  let unassignedToken: string;
  let managerToken: string;
  let candidateId: string;
  let commentId: string;

  beforeAll(async () => {
    const assigned = await createUser(UserRole.INTERVIEWER, "assigned");
    const unassigned = await createUser(UserRole.INTERVIEWER, "unassigned");
    const manager = await createUser(UserRole.HR_MANAGER, "manager");
    assignedToken = (await login(assigned)).accessToken;
    unassignedToken = (await login(unassigned)).accessToken;
    managerToken = (await login(manager)).accessToken;
    candidateId = await createCandidate([assigned.userId]);

    const created = await request(getApp())
      .post("/api/comments")
      .set(bearer(assignedToken))
      .send({ text: "Strong system design answers", entityType: "CANDIDATE", entityId: candidateId });
    expect(created.status).toBe(201);
    commentId = created.body.data.comment.commentId;
  });

  describe("an assigned interviewer", () => {
    it("can list the candidate's comments", async () => {
      const res = await request(getApp())
        .get(`/api/comments/CANDIDATE/${candidateId}`)
        .set(bearer(assignedToken));
      expect(res.status).toBe(200);
      expect(res.body.data.comments).toHaveLength(1);
    });

    it("can read a single comment and its replies", async () => {
      const single = await request(getApp())
        .get(`/api/comments/single/${commentId}`)
        .set(bearer(assignedToken));
      const replies = await request(getApp())
        .get(`/api/comments/${commentId}/replies`)
        .set(bearer(assignedToken));
      expect(single.status).toBe(200);
      expect(replies.status).toBe(200);
    });
  });

  it("lists the user's own comments (route used to be shadowed)", async () => {
    const res = await request(getApp()).get("/api/comments/user/authored").set(bearer(assignedToken));
    expect(res.status).toBe(200);
    expect(res.body.data.comments.length).toBeGreaterThan(0);
  });

  it("an HR manager can see every candidate's comments", async () => {
    const res = await request(getApp())
      .get(`/api/comments/CANDIDATE/${candidateId}`)
      .set(bearer(managerToken));
    expect(res.status).toBe(200);
  });

  describe("an unassigned interviewer", () => {
    it.each([
      ["list", `/api/comments/CANDIDATE/{id}`],
      ["list top-level", `/api/comments/CANDIDATE/{id}/top-level`],
      ["stats", `/api/comments/stats/CANDIDATE/{id}`],
    ])("is refused: %s", async (_name, path) => {
      const res = await request(getApp())
        .get(path.replace("{id}", candidateId))
        .set(bearer(unassignedToken));
      expect(res.status).toBe(403);
    });

    it("cannot comment on the candidate", async () => {
      const res = await request(getApp())
        .post("/api/comments")
        .set(bearer(unassignedToken))
        .send({ text: "sneaky", entityType: "CANDIDATE", entityId: candidateId });
      expect(res.status).toBe(403);
    });

    it.each(["/api/comments/typing", "/api/comments/presence/join", "/api/comments/presence/leave"])(
      "cannot broadcast real-time events: %s",
      async (path) => {
        const res = await request(getApp())
          .post(path)
          .set(bearer(unassignedToken))
          .send({ entityType: "CANDIDATE", entityId: candidateId, isTyping: true });
        expect(res.status).toBe(403);
      }
    );

    it("sees the candidate's comments as not found by ID", async () => {
      const single = await request(getApp())
        .get(`/api/comments/single/${commentId}`)
        .set(bearer(unassignedToken));
      const replies = await request(getApp())
        .get(`/api/comments/${commentId}/replies`)
        .set(bearer(unassignedToken));
      const edit = await request(getApp())
        .put(`/api/comments/${commentId}`)
        .set(bearer(unassignedToken))
        .send({ text: "edited" });
      const remove = await request(getApp())
        .delete(`/api/comments/${commentId}`)
        .set(bearer(unassignedToken));

      expect([single.status, replies.status, edit.status, remove.status]).toEqual([404, 404, 404, 404]);
    });

    it("can still comment on jobs, which all staff can see", async () => {
      const res = await request(getApp())
        .post("/api/comments")
        .set(bearer(unassignedToken))
        .send({ text: "Should we raise the band?", entityType: "JOB", entityId: "job-123" });
      expect(res.status).toBe(201);
    });
  });

  it("rejects non-string entity IDs (operator injection)", async () => {
    const res = await request(getApp())
      .post("/api/comments/typing")
      .set(bearer(managerToken))
      .send({ entityType: "CANDIDATE", entityId: { $ne: null }, isTyping: true });
    expect(res.status).toBe(400);
  });

  it("returns 404 for comments on an unknown candidate", async () => {
    const res = await request(getApp())
      .get("/api/comments/CANDIDATE/does-not-exist")
      .set(bearer(managerToken));
    expect(res.status).toBe(404);
  });

  it("requires authentication", async () => {
    const res = await request(getApp()).get(`/api/comments/CANDIDATE/${candidateId}`);
    expect(res.status).toBe(401);
  });
});
