import { describe, it, expect } from "vitest";
import request from "supertest";
import { getApp, createUser, uniqueEmail } from "./helpers";
import { UserRole } from "../Models/User";
import { connectDB } from "../mongo_db";
import {
  getThrottleDelayMs,
  loginThrottleService,
  LOGIN_THROTTLE,
  ACCOUNT_BACKSTOP,
} from "../services/LoginThrottleService";

const MINUTE = 60 * 1000;

const attemptLogin = (email: string, password: string) =>
  request(getApp()).post("/api/users/auth/login").send({ email, password });

describe("getThrottleDelayMs", () => {
  it("allows the free attempts without delay", () => {
    for (let failures = 0; failures < LOGIN_THROTTLE.FREE_ATTEMPTS; failures++) {
      expect(getThrottleDelayMs(failures)).toBe(0);
    }
  });

  it("doubles the delay after each further failure, capped at 30 minutes", () => {
    expect(getThrottleDelayMs(5)).toBe(1 * MINUTE);
    expect(getThrottleDelayMs(6)).toBe(2 * MINUTE);
    expect(getThrottleDelayMs(7)).toBe(4 * MINUTE);
    expect(getThrottleDelayMs(10)).toBe(30 * MINUTE);
    expect(getThrottleDelayMs(1000)).toBe(30 * MINUTE);
  });
});

describe("LoginThrottleService", () => {
  it("throttles an (email, IP) pair without affecting other IPs", async () => {
    const email = uniqueEmail("pair");
    for (let i = 0; i < LOGIN_THROTTLE.FREE_ATTEMPTS; i++) {
      await loginThrottleService.recordFailure(email, "198.51.100.1");
    }

    expect(await loginThrottleService.getRemainingDelayMs(email, "198.51.100.1")).toBeGreaterThan(0);
    expect(await loginThrottleService.getRemainingDelayMs(email, "203.0.113.7")).toBe(0);

    await loginThrottleService.reset(email, "198.51.100.1");
    expect(await loginThrottleService.getRemainingDelayMs(email, "198.51.100.1")).toBe(0);
  });
});

describe("login lockout", () => {
  it("throttles repeated failures from one IP without locking the account", async () => {
    const user = await createUser(UserRole.RECRUITER);

    for (let i = 0; i < LOGIN_THROTTLE.FREE_ATTEMPTS; i++) {
      expect((await attemptLogin(user.email, "wrong-password")).status).toBe(401);
    }
    // Even the right password is refused from this IP for now
    expect((await attemptLogin(user.email, user.password)).status).toBe(401);

    // ...but the account itself is not locked, so the owner on another
    // network is unaffected
    const db = await connectDB();
    const stored = await db.collection("users").findOne({ userId: user.userId });
    expect(stored?.accountLockedUntil).toBeFalsy();
    expect(await loginThrottleService.getRemainingDelayMs(user.email, "203.0.113.7")).toBe(0);

    // Once this pair's delay is gone, the right password works again
    await db.collection("loginThrottle").deleteMany({});
    expect((await attemptLogin(user.email, user.password)).status).toBe(200);
  });

  it("throttles unknown emails the same way (no account enumeration)", async () => {
    const email = uniqueEmail("ghost");
    for (let i = 0; i < LOGIN_THROTTLE.FREE_ATTEMPTS; i++) {
      await attemptLogin(email, "wrong-password");
    }
    const db = await connectDB();
    const record = await db
      .collection("loginThrottle")
      .findOne({ key: { $regex: `^${email.replace(/\./g, "\\.")}\\|` } });
    expect(record?.failures).toBe(LOGIN_THROTTLE.FREE_ATTEMPTS);
    expect(record?.lockedUntil).toBeTruthy();
  });

  it("still locks the account after distributed guessing (backstop)", async () => {
    const user = await createUser(UserRole.RECRUITER);
    const db = await connectDB();
    // Simulate failures already made from many other IPs
    await db
      .collection("users")
      .updateOne(
        { userId: user.userId },
        { $set: { failedLoginAttempts: ACCOUNT_BACKSTOP.MAX_ATTEMPTS - 1 } }
      );

    expect((await attemptLogin(user.email, "wrong-password")).status).toBe(401);

    const stored = await db.collection("users").findOne({ userId: user.userId });
    expect(stored?.accountLockedUntil).toBeTruthy();
    await db.collection("loginThrottle").deleteMany({});
    expect((await attemptLogin(user.email, user.password)).status).toBe(401);
  });

  it("resets the pair's counter after a successful login", async () => {
    const user = await createUser(UserRole.RECRUITER);
    await attemptLogin(user.email, "wrong-password");
    await attemptLogin(user.email, "wrong-password");
    expect((await attemptLogin(user.email, user.password)).status).toBe(200);

    const db = await connectDB();
    const remaining = await db
      .collection("loginThrottle")
      .countDocuments({ key: { $regex: `^${user.email.replace(/\./g, "\\.")}\\|` } });
    expect(remaining).toBe(0);
  });
});
