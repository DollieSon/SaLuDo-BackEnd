import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  getApp,
  createUser,
  login,
  extractRefreshCookie,
  uniqueEmail,
  bearer,
  TestUser,
} from "./helpers";
import { UserRole } from "../Models/User";
import { connectDB } from "../mongo_db";

const refresh = (cookie?: string) => {
  const req = request(getApp()).post("/api/users/auth/refresh").send({});
  return cookie ? req.set("Cookie", cookie) : req;
};

describe("login", () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createUser(UserRole.HR_USER);
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const wrongPassword = await request(getApp())
      .post("/api/users/auth/login")
      .send({ email: user.email, password: "definitely-wrong" });
    const unknownEmail = await request(getApp())
      .post("/api/users/auth/login")
      .send({ email: uniqueEmail("nobody"), password: "definitely-wrong" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it("rejects non-string credentials (NoSQL operator injection)", async () => {
    const res = await request(getApp())
      .post("/api/users/auth/login")
      .send({ email: { $gt: "" }, password: "x" });
    expect(res.status).toBe(400);
  });

  it("returns the refresh token only as an HttpOnly cookie", async () => {
    const res = await request(getApp())
      .post("/api/users/auth/login")
      .send({ email: user.email, password: user.password });

    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).toBeUndefined();
    const cookie = (res.headers["set-cookie"] as unknown as string[]).find((c) =>
      c.startsWith("saludo_refresh=")
    );
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/users\/auth/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it("uses SameSite=None; Secure when the frontend calls from another site", async () => {
    const res = await request(getApp())
      .post("/api/users/auth/login")
      .set("Origin", "https://frontend.example")
      .send({ email: user.email, password: user.password });

    const cookie = (res.headers["set-cookie"] as unknown as string[]).find((c) =>
      c.startsWith("saludo_refresh=")
    );
    expect(cookie).toMatch(/SameSite=None/i);
    expect(cookie).toMatch(/Secure/i);
  });

  it("issues access tokens that expire after 15 minutes", async () => {
    const { accessToken } = await login(user);
    const decoded = jwt.decode(accessToken) as { iat: number; exp: number };
    expect(decoded.exp - decoded.iat).toBe(15 * 60);
  });
});

describe("refresh sessions", () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createUser(UserRole.HR_USER);
  });

  it("restores a session (new access token and profile) from the cookie alone", async () => {
    const { refreshCookie } = await login(user);

    const res = await refresh(refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(user.email);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    const jobs = await request(getApp())
      .get("/api/jobs")
      .set(bearer(res.body.data.accessToken));
    expect(jobs.status).toBe(200);
  });

  it("fails without a cookie", async () => {
    const res = await refresh();
    expect(res.status).toBe(401);
  });

  it("rotates the cookie and rejects the old one", async () => {
    const { refreshCookie: original } = await login(user);

    const first = await refresh(original);
    expect(first.status).toBe(200);
    const rotated = extractRefreshCookie(first.headers["set-cookie"]);
    expect(rotated).toBeTruthy();
    expect(rotated).not.toBe(original);

    expect((await refresh(original)).status).toBe(401);
    expect((await refresh(rotated!)).status).toBe(200);
  });

  it("keeps sessions on different devices independent", async () => {
    const laptop = await login(user);
    const phone = await login(user);

    expect((await refresh(laptop.refreshCookie)).status).toBe(200);
    expect((await refresh(phone.refreshCookie)).status).toBe(200);
  });

  it("stores only hashes of refresh tokens", async () => {
    const { refreshCookie } = await login(user);
    const rawToken = refreshCookie.split("=")[1];

    const db = await connectDB();
    const stored = await db.collection("users").findOne({ userId: user.userId });

    expect(stored?.refreshToken).toBeUndefined();
    expect(stored?.refreshSessions.length).toBeGreaterThan(0);
    expect(JSON.stringify(stored?.refreshSessions)).not.toContain(rawToken);
  });

  it("logout revokes only the session that logged out", async () => {
    const laptop = await login(user);
    const phone = await login(user);

    const res = await request(getApp())
      .post("/api/users/auth/logout")
      .set(bearer(laptop.accessToken))
      .set("Cookie", laptop.refreshCookie)
      .send({});
    expect(res.status).toBe(200);

    expect((await refresh(laptop.refreshCookie)).status).toBe(401);
    expect((await refresh(phone.refreshCookie)).status).toBe(200);
  });

  it("logout blacklists the access token", async () => {
    const session = await login(user);
    await request(getApp())
      .post("/api/users/auth/logout")
      .set(bearer(session.accessToken))
      .set("Cookie", session.refreshCookie)
      .send({});

    const res = await request(getApp()).get("/api/jobs").set(bearer(session.accessToken));
    expect(res.status).toBe(401);
  });
});

describe("access token validation", () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createUser(UserRole.HR_USER);
  });

  it("rejects a refresh token presented as an access token", async () => {
    const { refreshCookie } = await login(user);
    const rawRefreshToken = refreshCookie.split("=")[1];

    const res = await request(getApp()).get("/api/jobs").set(bearer(rawRefreshToken));
    expect(res.status).toBe(401);
  });

  it("rejects unsigned (alg=none) tokens", async () => {
    const encode = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const forged = `${encode({ alg: "none", typ: "JWT" })}.${encode({
      userId: user.userId,
      type: "access",
    })}.`;

    const res = await request(getApp()).get("/api/jobs").set(bearer(forged));
    expect(res.status).toBe(401);
  });
});
