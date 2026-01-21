/**
 * MCP Tool Handlers - Main Aggregator
 *
 * This is the main facade that coordinates all tool handlers:
 * - SessionHandlers: list/close/reset_session
 * - NotebookHandlers: add/list/get/select/update/remove/search notebooks + stats
 * - AuthHandlers: setup_auth, re_auth
 * - CleanupHandlers: get_health, cleanup_data
 *
 * The core ask_question handler is kept here as it's the primary functionality.
 */

import { SessionManager } from "../session/session-manager.js";
import { AuthManager } from "../auth/auth-manager.js";
import { NotebookLibrary } from "../library/notebook-library.js";
import type { AddNotebookInput, UpdateNotebookInput } from "../library/types.js";
import { CONFIG, applyBrowserOptions, type BrowserOptions } from "../config.js";
import { log } from "../utils/logger.js";
import type { AskQuestionResult, ToolResult, ProgressCallback, ResponseStreamCallback } from "../types.js";
import { RateLimitError } from "../errors.js";

// Import sub-handlers
import { SessionHandlers } from "./session-handlers.js";
import { NotebookHandlers } from "./notebook-handlers.js";
import { AuthHandlers } from "./auth-handlers.js";
import { CleanupHandlers } from "./cleanup-handlers.js";
import {
  FOLLOW_UP_REMINDER,
  logToolStart,
  logToolSuccess,
  logToolError,
  getErrorMessage,
  successResult,
} from "./handler-types.js";

/**
 * MCP Tool Handlers - Main Class
 */
export class ToolHandlers {
  private sessionManager: SessionManager;
  private library: NotebookLibrary;

  // Sub-handlers
  private sessionHandlers: SessionHandlers;
  private notebookHandlers: NotebookHandlers;
  private authHandlers: AuthHandlers;
  private cleanupHandlers: CleanupHandlers;

  constructor(
    sessionManager: SessionManager,
    authManager: AuthManager,
    library: NotebookLibrary
  ) {
    this.sessionManager = sessionManager;
    this.library = library;

    // Initialize sub-handlers
    this.sessionHandlers = new SessionHandlers(sessionManager);
    this.notebookHandlers = new NotebookHandlers(sessionManager, library);
    this.authHandlers = new AuthHandlers(sessionManager, authManager);
    this.cleanupHandlers = new CleanupHandlers(sessionManager, authManager);
  }

  // ============================================================================
  // Core Handler: ask_question (kept here as primary functionality)
  // ============================================================================

