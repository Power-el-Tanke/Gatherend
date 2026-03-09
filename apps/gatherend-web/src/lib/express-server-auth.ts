import { NextRequest } from "next/server";

/**
 * Builds headers for server-to-server calls from Next route handlers to Express.
 *
 * Express authenticates using the BetterAuth session cookie, so we forward `cookie`.
 */
export async function getExpressServerAuthHeaders(
  req: NextRequest,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const cookie = req.headers.get("cookie");
  if (cookie) headers.cookie = cookie;

  // Forward Authorization if present (legacy compatibility).
  const authorization = req.headers.get("authorization");
  if (authorization) headers.Authorization = authorization;

  return headers;
}

