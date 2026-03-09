/**
 * Text Moderation Service
 *
 * Implements a 3-phase detection system for board descriptions:
 * 1. Aggressive normalization (leetspeak, homoglyphs, separations)
 * 2. Blacklist absolute check
 * 3. Contextual detection with sliding windows and set combinations
 *
 * Target: Board descriptions (max 200 chars)
 * Languages: Spanish and English
 */

import {
  HOMOGLYPHS,
  LEETSPEAK,
  BLACKLIST_ABSOLUTE,
  MINORS_SET,
  CONCERNING_AGES,
  SEXUAL_SET,
  MEDIA_EXCHANGE_SET,
  INTENT_SET,
  CONTACT_SET,
  IMPLICIT_SUSPICIOUS,
  ROLE_INVERSION_PATTERNS,
  SUSPICIOUS_EMOJIS,
  COMBINATION_SCORES,
  LEGITIMATE_CONTEXTS,
  AGE_PATTERNS,
  CONCERNING_AGE_RANGE,
  SCORING_CONFIG,
  USER_MESSAGES,
  type TextModerationResult,
  type ModerationAction,
  type ModerationFlag,
} from "../config/text-moderation.config.js";

// PHASE 1: AGGRESSIVE NORMALIZATION

/**
 * Normalize Unicode homoglyphs (Cyrillic, Greek lookalikes)
 */
function normalizeHomoglyphs(text: string): string {
  return text
    .split("")
    .map((char) => HOMOGLYPHS[char] || char)
    .join("");
}

/**
 * Normalize leetspeak and number substitutions
 */
function normalizeLeetspeak(text: string): string {
  return text
    .split("")
    .map((char) => LEETSPEAK[char] || char)
    .join("");
}

/**
 * Remove decorative characters and normalize spacing
 */
