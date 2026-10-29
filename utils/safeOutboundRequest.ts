// =======================
// SAFE OUTBOUND REQUESTS (SSRF GUARD)
// =======================
// Purpose: Validate user-configured webhook URLs and deliver webhooks without
//          letting them reach loopback, private, link-local or cloud-metadata
//          addresses. DNS is checked at connect time (so DNS rebinding can't
//          swap in an internal IP after validation) and redirects are never followed.
// Related: WebhookService, routes/webhooks.ts
// =======================

import dns from "dns";
import https from "https";
import net from "net";
import type { LookupFunction } from "net";

const blockedAddresses = new net.BlockList();
// IPv4
blockedAddresses.addSubnet("0.0.0.0", 8, "ipv4"); // "this" network
blockedAddresses.addSubnet("10.0.0.0", 8, "ipv4"); // RFC 1918
blockedAddresses.addSubnet("100.64.0.0", 10, "ipv4"); // carrier-grade NAT
blockedAddresses.addSubnet("127.0.0.0", 8, "ipv4"); // loopback
blockedAddresses.addSubnet("169.254.0.0", 16, "ipv4"); // link-local, cloud metadata
blockedAddresses.addSubnet("172.16.0.0", 12, "ipv4"); // RFC 1918
blockedAddresses.addSubnet("192.0.0.0", 24, "ipv4"); // IETF protocol assignments
blockedAddresses.addSubnet("192.0.2.0", 24, "ipv4"); // TEST-NET-1
blockedAddresses.addSubnet("192.168.0.0", 16, "ipv4"); // RFC 1918
blockedAddresses.addSubnet("198.18.0.0", 15, "ipv4"); // benchmarking
blockedAddresses.addSubnet("198.51.100.0", 24, "ipv4"); // TEST-NET-2
blockedAddresses.addSubnet("203.0.113.0", 24, "ipv4"); // TEST-NET-3
blockedAddresses.addSubnet("224.0.0.0", 4, "ipv4"); // multicast
blockedAddresses.addSubnet("240.0.0.0", 4, "ipv4"); // reserved + broadcast
// IPv6
// Note: IPv4-mapped (::ffff:a.b.c.d) addresses are handled in isPublicAddress, because
// adding ::ffff:0:0/96 here would make BlockList match every IPv4 address.
blockedAddresses.addAddress("::", "ipv6"); // unspecified
blockedAddresses.addAddress("::1", "ipv6"); // loopback
blockedAddresses.addSubnet("64:ff9b::", 96, "ipv6"); // NAT64
blockedAddresses.addSubnet("100::", 64, "ipv6"); // discard
blockedAddresses.addSubnet("2001:db8::", 32, "ipv6"); // documentation
blockedAddresses.addSubnet("fc00::", 7, "ipv6"); // unique local
blockedAddresses.addSubnet("fe80::", 10, "ipv6"); // link-local
blockedAddresses.addSubnet("ff00::", 8, "ipv6"); // multicast

// Expand an IPv6 address and return its embedded IPv4 if it is an IPv4-mapped
// (::ffff:x) or IPv4-compatible (::x) address; otherwise null.
const embeddedIPv4 = (address: string): string | null => {
  let text = address.toLowerCase().split("%")[0];
  const dotted = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const octets = dotted[1].split(".").map(Number);
    text =
      text.slice(0, -dotted[1].length) +
      ((octets[0] << 8) | octets[1]).toString(16) +
      ":" +
      ((octets[2] << 8) | octets[3]).toString(16);
  }
  const [head, tail] = text.includes("::") ? text.split("::") : [text, ""];
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const fill = new Array(8 - headParts.length - tailParts.length).fill("0");
  const hextets = [...headParts, ...fill, ...tailParts].map((h) => parseInt(h || "0", 16));
  if (hextets.length !== 8 || hextets.slice(0, 5).some((h) => h !== 0)) return null;
  if (hextets[5] !== 0xffff && hextets[5] !== 0) return null;
  if (hextets[5] === 0 && hextets[6] === 0) return null; // ::, ::1 handled by the BlockList
  return [hextets[6] >> 8, hextets[6] & 0xff, hextets[7] >> 8, hextets[7] & 0xff].join(".");
};

/**
 * True when the IP is a public unicast address that webhooks may reach.
 */
