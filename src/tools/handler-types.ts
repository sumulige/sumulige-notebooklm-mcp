/**
 * Type definitions and shared utilities for Tool Handlers
 */

import { SessionManager } from "../session/session-manager.js";
import { AuthManager } from "../auth/auth-manager.js";
import { NotebookLibrary } from "../library/notebook-library.js";
import type { ToolResult, ProgressCallback } from "../types.js";
import { log } from "../utils/logger.js";

/**
 * Browser options for tool calls
 */
export interface BrowserOptions {
  headless?: boolean;
  show?: boolean;
}

/**
 * Handler context containing all managers
 */
export interface HandlerContext {
  sessionManager: SessionManager;
  authManager: AuthManager;
  library: NotebookLibrary;
}

/**
 * Session info returned by list_sessions
 */
export interface SessionListInfo {
  id: string;
  created_at: number;
  last_activity: number;
  age_seconds: number;
  inactive_seconds: number;
  message_count: number;
  notebook_url: string;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: string;
  authenticated: boolean;
  notebook_url: string;
  active_sessions: number;
  max_sessions: number;
  session_timeout: number;
  total_messages: number;
  headless: boolean;
  auto_login_enabled: boolean;
  stealth_enabled: boolean;
  troubleshooting_tip?: string;
}

/**
 * Auth result
 */
export interface AuthResult {
  status: string;
  message: string;
  authenticated: boolean;
  duration_seconds?: number;
}

/**
 * Cleanup preview category
 */
export interface CleanupCategory {
  name: string;
  description: string;
  paths: string[];
  totalBytes: number;
  optional: boolean;
}

/**
 * Cleanup preview result
 */
export interface CleanupPreview {
  categories: CleanupCategory[];
  totalPaths: number;
  totalSizeBytes: number;
}

/**
 * Cleanup execution result
 */
export interface CleanupExecutionResult {
  deletedPaths: string[];
  failedPaths: string[];
  totalSizeBytes: number;
  categorySummary: Record<string, { count: number; bytes: number }>;
}

/**
 * Follow-up reminder for ask_question
 */
export const FOLLOW_UP_REMINDER =
  "\n\nEXTREMELY IMPORTANT: Is that ALL you need to know? You can always ask another question using the same session ID! Think about it carefully: before you reply to the user, review their original request and this answer. If anything is still unclear or missing, ask me another question first.";

/**
 * Helper function to extract error message
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Helper function for logging tool start
 */
export function logToolStart(toolName: string, details?: Record<string, unknown>): void {
  log.info(`🔧 [TOOL] ${toolName} called`);
  if (details) {
    for (const [key, value] of Object.entries(details)) {
      if (value !== undefined) {
        log.info(`  ${key}: ${value}`);
      }
    }
  }
}

/**
 * Helper function for logging tool success
 */
export function logToolSuccess(toolName: string, message?: string): void {
  log.success(`✅ [TOOL] ${toolName} completed${message ? ` ${message}` : ""}`);
}

/**
 * Helper function for logging tool error
 */
export function logToolError(toolName: string, error: string): void {
  log.error(`❌ [TOOL] ${toolName} failed: ${error}`);
}

/**
 * Helper function for logging tool warning
 */
export function logToolWarning(toolName: string, message: string): void {
  log.warning(`⚠️  [TOOL] ${toolName}: ${message}`);
}

/**
 * Create a successful tool result
 */
export function successResult<T>(data: T): ToolResult<T> {
  return { success: true, data };
}

/**
 * Create an error tool result
 */
export function errorResult(error: string): ToolResult<never> {
  return { success: false, error };
}

/**
 * Handler execution context
 */
export interface HandlerExecContext {
  toolName: string;
  logDetails?: Record<string, unknown>;
}

/**
 * Wrap a handler function with standardized error handling and logging.
 *
 * This eliminates the repetitive try/catch pattern in handlers:
 * - Automatically logs tool start with optional details
 * - Catches errors and logs them
 * - Returns proper error results
 *
 * Usage:
 * ```typescript
 * return wrapHandler("tool_name", { ID: args.id }, async () => {
 *   const result = await doSomething();
 *   logToolSuccess("tool_name");
 *   return successResult(result);
 * });
 * ```
 */
export async function wrapHandler<T>(
  toolName: string,
  logDetails: Record<string, unknown> | null,
  handler: () => Promise<ToolResult<T>>
): Promise<ToolResult<T>> {
  logToolStart(toolName, logDetails ?? undefined);

  try {
    return await handler();
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logToolError(toolName, errorMessage);
    return errorResult(errorMessage);
  }
}

// Re-export types that handlers need
export type { ToolResult, ProgressCallback };
