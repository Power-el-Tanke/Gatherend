import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/current-profile";
import { SignOutButton } from "./_sign-out-button";

interface BannedPageProps {
  searchParams: Promise<{ reason?: string; bannedAt?: string }>;
}

export default async function BannedPage({ searchParams }: BannedPageProps) {
  const profile = await currentProfile();

  if (!profile || !profile.banned) {
    redirect("/");
  }

  const { reason, bannedAt } = await searchParams;

  const formattedDate = bannedAt
    ? new Date(bannedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen w-full bg-[#1B2A28] flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold text-theme-text-light mb-3">
          Account Suspended
        </h1>

        <p className="text-theme-text-muted mb-6">
          Your account has been banned from Gatherend.
        </p>

        {formattedDate && (
          <p className="text-theme-text-muted mb-2">
            <span className="text-theme-text-light">Ban date:</span>{" "}
            {formattedDate}
          </p>
        )}

        {reason && (
          <p className="text-theme-text-muted mb-6">
            <span className="text-theme-text-light">Reason:</span> {reason}
          </p>
        )}

        <p className="text-theme-text-muted text-sm mb-8">
          If you believe this was a mistake, contact us at{" "}
          <a
            href="mailto:support@gatherend.com"
            className="text-theme-text-light underline"
          >
            support@gatherend.com
          </a>
        </p>

        <SignOutButton />
      </div>
    </div>
  );
}

