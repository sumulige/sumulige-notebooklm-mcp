/**
 * Tests for EventBus
 *
 * Tests the domain event bus including:
 * - Event publishing and subscribing
 * - Category subscriptions
 * - Wildcard subscriptions
 * - Event history
 * - Correlation IDs
 * - waitFor functionality
 */

import "reflect-metadata";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  EventBus,
  createEventBus,
  type EventType,
  type EventPayload,
} from "@/core/events/event-bus.js";

describe("EventBus", () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  afterEach(() => {
    bus.removeAllListeners();
  });

  describe("publish and subscribe", () => {
    it("should deliver events to subscribers", async () => {
      const handler = vi.fn();
      bus.subscribe("auth:started", handler);

      await bus.publish("auth:started", { method: "interactive" });

      expect(handler).toHaveBeenCalledWith(
        { method: "interactive" },
        expect.objectContaining({
          eventType: "auth:started",
          timestamp: expect.any(Number),
        })
      );
    });

    it("should deliver to multiple subscribers", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.subscribe("session:created", handler1);
      bus.subscribe("session:created", handler2);

      await bus.publish("session:created", {
        sessionId: "session-1",
        notebookUrl: "https://test.com",
      });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it("should not call unsubscribed handlers", async () => {
      const handler = vi.fn();
      const unsubscribe = bus.subscribe("auth:started", handler);

      unsubscribe();
      await bus.publish("auth:started", { method: "interactive" });

      expect(handler).not.toHaveBeenCalled();
    });

    it("should include metadata with events", async () => {
      const handler = vi.fn();
      bus.subscribe("browser:initialized", handler);

      await bus.publish("browser:initialized", { headless: true });

      expect(handler).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          eventType: "browser:initialized",
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe("category subscriptions", () => {
    it("should receive all events in a category", async () => {
      const handler = vi.fn();
      bus.subscribeToCategory("auth", handler);

      await bus.publish("auth:started", { method: "interactive" });
      await bus.publish("auth:succeeded", { method: "interactive", durationMs: 1000 });
      await bus.publish("auth:failed", { reason: "test" });

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it("should not receive events from other categories", async () => {
      const authHandler = vi.fn();
      bus.subscribeToCategory("auth", authHandler);

      await bus.publish("session:created", { sessionId: "test", notebookUrl: "test" });

      expect(authHandler).not.toHaveBeenCalled();
    });

    it("should unsubscribe from category", async () => {
      const handler = vi.fn();
      const unsubscribe = bus.subscribeToCategory("session", handler);

      unsubscribe();
      await bus.publish("session:created", { sessionId: "test", notebookUrl: "test" });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("wildcard subscriptions", () => {
    it("should receive all events", async () => {
      const handler = vi.fn();
      bus.subscribeToAll(handler);

      await bus.publish("auth:started", { method: "interactive" });
      await bus.publish("session:created", { sessionId: "test", notebookUrl: "test" });
      await bus.publish("browser:initialized", { headless: true });

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it("should unsubscribe from all", async () => {
      const handler = vi.fn();
      const unsubscribe = bus.subscribeToAll(handler);

      unsubscribe();
      await bus.publish("auth:started", { method: "interactive" });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("once", () => {
    it("should only receive the first event", async () => {
      const handler = vi.fn();
      bus.once("auth:started", handler);

      await bus.publish("auth:started", { method: "interactive" });
      await bus.publish("auth:started", { method: "auto" });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        { method: "interactive" },
        expect.any(Object)
      );
    });

    it("should be unsubscribable before event", async () => {
      const handler = vi.fn();
      const unsubscribe = bus.once("auth:started", handler);

      unsubscribe();
      await bus.publish("auth:started", { method: "interactive" });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("waitFor", () => {
    it("should resolve when event is published", async () => {
      const promise = bus.waitFor("auth:succeeded");

      // Publish after a small delay
      setTimeout(() => {
        bus.publish("auth:succeeded", { method: "interactive", durationMs: 500 });
      }, 10);

      const result = await promise;

      expect(result.payload).toEqual({ method: "interactive", durationMs: 500 });
      expect(result.metadata.eventType).toBe("auth:succeeded");
    });

    it("should timeout if event not received", async () => {
      await expect(
        bus.waitFor("auth:succeeded", 50)
      ).rejects.toThrow("Timeout waiting for event: auth:succeeded");
    });

    it("should not timeout if event received in time", async () => {
      const promise = bus.waitFor("auth:started", 100);

      setTimeout(() => {
        bus.publish("auth:started", { method: "interactive" });
      }, 10);

      const result = await promise;
      expect(result.payload.method).toBe("interactive");
    });
  });

  describe("correlation ID", () => {
    it("should include correlation ID in metadata", async () => {
      const handler = vi.fn();
      bus.subscribe("auth:started", handler);

      bus.setCorrelationId("request-123");
      await bus.publish("auth:started", { method: "interactive" });

      expect(handler).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          correlationId: "request-123",
        })
      );
    });

    it("should not include correlation ID if not set", async () => {
      const handler = vi.fn();
      bus.subscribe("auth:started", handler);

      await bus.publish("auth:started", { method: "interactive" });

      expect(handler).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          correlationId: undefined,
        })
      );
    });

    it("should allow clearing correlation ID", async () => {
      const handler = vi.fn();
      bus.subscribe("auth:started", handler);

      bus.setCorrelationId("request-123");
      bus.setCorrelationId(undefined);
      await bus.publish("auth:started", { method: "interactive" });

      expect(handler).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          correlationId: undefined,
        })
      );
    });
  });

  describe("event history", () => {
    it("should record published events", async () => {
      await bus.publish("auth:started", { method: "interactive" });
      await bus.publish("auth:succeeded", { method: "interactive", durationMs: 500 });

      const history = bus.getHistory();

      expect(history).toHaveLength(2);
      expect(history[0].eventType).toBe("auth:started");
      expect(history[1].eventType).toBe("auth:succeeded");
    });

    it("should limit history to 100 events", async () => {
      // Publish 110 events
      for (let i = 0; i < 110; i++) {
        await bus.publish("system:warning", { message: `warning ${i}`, context: "test" });
      }

      const history = bus.getHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it("should return limited history when requested", async () => {
      await bus.publish("auth:started", { method: "a" });
      await bus.publish("auth:started", { method: "b" });
      await bus.publish("auth:started", { method: "c" });

      const last2 = bus.getHistory(2);

      expect(last2).toHaveLength(2);
      expect((last2[0].payload as { method: string }).method).toBe("b");
      expect((last2[1].payload as { method: string }).method).toBe("c");
    });

    it("should filter history by type", async () => {
      await bus.publish("auth:started", { method: "interactive" });
      await bus.publish("session:created", { sessionId: "s1", notebookUrl: "u1" });
      await bus.publish("auth:succeeded", { method: "interactive", durationMs: 100 });
      await bus.publish("session:created", { sessionId: "s2", notebookUrl: "u2" });

      const sessionEvents = bus.getHistoryByType("session:created");

      expect(sessionEvents).toHaveLength(2);
      expect(sessionEvents[0].payload.sessionId).toBe("s1");
      expect(sessionEvents[1].payload.sessionId).toBe("s2");
    });

    it("should clear history", async () => {
      await bus.publish("auth:started", { method: "interactive" });
      await bus.publish("auth:succeeded", { method: "interactive", durationMs: 100 });

      bus.clearHistory();

      expect(bus.getHistory()).toHaveLength(0);
    });
  });

  describe("listener management", () => {
    it("should return listener count", () => {
      bus.subscribe("auth:started", () => {});
      bus.subscribe("auth:started", () => {});
      bus.subscribe("auth:succeeded", () => {});

      expect(bus.listenerCount("auth:started")).toBe(2);
      expect(bus.listenerCount("auth:succeeded")).toBe(1);
      expect(bus.listenerCount("auth:failed")).toBe(0);
    });

    it("should remove all listeners", () => {
      bus.subscribe("auth:started", () => {});
      bus.subscribe("auth:succeeded", () => {});

      bus.removeAllListeners();

      expect(bus.listenerCount("auth:started")).toBe(0);
      expect(bus.listenerCount("auth:succeeded")).toBe(0);
    });
  });

  describe("type safety", () => {
    it("should enforce correct payload types", async () => {
      const handler = vi.fn();
      bus.subscribe("session:message", handler);

      await bus.publish("session:message", {
        sessionId: "test",
        role: "user",
        preview: "Hello",
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "test",
          role: "user",
          preview: "Hello",
        }),
        expect.any(Object)
      );
    });
  });
});

describe("createEventBus", () => {
  it("should create a new EventBus instance", () => {
    const bus = createEventBus();
    expect(bus).toBeInstanceOf(EventBus);
  });
});
