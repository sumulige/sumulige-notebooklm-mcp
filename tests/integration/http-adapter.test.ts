/**
 * HTTP Transport Adapter Integration Tests
 *
 * Tests the HTTP API endpoints with mock tool handlers.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  HttpTransportAdapter,
  createHttpAdapter,
  type IToolHandlers,
  type HttpAdapterConfig,
} from "../../src/adapters/transport/http-adapter.js";

// ============================================================================
// Mock Tool Handlers
// ============================================================================

function createMockHandlers(): IToolHandlers {
  return {
    handleAskQuestion: vi.fn().mockResolvedValue({
      success: true,
      answer: "Mock answer",
      session_id: "test-session",
    }),
    handleListSessions: vi.fn().mockResolvedValue({
      success: true,
      sessions: [],
    }),
    handleCloseSession: vi.fn().mockResolvedValue({
      success: true,
      message: "Session closed",
    }),
    handleResetSession: vi.fn().mockResolvedValue({
      success: true,
      message: "Session reset",
    }),
    handleAddNotebook: vi.fn().mockResolvedValue({
      success: true,
      notebook_id: "test-notebook",
    }),
    handleListNotebooks: vi.fn().mockResolvedValue({
      success: true,
      notebooks: [],
    }),
    handleGetNotebook: vi.fn().mockResolvedValue({
      success: true,
      notebook: { id: "test", name: "Test" },
    }),
    handleSelectNotebook: vi.fn().mockResolvedValue({
      success: true,
      message: "Notebook selected",
    }),
    handleUpdateNotebook: vi.fn().mockResolvedValue({
      success: true,
      message: "Notebook updated",
    }),
    handleRemoveNotebook: vi.fn().mockResolvedValue({
      success: true,
      message: "Notebook removed",
    }),
    handleSearchNotebooks: vi.fn().mockResolvedValue({
      success: true,
      results: [],
    }),
    handleGetLibraryStats: vi.fn().mockResolvedValue({
      success: true,
      stats: { total: 0 },
    }),
    handleSetupAuth: vi.fn().mockResolvedValue({
      success: true,
      message: "Auth setup complete",
    }),
    handleReAuth: vi.fn().mockResolvedValue({
      success: true,
      message: "Re-auth complete",
    }),
    handleGetHealth: vi.fn().mockResolvedValue({
      success: true,
      status: "healthy",
    }),
    handleCleanupData: vi.fn().mockResolvedValue({
      success: true,
      message: "Cleanup complete",
    }),
    cleanup: vi.fn().mockResolvedValue(undefined),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("HttpTransportAdapter", () => {
  let adapter: HttpTransportAdapter;
  let handlers: IToolHandlers;
  const config: HttpAdapterConfig = {
    port: 3999, // Use high port to avoid conflicts
    host: "127.0.0.1",
    prefix: "/api/v1",
  };

  beforeAll(async () => {
    handlers = createMockHandlers();
    adapter = createHttpAdapter(handlers, config);
    await adapter.start();
  }, 15000); // 15s timeout for server startup

  afterAll(async () => {
    await adapter.stop();
  });

  describe("Server Lifecycle", () => {
    it("should start and have correct address", () => {
      expect(adapter.running).toBe(true);
      expect(adapter.address).toBe("http://127.0.0.1:3999");
    });
  });

  describe("Health Endpoint", () => {
    it("GET /health should return health status", async () => {
      const response = await fetch("http://127.0.0.1:3999/health");
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.status).toBe("healthy");
    });
  });

  describe("Session Endpoints", () => {
    it("GET /api/v1/sessions should list sessions", async () => {
      const response = await fetch("http://127.0.0.1:3999/api/v1/sessions");
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(handlers.handleListSessions).toHaveBeenCalled();
    });

    it("DELETE /api/v1/sessions/:id should close session", async () => {
      const response = await fetch(
        "http://127.0.0.1:3999/api/v1/sessions/test-session",
        { method: "DELETE" }
      );
      expect(response.ok).toBe(true);

      expect(handlers.handleCloseSession).toHaveBeenCalledWith({
        session_id: "test-session",
      });
    });

    it("POST /api/v1/sessions/:id/reset should reset session", async () => {
      const response = await fetch(
        "http://127.0.0.1:3999/api/v1/sessions/test-session/reset",
        { method: "POST" }
      );
      expect(response.ok).toBe(true);

      expect(handlers.handleResetSession).toHaveBeenCalledWith({
        session_id: "test-session",
      });
    });
  });

  describe("Ask Question Endpoint", () => {
    it("POST /api/v1/ask should ask question", async () => {
      const response = await fetch("http://127.0.0.1:3999/api/v1/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "What is AI?" }),
      });
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.answer).toBe("Mock answer");
      expect(handlers.handleAskQuestion).toHaveBeenCalled();
    });
  });

  describe("Notebook Endpoints", () => {
    it("GET /api/v1/notebooks should list notebooks", async () => {
      const response = await fetch("http://127.0.0.1:3999/api/v1/notebooks");
      expect(response.ok).toBe(true);

      expect(handlers.handleListNotebooks).toHaveBeenCalled();
    });

    it("POST /api/v1/notebooks should add notebook", async () => {
      const response = await fetch("http://127.0.0.1:3999/api/v1/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Notebook",
          url: "https://notebooklm.google.com/notebook/test",
        }),
      });
      expect(response.ok).toBe(true);

      expect(handlers.handleAddNotebook).toHaveBeenCalled();
    });

    it("GET /api/v1/notebooks/:id should get notebook", async () => {
      const response = await fetch(
        "http://127.0.0.1:3999/api/v1/notebooks/test-id"
      );
      expect(response.ok).toBe(true);

      expect(handlers.handleGetNotebook).toHaveBeenCalledWith({
        notebook_id: "test-id",
      });
    });

    it("PUT /api/v1/notebooks/:id should update notebook", async () => {
      const response = await fetch(
        "http://127.0.0.1:3999/api/v1/notebooks/test-id",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Updated Name" }),
        }
      );
      expect(response.ok).toBe(true);

      expect(handlers.handleUpdateNotebook).toHaveBeenCalledWith({
        notebook_id: "test-id",
        name: "Updated Name",
      });
    });

    it("DELETE /api/v1/notebooks/:id should remove notebook", async () => {
      const response = await fetch(
        "http://127.0.0.1:3999/api/v1/notebooks/test-id",
        { method: "DELETE" }
      );
      expect(response.ok).toBe(true);

      expect(handlers.handleRemoveNotebook).toHaveBeenCalledWith({
        notebook_id: "test-id",
        confirm: true,
      });
    });

    it("POST /api/v1/notebooks/:id/select should select notebook", async () => {
      const response = await fetch(
        "http://127.0.0.1:3999/api/v1/notebooks/test-id/select",
        { method: "POST" }
      );
      expect(response.ok).toBe(true);

      expect(handlers.handleSelectNotebook).toHaveBeenCalledWith({
        notebook_id: "test-id",
      });
    });

    it("GET /api/v1/library/stats should get stats", async () => {
      const response = await fetch(
        "http://127.0.0.1:3999/api/v1/library/stats"
      );
      expect(response.ok).toBe(true);

      expect(handlers.handleGetLibraryStats).toHaveBeenCalled();
    });
  });

  describe("Auth Endpoints", () => {
    it("POST /api/v1/auth/setup should setup auth", async () => {
      const response = await fetch("http://127.0.0.1:3999/api/v1/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(response.ok).toBe(true);

      expect(handlers.handleSetupAuth).toHaveBeenCalled();
    });

    it("POST /api/v1/auth/reauth should re-auth", async () => {
      const response = await fetch("http://127.0.0.1:3999/api/v1/auth/reauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(response.ok).toBe(true);

      expect(handlers.handleReAuth).toHaveBeenCalled();
    });
  });

  describe("System Endpoints", () => {
    it("POST /api/v1/cleanup should cleanup data", async () => {
      const response = await fetch("http://127.0.0.1:3999/api/v1/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(response.ok).toBe(true);

      expect(handlers.handleCleanupData).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should return 400 for failed operations", async () => {
      // Override mock to return failure
      (handlers.handleGetNotebook as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: false,
        error: "Notebook not found",
      });

      const response = await fetch(
        "http://127.0.0.1:3999/api/v1/notebooks/nonexistent"
      );
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe("Notebook not found");
    });
  });
});

describe("HttpTransportAdapter Configuration", () => {
  it("should use custom prefix", async () => {
    const handlers = createMockHandlers();
    const adapter = createHttpAdapter(handlers, {
      port: 3998,
      host: "127.0.0.1",
      prefix: "/custom/api",
    });

    try {
      await adapter.start();

      const response = await fetch("http://127.0.0.1:3998/custom/api/sessions");
      expect(response.ok).toBe(true);
    } finally {
      await adapter.stop();
    }
  }, 10000); // 10s timeout

  it("should support CORS", async () => {
    const handlers = createMockHandlers();
    const adapter = createHttpAdapter(handlers, {
      port: 3997,
      host: "127.0.0.1",
      cors: {
        origin: "http://localhost:5173",
        credentials: true,
      },
    });

    try {
      await adapter.start();

      const response = await fetch("http://127.0.0.1:3997/health", {
        headers: {
          Origin: "http://localhost:5173",
        },
      });

      expect(response.ok).toBe(true);
    } finally {
      await adapter.stop();
    }
  }, 10000); // 10s timeout
});
