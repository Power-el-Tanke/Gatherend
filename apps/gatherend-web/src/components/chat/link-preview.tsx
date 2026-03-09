"use client";

import { useLinkPreview } from "@/hooks/use-link-preview";
import { ExternalLink, Globe, Loader2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

interface LinkPreviewProps {
  url: string;
}

export const LinkPreview = ({ url }: LinkPreviewProps) => {
  const { data, isLoading, isError } = useLinkPreview(url);
  const [imageError, setImageError] = useState(false);

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className="mt-2 max-w-md rounded-lg overflow-hidden border border-theme-border-secondary bg-theme-bg-secondary p-3">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-theme-text-muted" />
          <span className="text-xs text-theme-text-muted">
            Loading preview...
          </span>
        </div>
      </div>
    );
  }

  // Don't show anything on error or no data
  if (isError || !data) {
    return null;
  }

  // Don't show if no meaningful data
  if (!data.title && !data.description && !data.image) {
    return null;
  }

  const hasImage = data.image && !imageError;
  const hostname = (() => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return data.siteName || "";
    }
  })();

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-2 max-w-md rounded-lg overflow-hidden border border-theme-border-secondary 
        bg-theme-bg-secondary hover:bg-theme-channel-hover transition-colors"
    >
      {/* Image preview */}
      {hasImage && (
        <div className="relative w-full h-40 bg-theme-bg-primary">
          <Image
            src={data.image!}
            alt={data.title || "Link preview"}
            fill
            className="object-cover"
            onError={() => setImageError(true)}
            unoptimized // External images may not work with Next.js image optimization
          />
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        {/* Site info */}
        <div className="flex items-center gap-2 text-xs text-theme-text-tertiary mb-1">
          {data.favicon && !imageError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.favicon}
              alt=""
              className="w-4 h-4 rounded"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <Globe className="w-4 h-4" />
          )}
          <span className="truncate">{hostname}</span>
          <ExternalLink className="w-3 h-3 ml-auto flex-shrink-0" />
        </div>

        {/* Title */}
        {data.title && (
          <h4 className="font-medium text-sm text-theme-text-primary line-clamp-2 mb-1">
            {data.title}
          </h4>
        )}

        {/* Description */}
        {data.description && (
          <p className="text-xs text-theme-text-tertiary line-clamp-2">
            {data.description}
          </p>
        )}
      </div>
    </a>
  );
};
