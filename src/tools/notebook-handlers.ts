/**
 * Notebook-related Tool Handlers
 *
 * Handles:
 * - add_notebook
 * - list_notebooks
 * - get_notebook
 * - select_notebook
 * - update_notebook
 * - remove_notebook
 * - search_notebooks
 * - get_library_stats
 */

import type { SessionManager } from "../session/session-manager.js";
import type { NotebookLibrary } from "../library/notebook-library.js";
import type { AddNotebookInput, UpdateNotebookInput } from "../library/types.js";
import type { ToolResult } from "../types.js";
import {
  logToolSuccess,
  logToolWarning,
  successResult,
  errorResult,
  wrapHandler,
} from "./handler-types.js";

export class NotebookHandlers {
  private sessionManager: SessionManager;
  private library: NotebookLibrary;

  constructor(sessionManager: SessionManager, library: NotebookLibrary) {
    this.sessionManager = sessionManager;
    this.library = library;
  }

  /**
   * Handle add_notebook tool
   */
  async handleAddNotebook(args: AddNotebookInput): Promise<ToolResult<{ notebook: any }>> {
    return wrapHandler("add_notebook", { Name: args.name }, async () => {
      const notebook = this.library.addNotebook(args);
      logToolSuccess("add_notebook", notebook.id);
      return successResult({ notebook });
    });
  }

  /**
   * Handle list_notebooks tool
   */
  async handleListNotebooks(): Promise<ToolResult<{ notebooks: any[] }>> {
    return wrapHandler("list_notebooks", null, async () => {
      const notebooks = this.library.listNotebooks();
      logToolSuccess("list_notebooks", `(${notebooks.length} notebooks)`);
      return successResult({ notebooks });
    });
  }

  /**
   * Handle get_notebook tool
   */
  async handleGetNotebook(args: { id: string }): Promise<ToolResult<{ notebook: any }>> {
    return wrapHandler("get_notebook", { ID: args.id }, async () => {
      const notebook = this.library.getNotebook(args.id);
      if (!notebook) {
        logToolWarning("get_notebook", `Notebook not found: ${args.id}`);
        return errorResult(`Notebook not found: ${args.id}`);
      }

      logToolSuccess("get_notebook", notebook.name);
      return successResult({ notebook });
    });
  }

  /**
   * Handle select_notebook tool
   */
  async handleSelectNotebook(args: { id: string }): Promise<ToolResult<{ notebook: any }>> {
    return wrapHandler("select_notebook", { ID: args.id }, async () => {
      const notebook = this.library.selectNotebook(args.id);
      logToolSuccess("select_notebook", notebook.name);
      return successResult({ notebook });
    });
  }

  /**
   * Handle update_notebook tool
   */
  async handleUpdateNotebook(args: UpdateNotebookInput): Promise<ToolResult<{ notebook: any }>> {
    return wrapHandler("update_notebook", { ID: args.id }, async () => {
      const notebook = this.library.updateNotebook(args);
      logToolSuccess("update_notebook", notebook.name);
      return successResult({ notebook });
    });
  }

  /**
   * Handle remove_notebook tool
   */
  async handleRemoveNotebook(args: {
    id: string;
  }): Promise<ToolResult<{ removed: boolean; closed_sessions: number }>> {
    return wrapHandler("remove_notebook", { ID: args.id }, async () => {
      const notebook = this.library.getNotebook(args.id);
      if (!notebook) {
        logToolWarning("remove_notebook", `Notebook not found: ${args.id}`);
        return errorResult(`Notebook not found: ${args.id}`);
      }

      const removed = this.library.removeNotebook(args.id);
      if (removed) {
        const closedSessions = await this.sessionManager.closeSessionsForNotebook(notebook.url);
        logToolSuccess("remove_notebook");
        return successResult({ removed: true, closed_sessions: closedSessions });
      } else {
        logToolWarning("remove_notebook", `Notebook not found: ${args.id}`);
        return errorResult(`Notebook not found: ${args.id}`);
      }
    });
  }

  /**
   * Handle search_notebooks tool
   */
  async handleSearchNotebooks(args: { query: string }): Promise<ToolResult<{ notebooks: any[] }>> {
    return wrapHandler("search_notebooks", { Query: `"${args.query}"` }, async () => {
      const notebooks = this.library.searchNotebooks(args.query);
      logToolSuccess("search_notebooks", `(${notebooks.length} results)`);
      return successResult({ notebooks });
    });
  }

  /**
   * Handle get_library_stats tool
   */
  async handleGetLibraryStats(): Promise<ToolResult<any>> {
    return wrapHandler("get_library_stats", null, async () => {
      const stats = this.library.getStats();
      logToolSuccess("get_library_stats");
      return successResult(stats);
    });
  }
}
