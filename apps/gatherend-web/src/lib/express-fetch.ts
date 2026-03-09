/**
 * Centralized fetch helper for Express API (localhost:3001 / NEXT_PUBLIC_API_URL)
 *
 * Auth behavior:
 * - Development: use `x-profile-id` (fast iteration, no token validation)
 * - Production:
 *   - rely on cookie-based session (HttpOnly cookie)
 */


// Check production by looking at the hostname (more reliable than NODE_ENV in client).
const IS_PRODUCTION =
  typeof window !== "undefined"
    ? window.location.hostname !== "localhost"
    : process.env.NODE_ENV === "production";

interface ExpressFetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
}

export function getExpressAuthHeaders(
  profileId: string,
  token?: string | null,
): Record<string, string> {

  if (IS_PRODUCTION) {
    // Cookie session is primary; Bearer is optional and only used for legacy compatibility.
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Development: use x-profile-id for faster iteration.
  // Express accepts this only in development.
  return { "x-profile-id": profileId };
}

export async function expressFetch(
  url: string,
  profileId: string,
  token?: string | null,
  options: ExpressFetchOptions = {},
): Promise<Response> {
  const authHeaders = getExpressAuthHeaders(profileId, token);

  return fetch(url, {
    ...options,
    // Session is cookie-based, so include cookies for cross-origin Express (localhost:3001).
    credentials: options.credentials ?? "include",
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  });
}

export interface ExpressAxiosConfig {
  headers: Record<string, string>;
  withCredentials?: boolean;
}

export function getExpressAxiosConfig(
  profileId: string,
  token?: string | null,
  additionalHeaders?: Record<string, string>,
): ExpressAxiosConfig {
  return {
    withCredentials: true,
    headers: {
      ...getExpressAuthHeaders(profileId, token),
      ...additionalHeaders,
    },
  };
}
