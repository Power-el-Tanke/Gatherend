"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
}

export const useLinkPreview = (url: string | null) => {
  return useQuery({
    queryKey: ["link-preview", url],
    queryFn: async () => {
      if (!url) return null;
      const response = await axios.get<LinkPreviewData>(
        `${process.env.NEXT_PUBLIC_API_URL}/link-preview`,
        {
          params: { url },
        }
      );
      return response.data;
    },
    enabled: !!url,
    staleTime: 1000 * 60 * 60, // 1 hour - link previews don't change often
    retry: 1, // Only retry once on failure
    refetchOnWindowFocus: false,
  });
};