export const isPublicAddress = (address: string): boolean => {
  const family = net.isIP(address);
  if (family === 4) {
    return !blockedAddresses.check(address, "ipv4");
  }
  if (family === 6) {
    // IPv4-mapped / compatible IPv6 (::ffff:10.0.0.1, ::ffff:a00:1): judge the embedded IPv4
    const embedded = embeddedIPv4(address);
    if (embedded) return isPublicAddress(embedded);
    return !blockedAddresses.check(address, "ipv6");
  }
  return false;
};

const BLOCKED_HOSTNAMES = /^(localhost|.*\.localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i;

/**
 * Validate a webhook URL. Returns an error message, or null when acceptable.
 */
export const validateWebhookUrl = async (rawUrl: unknown): Promise<string | null> => {
  if (typeof rawUrl !== "string" || rawUrl.length > 2048) {
    return "Invalid URL format";
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "Invalid URL format";
  }

  if (url.protocol !== "https:") return "Webhook URLs must use https://";
  if (url.username || url.password) return "Webhook URLs must not contain credentials";

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.test(hostname)) return "Webhook URL host is not allowed";

  if (net.isIP(hostname)) {
    return isPublicAddress(hostname) ? null : "Webhook URL must point to a public address";
  }

  try {
    const addresses = await dns.promises.lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || !addresses.every((a) => isPublicAddress(a.address))) {
      return "Webhook URL must point to a public address";
    }
  } catch {
    return "Webhook URL host could not be resolved";
  }

  return null;
};

// Custom webhook headers may not override transport/security headers
const FORBIDDEN_HEADERS = new Set([
  "host",
  "content-length",
  "content-type",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "upgrade",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "cookie",
  "x-webhook-id",
  "x-webhook-event",
  "x-webhook-timestamp",
  "x-webhook-signature",
]);
const HEADER_NAME_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
const MAX_CUSTOM_HEADERS = 20;

/**
 * Validate user-supplied webhook headers. Returns an error message, or null.
 */
export const validateWebhookHeaders = (headers: unknown): string | null => {
  if (headers === undefined || headers === null) return null;
  if (typeof headers !== "object" || Array.isArray(headers)) {
    return "Headers must be an object of string values";
  }
  const entries = Object.entries(headers as Record<string, unknown>);
  if (entries.length > MAX_CUSTOM_HEADERS) return `At most ${MAX_CUSTOM_HEADERS} custom headers are allowed`;
  for (const [name, value] of entries) {
    if (!HEADER_NAME_PATTERN.test(name)) return `Invalid header name: ${name}`;
    if (FORBIDDEN_HEADERS.has(name.toLowerCase())) return `Header not allowed: ${name}`;
    if (typeof value !== "string" || value.length > 1024 || /[\r\n]/.test(value)) {
      return `Invalid value for header: ${name}`;
    }
  }
  return null;
};

export const ALLOWED_WEBHOOK_METHODS = ["POST", "PUT", "PATCH"] as const;

// DNS lookup used for the actual connection: rejects non-public results
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) {
      callback(err, "", 0);
      return;
    }
    const list = addresses as dns.LookupAddress[];
    const blocked = list.find((a) => !isPublicAddress(a.address));
    if (list.length === 0 || blocked) {
      callback(new Error(`Blocked webhook destination address`), "", 0);
      return;
    }
    if ((options as dns.LookupOptions).all) {
      (callback as any)(null, list);
    } else {
      callback(null, list[0].address, list[0].family);
    }
  });
};

export interface SafeResponse {
  ok: boolean;
  status: number;
  statusText: string;
}

/**
 * Send a webhook request to a validated https URL. Redirects are not followed
 * and the response body is discarded.
 */
export const sendSafeWebhookRequest = async (
  rawUrl: string,
  options: { method: string; headers: Record<string, string>; body: string; timeoutMs: number }
): Promise<SafeResponse> => {
  const urlError = await validateWebhookUrl(rawUrl);
  if (urlError) throw new Error(urlError);
  const url = new URL(rawUrl);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  return new Promise<SafeResponse>((resolve, reject) => {
    const request = https.request(
      {
        protocol: "https:",
        hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: options.method,
        headers: { ...options.headers, "Content-Length": Buffer.byteLength(options.body) },
        lookup: safeLookup,
        timeout: options.timeoutMs,
      },
      (response) => {
        response.resume(); // discard body
        const status = response.statusCode || 0;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          statusText: response.statusMessage || "",
        });
      }
    );
    request.on("timeout", () => request.destroy(new Error("Webhook request timed out")));
    request.on("error", reject);
    request.end(options.body);
  });
};
