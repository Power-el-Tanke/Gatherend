import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { db } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/require-auth";
import { logger } from "@/lib/logger";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cache control - tokens must always be fresh
export const dynamic = "force-dynamic";

// Token TTL in seconds (30s - minimal window for token reuse attacks)
const TOKEN_TTL_SECONDS = 60;

export async function GET(req: NextRequest) {
  // Rate limiting - stricter for voice tokens (10 requests per 10 minutes)
  const rateLimitResponse = await checkRateLimit(RATE_LIMITS.livekitToken);
  if (rateLimitResponse) return rateLimitResponse;

  const room = req.nextUrl.searchParams.get("room");

  // CRITICAL: Authentication validation

  const auth = await requireAuth();
  if (!auth.success) return auth.response;
  const profile = auth.profile;

  if (!room) {
    return NextResponse.json(
      { error: 'Missing "room" query parameter' },
      { status: 400 },
    );
  }

  // Validate room is a valid UUID
  if (!UUID_REGEX.test(room)) {
    return NextResponse.json(
      { error: "Invalid room ID format" },
      { status: 400 },
    );
  }

  // CRITICAL: Validate user has access to the room (channel)

  try {
    // OPTIMIZATION: Query channel and conversation in parallel
    const [channel, conversation] = await Promise.all([
      db.channel.findUnique({
        where: { id: room },
        select: {
          id: true,
          type: true, // Fix #6: Include channel type to validate it's a VOICE channel
          boardId: true,
          board: {
            select: {
              members: {
                where: { profileId: profile.id },
                select: { id: true },
              },
            },
          },
        },
      }),
      db.conversation.findUnique({
        where: { id: room },
        select: {
          id: true,
          profileOneId: true,
          profileTwoId: true,
        },
      }),
    ]);

    if (channel) {
      // Fix #6: Validate this is a VOICE channel, not TEXT
      if (channel.type !== "VOICE") {
        return NextResponse.json(
          { error: "This channel is not a voice channel" },
          { status: 400 },
        );
      }

      // Verify board membership
      if (channel.board.members.length === 0) {
        return NextResponse.json(
          { error: "You are not a member of this board" },
          { status: 403 },
        );
      }
    } else if (conversation) {
      // Verify the user is part of this conversation
      if (
        conversation.profileOneId !== profile.id &&
        conversation.profileTwoId !== profile.id
      ) {
        return NextResponse.json(
          { error: "You are not a participant in this conversation" },
          { status: 403 },
        );
      }
    } else {
      return NextResponse.json(
        { error: "Room not found (not a channel or conversation)" },
        { status: 404 },
      );
    }
  } catch (error) {
    console.error("[LiveKit] Error validating access:", error);
    return NextResponse.json(
      { error: "Failed to validate access" },
      { status: 500 },
    );
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    logger.warn("[LiveKit] Missing config", {
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
      hasWsUrl: !!wsUrl,
    });
    return NextResponse.json(
      { error: "Server misconfigured." },
      { status: 500 },
    );
  }

  // Use authenticated profile data - prevents impersonation
  const participantIdentity = profile.id;
  const displayName = profile.username;

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: displayName, // Display name shown in the room
      ttl: TOKEN_TTL_SECONDS, // CRITICAL: Token expires after 30 seconds
    });
    at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });

    const token = await at.toJwt();

    return NextResponse.json(
      { token },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[LiveKit] Error generating token:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 },
    );
  }
}
