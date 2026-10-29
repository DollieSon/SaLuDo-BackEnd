// =======================
// URL SAFETY HELPERS
// =======================
// Purpose: Only store user-supplied links the frontend can safely render as
//          <a href>: absolute http(s) URLs (no javascript:, data:, etc.).
// Related: routes/candidates.ts (socialLinks)
// =======================

import { SocialLink } from "../Models/Candidate";

const MAX_URL_LENGTH = 2048;
const MAX_PLATFORM_LENGTH = 50;
const MAX_SOCIAL_LINKS = 20;

export const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Keep only well-formed social links with http(s) URLs.
 */
export const sanitizeSocialLinks = (value: unknown): SocialLink[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (link): link is SocialLink =>
        !!link &&
        typeof link === "object" &&
        typeof link.platform === "string" &&
        isHttpUrl(link.url)
    )
    .slice(0, MAX_SOCIAL_LINKS)
    .map((link) => ({
      platform: link.platform.trim().slice(0, MAX_PLATFORM_LENGTH),
      url: link.url.trim(),
    }));
};
