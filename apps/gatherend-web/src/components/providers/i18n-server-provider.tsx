import { getServerLocale } from "@/i18n/server";
import { I18nClientProvider } from "./i18n-client-provider";

interface I18nServerProviderProps {
  children: React.ReactNode;
}

export async function I18nServerProvider({
  children,
}: I18nServerProviderProps) {
  const locale = await getServerLocale();

  return (
    <I18nClientProvider initialLocale={locale}>{children}</I18nClientProvider>
  );
}
