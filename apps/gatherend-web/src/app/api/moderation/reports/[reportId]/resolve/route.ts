import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { ReportStatus } from "@prisma/client";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valid actions
const VALID_ACTIONS = ["dismiss", "warning", "strike", "ban"] as const;
type ResolveAction = (typeof VALID_ACTIONS)[number];

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    // Rate limiting
    const rateLimitResponse = await checkRateLimit(RATE_LIMITS.api);
    if (rateLimitResponse) return rateLimitResponse;

    const admin = await requireAdmin();
    if (!admin.success) return admin.response;

    const { reportId } = await params;

    // Validate UUID
    if (!reportId || !UUID_REGEX.test(reportId)) {
      return NextResponse.json({ error: "Invalid report ID" }, { status: 400 });
    }

    // Parse body with error handling
    let action: unknown;
    try {
      const body = await req.json();
      action = body.action;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Validate action
    if (
      !action ||
      typeof action !== "string" ||
      !VALID_ACTIONS.includes(action as ResolveAction)
    ) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const validAction = action as ResolveAction;

    // Execute everything in a transaction
    const result = await db.$transaction(async (tx) => {
      // Get the report
      const report = await tx.report.findUnique({
        where: { id: reportId },
        include: {
          targetOwner: true,
          reporter: true,
        },
      });

      if (!report) {
        throw new Error("NOT_FOUND");
      }

      if (report.status !== "PENDING" && report.status !== "REVIEWING") {
        throw new Error("ALREADY_RESOLVED");
      }

      // Determine new status and action taken
      let newStatus: ReportStatus;
      let actionTaken: string;
      let resolution: string;

      switch (validAction) {
        case "dismiss":
          newStatus = ReportStatus.DISMISSED;
          actionTaken = "none";
          resolution = "Report dismissed - no violation found";

          // Update reporter stats (false report) - only if reporter still exists
          if (report.reporterId) {
            await tx.profile.update({
              where: { id: report.reporterId },
              data: {
                falseReports: { increment: 1 },
              },
            });
          }
          break;

        case "warning":
          newStatus = ReportStatus.ACTION_TAKEN;
          actionTaken = "warning";
          resolution = "Warning issued to user";

          // Update reporter stats (valid report) - only if reporter still exists
          if (report.reporterId) {
            await tx.profile.update({
              where: { id: report.reporterId },
              data: {
                validReports: { increment: 1 },
              },
            });
          }
          break;

        case "strike":
          newStatus = ReportStatus.ACTION_TAKEN;
          actionTaken = "strike";
          resolution = "Strike issued to user";

          // Create strike if target owner exists
          if (report.targetOwnerId) {
            await tx.strike.create({
              data: {
                profileId: report.targetOwnerId,
                reason: `${report.category} violation`,
                severity:
                  report.priority === "urgent"
                    ? "CRITICAL"
                    : report.priority === "high"
                      ? "HIGH"
                      : "MEDIUM",
                contentType: report.targetType.toLowerCase(),
                snapshot: report.snapshot as object,
                originReportId: report.id,
                autoDetected: false,
              },
            });
          }

          // Update reporter stats (valid report) - only if reporter still exists
          if (report.reporterId) {
            await tx.profile.update({
              where: { id: report.reporterId },
              data: {
                validReports: { increment: 1 },
              },
            });
          }
          break;

        case "ban":
          newStatus = ReportStatus.ACTION_TAKEN;
          actionTaken = "ban";
          resolution = "User banned from platform";

          // Ban the target owner
          if (report.targetOwnerId) {
            await tx.profile.update({
              where: { id: report.targetOwnerId },
              data: {
                banned: true,
                bannedAt: new Date(),
                banReason: `${report.category} violation - Report #${report.id}`,
              },
            });

            // Also create a CRITICAL strike
            await tx.strike.create({
              data: {
                profileId: report.targetOwnerId,
                reason: `${report.category} violation - resulted in ban`,
                severity: "CRITICAL",
                contentType: report.targetType.toLowerCase(),
                snapshot: report.snapshot as object,
                originReportId: report.id,
                autoDetected: false,
              },
            });
          }

          // Update reporter stats (valid report) - only if reporter still exists
          if (report.reporterId) {
            await tx.profile.update({
              where: { id: report.reporterId },
              data: {
                validReports: { increment: 1 },
              },
            });
          }
          break;
      }

      // Update the report
      const updatedReport = await tx.report.update({
        where: { id: reportId },
        data: {
          status: newStatus,
          actionTaken,
          resolution,
          resolvedAt: new Date(),
          resolvedById: admin.profile.id,
        },
      });

      // Update reporter accuracy - only if reporter still exists
      if (report.reporterId) {
        const reporter = await tx.profile.findUnique({
          where: { id: report.reporterId },
          select: { validReports: true, falseReports: true },
        });

        if (reporter) {
          const total = reporter.validReports + reporter.falseReports;
          const accuracy = total > 0 ? reporter.validReports / total : null;

          await tx.profile.update({
            where: { id: report.reporterId },
            data: { reportAccuracy: accuracy },
          });
        }
      }

      return updatedReport;
    });

    return NextResponse.json({
      success: true,
      report: {
        id: result.id,
        status: result.status,
        actionTaken: result.actionTaken,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND")
        return NextResponse.json(
          { error: "Report not found" },
          { status: 404 },
        );
      if (error.message === "ALREADY_RESOLVED")
        return NextResponse.json(
          { error: "Report already resolved" },
          { status: 400 },
        );
    }
    console.error("[MODERATION_REPORT_RESOLVE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
