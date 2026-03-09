"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useTokenGetter } from "@/components/providers/token-manager-provider";
import { getExpressAxiosConfig } from "@/lib/express-fetch";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

interface Sticker {
  id: string;
  name: string;
  imageUrl: string;
  category: string;
  uploaderId?: string;
  isCustom?: boolean;
}

export const useStickers = (profileId?: string) => {
  const getToken = useTokenGetter();

  return useQuery({
    queryKey: ["stickers", profileId],
    queryFn: async () => {
      // Get token from TokenManager (cached + auto-refresh)
      const token = IS_PRODUCTION ? await getToken() : undefined;
      const config = profileId ? getExpressAxiosConfig(profileId, token) : {};
      const response = await axios.get<Sticker[]>(
        `${process.env.NEXT_PUBLIC_API_URL}/stickers`,
        config
      );
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos - para que stickers nuevos aparezcan pronto
    // Siempre enabled: si no hay profileId, obtiene solo stickers por defecto
  });
};

