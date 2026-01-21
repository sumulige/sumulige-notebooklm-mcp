/**
 * Authentication-related Tool Handlers
 *
 * Handles:
 * - setup_auth
 * - re_auth
 */

import type { SessionManager } from "../session/session-manager.js";
import type { AuthManager } from "../auth/auth-manager.js";
import { CONFIG, applyBrowserOptions, type BrowserOptions } from "../config.js";
import type { ToolResult, ProgressCallback } from "../types.js";
import {
  type AuthResult,
  logToolStart,
  logToolSuccess,
  logToolError,
  getErrorMessage,
  successResult,
  errorResult,
} from "./handler-types.js";

export class AuthHandlers {
  private sessionManager: SessionManager;
  private authManager: AuthManager;

  constructor(sessionManager: SessionManager, authManager: AuthManager) {
    this.sessionManager = sessionManager;
    this.authManager = authManager;
  }

  /**
   * Handle setup_auth tool
   *
   * Opens a browser window for manual login with live progress updates.
   * The operation waits synchronously for login completion (up to 10 minutes).
   */
  async handleSetupAuth(
    args: {
      show_browser?: boolean;
      browser_options?: BrowserOptions;
    },
    sendProgress?: ProgressCallback
  ): Promise<ToolResult<AuthResult>> {
    const { show_browser, browser_options } = args;

    // CRITICAL: Send immediate progress to reset timeout from the very start
    await sendProgress?.("Initializing authentication setup...", 0, 10);

    logToolStart("setup_auth", {
      "Show browser": show_browser,
    });

    const startTime = Date.now();

    // Apply browser options temporarily
    const originalConfig = { ...CONFIG };
    const effectiveConfig = applyBrowserOptions(browser_options, show_browser);
    Object.assign(CONFIG, effectiveConfig);

    try {
      // Progress: Starting
      await sendProgress?.("Preparing authentication browser...", 1, 10);

      // Progress: Opening browser
      await sendProgress?.("Opening browser window...", 2, 10);

      // Perform setup with progress updates (uses CONFIG internally)
      const success = await this.authManager.performSetup(sendProgress);

      const durationSeconds = (Date.now() - startTime) / 1000;

      if (success) {
        // Progress: Complete
        await sendProgress?.("Authentication saved successfully!", 10, 10);

        logToolSuccess("setup_auth", `(${durationSeconds.toFixed(1)}s)`);
        return successResult({
          status: "authenticated",
          message: "Successfully authenticated and saved browser state",
          authenticated: true,
          duration_seconds: durationSeconds,
        });
      } else {
        logToolError("setup_auth", `failed (${durationSeconds.toFixed(1)}s)`);
        return errorResult("Authentication failed or was cancelled");
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      const durationSeconds = (Date.now() - startTime) / 1000;
      logToolError("setup_auth", `${errorMessage} (${durationSeconds.toFixed(1)}s)`);
      return errorResult(errorMessage);
    } finally {
      // Restore original CONFIG
      Object.assign(CONFIG, originalConfig);
    }
  }

  /**
   * Handle re_auth tool
   *
   * Performs a complete re-authentication:
   * 1. Closes all active browser sessions
   * 2. Deletes all saved authentication data (cookies, Chrome profile)
   * 3. Opens browser for fresh Google login
   *
   * Use for switching Google accounts or recovering from rate limits.
   */
  async handleReAuth(
    args: {
      show_browser?: boolean;
      browser_options?: BrowserOptions;
    },
    sendProgress?: ProgressCallback
  ): Promise<ToolResult<AuthResult>> {
    const { show_browser, browser_options } = args;

    await sendProgress?.("Preparing re-authentication...", 0, 12);

    logToolStart("re_auth", {
      "Show browser": show_browser,
    });

    const startTime = Date.now();

    // Apply browser options temporarily
    const originalConfig = { ...CONFIG };
    const effectiveConfig = applyBrowserOptions(browser_options, show_browser);
    Object.assign(CONFIG, effectiveConfig);

    try {
      // 1. Close all active sessions
      await sendProgress?.("Closing all active sessions...", 1, 12);
      await this.sessionManager.closeAllSessions();

      // 2. Clear all auth data
      await sendProgress?.("Clearing authentication data...", 2, 12);
      await this.authManager.clearAllAuthData();

      // 3. Perform fresh setup
      await sendProgress?.("Starting fresh authentication...", 3, 12);
      const success = await this.authManager.performSetup(sendProgress);

      const durationSeconds = (Date.now() - startTime) / 1000;

      if (success) {
        await sendProgress?.("Re-authentication complete!", 12, 12);
        logToolSuccess("re_auth", `(${durationSeconds.toFixed(1)}s)`);
        return successResult({
          status: "authenticated",
          message:
            "Successfully re-authenticated with new account. All previous sessions have been closed.",
          authenticated: true,
          duration_seconds: durationSeconds,
        });
      } else {
        logToolError("re_auth", `failed (${durationSeconds.toFixed(1)}s)`);
        return errorResult("Re-authentication failed or was cancelled");
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      const durationSeconds = (Date.now() - startTime) / 1000;
      logToolError("re_auth", `${errorMessage} (${durationSeconds.toFixed(1)}s)`);
      return errorResult(errorMessage);
    } finally {
      // Restore original CONFIG
      Object.assign(CONFIG, originalConfig);
    }
  }
}
