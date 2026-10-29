import crypto from "crypto";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../app";
import { connectDB } from "../mongo_db";
import { UserRepository } from "../repositories/UserRepository";
import { CandidateService } from "../services/CandidateService";
import { PasswordUtils } from "../routes/middleware/passwordUtils";
import { UserRole } from "../Models/User";
import { REFRESH_TOKEN_COOKIE } from "../utils/securityConfig";

let app: Express | null = null;

export const getApp = (): Express => {
  if (!app) {
    app = createApp();
  }
  return app;
};

export const uniqueEmail = (prefix = "user") =>
  `${prefix}.${crypto.randomUUID().slice(0, 8)}@test.saludo`;

export interface TestUser {
  userId: string;
  email: string;
  password: string;
  role: UserRole;
}

export const createUser = async (role: UserRole, prefix: string = role): Promise<TestUser> => {
  const db = await connectDB();
  const repository = new UserRepository(db);
  const email = uniqueEmail(prefix);
  const password = `Pw-${crypto.randomUUID()}`;
  const user = await repository.createUser({
    email,
    password: await PasswordUtils.hashPassword(password),
    firstName: "Test",
    lastName: prefix,
    title: "Tester",
    role,
  });
  return { userId: user.userId, email, password, role };
};

export interface LoginResult {
  accessToken: string;
  refreshCookie: string; // "name=value", ready for a Cookie header
}

export const extractRefreshCookie = (setCookie: string | string[] | undefined): string | null => {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookie = cookies.find((c) => c.startsWith(`${REFRESH_TOKEN_COOKIE}=`));
  return cookie ? cookie.split(";")[0] : null;
};

export const login = async (user: TestUser): Promise<LoginResult> => {
  const res = await request(getApp())
    .post("/api/users/auth/login")
    .send({ email: user.email, password: user.password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${user.email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const refreshCookie = extractRefreshCookie(res.headers["set-cookie"]);
  if (!refreshCookie) {
    throw new Error("Login did not set the refresh cookie");
  }
  return { accessToken: res.body.data.accessToken, refreshCookie };
};

export const createCandidate = async (assignedUserIds: string[] = []): Promise<string> => {
  const candidate = await new CandidateService().addCandidate(
    "Test Candidate",
    [uniqueEmail("candidate")],
    new Date("1995-01-01")
  );
  const db = await connectDB();
  await db
    .collection("personalInfo")
    .updateOne(
      { candidateId: candidate.candidateId },
      { $set: { assignedHRUserIds: assignedUserIds } }
    );
  return candidate.candidateId;
};

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
