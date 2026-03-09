/**
 * NudeNet Moderation Service
 *
 * Handles content moderation using self-hosted NudeNet API.
 * Replaces AWS Rekognition for NSFW detection.
 *
 * Cost: Self-hosted (free)
 * Latency: ~200-500ms per image
 */

import { logger } from "../lib/logger.js";
import {
  ThresholdConfig,
  getSeverityForLabel,
  type StrikeSeverity,
} from "../config/moderation.config.js";

// NudeNet API configuration
const NUDENET_URL = process.env.NUDENET_URL || "";
const NUDENET_API_KEY = process.env.NUDENET_API_KEY || "";

// Label format compatible with existing code
export interface ModerationLabel {
  Name?: string;
  Confidence?: number;
  OriginalLabel?: string;
}

export interface ModerationResult {
  blocked: boolean;
  reason: string | null;
  severity: StrikeSeverity | null;
  labels: ModerationLabel[];
  confidence: number | null;
  processingTimeMs: number;
}

export interface BlockedLabel {
  name: string;
  confidence: number;
  severity: StrikeSeverity;
}

/**
 * Analyze image for moderation labels using NudeNet
 */
export async function analyzeImage(
  imageBuffer: Buffer,
  threshold: ThresholdConfig,
): Promise<ModerationResult> {
  const startTime = Date.now();

  try {
    // Create form data with the image
    const formData = new FormData();
    // Create a proper ArrayBuffer copy for Blob compatibility
    const arrayBuffer = imageBuffer.buffer.slice(
      imageBuffer.byteOffset,
      imageBuffer.byteOffset + imageBuffer.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: "image/jpeg" });
    formData.append("file", blob, "image.jpg");

    // Call NudeNet API
    const response = await fetch(`${NUDENET_URL}/moderate`, {
      method: "POST",
      headers: {
        "X-API-Key": NUDENET_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`NudeNet API error: ${response.status}`);
    }

    const data = await response.json();

    // Handle different response formats
    let labels: ModerationLabel[] = [];

    if (data.ModerationLabels) {
      // Already formatted response
      labels = data.ModerationLabels;
    } else if (data.predictions) {
      // Raw NudeNet format - convert to our format
      // NudeNet returns scores 0-1, convert to 0-100
      labels = data.predictions.map((p: { class: string; score: number }) => ({
        Name: p.class,
        Confidence: p.score * 100,
        OriginalLabel: p.class,
      }));
    }

    // Check if any labels exceed our thresholds
    const blockedLabels = findBlockedLabels(labels, threshold);

    const processingTimeMs = Date.now() - startTime;

    if (blockedLabels.length > 0) {
      // Get the highest severity blocked label
      const highestSeverityLabel = blockedLabels.reduce((prev, current) => {
        const severityOrder: StrikeSeverity[] = [
          "LOW",
          "MEDIUM",
          "HIGH",
          "CRITICAL",
        ];
        return severityOrder.indexOf(current.severity) >
          severityOrder.indexOf(prev.severity)
          ? current
          : prev;
      });

      return {
        blocked: true,
        reason: highestSeverityLabel.name,
        severity: highestSeverityLabel.severity,
        labels,
        confidence: highestSeverityLabel.confidence,
        processingTimeMs,
      };
    }

    return {
      blocked: false,
      reason: null,
      severity: null,
      labels,
      confidence: null,
      processingTimeMs,
    };
  } catch (error) {
    logger.error("[NudeNet] Error analyzing image:", error);

    // On error, fail safe (allow the image but log for review)
    return {
      blocked: false,
      reason: null,
      severity: null,
      labels: [],
      confidence: null,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Find labels that should block the content based on threshold config
 */
function findBlockedLabels(
  labels: ModerationLabel[],
  threshold: ThresholdConfig,
): BlockedLabel[] {
  const blocked: BlockedLabel[] = [];

  for (const label of labels) {
    // Use OriginalLabel if available (our API transforms Name but keeps original)
    const labelName = label.OriginalLabel || label.Name || "";
    const confidence = label.Confidence || 0;

    // Check if this label is in our block list
    const isInBlockList = threshold.blockLabels.includes(labelName);

    if (!isInBlockList) {
      continue;
    }

    // Get the threshold for this specific label, or use default
    const requiredConfidence =
      threshold.labelThresholds[labelName] || threshold.minConfidence;

    // Check if confidence exceeds threshold
    if (confidence >= requiredConfidence) {
      logger.info(
        `[NudeNet] BLOCKED: "${labelName}" at ${confidence.toFixed(1)}% (threshold: ${requiredConfidence}%)`,
      );
      blocked.push({
        name: labelName,
        confidence,
        severity: getSeverityForLabel(labelName),
      });
    }
  }

  return blocked;
}

/**
 * Check if NudeNet is properly configured
 */
export function isRekognitionConfigured(): boolean {
  return !!(NUDENET_URL && NUDENET_API_KEY);
}

// Alias for backwards compatibility
export const isNudeNetConfigured = isRekognitionConfigured;

/**
 * Get a human-readable reason for blocked content
 */
export function getBlockedReason(reason: string): string {
  const reasonMap: Record<string, string> = {
    MALE_GENITALIA_EXPOSED: "Explicit content is not allowed",
    FEMALE_GENITALIA_EXPOSED: "Explicit content is not allowed",
    ANUS_EXPOSED: "Explicit content is not allowed",
    FEMALE_BREAST_EXPOSED: "This content is not allowed in public areas",
    BUTTOCKS_EXPOSED: "This content is not allowed in public areas",
  };

  return reasonMap[reason] || "This content violates our community guidelines";
}
