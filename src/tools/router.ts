/**
 * Tool Router
 *
 * Handles routing of tool calls to appropriate handlers.
 * Replaces the large switch statement in index.ts with a registry-based approach.
 */

import { ToolHandlers } from "./handlers.js";
import type { ProgressCallback, ToolResult } from "../types.js";
import type { BrowserOptions } from "../config.js";
import { log } from "../utils/logger.js";

/**
 * Tool call arguments type - union of all possible tool arguments
 */
export type ToolArgs = Record<string, unknown>;

/**
 * Tool handler function signature
 */
type ToolHandler = (
  handlers: ToolHandlers,
  args: ToolArgs,
  sendProgress?: ProgressCallback
) => Promise<ToolResult>;

/**
 * Tool registry entry
 */
interface ToolEntry {
  handler: ToolHandler;
  supportsProgress: boolean;
}

/**
 * Tool registry - maps tool names to their handlers
 */
const toolRegistry: Record<string, ToolEntry> = {
  // Core functionality
  ask_question: {
    handler: async (h, args, sendProgress) =>
      h.handleAskQuestion(
        args as {
          question: string;
          session_id?: string;
          notebook_id?: string;
          notebook_url?: string;
          show_browser?: boolean;
          browser_options?: BrowserOptions;
        },
        sendProgress
      ),
    supportsProgress: true,
  },

  // Notebook management
  add_notebook: {
    handler: async (h, args) =>
      h.handleAddNotebook(
        args as {
          url: string;
          name: string;
          description: string;
          topics: string[];
          content_types?: string[];
          use_cases?: string[];
          tags?: string[];
        }
      ),
    supportsProgress: false,
  },
  list_notebooks: {
    handler: async (h) => h.handleListNotebooks(),
    supportsProgress: false,
  },
  get_notebook: {
    handler: async (h, args) => h.handleGetNotebook(args as { id: string }),
    supportsProgress: false,
  },
  select_notebook: {
    handler: async (h, args) => h.handleSelectNotebook(args as { id: string }),
    supportsProgress: false,
  },
  update_notebook: {
    handler: async (h, args) =>
      h.handleUpdateNotebook(
        args as {
          id: string;
          name?: string;
          description?: string;
          topics?: string[];
          content_types?: string[];
          use_cases?: string[];
          tags?: string[];
          url?: string;
        }
      ),
    supportsProgress: false,
  },
  remove_notebook: {
    handler: async (h, args) => h.handleRemoveNotebook(args as { id: string }),
    supportsProgress: false,
  },
  search_notebooks: {
    handler: async (h, args) =>
      h.handleSearchNotebooks(args as { query: string }),
    supportsProgress: false,
  },
  get_library_stats: {
    handler: async (h) => h.handleGetLibraryStats(),
    supportsProgress: false,
  },

  // Session management
  list_sessions: {
    handler: async (h) => h.handleListSessions(),
    supportsProgress: false,
  },
  close_session: {
    handler: async (h, args) =>
      h.handleCloseSession(args as { session_id: string }),
    supportsProgress: false,
  },
  reset_session: {
    handler: async (h, args) =>
      h.handleResetSession(args as { session_id: string }),
    supportsProgress: false,
  },

  // Health & Cleanup
  get_health: {
    handler: async (h) => h.handleGetHealth(),
    supportsProgress: false,
  },
  cleanup_data: {
    handler: async (h, args) =>
      h.handleCleanupData(
        args as { confirm: boolean; preserve_library?: boolean }
      ),
    supportsProgress: false,
  },

  // Authentication
  setup_auth: {
    handler: async (h, args, sendProgress) =>
      h.handleSetupAuth(
        args as { show_browser?: boolean; browser_options?: BrowserOptions },
        sendProgress
      ),
    supportsProgress: true,
  },
  re_auth: {
    handler: async (h, args, sendProgress) =>
      h.handleReAuth(
        args as { show_browser?: boolean; browser_options?: BrowserOptions },
        sendProgress
      ),
    supportsProgress: true,
  },
};

/**
 * Tool Router class
 *
 * Routes tool calls to appropriate handlers using a registry-based approach.
 */
export class ToolRouter {
  private handlers: ToolHandlers;

  constructor(handlers: ToolHandlers) {
    this.handlers = handlers;
  }

  /**
   * Check if a tool is registered
   */
  hasHandler(toolName: string): boolean {
    return toolName in toolRegistry;
  }

  /**
   * Check if a tool supports progress notifications
   */
  supportsProgress(toolName: string): boolean {
    return toolRegistry[toolName]?.supportsProgress ?? false;
  }

  /**
   * Route a tool call to the appropriate handler
   */
  async route(
    toolName: string,
    args: ToolArgs,
    sendProgress?: ProgressCallback
  ): Promise<ToolResult> {
    const entry = toolRegistry[toolName];

    if (!entry) {
      log.error(`❌ [Router] Unknown tool: ${toolName}`);
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
      };
    }

    // Only pass progress callback if tool supports it
    const progressCb = entry.supportsProgress ? sendProgress : undefined;

    return entry.handler(this.handlers, args, progressCb);
  }

  /**
   * Get list of registered tool names
   */
  getRegisteredTools(): string[] {
    return Object.keys(toolRegistry);
  }
}
