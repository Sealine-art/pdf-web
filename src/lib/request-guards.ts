type RateLimitBucket = { startedAt: number; count: number };
type RateLimitRegistry = typeof globalThis & { __clearpdfRateLimits?: Map<string, RateLimitBucket> };

const registry = globalThis as RateLimitRegistry;
const rateLimits = registry.__clearpdfRateLimits ??= new Map<string, RateLimitBucket>();

export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  let bucket = rateLimits.get(key);
  if (!bucket || now - bucket.startedAt >= windowMs) {
    bucket = { startedAt: now, count: 0 };
    rateLimits.set(key, bucket);
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.startedAt + windowMs - now) / 1000)) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

function headerValues(value: string | null) {
  return value?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    if (origin === "null") return request.headers.get("sec-fetch-site") === "same-origin";
    try {
      const requestUrl = new URL(request.url);
      const hosts = new Set([
        requestUrl.host,
        ...headerValues(request.headers.get("host")),
        ...headerValues(request.headers.get("x-forwarded-host")),
      ]);
      const protocols = new Set([
        requestUrl.protocol.slice(0, -1),
        ...headerValues(request.headers.get("x-forwarded-proto")),
      ].filter((protocol) => protocol === "http" || protocol === "https"));
      const allowedOrigins = new Set<string>([requestUrl.origin]);
      for (const host of hosts) {
        for (const protocol of protocols) allowedOrigins.add(`${protocol}://${host}`);
      }
      // Embedded preview gateways can rewrite the server's perceived origin.
      // Fetch Metadata is browser-controlled and preserves the page's same-origin context.
      return allowedOrigins.has(new URL(origin).origin) || request.headers.get("sec-fetch-site") === "same-origin";
    } catch {
      return false;
    }
  }

  return request.headers.get("sec-fetch-site") === "same-origin";
}
