"use client";

import { I18nProvider } from "@/i18n";
import { Locale } from "@/i18n/types";

interface I18nServerProviderProps {
  children: React.ReactNode;
  initialLocale: Locale;
}

export function I18nClientProvider({
  children,
  initialLocale,
}: I18nServerProviderProps) {
  return <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>;
}
