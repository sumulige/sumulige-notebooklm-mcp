/**
 * HTTP Transport Adapter
 *
 * Provides a REST API interface for NotebookLM MCP tools.
 * This enables the server to be accessed via HTTP instead of (or alongside) stdio.
 *
 * Features:
 * - REST endpoints for all MCP tools
 * - Server-Sent Events (SSE) for streaming progress
 * - CORS support for browser clients
 * - Health check endpoint
 * - OpenAPI documentation ready
 *
 * Usage:
 *   const adapter = new HttpTransportAdapter(toolHandlers);
 *   await adapter.start(3000);
 */

import Fastify, {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import cors from "@fastify/cors";
import { log } from "../../utils/logger.js";
import type { EventBus } from "../../core/events/event-bus.js";

// ============================================================================
// Types
// ============================================================================

/**
 * HTTP adapter configuration
 */
export interface HttpAdapterConfig {
  readonly port: number;
  readonly host?: string;
  readonly cors?: {
    readonly origin?: string | string[] | boolean;
    readonly credentials?: boolean;
  };
  readonly prefix?: string; // API prefix, e.g., "/api/v1"
}

/**
 * Tool handler interface (matches existing ToolHandlers)
 */
export interface IToolHandlers {
  handleAskQuestion(
    args: Record<string, unknown>,
    sendProgress?: ProgressCallback
  ): Promise<ToolResult>;

  // Session handlers
  handleListSessions(): Promise<ToolResult>;
  handleCloseSession(args: Record<string, unknown>): Promise<ToolResult>;
  handleResetSession(args: Record<string, unknown>): Promise<ToolResult>;

  // Notebook handlers
  handleAddNotebook(args: Record<string, unknown>): Promise<ToolResult>;
  handleListNotebooks(args: Record<string, unknown>): Promise<ToolResult>;
  handleGetNotebook(args: Record<string, unknown>): Promise<ToolResult>;
  handleSelectNotebook(args: Record<string, unknown>): Promise<ToolResult>;
  handleUpdateNotebook(args: Record<string, unknown>): Promise<ToolResult>;
  handleRemoveNotebook(args: Record<string, unknown>): Promise<ToolResult>;
  handleSearchNotebooks(args: Record<string, unknown>): Promise<ToolResult>;
  handleGetLibraryStats(): Promise<ToolResult>;

  // Auth handlers
  handleSetupAuth(
    args: Record<string, unknown>,
    sendProgress?: ProgressCallback
  ): Promise<ToolResult>;
  handleReAuth(
    args: Record<string, unknown>,
    sendProgress?: ProgressCallback
  ): Promise<ToolResult>;

  // System handlers
  handleGetHealth(): Promise<ToolResult>;
  handleCleanupData(args: Record<string, unknown>): Promise<ToolResult>;

  cleanup(): Promise<void>;
}

/**
 * Tool result type
 */
interface ToolResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

/**
 * Progress callback type
 */
type ProgressCallback = (
  message: string,
  progress?: number,
  total?: number
) => Promise<void>;

/**
 * SSE progress event
 */
interface ProgressEvent {
  message: string;
  progress?: number;
  total?: number;
  timestamp: number;
}

// ============================================================================
// HTTP Transport Adapter
// ============================================================================

/**
 * HTTP Transport Adapter
 *
 * Exposes MCP tools via REST API
 */
export class HttpTransportAdapter {
  private server: FastifyInstance;
  private handlers: IToolHandlers;
  private eventBus?: EventBus;
  private config: HttpAdapterConfig;
  private isRunning: boolean = false;

  constructor(
    handlers: IToolHandlers,
    config: HttpAdapterConfig,
    eventBus?: EventBus
  ) {
    this.handlers = handlers;
    this.config = config;
    this.eventBus = eventBus;

    // Create Fastify instance
    this.server = Fastify({
      logger: false, // Use our own logger
      disableRequestLogging: true,
    });

    // Setup routes (sync)
    this.setupRoutes();
  }

  /**
   * Setup middleware (CORS, etc.)
   */
  private async setupMiddleware(): Promise<void> {
    // Register CORS
    await this.server.register(cors, {
      origin: this.config.cors?.origin ?? true,
      credentials: this.config.cors?.credentials ?? true,
    });

    // Request logging
    this.server.addHook("onRequest", async (request, _reply) => {
      log.dim(`📥 ${request.method} ${request.url}`);
    });

    // Response logging
    this.server.addHook("onResponse", async (request, reply) => {
      const status = reply.statusCode;
      const emoji = status < 400 ? "📤" : "❌";
      log.dim(`${emoji} ${request.method} ${request.url} → ${status}`);
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    const prefix = this.config.prefix ?? "/api/v1";

    // Health check (no prefix)
    this.server.get("/health", async () => {
      return this.handlers.handleGetHealth();
    });

    // =========================================
    // Ask Question (with SSE progress)
    // =========================================
    this.server.post(
      `${prefix}/ask`,
      async (request: FastifyRequest, reply: FastifyReply) => {
        const body = request.body as Record<string, unknown>;

        // Check if client wants SSE
        const acceptSSE = request.headers.accept?.includes("text/event-stream");

        if (acceptSSE) {
          return this.handleWithSSE(reply, async (sendProgress) => {
            return this.handlers.handleAskQuestion(body, sendProgress);
          });
        }

        // Regular JSON response
        const result = await this.handlers.handleAskQuestion(body);
        return this.sendResult(reply, result);
      }
    );

    // =========================================
    // Session Management
    // =========================================
    this.server.get(`${prefix}/sessions`, async (_request, reply) => {
      const result = await this.handlers.handleListSessions();
      return this.sendResult(reply, result);
    });

    this.server.delete(
      `${prefix}/sessions/:sessionId`,
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { sessionId } = request.params as { sessionId: string };
        const result = await this.handlers.handleCloseSession({
          session_id: sessionId,
        });
        return this.sendResult(reply, result);
      }
    );

    this.server.post(
      `${prefix}/sessions/:sessionId/reset`,
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { sessionId } = request.params as { sessionId: string };
        const result = await this.handlers.handleResetSession({
          session_id: sessionId,
        });
        return this.sendResult(reply, result);
      }
    );

    // =========================================
    // Notebook Management
    // =========================================
    this.server.get(`${prefix}/notebooks`, async (request, reply) => {
      const query = request.query as Record<string, unknown>;
      const result = await this.handlers.handleListNotebooks(query);
      return this.sendResult(reply, result);
    });

    this.server.post(`${prefix}/notebooks`, async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const result = await this.handlers.handleAddNotebook(body);
      return this.sendResult(reply, result);
    });

    this.server.get(
      `${prefix}/notebooks/:notebookId`,
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { notebookId } = request.params as { notebookId: string };
        const result = await this.handlers.handleGetNotebook({
          notebook_id: notebookId,
        });
        return this.sendResult(reply, result);
      }
    );

    this.server.put(
      `${prefix}/notebooks/:notebookId`,
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { notebookId } = request.params as { notebookId: string };
        const body = request.body as Record<string, unknown>;
        const result = await this.handlers.handleUpdateNotebook({
          notebook_id: notebookId,
          ...body,
        });
        return this.sendResult(reply, result);
      }
    );

    this.server.delete(
      `${prefix}/notebooks/:notebookId`,
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { notebookId } = request.params as { notebookId: string };
        const result = await this.handlers.handleRemoveNotebook({
          notebook_id: notebookId,
          confirm: true,
        });
        return this.sendResult(reply, result);
      }
    );

    this.server.post(
      `${prefix}/notebooks/:notebookId/select`,
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { notebookId } = request.params as { notebookId: string };
        const result = await this.handlers.handleSelectNotebook({
          notebook_id: notebookId,
        });
        return this.sendResult(reply, result);
      }
    );

    this.server.get(`${prefix}/notebooks/search`, async (request, reply) => {
      const query = request.query as Record<string, unknown>;
      const result = await this.handlers.handleSearchNotebooks(query);
      return this.sendResult(reply, result);
    });

    this.server.get(`${prefix}/library/stats`, async (_request, reply) => {
      const result = await this.handlers.handleGetLibraryStats();
      return this.sendResult(reply, result);
    });

    // =========================================
    // Authentication
    // =========================================
    this.server.post(`${prefix}/auth/setup`, async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const acceptSSE = request.headers.accept?.includes("text/event-stream");

      if (acceptSSE) {
        return this.handleWithSSE(reply, async (sendProgress) => {
          return this.handlers.handleSetupAuth(body, sendProgress);
        });
      }

      const result = await this.handlers.handleSetupAuth(body);
      return this.sendResult(reply, result);
    });

    this.server.post(`${prefix}/auth/reauth`, async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const acceptSSE = request.headers.accept?.includes("text/event-stream");

      if (acceptSSE) {
        return this.handleWithSSE(reply, async (sendProgress) => {
          return this.handlers.handleReAuth(body, sendProgress);
        });
      }

      const result = await this.handlers.handleReAuth(body);
      return this.sendResult(reply, result);
    });

    // =========================================
    // System
    // =========================================
    this.server.post(`${prefix}/cleanup`, async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const result = await this.handlers.handleCleanupData(body);
      return this.sendResult(reply, result);
    });
  }

  /**
   * Handle request with Server-Sent Events for progress
   */
  private async handleWithSSE(
    reply: FastifyReply,
    handler: (sendProgress: ProgressCallback) => Promise<ToolResult>
  ): Promise<void> {
    // Set SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Send progress events
    const sendProgress: ProgressCallback = async (message, progress, total) => {
      const event: ProgressEvent = {
        message,
        progress,
        total,
        timestamp: Date.now(),
      };
      reply.raw.write(`event: progress\n`);
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      // Execute handler
      const result = await handler(sendProgress);

      // Send final result
      reply.raw.write(`event: result\n`);
      reply.raw.write(`data: ${JSON.stringify(result)}\n\n`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      reply.raw.write(`event: error\n`);
      reply.raw.write(
        `data: ${JSON.stringify({ success: false, error: errorMessage })}\n\n`
      );
    } finally {
      reply.raw.end();
    }
  }

  /**
   * Send result with appropriate status code
   */
  private sendResult(reply: FastifyReply, result: ToolResult): FastifyReply {
    if (result.success) {
      return reply.status(200).send(result);
    } else {
      return reply.status(400).send(result);
    }
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      log.warning("⚠️ HTTP adapter already running");
      return;
    }

    try {
      // Setup middleware (must be done before listen)
      await this.setupMiddleware();

      const address = await this.server.listen({
        port: this.config.port,
        host: this.config.host ?? "0.0.0.0",
      });

      this.isRunning = true;

      log.success(`🌐 HTTP API server started`);
      log.info(`  Address: ${address}`);
      log.info(`  API Prefix: ${this.config.prefix ?? "/api/v1"}`);
      log.info(`  CORS: ${this.config.cors?.origin ?? "enabled (all origins)"}`);

      // Emit event
      await this.eventBus?.publish("transport:started", {
        type: "http",
        address,
        port: this.config.port,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error(`❌ Failed to start HTTP server: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.server.close();
      this.isRunning = false;

      log.success("🛑 HTTP API server stopped");

      // Emit event
      await this.eventBus?.publish("transport:stopped", {
        type: "http",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error(`❌ Error stopping HTTP server: ${errorMessage}`);
    }
  }

  /**
   * Check if server is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Get server address
   */
  get address(): string | null {
    if (!this.isRunning) return null;
    const addresses = this.server.addresses();
    if (addresses.length === 0) return null;
    const addr = addresses[0];
    return `http://${addr.address}:${addr.port}`;
  }
}

/**
 * Create HTTP transport adapter
 */
export function createHttpAdapter(
  handlers: IToolHandlers,
  config: HttpAdapterConfig,
  eventBus?: EventBus
): HttpTransportAdapter {
  return new HttpTransportAdapter(handlers, config, eventBus);
}

/**
 * Default configuration
 */
export const DEFAULT_HTTP_CONFIG: HttpAdapterConfig = {
  port: 3000,
  host: "0.0.0.0",
  prefix: "/api/v1",
  cors: {
    origin: true,
    credentials: true,
  },
};
