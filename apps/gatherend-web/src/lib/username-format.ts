import { JsonValue } from "@prisma/client/runtime/library";

/**
 * Username format structure supporting multiple style combinations
 */
export interface UsernameFormatConfig {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/**
 * Parse usernameFormat from database
 * Handles both legacy enum values (NORMAL, BOLD, ITALIC) and new JSON format
 */
export function parseUsernameFormat(
  format: JsonValue | UsernameFormatConfig | string | null | undefined
): UsernameFormatConfig {
  if (!format) return {};

  // Legacy string enum format - convert to new structure
  if (typeof format === "string") {
    switch (format) {
      case "BOLD":
        return { bold: true };
      case "ITALIC":
        return { italic: true };
      case "NORMAL":
      default:
        return {};
    }
  }

  // New JSON format
  if (typeof format === "object" && format !== null && !Array.isArray(format)) {
    const obj = format as Record<string, unknown>;
    return {
      bold: obj.bold === true,
      italic: obj.italic === true,
      underline: obj.underline === true,
    };
  }

  return {};
}

/**
 * Get CSS classes for username format
 */
export function getUsernameFormatClasses(
  format: JsonValue | UsernameFormatConfig | string | null | undefined
): string {
  const parsed = parseUsernameFormat(format);
  const classes: string[] = [];

  if (parsed.bold) {
    classes.push("font-bold");
  } else {
    classes.push("font-semibold"); // Default weight
  }

  if (parsed.italic) {
    classes.push("italic");
  }

  if (parsed.underline) {
    classes.push("underline");
  }

  return classes.join(" ");
}

/**
 * Check if format has any styling applied
 */
export function hasFormatting(
  format: JsonValue | UsernameFormatConfig | string | null | undefined
): boolean {
  const parsed = parseUsernameFormat(format);
  return (
    parsed.bold === true || parsed.italic === true || parsed.underline === true
  );
}
