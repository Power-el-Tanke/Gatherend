"use client";

import { Search } from "lucide-react";
import { useTranslation } from "@/i18n";

export function BoardSearchBar({
  query,
  onChange,
}: {
  query: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="relative" style={{ marginRight: "174px" }}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />

      <input
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.discovery.searchBoards}
        className="
          w-full h-10 pl-10 pr-3
          rounded-md
          bg-theme-bg-secondary
          text-neutral-200
          placeholder:text-neutral-400
          border border-white/10
          focus:border-emerald-400/50
          focus:ring-0
          outline-none
        "
      />
    </div>
  );
}
