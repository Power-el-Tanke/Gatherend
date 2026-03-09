"use client";

import { useLanguageSync } from "@/hooks/use-language-sync";

export function LanguageSyncProvider() {
  useLanguageSync();
  return null;
}
