/**
 * Tests for SessionEntity
 *
 * Tests the immutable session value object including:
 * - Creation and initialization
 * - State transitions
 * - Immutability guarantees
 * - Message handling
 * - Serialization
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SessionEntity,
  generateSessionId,
  type SessionConfig,
  type SessionSnapshot,
} from "@/core/domain/session-entity.js";

describe("SessionEntity", () => {
  const createConfig = (): SessionConfig => ({
    notebookUrl: "https://notebooklm.google.com/notebook/test-123",
    headless: true,
    timeout: 30000,
  });

  describe("create", () => {
    it("should create a new session with idle status", () => {
      const config = createConfig();
      const session = SessionEntity.create("session-1", config);

      expect(session.id).toBe("session-1");
      expect(session.status).toBe("idle");
      expect(session.messages).toHaveLength(0);
      expect(session.config).toEqual(config);
    });

    it("should set timestamps on creation", () => {
      const before = Date.now();
      const session = SessionEntity.create("session-1", createConfig());
      const after = Date.now();

      expect(session.createdAt).toBeGreaterThanOrEqual(before);
      expect(session.createdAt).toBeLessThanOrEqual(after);
      expect(session.lastActivityAt).toBe(session.createdAt);
    });

    it("should freeze the session object", () => {
      const session = SessionEntity.create("session-1", createConfig());
      expect(Object.isFrozen(session)).toBe(true);
    });

    it("should freeze the config object", () => {
      const session = SessionEntity.create("session-1", createConfig());
      expect(Object.isFrozen(session.config)).toBe(true);
    });

    it("should freeze the messages array", () => {
      const session = SessionEntity.create("session-1", createConfig());
      expect(Object.isFrozen(session.messages)).toBe(true);
    });
  });

  describe("fromSnapshot", () => {
    it("should restore a session from snapshot", () => {
      const snapshot: SessionSnapshot = {
        id: "session-restored",
        config: createConfig(),
        status: "processing",
        messages: [
          { role: "user", content: "Hello", timestamp: 1000 },
          { role: "assistant", content: "Hi there", timestamp: 2000 },
        ],
        createdAt: 1000,
        lastActivityAt: 2000,
        errorMessage: undefined,
      };

      const session = SessionEntity.fromSnapshot(snapshot);

      expect(session.id).toBe("session-restored");
      expect(session.status).toBe("processing");
      expect(session.messages).toHaveLength(2);
      expect(session.createdAt).toBe(1000);
      expect(session.lastActivityAt).toBe(2000);
    });

    it("should restore error message from snapshot", () => {
      const snapshot: SessionSnapshot = {
        id: "session-error",
        config: createConfig(),
        status: "error",
        messages: [],
        createdAt: 1000,
        lastActivityAt: 2000,
        errorMessage: "Connection failed",
      };

      const session = SessionEntity.fromSnapshot(snapshot);
      expect(session.errorMessage).toBe("Connection failed");
    });
  });

  describe("computed properties", () => {
    it("should calculate ageSeconds correctly", async () => {
      const session = SessionEntity.create("session-1", createConfig());

      // Wait a bit to ensure some time passes
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(session.ageSeconds).toBeGreaterThanOrEqual(0);
    });

    it("should calculate inactiveSeconds correctly", async () => {
      const session = SessionEntity.create("session-1", createConfig());

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(session.inactiveSeconds).toBeGreaterThanOrEqual(0);
    });

    it("should return correct messageCount", () => {
      const snapshot: SessionSnapshot = {
        id: "session-1",
        config: createConfig(),
        status: "idle",
        messages: [
          { role: "user", content: "Hello", timestamp: 1000 },
          { role: "assistant", content: "Hi", timestamp: 2000 },
          { role: "user", content: "Bye", timestamp: 3000 },
        ],
        createdAt: 1000,
        lastActivityAt: 3000,
      };

      const session = SessionEntity.fromSnapshot(snapshot);
      expect(session.messageCount).toBe(3);
    });

    it("should return isActive=true for idle status", () => {
      const session = SessionEntity.create("session-1", createConfig());
      expect(session.isActive).toBe(true);
    });

    it("should return isActive=true for processing status", () => {
      const session = SessionEntity.create("session-1", createConfig())
        .startProcessing("test");
      expect(session.isActive).toBe(true);
    });

    it("should return isActive=false for closed status", () => {
      const session = SessionEntity.create("session-1", createConfig()).close();
      expect(session.isActive).toBe(false);
    });

    it("should return isActive=false for error status", () => {
      const session = SessionEntity.create("session-1", createConfig())
        .markError("test error");
      expect(session.isActive).toBe(false);
    });

    it("should return canAcceptMessage=true only for idle status", () => {
      const idle = SessionEntity.create("session-1", createConfig());
      expect(idle.canAcceptMessage).toBe(true);

      const processing = idle.startProcessing("test");
      expect(processing.canAcceptMessage).toBe(false);

      const waiting = processing.startWaiting();
      expect(waiting.canAcceptMessage).toBe(false);

      const closed = idle.close();
      expect(closed.canAcceptMessage).toBe(false);

      const error = idle.markError("test");
      expect(error.canAcceptMessage).toBe(false);
    });
  });

  describe("state transitions", () => {
    describe("startProcessing", () => {
      it("should transition from idle to processing", () => {
        const session = SessionEntity.create("session-1", createConfig());
        const processing = session.startProcessing("Hello");

        expect(processing.status).toBe("processing");
        expect(processing.messages).toHaveLength(1);
        expect(processing.messages[0].role).toBe("user");
        expect(processing.messages[0].content).toBe("Hello");
      });

      it("should throw if not in idle status", () => {
        const processing = SessionEntity.create("session-1", createConfig())
          .startProcessing("test");

        expect(() => processing.startProcessing("another")).toThrow(
          "Cannot process message in status: processing"
        );
      });

      it("should update lastActivityAt", () => {
        const session = SessionEntity.create("session-1", createConfig());
        const before = session.lastActivityAt;

        // Small delay to ensure timestamp differs
        const processing = session.startProcessing("test");

        expect(processing.lastActivityAt).toBeGreaterThanOrEqual(before);
      });

      it("should return a new instance (immutability)", () => {
        const session = SessionEntity.create("session-1", createConfig());
        const processing = session.startProcessing("test");

        expect(processing).not.toBe(session);
        expect(session.status).toBe("idle");
        expect(processing.status).toBe("processing");
      });
    });

    describe("startWaiting", () => {
      it("should transition from processing to waiting", () => {
        const processing = SessionEntity.create("session-1", createConfig())
          .startProcessing("test");
        const waiting = processing.startWaiting();

        expect(waiting.status).toBe("waiting");
      });

      it("should throw if not in processing status", () => {
        const session = SessionEntity.create("session-1", createConfig());

        expect(() => session.startWaiting()).toThrow(
          "Cannot wait in status: idle"
        );
      });
    });

    describe("completeWithResponse", () => {
      it("should transition from waiting to idle with response", () => {
        const waiting = SessionEntity.create("session-1", createConfig())
          .startProcessing("Hello")
          .startWaiting();
        const completed = waiting.completeWithResponse("Hi there!");

        expect(completed.status).toBe("idle");
        expect(completed.messages).toHaveLength(2);
        expect(completed.messages[1].role).toBe("assistant");
        expect(completed.messages[1].content).toBe("Hi there!");
      });

      it("should transition from processing to idle", () => {
        const processing = SessionEntity.create("session-1", createConfig())
          .startProcessing("Hello");
        const completed = processing.completeWithResponse("Quick response");

        expect(completed.status).toBe("idle");
      });

      it("should clear error message on completion", () => {
        // Create a session with error, then reset and process
        const snapshot: SessionSnapshot = {
          id: "session-1",
          config: createConfig(),
          status: "waiting",
          messages: [{ role: "user", content: "test", timestamp: 1000 }],
          createdAt: 1000,
          lastActivityAt: 1000,
          errorMessage: "Previous error",
        };
        const session = SessionEntity.fromSnapshot(snapshot);
        const completed = session.completeWithResponse("response");

        expect(completed.errorMessage).toBeUndefined();
      });

      it("should throw if not in waiting or processing status", () => {
        const session = SessionEntity.create("session-1", createConfig());

        expect(() => session.completeWithResponse("test")).toThrow(
          "Cannot complete in status: idle"
        );
      });
    });

    describe("markError", () => {
      it("should transition to error status", () => {
        const session = SessionEntity.create("session-1", createConfig());
        const errored = session.markError("Something went wrong");

        expect(errored.status).toBe("error");
        expect(errored.errorMessage).toBe("Something went wrong");
      });

      it("should preserve messages when marking error", () => {
        const processing = SessionEntity.create("session-1", createConfig())
          .startProcessing("Hello");
        const errored = processing.markError("Failed");

        expect(errored.messages).toHaveLength(1);
      });
    });

    describe("reset", () => {
      it("should return to idle with empty messages", () => {
        const session = SessionEntity.create("session-1", createConfig())
          .startProcessing("Hello")
          .startWaiting()
          .completeWithResponse("Hi");

        const reset = session.reset();

        expect(reset.status).toBe("idle");
        expect(reset.messages).toHaveLength(0);
        expect(reset.errorMessage).toBeUndefined();
      });

      it("should reset from error state", () => {
        const errored = SessionEntity.create("session-1", createConfig())
          .markError("test error");
        const reset = errored.reset();

        expect(reset.status).toBe("idle");
        expect(reset.errorMessage).toBeUndefined();
      });
    });

    describe("close", () => {
      it("should transition to closed status", () => {
        const session = SessionEntity.create("session-1", createConfig());
        const closed = session.close();

        expect(closed.status).toBe("closed");
      });

      it("should preserve messages when closing", () => {
        const session = SessionEntity.create("session-1", createConfig())
          .startProcessing("Hello")
          .startWaiting()
          .completeWithResponse("Hi");
        const closed = session.close();

        expect(closed.messages).toHaveLength(2);
      });
    });

    describe("touch", () => {
      it("should update lastActivityAt", async () => {
        const session = SessionEntity.create("session-1", createConfig());
        const originalTime = session.lastActivityAt;

        await new Promise((resolve) => setTimeout(resolve, 10));
        const touched = session.touch();

        expect(touched.lastActivityAt).toBeGreaterThan(originalTime);
      });

      it("should not change status", () => {
        const session = SessionEntity.create("session-1", createConfig());
        const touched = session.touch();

        expect(touched.status).toBe("idle");
      });
    });
  });

  describe("message utilities", () => {
    let sessionWithMessages: SessionEntity;

    beforeEach(() => {
      const snapshot: SessionSnapshot = {
        id: "session-1",
        config: createConfig(),
        status: "idle",
        messages: [
          { role: "user", content: "First question", timestamp: 1000 },
          { role: "assistant", content: "First answer", timestamp: 2000 },
          { role: "user", content: "Second question", timestamp: 3000 },
          { role: "assistant", content: "Second answer", timestamp: 4000 },
        ],
        createdAt: 1000,
        lastActivityAt: 4000,
      };
      sessionWithMessages = SessionEntity.fromSnapshot(snapshot);
    });

    describe("getConversationHistory", () => {
      it("should format messages as conversation", () => {
        const history = sessionWithMessages.getConversationHistory();

        expect(history).toContain("user: First question");
        expect(history).toContain("assistant: First answer");
        expect(history).toContain("user: Second question");
        expect(history).toContain("assistant: Second answer");
      });

      it("should return empty string for no messages", () => {
        const session = SessionEntity.create("session-1", createConfig());
        expect(session.getConversationHistory()).toBe("");
      });
    });

    describe("getLastMessages", () => {
      it("should return last N messages", () => {
        const last2 = sessionWithMessages.getLastMessages(2);

        expect(last2).toHaveLength(2);
        expect(last2[0].content).toBe("Second question");
        expect(last2[1].content).toBe("Second answer");
      });

      it("should return all messages if count exceeds length", () => {
        const last10 = sessionWithMessages.getLastMessages(10);
        expect(last10).toHaveLength(4);
      });

      it("should return empty array if no messages", () => {
        const session = SessionEntity.create("session-1", createConfig());
        expect(session.getLastMessages(5)).toHaveLength(0);
      });
    });
  });

  describe("serialization", () => {
    describe("toSnapshot", () => {
      it("should export all properties", () => {
        const session = SessionEntity.create("session-1", createConfig())
          .startProcessing("test")
          .startWaiting()
          .completeWithResponse("response");

        const snapshot = session.toSnapshot();

        expect(snapshot.id).toBe("session-1");
        expect(snapshot.status).toBe("idle");
        expect(snapshot.messages).toHaveLength(2);
        expect(snapshot.config).toBeDefined();
        expect(snapshot.createdAt).toBeDefined();
        expect(snapshot.lastActivityAt).toBeDefined();
      });
    });

    describe("toInfo", () => {
      it("should export API-friendly info", () => {
        const session = SessionEntity.create("session-1", createConfig())
          .startProcessing("test")
          .startWaiting()
          .completeWithResponse("response");

        const info = session.toInfo();

        expect(info.id).toBe("session-1");
        expect(info.status).toBe("idle");
        expect(info.message_count).toBe(2);
        expect(info.notebook_url).toBe(createConfig().notebookUrl);
        expect(typeof info.age_seconds).toBe("number");
        expect(typeof info.inactive_seconds).toBe("number");
        expect(typeof info.created_at).toBe("number");
        expect(typeof info.last_activity).toBe("number");
      });
    });
  });
});

describe("generateSessionId", () => {
  it("should generate unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateSessionId());
    }
    expect(ids.size).toBe(100);
  });

  it("should start with 'session-' prefix", () => {
    const id = generateSessionId();
    expect(id.startsWith("session-")).toBe(true);
  });

  it("should have reasonable length", () => {
    const id = generateSessionId();
    expect(id.length).toBeGreaterThan(10);
    expect(id.length).toBeLessThan(30);
  });
});
