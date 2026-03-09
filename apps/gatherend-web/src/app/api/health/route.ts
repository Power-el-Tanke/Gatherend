import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Cache control - health checks must always be fresh
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Check database connection
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "gatherend-web",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        service: "gatherend-web",
      },
      { status: 503 },
    );
  }
}
