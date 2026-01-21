/**
 * Cleanup and System Tool Handlers
 *
 * Handles:
 * - get_health
 * - cleanup_data
 */

import type { SessionManager } from "../session/session-manager.js";
import type { AuthManager } from "../auth/auth-manager.js";
import { CONFIG } from "../config.js";
import { CleanupManager } from "../utils/cleanup-manager.js";
import type { ToolResult } from "../types.js";
import {
  type HealthCheckResult,
  type CleanupPreview,
  type CleanupExecutionResult,
  logToolStart,
  logToolSuccess,
  logToolError,
  getErrorMessage,
  successResult,
  errorResult,
  wrapHandler,
} from "./handler-types.js";
import { log } from "../utils/logger.js";

export class CleanupHandlers {
  private sessionManager: SessionManager;
  private authManager: AuthManager;

  constructor(sessionManager: SessionManager, authManager: AuthManager) {
    this.sessionManager = sessionManager;
    this.authManager = authManager;
  }

  /**
   * Handle get_health tool
   */
  async handleGetHealth(): Promise<ToolResult<HealthCheckResult>> {
    return wrapHandler("get_health", null, async () => {
      // Check authentication status
      const statePath = await this.authManager.getValidStatePath();
      const authenticated = statePath !== null;

      // Get session stats
      const stats = this.sessionManager.getStats();

      const result: HealthCheckResult = {
        status: "ok",
        authenticated,
        notebook_url: CONFIG.notebookUrl || "not configured",
        active_sessions: stats.active_sessions,
        max_sessions: stats.max_sessions,
        session_timeout: stats.session_timeout,
        total_messages: stats.total_messages,
        headless: CONFIG.headless,
        auto_login_enabled: CONFIG.autoLoginEnabled,
        stealth_enabled: CONFIG.stealthEnabled,
        // Add troubleshooting tip if not authenticated
        ...(!authenticated && {
          troubleshooting_tip:
            "For fresh start with clean browser session: Close all Chrome instances → " +
            "cleanup_data(confirm=true, preserve_library=true) → setup_auth",
        }),
      };

      logToolSuccess("get_health");
      return successResult(result);
    });
  }

  /**
   * Handle cleanup_data tool
   *
   * ULTRATHINK Deep Cleanup - scans entire system for ALL NotebookLM MCP files
   */
  async handleCleanupData(args: {
    confirm: boolean;
    preserve_library?: boolean;
  }): Promise<
    ToolResult<{
      status: string;
      mode: string;
      preview?: CleanupPreview;
      result?: CleanupExecutionResult;
    }>
  > {
    const { confirm, preserve_library = false } = args;

    logToolStart("cleanup_data", {
      Confirm: confirm,
      "Preserve Library": preserve_library,
    });

    const cleanupManager = new CleanupManager();

    try {
      // Always run in deep mode
      const mode = "deep";

      if (!confirm) {
        // Preview mode - show what would be deleted
        log.info(`  📋 Generating cleanup preview (mode: ${mode})...`);

        const preview = await cleanupManager.getCleanupPaths(mode, preserve_library);
        const platformInfo = cleanupManager.getPlatformInfo();

        log.info(
          `  Found ${preview.totalPaths.length} items (${cleanupManager.formatBytes(preview.totalSizeBytes)})`
        );
        log.info(`  Platform: ${platformInfo.platform}`);

        return successResult({
          status: "preview",
          mode,
          preview: {
            categories: preview.categories,
            totalPaths: preview.totalPaths.length,
            totalSizeBytes: preview.totalSizeBytes,
          },
        });
      } else {
        // Cleanup mode - actually delete files
        log.info(`  🗑️  Performing cleanup (mode: ${mode})...`);

        const result = await cleanupManager.performCleanup(mode, preserve_library);

        if (result.success) {
          logToolSuccess("cleanup_data", `- deleted ${result.deletedPaths.length} items`);
        } else {
          log.warning(`⚠️  [TOOL] cleanup_data completed with ${result.failedPaths.length} errors`);
        }

        return {
          success: result.success,
          data: {
            status: result.success ? "completed" : "partial",
            mode,
            result: {
              deletedPaths: result.deletedPaths,
              failedPaths: result.failedPaths,
              totalSizeBytes: result.totalSizeBytes,
              categorySummary: result.categorySummary,
            },
          },
        };
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logToolError("cleanup_data", errorMessage);
      return errorResult(errorMessage);
    }
  }
}