  /**
   * Handle ask_question tool
   *
   * @param args Tool arguments
   * @param sendProgress Progress callback for MCP notifications
   * @param onStreamChunk Optional streaming callback for character-by-character response
   */
  async handleAskQuestion(
    args: {
      question: string;
      session_id?: string;
      notebook_id?: string;
      notebook_url?: string;
      show_browser?: boolean;
      browser_options?: BrowserOptions;
      /** Enable streaming mode for real-time response delivery */
      streaming?: boolean;
      /** Streaming options */
      streaming_options?: {
        min_interval_ms?: number;
        max_jitter_ms?: number;
        chunk_size?: number;
      };
    },
    sendProgress?: ProgressCallback,
    onStreamChunk?: ResponseStreamCallback
  ): Promise<ToolResult<AskQuestionResult>> {
    const {
      question,
      session_id,
      notebook_id,
      notebook_url,
      show_browser,
      browser_options,
      streaming = false,
      streaming_options,
    } = args;

    logToolStart("ask_question", {
      Question: `"${question.substring(0, 100)}"...`,
      "Session ID": session_id,
      "Notebook ID": notebook_id,
      "Notebook URL": notebook_url,
    });

    try {
      // Resolve notebook URL
      let resolvedNotebookUrl = notebook_url;

      if (!resolvedNotebookUrl && notebook_id) {
        const notebook = this.library.incrementUseCount(notebook_id);
        if (!notebook) {
          throw new Error(`Notebook not found in library: ${notebook_id}`);
        }

        resolvedNotebookUrl = notebook.url;
        log.info(`  Resolved notebook: ${notebook.name}`);
      } else if (!resolvedNotebookUrl) {
        const active = this.library.getActiveNotebook();
        if (active) {
          const notebook = this.library.incrementUseCount(active.id);
          if (!notebook) {
            throw new Error(`Active notebook not found: ${active.id}`);
          }
          resolvedNotebookUrl = notebook.url;
          log.info(`  Using active notebook: ${notebook.name}`);
        }
      }

      // Progress: Getting or creating session
      await sendProgress?.("Getting or creating browser session...", 1, 5);

      // Apply browser options temporarily
      const originalConfig = { ...CONFIG };
      const effectiveConfig = applyBrowserOptions(browser_options, show_browser);
      Object.assign(CONFIG, effectiveConfig);

      // Calculate overrideHeadless parameter for session manager
      // show_browser takes precedence over browser_options.headless
      let overrideHeadless: boolean | undefined = undefined;
      if (show_browser !== undefined) {
        overrideHeadless = show_browser;
      } else if (browser_options?.show !== undefined) {
        overrideHeadless = browser_options.show;
      } else if (browser_options?.headless !== undefined) {
        overrideHeadless = !browser_options.headless;
      }

      try {
        // Get or create session (with headless override to handle mode changes)
        const session = await this.sessionManager.getOrCreateSession(
          session_id,
          resolvedNotebookUrl,
          overrideHeadless
        );

        // Progress: Asking question
        await sendProgress?.("Asking question to NotebookLM...", 2, 5);

        let rawAnswer: string;

        // Check if streaming mode is enabled
        if (streaming && onStreamChunk) {
          log.info("🌊 Streaming mode enabled");
          await sendProgress?.("Streaming response from NotebookLM...", 3, 5);

          const streamResult = await session.askWithStreaming(question, onStreamChunk, {
            sendProgress,
            minIntervalMs: streaming_options?.min_interval_ms ?? 100,
            maxJitterMs: streaming_options?.max_jitter_ms ?? 50,
            chunkSize: streaming_options?.chunk_size ?? 0,
          });

          if (!streamResult.success || !streamResult.response) {
            throw new Error(streamResult.error ?? "Streaming failed");
          }

          rawAnswer = streamResult.response;
          log.success(`✅ Streaming complete: ${streamResult.chunkCount} chunks`);
        } else {
          // Standard non-streaming mode
          rawAnswer = await session.ask(question, sendProgress);
        }

        const answer = `${rawAnswer.trimEnd()}${FOLLOW_UP_REMINDER}`;

        // Get session info
        const sessionInfo = session.getInfo();

        const result: AskQuestionResult = {
          status: "success",
          question,
          answer,
          session_id: session.sessionId,
          notebook_url: session.notebookUrl,
          session_info: {
            age_seconds: sessionInfo.age_seconds,
            message_count: sessionInfo.message_count,
            last_activity: sessionInfo.last_activity,
          },
        };

        // Progress: Complete
        await sendProgress?.("Question answered successfully!", 5, 5);

        logToolSuccess("ask_question");
        return successResult(result);
      } finally {
        // Restore original CONFIG
        Object.assign(CONFIG, originalConfig);
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      // Special handling for rate limit errors
      if (error instanceof RateLimitError || errorMessage.toLowerCase().includes("rate limit")) {
        log.error(`🚫 [TOOL] Rate limit detected`);
        return {
          success: false,
          error:
            "NotebookLM rate limit reached (50 queries/day for free accounts).\n\n" +
            "You can:\n" +
            "1. Use the 're_auth' tool to login with a different Google account\n" +
            "2. Wait until tomorrow for the quota to reset\n" +
            "3. Upgrade to Google AI Pro/Ultra for 5x higher limits\n\n" +
            `Original error: ${errorMessage}`,
        };
      }

      logToolError("ask_question", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // ============================================================================
  // Session Handlers (delegated)
  // ============================================================================

  async handleListSessions() {
    return this.sessionHandlers.handleListSessions();
  }

  async handleCloseSession(args: { session_id: string }) {
    return this.sessionHandlers.handleCloseSession(args);
  }

  async handleResetSession(args: { session_id: string }) {
    return this.sessionHandlers.handleResetSession(args);
  }

  // ============================================================================
  // Notebook Handlers (delegated)
  // ============================================================================

  async handleAddNotebook(args: AddNotebookInput) {
    return this.notebookHandlers.handleAddNotebook(args);
  }

  async handleListNotebooks() {
    return this.notebookHandlers.handleListNotebooks();
  }

  async handleGetNotebook(args: { id: string }) {
    return this.notebookHandlers.handleGetNotebook(args);
  }

  async handleSelectNotebook(args: { id: string }) {
    return this.notebookHandlers.handleSelectNotebook(args);
  }

  async handleUpdateNotebook(args: UpdateNotebookInput) {
    return this.notebookHandlers.handleUpdateNotebook(args);
  }

  async handleRemoveNotebook(args: { id: string }) {
    return this.notebookHandlers.handleRemoveNotebook(args);
  }

  async handleSearchNotebooks(args: { query: string }) {
    return this.notebookHandlers.handleSearchNotebooks(args);
  }

  async handleGetLibraryStats() {
    return this.notebookHandlers.handleGetLibraryStats();
  }

  // ============================================================================
  // Auth Handlers (delegated)
  // ============================================================================

  async handleSetupAuth(
    args: { show_browser?: boolean; browser_options?: BrowserOptions },
    sendProgress?: ProgressCallback
  ) {
    return this.authHandlers.handleSetupAuth(args, sendProgress);
  }

  async handleReAuth(
    args: { show_browser?: boolean; browser_options?: BrowserOptions },
    sendProgress?: ProgressCallback
  ) {
    return this.authHandlers.handleReAuth(args, sendProgress);
  }

  // ============================================================================
  // Cleanup Handlers (delegated)
  // ============================================================================

  async handleGetHealth() {
    return this.cleanupHandlers.handleGetHealth();
  }

  async handleCleanupData(args: { confirm: boolean; preserve_library?: boolean }) {
    return this.cleanupHandlers.handleCleanupData(args);
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Cleanup all resources (called on server shutdown)
   */
  async cleanup(): Promise<void> {
    log.info(`🧹 Cleaning up tool handlers...`);
    await this.sessionManager.closeAllSessions();
    log.success(`✅ Tool handlers cleanup complete`);
  }
}
