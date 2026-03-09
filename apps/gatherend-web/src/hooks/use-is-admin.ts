"use client";

import { useState, useEffect } from "react";

/**
 * Hook to check if current user is an admin
 * Fetches from an API endpoint to avoid exposing admin IDs client-side
 */
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch("/api/moderation/check-admin");
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(data.isAdmin);
        }
      } catch (error) {
        console.error("Failed to check admin status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdmin();
  }, []);

  return { isAdmin, isLoading };
}
