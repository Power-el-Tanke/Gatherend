import { NextResponse } from "next/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET() {
  // Light rate limiting for public config endpoint
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
  if (rateLimitResponse) return rateLimitResponse;

  // El cliente (navegador) necesita la URL pública para WebSockets
  const socketUrl =
    process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

  return NextResponse.json({
    socketUrl,
  });
}
