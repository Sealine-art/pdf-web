import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "clearpdf_session";
export const SESSION_DURATION_SECONDS = 8 * 60 * 60;

export function getAccessCredentials() {
  const username = process.env.APP_BASIC_AUTH_USER?.trim();
  const password = process.env.APP_BASIC_AUTH_PASSWORD?.trim();
  return username && password ? { username, password } : null;
}

export function secureTextEqual(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function signature(username: string, password: string, expiresAt: number) {
  return createHmac("sha256", password)
    .update(`ClearPDF-session-v1\n${username}\n${expiresAt}`)
    .digest("base64url");
}

export function createSessionToken(username: string, password: string, now = Date.now()) {
  const expiresAt = Math.floor(now / 1000) + SESSION_DURATION_SECONDS;
  return `${expiresAt}.${signature(username, password, expiresAt)}`;
}

export function isValidSessionToken(token: string | undefined, username: string, password: string, now = Date.now()) {
  if (!token) return false;
  const [expiresText, providedSignature, extra] = token.split(".");
  if (!expiresText || !providedSignature || extra !== undefined || !/^\d{10}$/.test(expiresText)) return false;

  const expiresAt = Number(expiresText);
  const nowSeconds = Math.floor(now / 1000);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= nowSeconds || expiresAt > nowSeconds + SESSION_DURATION_SECONDS + 5) return false;

  return secureTextEqual(providedSignature, signature(username, password, expiresAt));
}
