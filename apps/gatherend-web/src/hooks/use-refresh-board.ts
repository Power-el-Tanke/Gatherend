"use client";

import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";

export function useRefreshBoard(boardId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = async () => {
    if (!boardId) return;

    try {
      setIsLoading(true);

      const res = await axios.post(`/api/boards/${boardId}/refresh`);

      if (res.data?.refreshedAt) {
        const date = new Date(res.data.refreshedAt);
        setLastRefresh(date);

        toast.success("Board refreshed");
      }

      return res.data;
    } catch (err: any) {
      console.error(err);

      if (err?.response?.data?.error) {
        toast.error(err.response.data.error);
      } else {
        toast.error("Could not refresh board");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    refresh,
    isLoading,
    lastRefresh,
  };
}
