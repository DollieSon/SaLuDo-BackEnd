// =======================
// LOGIN THROTTLE SERVICE
// =======================
// Purpose: Slow down password guessing without letting an attacker lock real
// users out. Failed logins are counted per (email, client IP): after a few
// free attempts that pair has to wait, with the delay doubling on each further
// failure. The account owner, logging in from another network, is unaffected.
// A much higher account-wide limit (see ACCOUNT_BACKSTOP) still stops
// distributed guessing from many IPs.
// Related: routes/users.ts (POST /auth/login), Models/User.ts
// =======================

import { Collection } from "mongodb";
import { connectDB } from "../mongo_db";

export const LOGIN_THROTTLE = {
  FREE_ATTEMPTS: 5, // failures per (email, IP) before delays start
  BASE_DELAY_MS: 60 * 1000, // first delay: 1 minute, doubling afterwards
  MAX_DELAY_MS: 30 * 60 * 1000, // delays are capped at 30 minutes
  RECORD_TTL_SECONDS: 24 * 60 * 60, // records expire a day after the last failure
} as const;

// Account-wide lock, only reached by guessing from many different IPs
export const ACCOUNT_BACKSTOP = {
  MAX_ATTEMPTS: 50,
  LOCKOUT_MINUTES: 15,
} as const;

const COLLECTION_NAME = "loginThrottle";

interface LoginThrottleRecord {
  key: string;
  failures: number;
  lockedUntil?: Date;
  updatedAt: Date;
}

/**
 * Delay imposed after the given number of consecutive failures.
 */
export const getThrottleDelayMs = (failures: number): number => {
  if (failures < LOGIN_THROTTLE.FREE_ATTEMPTS) {
    return 0;
  }
  const doublings = failures - LOGIN_THROTTLE.FREE_ATTEMPTS;
  return Math.min(
    LOGIN_THROTTLE.BASE_DELAY_MS * 2 ** Math.min(doublings, 30),
    LOGIN_THROTTLE.MAX_DELAY_MS
  );
};

const buildKey = (email: string, ip: string | undefined) =>
  `${email}|${ip || "unknown"}`;

export class LoginThrottleService {
  private collectionPromise: Promise<Collection<LoginThrottleRecord>> | null =
    null;

  private getCollection(): Promise<Collection<LoginThrottleRecord>> {
    if (!this.collectionPromise) {
      this.collectionPromise = (async () => {
        const db = await connectDB();
        const collection = db.collection<LoginThrottleRecord>(COLLECTION_NAME);
        await collection.createIndex({ key: 1 }, { unique: true });
        await collection.createIndex(
          { updatedAt: 1 },
          { expireAfterSeconds: LOGIN_THROTTLE.RECORD_TTL_SECONDS }
        );
        return collection;
      })().catch((error) => {
        this.collectionPromise = null;
        throw error;
      });
    }
    return this.collectionPromise;
  }

  /**
   * Milliseconds this (email, IP) pair still has to wait, 0 if it may try now.
   */
  async getRemainingDelayMs(email: string, ip: string | undefined): Promise<number> {
    const collection = await this.getCollection();
    const record = await collection.findOne({ key: buildKey(email, ip) });
    if (!record?.lockedUntil) {
      return 0;
    }
    return Math.max(0, record.lockedUntil.getTime() - Date.now());
  }

  /**
   * Count a failed attempt and start the next delay if the free attempts are used up.
   * Returns the number of consecutive failures for this pair.
   */
  async recordFailure(email: string, ip: string | undefined): Promise<number> {
    const collection = await this.getCollection();
    const key = buildKey(email, ip);
    const now = new Date();

    const record = await collection.findOneAndUpdate(
      { key },
      { $inc: { failures: 1 }, $set: { updatedAt: now } },
      { upsert: true, returnDocument: "after" }
    );
    const failures = record?.failures ?? 1;

    const delayMs = getThrottleDelayMs(failures);
    if (delayMs > 0) {
      await collection.updateOne(
        { key },
        { $set: { lockedUntil: new Date(now.getTime() + delayMs) } }
      );
    }
    return failures;
  }

  /**
   * Clear the counter after a successful login from this pair.
   */
  async reset(email: string, ip: string | undefined): Promise<void> {
    const collection = await this.getCollection();
    await collection.deleteOne({ key: buildKey(email, ip) });
  }
}

export const loginThrottleService = new LoginThrottleService();
