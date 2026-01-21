/**
 * Session-related Tool Handlers
 *
 * Handles:
 * - list_sessions
 * - close_session
 * - reset_session
 */

import type { SessionManager } from "../session/session-manager.js";
import type { ToolResult } from "../types.js";
import {
  type SessionListInfo,
  logToolSuccess,
  logToolWarning,
  successResult,
  errorResult,
  wrapHandler,
} from "./handler-types.js";

export class SessionHandlers {
  private sessionManager: SessionManager;

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * Handle list_sessions tool
   */
  async handleListSessions(): Promise<
    ToolResult<{
      active_sessions: number;
      max_sessions: number;
      session_timeout: number;
      oldest_session_seconds: number;
      total_messages: number;
      sessions: SessionListInfo[];
    }>
  > {
    return wrapHandler("list_sessions", null, async () => {
      const stats = this.sessionManager.getStats();
      const sessions = this.sessionManager.getAllSessionsInfo();

      const result = {
        active_sessions: stats.active_sessions,
        max_sessions: stats.max_sessions,
        session_timeout: stats.session_timeout,
        oldest_session_seconds: stats.oldest_session_seconds,
        total_messages: stats.total_messages,
        sessions: sessions.map((info) => ({
          id: info.id,
          created_at: info.created_at,
          last_activity: info.last_activity,
          age_seconds: info.age_seconds,
          inactive_seconds: info.inactive_seconds,
          message_count: info.message_count,
          notebook_url: info.notebook_url,
        })),
      };

      logToolSuccess("list_sessions", `(${result.active_sessions} sessions)`);
      return successResult(result);
    });
  }

  /**
   * Handle close_session tool
   */
  async handleCloseSession(args: {
    session_id: string;
  }): Promise<ToolResult<{ status: string; message: string; session_id: string }>> {
    const { session_id } = args;

    return wrapHandler("close_session", { "Session ID": session_id }, async () => {
      const closed = await this.sessionManager.closeSession(session_id);

      if (closed) {
        logToolSuccess("close_session");
        return successResult({
          status: "success",
          message: `Session ${session_id} closed successfully`,
          session_id,
        });
      } else {
        logToolWarning("close_session", `Session ${session_id} not found`);
        return errorResult(`Session ${session_id} not found`);
      }
    });
  }

  /**
   * Handle reset_session tool
   */
  async handleResetSession(args: {
    session_id: string;
  }): Promise<ToolResult<{ status: string; message: string; session_id: string }>> {
    const { session_id } = args;

    return wrapHandler("reset_session", { "Session ID": session_id }, async () => {
      const session = this.sessionManager.getSession(session_id);

      if (!session) {
        logToolWarning("reset_session", `Session ${session_id} not found`);
        return errorResult(`Session ${session_id} not found`);
      }

      await session.reset();

      logToolSuccess("reset_session");
      return successResult({
        status: "success",
        message: `Session ${session_id} reset successfully`,
        session_id,
      });
    });
  }
}
