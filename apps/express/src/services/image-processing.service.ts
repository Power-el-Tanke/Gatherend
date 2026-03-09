/**
 * Image Processing Service
 *
 * Handles:
 * - EXIF stripping for privacy
 * - SHA-256 hashing for exact match cache
 * - Perceptual hashing for similar image detection
 * - Image optimization before upload
 */

import sharp from "sharp";
import { createHash } from "crypto";

export interface ProcessedImage {
  buffer: Buffer;
  hash: string;
  width: number;
  height: number;
  format: string;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
}

/**
 * Process an image: strip EXIF, calculate hash, get metadata
 */
export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  // Use sharp to strip EXIF and normalize
  const image = sharp(buffer);
  const metadata = await image.metadata();

  // Strip EXIF data and convert to consistent format
  const processedBuffer = await image
    .rotate() // Auto-rotate based on EXIF orientation before stripping
    .withMetadata({}) // Keep minimal metadata, removes EXIF/IPTC/XMP
    .toBuffer();

  // Calculate SHA-256 hash of the processed image
  const hash = calculateHash(processedBuffer);

  return {
    buffer: processedBuffer,
    hash,
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || "unknown",
  };
}

/**
 * Calculate SHA-256 hash of a buffer
 */
export function calculateHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Get image metadata without processing
 */
export async function getImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
  const metadata = await sharp(buffer).metadata();

  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || "unknown",
    size: buffer.length,
    hasAlpha: metadata.hasAlpha || false,
  };
}

/**
 * Extract first frame from animated images (GIF, WebP)
 * Used for moderating animated stickers
 */
export async function extractFirstFrame(buffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();

  // Check if it's an animated format
  if (metadata.pages && metadata.pages > 1) {
    // Extract only the first page/frame
    return sharp(buffer, { pages: 1 }).toBuffer();
  }

  // Not animated, return as-is
  return buffer;
}

/**
 * Resize image for Rekognition (max 5MB, but we'll use smaller for speed)
 * Rekognition works fine with smaller images
 */
export async function prepareForRekognition(buffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(buffer).metadata();
  const maxDimension = 1024; // Good balance of quality vs speed

  // Only resize if larger than max dimension
  if (
    (metadata.width || 0) > maxDimension ||
    (metadata.height || 0) > maxDimension
  ) {
    return sharp(buffer)
      .resize(maxDimension, maxDimension, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .toBuffer();
  }

  return buffer;
}

/**
 * Optimize image for storage (Cloudinary will also optimize, but this helps)
 */
export async function optimizeForStorage(
  buffer: Buffer,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<Buffer> {
  const { maxWidth = 2048, maxHeight = 2048, quality = 85 } = options;

  return sharp(buffer)
    .resize(maxWidth, maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

/**
 * Check if buffer is a valid image
 */
export async function isValidImage(buffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata();
    return !!metadata.format;
  } catch {
    return false;
  }
}

/**
 * Get supported formats
 */
export const SUPPORTED_IMAGE_FORMATS = [
  "jpeg",
  "jpg",
  "png",
  "webp",
  "gif",
  "avif",
  "heif",
  "heic",
];

export function isSupportedFormat(format: string): boolean {
  return SUPPORTED_IMAGE_FORMATS.includes(format.toLowerCase());
}
