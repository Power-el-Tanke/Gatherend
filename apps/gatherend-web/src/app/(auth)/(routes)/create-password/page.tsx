"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Check, CheckCircle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/i18n";
import { requestPasswordReset, resetPassword } from "@/lib/better-auth-client";

type Step = "request" | "email-sent" | "set-password" | "success";

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }

  if (
    err &&
    typeof err === "object" &&
    "error" in err &&
    err.error &&
    typeof err.error === "object" &&
    "message" in err.error &&
    typeof err.error.message === "string"
  ) {
    return err.error.message;
  }

  return fallback;
}

function CreatePasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useTranslation();

  const token = searchParams.get("token") || "";
  const emailFromQuery = searchParams.get("email") || "";
  const resetError = searchParams.get("error") || "";

  const [step, setStep] = useState<Step>(() =>
    token.trim().length > 0 ? "set-password" : "request",
  );
  const [email, setEmail] = useState(() => emailFromQuery);
  const [emailError, setEmailError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const hasToken = useMemo(() => token.trim().length > 0, [token]);

  useEffect(() => {
    if (emailFromQuery) {
      setEmail(emailFromQuery);
    }
  }, [emailFromQuery]);

  useEffect(() => {
    if (hasToken) {
      setStep("set-password");
      return;
    }

    if (resetError) {
      setError("The reset link is invalid or expired. Request a new one.");
      setStep("request");
    }
  }, [hasToken, resetError]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setEmailError("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      setEmailError(t.auth.invalidEmail);
      return;
    }

    setIsLoading(true);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/create-password`
          : "/create-password";

      const result = await requestPasswordReset({
        email: email.trim(),
        redirectTo,
      });

      const resultError = (result as { error?: { message?: string } }).error;
      if (resultError?.message) {
        // Use a generic response to avoid account enumeration.
        setStep("email-sent");
        return;
      }

      setStep("email-sent");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.auth.failedToSendCode));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setPasswordError("");
    setConfirmPasswordError("");

    if (!hasToken) {
      setError("Invalid or missing reset token.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(t.auth.passwordTooShort);
      return;
    }

    if (newPassword !== confirmPassword) {
      setConfirmPasswordError(t.auth.passwordsDoNotMatch);
      return;
    }

    setIsLoading(true);

    try {
      const result = await resetPassword({
        token,
        newPassword,
      });

      const resultError = (result as { error?: { message?: string } }).error;
      if (resultError?.message) {
        // Keep token validation feedback generic.
        setError("The reset link is invalid or expired. Request a new one.");
        return;
      }

      setStep("success");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.auth.failedToSetPassword));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-[#1B2A28] rounded-xl shadow-xl p-8">
        {step === "request" && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white">
                {t.auth.resetPassword}
              </h1>
              <p className="text-sm text-zinc-400 mt-2">
                {t.auth.resetPasswordDesc}
              </p>
            </div>

            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-zinc-300">
                  {t.auth.email}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t.auth.enterYourEmail}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError("");
                  }}
                  className="mt-1 bg-zinc-900/50 border-zinc-600 focus-visible:ring-1 focus-visible:border-[#109e92] focus-visible:ring-[#109e92]"
                  disabled={isLoading}
                  autoFocus
                />
                {emailError && (
                  <p className="text-xs text-red-400 mt-1">{emailError}</p>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-md bg-red-900/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-[#368780] hover:bg-[#17968b] text-white cursor-pointer"
                disabled={isLoading || !email}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {t.auth.sendVerificationCode}
              </Button>

              <p className="text-center text-sm text-zinc-400">
                <Link
                  href="/sign-in"
                  className="text-[#109e92] hover:underline"
                >
                  {t.auth.backToSignIn}
                </Link>
              </p>
            </form>
          </>
        )}

        {step === "email-sent" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-[#368780] flex items-center justify-center">
              <Check className="h-8 w-8 text-zinc-300" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              {t.auth.checkYourEmail}
            </h1>
            <p className="text-sm text-zinc-300">
              We sent a reset link to{" "}
              <span className="font-medium">{email}</span>.
            </p>
            <p className="text-xs text-zinc-400">
              Open the link from your inbox to continue setting your new
              password.
            </p>
            <Button
              onClick={() => router.push("/sign-in")}
              className="w-full bg-[#368780] hover:bg-[#17968b] text-white cursor-pointer"
            >
              {t.auth.backToSignIn}
            </Button>
          </div>
        )}

        {step === "set-password" && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white">
                {t.auth.setYourPassword}
              </h1>
              <p className="text-sm text-zinc-400 mt-2">
                {t.auth.setPasswordDesc}
              </p>
            </div>

            <form onSubmit={handleSetPassword} className="space-y-4">
              <div>
                <Label htmlFor="new-password" className="text-zinc-300">
                  {t.auth.newPassword}
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t.auth.enterNewPassword}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPasswordError("");
                    }}
                    className="bg-zinc-900/50 border-zinc-600 focus-visible:ring-1 focus-visible:border-[#109e92] focus-visible:ring-[#109e92] pr-10"
                    disabled={isLoading}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-xs text-red-400 mt-1">{passwordError}</p>
                )}
              </div>

              <div>
                <Label htmlFor="confirm-password" className="text-zinc-300">
                  {t.auth.confirmPassword}
                </Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t.auth.confirmNewPassword}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setConfirmPasswordError("");
                  }}
                  className="mt-1 bg-zinc-900/50 border-zinc-600 focus-visible:ring-1 focus-visible:border-[#109e92] focus-visible:ring-[#109e92]"
                  disabled={isLoading}
                />
                {confirmPasswordError && (
                  <p className="text-xs text-red-400 mt-1">
                    {confirmPasswordError}
                  </p>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-md bg-red-900/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-[#368780] hover:bg-[#17968b] text-white cursor-pointer"
                disabled={isLoading || !newPassword || !confirmPassword}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {t.auth.setPassword}
              </Button>
            </form>
          </>
        )}

        {step === "success" && (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-900/30 flex items-center justify-center mb-6">
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {t.auth.passwordCreated}
            </h1>
            <p className="text-sm text-zinc-400 mb-6">
              {t.auth.passwordCreatedDesc}
            </p>
            <Button
              onClick={() => router.push("/sign-in")}
              className="w-full bg-[#368780] hover:bg-[#17968b] text-white cursor-pointer"
            >
              {t.auth.backToSignIn}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreatePasswordPage() {
  return (
    <div className="h-full flex items-center justify-center py-12 px-4">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-[#109e92]" />
          </div>
        }
      >
        <CreatePasswordContent />
      </Suspense>
    </div>
  );
}
