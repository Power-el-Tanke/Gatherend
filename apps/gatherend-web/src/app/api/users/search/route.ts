import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import {
  findProfileByFullUsername,
  findProfilesByUsername,
} from "@/lib/username";

// Max query length to prevent expensive DB queries
const MAX_QUERY_LENGTH = 50;

/**
 * GET /api/users/search?q=username
 * Busca usuarios por username o username completo (username/discriminator)
 */
export async function GET(req: Request) {
  try {
    // Rate limiting - important for search endpoints
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const auth = await requireAuth();
    if (!auth.success) return auth.response;

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.trim() === "") {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 },
      );
    }

    // Validate query length
    if (query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        { error: `Query too long (max ${MAX_QUERY_LENGTH} characters)` },
        { status: 400 },
      );
    }

    // Si el query contiene "/", buscar por username completo
    if (query.includes("/")) {
      const result = await findProfileByFullUsername(query);
      return NextResponse.json(result ? [result] : []);
    }

    // Si no, buscar por username parcial
    const results = await findProfilesByUsername(query, 10);
    return NextResponse.json(results);
  } catch (error) {
    console.error("[USERS_SEARCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
