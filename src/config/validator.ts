/**
 * Configuration Validator
 *
 * Provides health check and validation for configuration objects.
 */

import type { ConfigOutput } from './schema.js';
import { ConfigSchema } from './schema.js';

/**
 * Configuration health check result
 */
export interface ConfigHealthResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Detailed validation error
 */
export interface ValidationError {
  path: string[];
  message: string;
  code: string;
}

/**
 * Configuration validation result with details
 */
export interface ConfigValidationResult {
  success: boolean;
  data?: ConfigOutput;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  path: string[];
  message: string;
  code: string;
}

/**
 * Check configuration health
 *
 * Validates the configuration against the schema and returns
 * a health result with errors and warnings.
 *
 * @param config - Configuration object to validate
 * @returns Health check result
 */
export function checkConfigHealth(config: unknown): ConfigHealthResult {
  const result = ConfigSchema.safeParse(config);

  if (result.success) {
    return {
      success: true,
      errors: [],
      warnings: generateWarnings(result.data),
    };
  }

  return {
    success: false,
    errors: result.error.errors.map(formatZodError),
    warnings: [],
  };
}

/**
 * Validate configuration with detailed output
 *
 * @param config - Configuration object to validate
 * @returns Detailed validation result
 */
export function validateConfigDetailed(config: unknown): ConfigValidationResult {
  const result = ConfigSchema.safeParse(config);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: [],
      warnings: generateDetailedWarnings(result.data),
    };
  }

  return {
    success: false,
    errors: result.error.errors.map((e) => ({
      path: e.path.map(String),
      message: e.message,
      code: e.code,
    })),
    warnings: [],
  };
}

/**
 * Format Zod error to readable string
 */
function formatZodError(error: { path: (string | number)[]; message: string }): string {
  const path = error.path.length > 0 ? error.path.join('.') : 'config';
  return `${path}: ${error.message}`;
}

/**
 * Generate warnings for valid but non-optimal configuration
 */
function generateWarnings(config: ConfigOutput): string[] {
  const warnings: string[] = [];

  // Performance warnings
  if (config.maxSessions > 50) {
    warnings.push(`maxSessions (${config.maxSessions}) > 50 may cause performance issues`);
  }

  if (config.browserTimeout > 120000) {
    warnings.push(`browserTimeout (${config.browserTimeout}ms) > 120s may indicate slow network`);
  }

  // Stealth settings warnings
  if (!config.stealthEnabled) {
    warnings.push('stealthEnabled is false - this may increase detection risk');
  }

  // Session timeout warnings
  if (config.sessionTimeout < 300) {
    warnings.push(
      `sessionTimeout (${config.sessionTimeout}s) < 300s may cause frequent re-authentication`
    );
  }

  // Instance management warnings
  if (config.instanceProfileMaxCount > 50) {
    warnings.push(
      `instanceProfileMaxCount (${config.instanceProfileMaxCount}) > 50 may use significant disk space`
    );
  }

  return warnings;
}

/**
 * Generate detailed warnings with codes
 */
function generateDetailedWarnings(config: ConfigOutput): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Performance warnings
  if (config.maxSessions > 50) {
    warnings.push({
      path: ['maxSessions'],
      message: `maxSessions (${config.maxSessions}) > 50 may cause performance issues`,
      code: 'HIGH_MAX_SESSIONS',
    });
  }

  if (config.browserTimeout > 120000) {
    warnings.push({
      path: ['browserTimeout'],
      message: `browserTimeout (${config.browserTimeout}ms) > 120s may indicate slow network`,
      code: 'HIGH_BROWSER_TIMEOUT',
    });
  }

  // Stealth settings warnings
  if (!config.stealthEnabled) {
    warnings.push({
      path: ['stealthEnabled'],
      message: 'stealthEnabled is false - this may increase detection risk',
      code: 'STEALTH_DISABLED',
    });
  }

  // Session timeout warnings
  if (config.sessionTimeout < 300) {
    warnings.push({
      path: ['sessionTimeout'],
      message: `sessionTimeout (${config.sessionTimeout}s) < 300s may cause frequent re-authentication`,
      code: 'LOW_SESSION_TIMEOUT',
    });
  }

  // Instance management warnings
  if (config.instanceProfileMaxCount > 50) {
    warnings.push({
      path: ['instanceProfileMaxCount'],
      message: `instanceProfileMaxCount (${config.instanceProfileMaxCount}) > 50 may use significant disk space`,
      code: 'HIGH_INSTANCE_MAX_COUNT',
    });
  }

  // Auto-login without credentials warning
  if (config.autoLoginEnabled && !config.loginEmail) {
    warnings.push({
      path: ['autoLoginEnabled', 'loginEmail'],
      message: 'autoLoginEnabled is true but loginEmail is not set',
      code: 'AUTO_LOGIN_NO_CREDENTIALS',
    });
  }

  return warnings;
}
