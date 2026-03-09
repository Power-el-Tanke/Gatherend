import { getImgproxyUrl } from "./imgproxy.js";

const _envHostnames = (process.env.MEDIA_ALLOWED_HOSTNAMES || "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);
const ALLOWED_SOURCE_HOSTNAMES = new Set([
  ..._envHostnames,
  "res.cloudinary.com",
  "d1i5ye3mnngc0e.cloudfront.net",
]);

function canProxySourceUrl(sourceUrl: string): boolean {
  try {
    const u = new URL(sourceUrl);
    if (u.protocol !== "https:") return false;
    return ALLOWED_SOURCE_HOSTNAMES.has(u.hostname);
  } catch {
    return false;
  }
}

type WithFile = {
  fileUrl?: string | null;
  fileType?: string | null;
};

export type WithFilePreviews = {
  filePreviewUrl?: string | null;
  fileStaticPreviewUrl?: string | null;
};

const PREVIEW_OPTIONS = {
  width: 800,
  height: 600,
  resize: "fit" as const,
  format: "webp" as const,
  quality: 85,
};

export function attachFilePreviews<T extends WithFile>(
  item: T,
): T & WithFilePreviews {
  const fileUrl = item.fileUrl ?? null;
  const fileType = item.fileType ?? null;

  if (!fileUrl || !fileType?.startsWith("image/")) {
    return { ...item, filePreviewUrl: null, fileStaticPreviewUrl: null };
  }

  if (!canProxySourceUrl(fileUrl)) {
    return { ...item, filePreviewUrl: null, fileStaticPreviewUrl: null };
  }

  // For animated formats: provide a guaranteed-static placeholder (JPEG).
  // For GIF we intentionally avoid generating an animated WebP preview because Next won't optimize it
  // and we want "static by default, animate on hover" behavior in the UI.
  const wantsStaticPreview =
    fileType === "image/webp" ||
    fileType === "image/gif" ||
    fileType === "image/apng";

  const filePreviewUrl =
    fileType === "image/gif" ? null : getImgproxyUrl(fileUrl, PREVIEW_OPTIONS);

  const fileStaticPreviewUrl = wantsStaticPreview
    ? getImgproxyUrl(fileUrl, {
        width: PREVIEW_OPTIONS.width,
        height: PREVIEW_OPTIONS.height,
        resize: PREVIEW_OPTIONS.resize,
        format: "jpeg",
        quality: 82,
      })
    : null;

  return { ...item, filePreviewUrl, fileStaticPreviewUrl };
}
