"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { logger } from "@/lib/logger";
import {
  Locale,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  TranslationKeys,
} from "./types";
import { en } from "./messages/en";
import { es } from "./messages/es";

// Storage key for persisting locale preference
const LOCALE_STORAGE_KEY = "gatherend-locale";

// Messages map
const messages: Record<Locale, TranslationKeys> = {
  en,
  es,
};

// Context type
interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationKeys;
}

// Create context
const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Detect browser language and return matching locale
function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;

  const browserLangs = navigator.languages || [navigator.language];

  for (const lang of browserLangs) {
    // Get the base language code (e.g., "es-PE" -> "es")
    const baseLang = lang.split("-")[0].toLowerCase() as Locale;

    if (SUPPORTED_LOCALES.includes(baseLang)) {
      return baseLang;
    }
  }

  return DEFAULT_LOCALE;
}

// Get stored locale from localStorage
function getStoredLocale(): Locale | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
      return stored as Locale;
    }
  } catch {
    // localStorage not available (SSR or privacy mode)
  }

  return null;
}

// Store locale in localStorage and cookie
function storeLocale(locale: Locale): void {
  if (typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    // Also store in cookie for SSR
    document.cookie = `gatherend-locale=${locale};path=/;max-age=31536000;SameSite=Lax`;
  } catch {
    // localStorage not available
  }
}

interface I18nProviderProps {
  children: React.ReactNode;
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  // Initialize locale - use initialLocale from server if provided, otherwise detect
  const [locale, setLocaleState] = useState<Locale>(() => {
    // If server provided initialLocale, use it to prevent hydration mismatch
    if (initialLocale) {
      return initialLocale;
    }
    // Only run detection on client
    if (typeof window === "undefined") {
      return DEFAULT_LOCALE;
    }
    const storedLocale = getStoredLocale();
    const browserLocale = detectBrowserLocale();
    return storedLocale ?? browserLocale;
  });
  const [isInitialized] = useState(() => typeof window !== "undefined");

  // Update HTML lang attribute on mount and locale changes
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Set locale and persist
  const setLocale = useCallback((newLocale: Locale) => {
    if (!SUPPORTED_LOCALES.includes(newLocale)) {
      logger.warn(`Unsupported locale: ${newLocale}`);
      return;
    }

    setLocaleState(newLocale);
    storeLocale(newLocale);

    // Update HTML lang attribute
    document.documentElement.lang = newLocale;
  }, []);

  // Get translations for current locale
  const t = useMemo(() => messages[locale], [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t]
  );

  // Prevent flash of wrong language
  if (!isInitialized && typeof window !== "undefined") {
    return null;
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// Hook to use i18n
export function useTranslation() {
  const context = useContext(I18nContext);

  if (context === undefined) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }

  return context;
}

// Hook to get just the locale
export function useLocale(): Locale {
  const { locale } = useTranslation();
  return locale;
}

// Utility: Get language name for display
export function getLanguageName(locale: Locale): string {
  const names: Record<Locale, string> = {
    en: "English",
    es: "Español",
  };
  return names[locale] || locale;
}

// Utility: Map Prisma Languages enum to Locale
export function languageToLocale(language: string): Locale {
  const map: Record<string, Locale> = {
    EN: "en",
    ES: "es",
  };
  return map[language.toUpperCase()] ?? DEFAULT_LOCALE;
}

// Utility: Map Locale to Prisma Languages enum
export function localeToLanguage(locale: Locale): string {
  return locale.toUpperCase();
}

// Export types
export type { Locale, TranslationKeys };
export { SUPPORTED_LOCALES, DEFAULT_LOCALE };
