"use client";

import { memo } from "react";
import { Check, X, Loader2, Bold, Italic, Underline } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { UsernameSectionProps } from "./types";

export const UsernameSection = memo(function UsernameSection({
  username,
  discriminator,
  usernameStatus,
  originalUsername,
  formatState,
  formatActions,
  isSaving,
  onUsernameChange,
  t,
}: UsernameSectionProps) {
  return (
    <div className="flex-1 space-y-2 w-full">
      {/* Username & Discriminator Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <div className="space-y-2">
            <label
              htmlFor="profile-username"
              className="uppercase text-xs font-bold text-theme-text-subtle"
            >
              {t.profile.username}
            </label>
            <div className="relative">
              <Input
                id="profile-username"
                name="profile-username"
                disabled={isSaving}
                className={cn(
                  "bg-theme-bg-input border-0 focus-visible:ring-2 focus-visible:ring-theme-accent-primary text-theme-text-light pr-10",
                  formatState.bold && "font-bold",
                  formatState.italic && "italic",
                  formatState.underline && "underline",
                )}
                placeholder={t.profile.usernamePlaceholder}
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
              />
              {usernameStatus.checking && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-theme-text-muted" />
              )}
              {!usernameStatus.checking &&
                usernameStatus.valid &&
                username !== originalUsername && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
              {!usernameStatus.checking &&
                !usernameStatus.valid &&
                username.length > 0 && (
                  <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
                )}
            </div>
            {usernameStatus.message && (
              <p
                className={`text-xs mt-1 ${
                  usernameStatus.valid ? "text-green-400" : "text-red-400"
                }`}
              >
                {usernameStatus.message}
              </p>
            )}
          </div>
        </div>
        <div>
          <label
            htmlFor="profile-discriminator"
            className="uppercase text-xs font-bold text-theme-text-subtle"
          >
            {t.profile.identifier}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted font-mono">
              /
            </span>
            <Input
              id="profile-discriminator"
              name="profile-discriminator"
              disabled
              className="pl-4.5 bg-theme-bg-input border-0 text-theme-text-muted cursor-not-allowed font-mono"
              value={discriminator || "xxx"}
            />
          </div>
        </div>
      </div>

      {/* Username Format */}
      <div className="space-y-2">
        <span
          id="username-style-label"
          className="uppercase text-xs font-bold text-theme-text-subtle block"
        >
          {t.profile.style}
        </span>
        <div
          className="flex items-center gap-2"
          role="group"
          aria-labelledby="username-style-label"
        >
          <button
            type="button"
            onClick={formatActions.toggleBold}
            disabled={isSaving}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-md transition-colors cursor-pointer",
              formatState.bold
                ? "bg-theme-tab-button-bg text-white"
                : "bg-theme-bg-input text-theme-text-subtle hover:bg-theme-bg-secondary",
            )}
            aria-label="Bold"
            aria-pressed={formatState.bold}
          >
            <Bold className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={formatActions.toggleItalic}
            disabled={isSaving}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-md transition-colors cursor-pointer",
              formatState.italic
                ? "bg-theme-tab-button-bg text-white"
                : "bg-theme-bg-input text-theme-text-subtle hover:bg-theme-bg-secondary",
            )}
            aria-label="Italic"
            aria-pressed={formatState.italic}
          >
            <Italic className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={formatActions.toggleUnderline}
            disabled={isSaving}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-md transition-colors cursor-pointer",
              formatState.underline
                ? "bg-theme-tab-button-bg text-white"
                : "bg-theme-bg-input text-theme-text-subtle hover:bg-theme-bg-secondary",
            )}
            aria-label="Underline"
            aria-pressed={formatState.underline}
          >
            <Underline className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
});
