import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { getApp, createUser, login, createCandidate, bearer } from "./helpers";
import { UserRole } from "../Models/User";
import { JobService } from "../services/JobService";

describe("authentication is required", () => {
  it.each([
    "/api/candidates",
    "/api/jobs",
    "/api/skills/master",
    "/api/files/000000000000000000000000",
    "/api/notifications",
  ])("GET %s without a token is 401", async (path) => {
    const res = await request(getApp()).get(path);
    expect(res.status).toBe(401);
  });
});

describe("candidate assignments", () => {
  let candidateId: string;
  let assignedToken: string;
  let unassignedToken: string;
  let managerToken: string;

  beforeAll(async () => {
    const assigned = await createUser(UserRole.HR_USER, "assigned");
    const unassigned = await createUser(UserRole.HR_USER, "unassigned");
    const manager = await createUser(UserRole.HR_MANAGER, "manager");
    assignedToken = (await login(assigned)).accessToken;
    unassignedToken = (await login(unassigned)).accessToken;
    managerToken = (await login(manager)).accessToken;
    candidateId = await createCandidate([assigned.userId]);
  });

  it("lets the assigned user read the candidate", async () => {
    const res = await request(getApp()).get(`/api/candidates/${candidateId}`).set(bearer(assignedToken));
    expect(res.status).toBe(200);
  });

  it("lets an HR manager read any candidate", async () => {
    const res = await request(getApp()).get(`/api/candidates/${candidateId}`).set(bearer(managerToken));
    expect(res.status).toBe(200);
  });

  it("refuses users who are not assigned", async () => {
    const res = await request(getApp()).get(`/api/candidates/${candidateId}`).set(bearer(unassignedToken));
    expect(res.status).toBe(403);
  });
});

describe("public applicant endpoints", () => {
  it("expose only the job's name and description", async () => {
    const job = await new JobService().createJob({
      jobName: "Backend Engineer",
      jobDescription: "Build APIs",
      skills: [],
    });
    const jobId = String((job as { _id?: unknown })._id);

    const res = await request(getApp()).get(`/api/public/jobs/${jobId}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(["_id", "jobDescription", "jobName"]);
  });

  it("reject an application without a resume", async () => {
    const res = await request(getApp())
      .post("/api/public/applications")
      .field("name", "Applicant")
      .field("email", "applicant@test.saludo");
    expect(res.status).toBe(400);
  });
});

describe("HTTP hardening", () => {
  it("sends security headers", async () => {
    const res = await request(getApp()).get("/api/data");
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("only allows the configured frontend origin", async () => {
    const allowed = await request(getApp()).get("/api/data").set("Origin", "http://localhost:5173");
    const other = await request(getApp()).get("/api/data").set("Origin", "https://evil.example");

    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