function removeDecorations(text: string): string {
  // Remove common decorative characters
  let normalized = text.replace(/[_\-\*\+\.\|~^`´'"""''«»]/g, "");

  // Remove zero-width characters
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, "");

  // Normalize multiple spaces to single space
  normalized = normalized.replace(/\s+/g, " ");

  return normalized;
}

/**
 * Detect and collapse artificial letter separation
 * "n i ñ o s" -> "niños"
 */
function collapseSeparatedLetters(text: string): string {
  // Pattern: single letters separated by spaces
  // Match sequences of "letter space letter space letter..."
  return text.replace(/\b([a-záéíóúüñ])\s+(?=[a-záéíóúüñ]\b)/gi, "$1");
}

/**
 * Extract emojis from text for separate analysis
 */
function extractEmojis(text: string): string[] {
  const emojiRegex =
    /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26CE}]|[\u{26D4}]|[\u{26EA}]|[\u{26F2}-\u{26F3}]|[\u{26F5}]|[\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F171}]|[\u{1F17E}-\u{1F17F}]|[\u{1F18E}]|[\u{1F191}-\u{1F19A}]|[\u{1F201}-\u{1F202}]|[\u{1F21A}]|[\u{1F22F}]|[\u{1F232}-\u{1F23A}]|[\u{1F250}-\u{1F251}]/gu;

  const matches = text.match(emojiRegex);
  return matches || [];
}

/**
 * Full aggressive normalization pipeline
 */
export function aggressiveNormalize(text: string): string {
  let normalized = text.toLowerCase();

  // Step 1: Normalize homoglyphs (Cyrillic, Greek)
  normalized = normalizeHomoglyphs(normalized);

  // Step 2: Remove decorative characters
  normalized = removeDecorations(normalized);

  // Step 3: Normalize leetspeak
  normalized = normalizeLeetspeak(normalized);

  // Step 4: Collapse artificially separated letters
  normalized = collapseSeparatedLetters(normalized);

  // Step 5: Final cleanup
  normalized = normalized.trim();

  return normalized;
}

/**
 * Tokenize text into words
 */
function tokenize(text: string): string[] {
  return text.split(/\s+/).filter((token) => token.length > 0);
}

// PHASE 2: BLACKLIST CHECK

/**
 * Check if text contains any blacklisted terms
 */
function checkBlacklist(normalizedText: string): {
  hit: boolean;
  term?: string;
} {
  for (const term of BLACKLIST_ABSOLUTE) {
    if (normalizedText.includes(term)) {
      return { hit: true, term };
    }
  }
  return { hit: false };
}

// PHASE 3: CONTEXTUAL DETECTION

/**
 * Check if text contains any word from a set
 */
function hasAnyWord(
  text: string,
  wordSet: string[],
): { found: boolean; matches: string[] } {
  const matches: string[] = [];
  const textLower = text.toLowerCase();

  for (const word of wordSet) {
    // Use word boundary matching for better accuracy
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, "i");
    if (regex.test(textLower)) {
      matches.push(word);
    }
  }

  return { found: matches.length > 0, matches };
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Check for concerning age mentions
 */
function checkAgePatterns(text: string): {
  found: boolean;
  ages: number[];
  matches: string[];
} {
  const ages: number[] = [];
  const matches: string[] = [];

  for (const pattern of AGE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Extract the numeric part
      const numMatch = match[0].match(/\d{1,2}/);
      if (numMatch) {
        const age = parseInt(numMatch[0], 10);
        if (
          age >= CONCERNING_AGE_RANGE.min &&
          age <= CONCERNING_AGE_RANGE.max
        ) {
          ages.push(age);
          matches.push(match[0]);
        }
      }
    }
  }

  // Also check for age words in CONCERNING_AGES set
  const wordAges = hasAnyWord(text, CONCERNING_AGES);
  if (wordAges.found) {
    matches.push(...wordAges.matches);
  }

  return { found: ages.length > 0 || wordAges.found, ages, matches };
}

/**
 * Check for implicit suspicious patterns
 */
function checkImplicitSuspicious(text: string): {
  found: boolean;
  matches: string[];
} {
  const matches: string[] = [];
  const textLower = text.toLowerCase();

  for (const pattern of IMPLICIT_SUSPICIOUS) {
    if (textLower.includes(pattern.toLowerCase())) {
      matches.push(pattern);
    }
  }

  return { found: matches.length > 0, matches };
}

/**
 * Check for role inversion patterns (grooming via proxy)
 */
function checkRoleInversion(text: string): {
  found: boolean;
  matches: string[];
} {
  const matches: string[] = [];
  const textLower = text.toLowerCase();

  for (const pattern of ROLE_INVERSION_PATTERNS) {
    if (textLower.includes(pattern.toLowerCase())) {
      matches.push(pattern);
    }
  }

  return { found: matches.length > 0, matches };
}

/**
 * Check for suspicious emoji combinations
 */
function checkSuspiciousEmojis(
  text: string,
  emojis: string[],
): { found: boolean; matches: string[]; score: number } {
  const matches: string[] = [];
  let score = 0;

  for (const emoji of emojis) {
    if (SUSPICIOUS_EMOJIS.includes(emoji)) {
      matches.push(emoji);
      score += 1;
    }
  }

  // Extra score if multiple suspicious emojis
  if (matches.length >= 2) {
    score += 2;
  }

  return { found: matches.length > 0, matches, score };
}

/**
 * Check for legitimate context (reduces false positives)
 */
function hasLegitimateContext(text: string): boolean {
  const textLower = text.toLowerCase();

  for (const context of LEGITIMATE_CONTEXTS) {
    if (textLower.includes(context.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Analyze text with sliding windows for context
 */
function analyzeWithSlidingWindows(
  normalizedText: string,
  originalText: string,
): {
  score: number;
  flags: ModerationFlag[];
  reason?: string;
  action?: ModerationAction;
} {
  const tokens = tokenize(normalizedText);
  let totalScore = 0;
  const flags: ModerationFlag[] = [];
  let detectedReason: string | undefined;
  let detectedAction: ModerationAction | undefined;

  // Extract emojis from original text (before normalization)
  const emojis = extractEmojis(originalText);

  // Global detection (full text)
  const globalMinors = hasAnyWord(normalizedText, MINORS_SET);
  const globalSexual = hasAnyWord(normalizedText, SEXUAL_SET);
  const globalMedia = hasAnyWord(normalizedText, MEDIA_EXCHANGE_SET);
  const globalIntent = hasAnyWord(normalizedText, INTENT_SET);
  const globalContact = hasAnyWord(normalizedText, CONTACT_SET);
  const globalAges = checkAgePatterns(normalizedText);
  const globalImplicit = checkImplicitSuspicious(normalizedText);
  const globalRoleInversion = checkRoleInversion(normalizedText);
  const globalEmojis = checkSuspiciousEmojis(originalText, emojis);

  // Check for legitimate context (reduces score)
  const isLegitimate = hasLegitimateContext(normalizedText);

  // === CRITICAL COMBINATIONS - IMMEDIATE BLOCK ===

  // SEXUAL + MINORS = BLOCK
  if (globalSexual.found && globalMinors.found) {
    return {
      score: 15,
      flags: [
        {
          type: "SEXUAL_MINORS_COMBINATION",
          matched: [...globalSexual.matches, ...globalMinors.matches],
          score: 15,
        },
      ],
      reason: "SEXUAL_MINORS_COMBINATION",
      action: "BLOCK",
    };
  }

  // INTENT + MINORS = BLOCK
  if (globalIntent.found && globalMinors.found && !isLegitimate) {
    return {
      score: 12,
      flags: [
        {
          type: "INTENT_MINORS_COMBINATION",
          matched: [...globalIntent.matches, ...globalMinors.matches],
          score: 12,
        },
      ],
      reason: "INTENT_MINORS_COMBINATION",
      action: "BLOCK",
    };
  }

  // MEDIA + MINORS = BLOCK
  if (globalMedia.found && globalMinors.found && !isLegitimate) {
    return {
      score: 15,
      flags: [
        {
          type: "MEDIA_MINORS_COMBINATION",
          matched: [...globalMedia.matches, ...globalMinors.matches],
          score: 15,
        },
      ],
      reason: "MEDIA_MINORS_COMBINATION",
      action: "BLOCK",
    };
  }

  // CONTACT + MINORS = BLOCK
  if (globalContact.found && globalMinors.found && !isLegitimate) {
    return {
      score: 12,
      flags: [
        {
          type: "CONTACT_MINORS_COMBINATION",
          matched: [...globalContact.matches, ...globalMinors.matches],
          score: 12,
        },
      ],
      reason: "CONTACT_MINORS_COMBINATION",
      action: "BLOCK",
    };
  }

  // INTENT + SEXUAL = BLOCK
  if (globalIntent.found && globalSexual.found) {
    return {
      score: 10,
      flags: [
        {
          type: "INTENT_SEXUAL_COMBINATION",
          matched: [...globalIntent.matches, ...globalSexual.matches],
          score: 10,
        },
      ],
      reason: "INTENT_SEXUAL_COMBINATION",
      action: "BLOCK",
    };
  }

  // SEXUAL + CONTACT = BLOCK
  if (globalSexual.found && globalContact.found) {
    return {
      score: 10,
      flags: [
        {
          type: "SEXUAL_CONTACT_COMBINATION",
          matched: [...globalSexual.matches, ...globalContact.matches],
          score: 10,
        },
      ],
      reason: "SEXUAL_CONTACT_COMBINATION",
      action: "BLOCK",
    };
  }

  // INTENT + MEDIA + SEXUAL = BLOCK
  if (globalIntent.found && globalMedia.found && globalSexual.found) {
    return {
      score: 12,
      flags: [
        {
          type: "INTENT_MEDIA_SEXUAL_COMBINATION",
          matched: [
            ...globalIntent.matches,
            ...globalMedia.matches,
            ...globalSexual.matches,
          ],
          score: 12,
        },
      ],
      reason: "INTENT_MEDIA_SEXUAL_COMBINATION",
      action: "BLOCK",
    };
  }

  // INTENT + MEDIA + MINORS = BLOCK
  if (
    globalIntent.found &&
    globalMedia.found &&
    globalMinors.found &&
    !isLegitimate
  ) {
    return {
      score: 15,
      flags: [
        {
          type: "INTENT_MEDIA_MINORS_COMBINATION",
          matched: [
            ...globalIntent.matches,
            ...globalMedia.matches,
            ...globalMinors.matches,
          ],
          score: 15,
        },
      ],
      reason: "INTENT_MEDIA_MINORS_COMBINATION",
      action: "BLOCK",
    };
  }

  // === AGE-SPECIFIC COMBINATIONS ===

  if (globalAges.found) {
    // AGE + SEXUAL = BLOCK
    if (globalSexual.found) {
      return {
        score: 15,
        flags: [
          {
            type: "AGE_SEXUAL_COMBINATION",
            matched: [...globalAges.matches, ...globalSexual.matches],
            score: 15,
          },
        ],
        reason: "AGE_SEXUAL_COMBINATION",
        action: "BLOCK",
      };
    }

    // AGE + MEDIA = BLOCK (unless legitimate)
    if (globalMedia.found && !isLegitimate) {
      return {
        score: 12,
        flags: [
          {
            type: "AGE_MEDIA_COMBINATION",
            matched: [...globalAges.matches, ...globalMedia.matches],
            score: 12,
          },
        ],
        reason: "AGE_MEDIA_COMBINATION",
        action: "BLOCK",
      };
    }

    // AGE + CONTACT = BLOCK (unless legitimate)
    if (globalContact.found && !isLegitimate) {
      return {
        score: 10,
        flags: [
          {
            type: "AGE_CONTACT_COMBINATION",
            matched: [...globalAges.matches, ...globalContact.matches],
            score: 10,
          },
        ],
        reason: "AGE_CONTACT_COMBINATION",
        action: "BLOCK",
      };
    }

    // AGE + INTENT = BLOCK (unless legitimate)
    if (globalIntent.found && !isLegitimate) {
      return {
        score: 10,
        flags: [
          {
            type: "AGE_INTENT_COMBINATION",
            matched: [...globalAges.matches, ...globalIntent.matches],
            score: 10,
          },
        ],
        reason: "AGE_INTENT_COMBINATION",
        action: "BLOCK",
      };
    }
  }

  // === IMPLICIT SUSPICIOUS PATTERNS ===

  if (globalImplicit.found) {
    totalScore += 6;
    flags.push({
      type: "IMPLICIT_SUSPICIOUS",
      matched: globalImplicit.matches,
      score: 6,
    });
    detectedReason = "IMPLICIT_SUSPICIOUS";
  }

  // === ROLE INVERSION (GROOMING VIA PROXY) ===

  if (globalRoleInversion.found) {
    totalScore += 8;
    flags.push({
      type: "ROLE_INVERSION",
      matched: globalRoleInversion.matches,
      score: 8,
    });
    if (!detectedReason) detectedReason = "ROLE_INVERSION";
  }

  // === SUSPICIOUS EMOJIS ===

  if (globalEmojis.found) {
    // Only add emoji score if combined with other suspicious content
    if (globalMinors.found || globalSexual.found || globalContact.found) {
      totalScore += globalEmojis.score + 3; // Bonus for combination
      flags.push({
        type: "SUSPICIOUS_EMOJI_COMBINATION",
        matched: globalEmojis.matches,
        score: globalEmojis.score + 3,
      });
    } else if (globalEmojis.score >= 3) {
      totalScore += globalEmojis.score;
      flags.push({
        type: "SUSPICIOUS_EMOJI",
        matched: globalEmojis.matches,
        score: globalEmojis.score,
      });
    }
  }

  // === SLIDING WINDOW ANALYSIS for edge cases ===

  const windowSizes = [3, 5, 8];

  for (const windowSize of windowSizes) {
    if (tokens.length < windowSize) continue;

    for (let i = 0; i <= tokens.length - windowSize; i++) {
      const window = tokens.slice(i, i + windowSize);
      const windowText = window.join(" ");

      const windowMinors = hasAnyWord(windowText, MINORS_SET);
      const windowSexual = hasAnyWord(windowText, SEXUAL_SET);
      const windowMedia = hasAnyWord(windowText, MEDIA_EXCHANGE_SET);
      const windowIntent = hasAnyWord(windowText, INTENT_SET);
      const windowContact = hasAnyWord(windowText, CONTACT_SET);

      // Calculate window score
      let windowScore = 0;
      const windowMatches: string[] = [];

      if (windowMinors.found && windowContact.found) {
        windowScore += 4;
        windowMatches.push(...windowMinors.matches, ...windowContact.matches);
      }

      if (windowMedia.found && windowContact.found) {
        windowScore += 3;
        windowMatches.push(...windowMedia.matches, ...windowContact.matches);
      }

      if (windowIntent.found && windowMedia.found) {
        windowScore += 2;
        windowMatches.push(...windowIntent.matches, ...windowMedia.matches);
      }

      if (windowScore > 0) {
        totalScore += windowScore;
        flags.push({
          type: "WINDOW_COMBINATION",
          matched: windowMatches,
          window: windowText,
          score: windowScore,
        });
      }
    }
  }

  // === DETERMINE FINAL ACTION ===

  if (totalScore >= SCORING_CONFIG.blockThreshold) {
    detectedAction = "BLOCK";
    if (!detectedReason) detectedReason = "HIGH_RISK_SCORE";
  } else if (totalScore >= SCORING_CONFIG.reviewThreshold) {
    detectedAction = "REVIEW";
    if (!detectedReason) detectedReason = "MEDIUM_RISK_SCORE";
  }

  return {
    score: totalScore,
    flags,
    reason: detectedReason,
    action: detectedAction,
  };
}

// MAIN MODERATION FUNCTION

/**
 * Moderate text content (board descriptions)
 *
 * @param text - The text to moderate
 * @returns TextModerationResult with action, score, and flags
 */
export function moderateText(text: string): TextModerationResult {
  const startTime = Date.now();

  // Handle empty/null text
  if (!text || text.trim().length === 0) {
    return {
      action: "ALLOW",
      score: 0,
      flags: [],
      normalizedText: "",
      processingTimeMs: Date.now() - startTime,
    };
  }

  const originalText = text;

  // Phase 1: Aggressive normalization
  const normalizedText = aggressiveNormalize(text);

  // Phase 2: Blacklist check
  const blacklistResult = checkBlacklist(normalizedText);
  if (blacklistResult.hit) {
    return {
      action: "BLOCK",
      score: 100, // Max score for blacklist hit
      reason: "BLACKLIST_HIT",
      flags: [
        {
          type: "BLACKLIST_HIT",
          matched: [blacklistResult.term!],
          score: 100,
        },
      ],
      normalizedText,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Phase 3: Contextual detection with sliding windows
  const analysisResult = analyzeWithSlidingWindows(
    normalizedText,
    originalText,
  );

  return {
    action: analysisResult.action || "ALLOW",
    score: analysisResult.score,
    reason: analysisResult.reason,
    flags: analysisResult.flags,
    normalizedText,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Get user-facing message for a moderation reason
 */
export function getModerationMessage(reason?: string): string {
  if (!reason) return USER_MESSAGES.DEFAULT;
  return USER_MESSAGES[reason] || USER_MESSAGES.DEFAULT;
}

/**
 * Quick check if text should be blocked (for validation)
 */
export function shouldBlockText(text: string): boolean {
  const result = moderateText(text);
  return result.action === "BLOCK";
}

/**
 * Get moderation result with user message
 */
export function moderateTextWithMessage(
  text: string,
): TextModerationResult & { userMessage: string } {
  const result = moderateText(text);
  return {
    ...result,
    userMessage: getModerationMessage(result.reason),
  };
}
