"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { logger } from "@/lib/logger";
import { useTokenGetter } from "@/components/providers/token-manager-provider";
import { getExpressAxiosConfig } from "@/lib/express-fetch";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

interface UploadStickerVariables {
  formData: FormData;
  profileId: string;
}

export const useUploadSticker = () => {
  const queryClient = useQueryClient();
  const getToken = useTokenGetter();

  return useMutation({
    mutationFn: async ({ formData, profileId }: UploadStickerVariables) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        logger.error("[useUploadSticker] NEXT_PUBLIC_API_URL is not defined!");
        throw new Error("API URL not configured");
      }

      // Get token from TokenManager (cached + auto-refresh)
      const token = IS_PRODUCTION ? await getToken() : undefined;

      const response = await axios.post(`${apiUrl}/stickers`, formData, {
        ...getExpressAxiosConfig(profileId, token, {
          "Content-Type": "multipart/form-data",
        }),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stickers"] });
    },
  });
};

interface DeleteStickerVariables {
  stickerId: string;
  profileId: string;
}

export const useDeleteSticker = () => {
  const queryClient = useQueryClient();
  const getToken = useTokenGetter();

  return useMutation({
    mutationFn: async ({ stickerId, profileId }: DeleteStickerVariables) => {
      // Get token from TokenManager (cached + auto-refresh)
      const token = IS_PRODUCTION ? await getToken() : undefined;

      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/stickers/${stickerId}`,
        getExpressAxiosConfig(profileId, token)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stickers"] });
    },
  });
};

