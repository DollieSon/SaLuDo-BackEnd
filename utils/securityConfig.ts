// =======================
// SECURITY CONFIGURATION
// =======================
// Purpose: Single source of truth for JWT secrets, JWT verification options,
//          CORS allowed origins and the refresh-token cookie settings.
// Related: AuthMiddleware, PasswordUtils, WebSocketService, index.ts
// =======================

import crypto from "crypto";
import type { CookieOptions } from "express";
import type { SignOptions, VerifyOptions } from "jsonwebtoken";

// Placeholder values that shipped in older versions of this codebase. Tokens
// signed with these are forgeable by anyone, so they are treated as "unset".
const PUBLIC_PLACEHOLDER_SECRETS = new Set([
  "your-jwt-secret-change-in-production",
  "your-jwt-refresh-secret-change-in-production",
]);

const MIN_SECRET_LENGTH = 32;

export const JWT_ALGORITHM = "HS256" as const;
export const JWT_SIGN_OPTIONS: SignOptions = { algorithm: JWT_ALGORITHM };
export const JWT_VERIFY_OPTIONS: VerifyOptions = { algorithms: [JWT_ALGORITHM] };

const isUsableSecret = (value: string | undefined): value is string =>
  !!value && !PUBLIC_PLACEHOLDER_SECRETS.has(value);

/**
 * Returns a list of problems with the JWT configuration. Empty means OK.
 * Called at startup so the server refuses to boot in any environment.
 */
export const validateJwtConfig = (): string[] => {
  const problems: string[] = [];
  const accessSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!isUsableSecret(accessSecret)) {
    problems.push("JWT_SECRET is not set or uses a public placeholder value");
  } else if (accessSecret.length < MIN_SECRET_LENGTH) {
    console.warn(
      `SECURITY WARNING: JWT_SECRET is shorter than ${MIN_SECRET_LENGTH} characters. Use a 64-byte random hex string.`
    );
  }

  if (refreshSecret !== undefined && refreshSecret !== "") {
    if (!isUsableSecret(refreshSecret)) {
      problems.push("JWT_REFRESH_SECRET uses a public placeholder value");
    } else if (refreshSecret === accessSecret) {
      problems.push("JWT_REFRESH_SECRET must be different from JWT_SECRET");
    }
  }

  return problems;
};

/**
 * Secret used to sign and verify access tokens.
 * Throws instead of falling back to a guessable default.
 */
export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!isUsableSecret(secret)) {
    throw new Error(
      "JWT_SECRET is not configured. Refusing to sign or verify tokens."
    );
  }
  return secret;
};

/**
 * Secret used for refresh tokens. If JWT_REFRESH_SECRET is not set, a
 * separate key is derived from JWT_SECRET so access and refresh tokens are
 * never signed with the same key.
 */
export const getJwtRefreshSecret = (): string => {
  const explicit = process.env.JWT_REFRESH_SECRET;
  if (explicit) {
    if (!isUsableSecret(explicit)) {
      throw new Error("JWT_REFRESH_SECRET uses a public placeholder value.");
    }
    return explicit;
  }
  return crypto
    .createHmac("sha256", getJwtSecret())
    .update("saludo:refresh-token:v1")
    .digest("hex");
};

// =======================
// CORS
// =======================

const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

/**
 * Allowed browser origins, from the comma-separated CORS_ORIGIN variable.
 * Falls back to the Vite dev/preview origins outside production.
 */
export const getAllowedOrigins = (): string[] => {
  const configured = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter((origin) => origin && origin !== "*");

  if (configured.length > 0) return configured;
  return process.env.NODE_ENV === "production" ? [] : DEV_ORIGINS;
};

// =======================
// REFRESH TOKEN COOKIE
// =======================

export const REFRESH_TOKEN_COOKIE = "saludo_refresh";
export const REFRESH_TOKEN_COOKIE_PATH = "/api/users/auth";
export const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * HttpOnly cookie options for the refresh token.
 * Set REFRESH_COOKIE_SAMESITE=none when the frontend and API are on different
 * sites (e.g. two *.onrender.com hosts); that also forces Secure.
 */
export const getRefreshCookieOptions = (): CookieOptions => {
  const configured = (process.env.REFRESH_COOKIE_SAMESITE || "").toLowerCase();
  const sameSite: CookieOptions["sameSite"] =
    configured === "none" || configured === "lax" || configured === "strict"
      ? configured
      : "strict";

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || sameSite === "none",
    sameSite,
    path: REFRESH_TOKEN_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  };
};

/**
 * Reads a single cookie from the raw Cookie header (avoids a cookie-parser dependency).
 */
export const readCookie = (
  cookieHeader: string | undefined,
  name: string
): string | undefined => {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
};
