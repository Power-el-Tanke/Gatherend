import { cookies } from "next/headers";
import {
  Locale,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  TranslationKeys,
} from "./types";
import { en } from "./messages/en";
import { es } from "./messages/es";

const messages: Record<Locale, TranslationKeys> = {
  en,
  es,
};

/**
 * Get the locale from cookie for server components.
 * The middleware guarantees the cookie always exists (injected into request if missing).
 */
export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("gatherend-locale");

  if (
    localeCookie?.value &&
    SUPPORTED_LOCALES.includes(localeCookie.value as Locale)
  ) {
    return localeCookie.value as Locale;
  }

  // Fallback defensivo (no debería llegar aquí si el middleware está activo)
  return DEFAULT_LOCALE;
}

/**
 * Get translations for server components
 */
export async function getServerTranslations(): Promise<TranslationKeys> {
  const locale = await getServerLocale();
  return messages[locale];
}

/**
 * Get both locale and translations for server components
 */
export async function getServerI18n(): Promise<{
  locale: Locale;
  t: TranslationKeys;
}> {
  const locale = await getServerLocale();
  return {
    locale,
    t: messages[locale],
  };
}
