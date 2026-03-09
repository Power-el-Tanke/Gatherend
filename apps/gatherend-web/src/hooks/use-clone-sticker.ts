import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { useTokenGetter } from "@/components/providers/token-manager-provider";
import { getExpressAxiosConfig } from "@/lib/express-fetch";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

interface CloneStickerParams {
  stickerId: string;
  profileId: string;
}

export const useCloneSticker = () => {
  const queryClient = useQueryClient();
  const getToken = useTokenGetter();

  return useMutation({
    mutationFn: async ({ stickerId, profileId }: CloneStickerParams) => {
      // Get token from TokenManager (cached + auto-refresh)
      const token = IS_PRODUCTION ? await getToken() : undefined;

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/stickers/${stickerId}/clone`,
        {},
        getExpressAxiosConfig(profileId, token)
      );
      return response.data;
    },
    onSuccess: () => {
      // Invalidate stickers query to refetch
      queryClient.invalidateQueries({ queryKey: ["stickers"] });
      toast.success("Sticker added to your collection!");
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || "Failed to add sticker";
      toast.error(message);
    },
  });
};

