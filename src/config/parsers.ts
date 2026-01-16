/**
 * Safe Configuration Parsers
 *
 * Replaces the basic parseBoolean, parseInteger, parseArray functions
 * with type-safe alternatives that include validation and range checking.
 */

/**
 * Valid profile strategy values
 */
const VALID_PROFILE_STRATEGIES = ['auto', 'single', 'isolated'] as const;
export type ProfileStrategy = (typeof VALID_PROFILE_STRATEGIES)[number];

/**
 * Parse boolean from environment variable string
 *
 * Accepts: "true", "1" (case-insensitive) → true
 *          "false", "0" (case-insensitive) → false
 *          anything else → defaultValue
 *
 * @param value - Environment variable value
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed boolean value
 */
export function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;

  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'true' || trimmed === '1') return true;
  if (trimmed === 'false' || trimmed === '0') return false;

  // Invalid value, return default
  return defaultValue;
}

/**
 * Parse integer from environment variable string
 *
 * Features:
 * - Rejects NaN values
 * - Optionally validates min/max bounds
 * - Returns defaultValue if parsing fails or out of bounds
 *
 * @param value - Environment variable value
 * @param defaultValue - Default value if parsing fails
 * @param min - Optional minimum allowed value (inclusive)
 * @param max - Optional maximum allowed value (inclusive)
 * @returns Parsed integer value
 */
export function parseIntegerEnv(
  value: string | undefined,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  if (value === undefined || value === '') return defaultValue;

  const trimmed = value.trim();
  const parsed = Number.parseInt(trimmed, 10);

  if (Number.isNaN(parsed)) return defaultValue;

  // Check bounds
  if (min !== undefined && parsed < min) return defaultValue;
  if (max !== undefined && parsed > max) return defaultValue;

  return parsed;
}

/**
 * Parse comma-separated array from environment variable
 *
 * Splits by comma, trims whitespace, filters empty strings.
 *
 * @param value - Environment variable value
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed array value
 */
export function parseArrayEnv(value: string | undefined, defaultValue: string[]): string[] {
  if (!value) return defaultValue;

  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Parse profile strategy from environment variable
 *
 * Validates against allowed values: 'auto', 'single', 'isolated'
 *
 * @param value - Environment variable value
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed profile strategy value
 */
export function parseProfileStrategy(
  value: string | undefined,
  defaultValue: ProfileStrategy
): ProfileStrategy {
  if (value === undefined || value === '') return defaultValue;

  const trimmed = value.trim().toLowerCase();

  // Check if it's a valid strategy
  if (VALID_PROFILE_STRATEGIES.includes(trimmed as ProfileStrategy)) {
    return trimmed as ProfileStrategy;
  }

  // Invalid value, return default
  return defaultValue;
}

/**
 * Parse URL from environment variable
 *
 * Validates that the value is a well-formed URL.
 *
 * @param value - Environment variable value
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed URL value
 */
export function parseUrlEnv(value: string | undefined, defaultValue: string): string {
  if (!value) return defaultValue;

  const trimmed = value.trim();

  // Basic URL validation - must start with http:// or https://
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Not a valid URL, return default
  return defaultValue;
}

/**
 * Parse email from environment variable
 *
 * Validates that the value looks like an email address.
 * Must have: non-empty local part, @ symbol, non-empty domain with at least one dot.
 *
 * @param value - Environment variable value
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed email value
 */
export function parseEmailEnv(value: string | undefined, defaultValue: string): string {
  if (!value) return defaultValue;

  const trimmed = value.trim();

  // Basic email validation:
  // - Must contain exactly one @
  // - Must have at least one character before @
  // - Must have at least one character after @
  // - Domain part must contain at least one dot
  const atIndex = trimmed.indexOf('@');
  const hasValidFormat =
    atIndex > 0 && // Something before @
    atIndex < trimmed.length - 1 && // Something after @
    trimmed.indexOf('.', atIndex) > atIndex + 1; // Dot in domain part (not right after @)

  if (hasValidFormat) {
    return trimmed;
  }

  // Not a valid email, return default
  return defaultValue;
}

/**
 * Parse positive integer from environment variable
 *
 * Ensures the parsed value is greater than 0.
 *
 * @param value - Environment variable value
 * @param defaultValue - Default value if parsing fails
 * @param max - Optional maximum allowed value
 * @returns Parsed positive integer value
 */
export function parsePositiveIntegerEnv(
  value: string | undefined,
  defaultValue: number,
  max?: number
): number {
  if (value === undefined || value === '') return defaultValue;

  const trimmed = value.trim();
  const parsed = Number.parseInt(trimmed, 10);

  if (Number.isNaN(parsed) || parsed <= 0) return defaultValue;
  if (max !== undefined && parsed > max) return defaultValue;

  return parsed;
}

/**
 * Parse non-negative integer from environment variable
 *
 * Ensures the parsed value is >= 0.
 *
 * @param value - Environment variable value
 * @param defaultValue - Default value if parsing fails
 * @param max - Optional maximum allowed value
 * @returns Parsed non-negative integer value
 */
export function parseNonNegativeIntegerEnv(
  value: string | undefined,
  defaultValue: number,
  max?: number
): number {
  if (value === undefined || value === '') return defaultValue;

  const trimmed = value.trim();
  const parsed = Number.parseInt(trimmed, 10);

  if (Number.isNaN(parsed) || parsed < 0) return defaultValue;
  if (max !== undefined && parsed > max) return defaultValue;

  return parsed;
}
