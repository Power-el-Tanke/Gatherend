import { createAuthClient } from "better-auth/react";

// In the browser, default to same-origin to avoid accidentally shipping a localhost baseURL to production.
const authBaseURL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
      "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: authBaseURL,
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  requestPasswordReset,
  resetPassword,
} = authClient;
