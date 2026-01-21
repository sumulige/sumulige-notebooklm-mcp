/**
 * Tests for AuthStateMachine
 *
 * Tests the authentication state machine including:
 * - State transitions
 * - Event dispatching
 * - Invalid transition handling
 * - Event emission
 * - History tracking
 * - Async-lock protection
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AuthStateMachine,
  createAuthStateMachine,
  type AuthState,
  type AuthEvent,
} from "@/core/auth/auth-state-machine.js";

describe("AuthStateMachine", () => {
  let machine: AuthStateMachine;

  beforeEach(() => {
    machine = new AuthStateMachine();
  });

  describe("initial state", () => {
    it("should start in unauthenticated state", () => {
      expect(machine.state).toBe("unauthenticated");
    });

    it("should accept custom initial state", () => {
      const authenticated = new AuthStateMachine("authenticated");
      expect(authenticated.state).toBe("authenticated");
    });

    it("should have empty history initially", () => {
      expect(machine.history).toHaveLength(0);
    });

    it("should have null lastEvent initially", () => {
      expect(machine.lastEvent).toBeNull();
    });
  });

  describe("computed properties", () => {
    it("should return isAuthenticated=true only in authenticated state", () => {
      expect(machine.isAuthenticated).toBe(false);

      const authenticated = new AuthStateMachine("authenticated");
      expect(authenticated.isAuthenticated).toBe(true);
    });

    it("should return isAuthenticating=true only in authenticating state", () => {
      expect(machine.isAuthenticating).toBe(false);

      const authenticating = new AuthStateMachine("authenticating");
      expect(authenticating.isAuthenticating).toBe(true);
    });

    it("should return needsReauth correctly", () => {
      // unauthenticated needs reauth
      expect(machine.needsReauth).toBe(true);

      // expired needs reauth
      const expired = new AuthStateMachine("expired");
      expect(expired.needsReauth).toBe(true);

      // error needs reauth
      const error = new AuthStateMachine("error");
      expect(error.needsReauth).toBe(true);

      // authenticated doesn't need reauth
      const authenticated = new AuthStateMachine("authenticated");
      expect(authenticated.needsReauth).toBe(false);

      // authenticating doesn't need reauth (in progress)
      const authenticating = new AuthStateMachine("authenticating");
      expect(authenticating.needsReauth).toBe(false);
    });
  });

  describe("state transitions", () => {
    describe("from unauthenticated", () => {
      it("should transition to authenticating on START_AUTH", async () => {
        const result = await machine.dispatch("START_AUTH", { method: "interactive" });

        expect(result).toBe(true);
        expect(machine.state).toBe("authenticating");
      });

      it("should transition to authenticated on STATE_LOADED", async () => {
        const result = await machine.dispatch("STATE_LOADED", { source: "state.json" });

        expect(result).toBe(true);
        expect(machine.state).toBe("authenticated");
      });

      it("should reject invalid transitions", async () => {
        const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const result = await machine.dispatch("AUTH_SUCCESS", { method: "test", timestamp: Date.now() });

        expect(result).toBe(false);
        expect(machine.state).toBe("unauthenticated");
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });

    describe("from authenticating", () => {
      beforeEach(async () => {
        await machine.dispatch("START_AUTH", { method: "interactive" });
      });

      it("should transition to authenticated on AUTH_SUCCESS", async () => {
        const result = await machine.dispatch("AUTH_SUCCESS", {
          method: "interactive",
          timestamp: Date.now(),
        });

        expect(result).toBe(true);
        expect(machine.state).toBe("authenticated");
      });

      it("should transition to error on AUTH_FAILED", async () => {
        const result = await machine.dispatch("AUTH_FAILED", {
          reason: "Invalid credentials",
          method: "interactive",
        });

        expect(result).toBe(true);
        expect(machine.state).toBe("error");
      });
    });

    describe("from authenticated", () => {
      beforeEach(async () => {
        await machine.dispatch("STATE_LOADED", { source: "state.json" });
      });

      it("should transition to expired on COOKIES_EXPIRED", async () => {
        const result = await machine.dispatch("COOKIES_EXPIRED", {
          expiredAt: Date.now(),
        });

        expect(result).toBe(true);
        expect(machine.state).toBe("expired");
      });

      it("should transition to unauthenticated on LOGOUT", async () => {
        const result = await machine.dispatch("LOGOUT", { reason: "user request" });

        expect(result).toBe(true);
        expect(machine.state).toBe("unauthenticated");
      });

      it("should transition to unauthenticated on STATE_CLEARED", async () => {
        const result = await machine.dispatch("STATE_CLEARED", { reason: "manual clear" });

        expect(result).toBe(true);
        expect(machine.state).toBe("unauthenticated");
      });
    });

    describe("from expired", () => {
      beforeEach(async () => {
        await machine.dispatch("STATE_LOADED", { source: "state.json" });
        await machine.dispatch("COOKIES_EXPIRED", { expiredAt: Date.now() });
      });

      it("should transition to authenticating on START_AUTH", async () => {
        const result = await machine.dispatch("START_AUTH", { method: "auto" });

        expect(result).toBe(true);
        expect(machine.state).toBe("authenticating");
      });

      it("should transition to unauthenticated on STATE_CLEARED", async () => {
        const result = await machine.dispatch("STATE_CLEARED", { reason: "clear" });

        expect(result).toBe(true);
        expect(machine.state).toBe("unauthenticated");
      });
    });

    describe("from error", () => {
      beforeEach(async () => {
        await machine.dispatch("START_AUTH", { method: "interactive" });
        await machine.dispatch("AUTH_FAILED", { reason: "test", method: "interactive" });
      });

      it("should transition to authenticating on START_AUTH", async () => {
        const result = await machine.dispatch("START_AUTH", { method: "interactive" });

        expect(result).toBe(true);
        expect(machine.state).toBe("authenticating");
      });

      it("should transition to unauthenticated on STATE_CLEARED", async () => {
        const result = await machine.dispatch("STATE_CLEARED", { reason: "clear" });

        expect(result).toBe(true);
        expect(machine.state).toBe("unauthenticated");
      });
    });
  });

  describe("canTransition", () => {
    it("should return true for valid transitions", () => {
      expect(machine.canTransition("START_AUTH")).toBe(true);
      expect(machine.canTransition("STATE_LOADED")).toBe(true);
    });

    it("should return false for invalid transitions", () => {
      expect(machine.canTransition("AUTH_SUCCESS")).toBe(false);
      expect(machine.canTransition("COOKIES_EXPIRED")).toBe(false);
    });
  });

  describe("getNextState", () => {
    it("should return the next state for valid transitions", () => {
      expect(machine.getNextState("START_AUTH")).toBe("authenticating");
      expect(machine.getNextState("STATE_LOADED")).toBe("authenticated");
    });

    it("should return null for invalid transitions", () => {
      expect(machine.getNextState("AUTH_SUCCESS")).toBeNull();
      expect(machine.getNextState("LOGOUT")).toBeNull();
    });
  });

  describe("event emission", () => {
    it("should emit stateChanged on transition", async () => {
      const handler = vi.fn();
      machine.on("stateChanged", handler);

      await machine.dispatch("START_AUTH", { method: "interactive" });

      expect(handler).toHaveBeenCalledWith(
        "authenticating",
        "unauthenticated",
        "START_AUTH"
      );
    });

    it("should emit authStarted on START_AUTH", async () => {
      const handler = vi.fn();
      machine.on("authStarted", handler);

      await machine.dispatch("START_AUTH", { method: "interactive" });

      expect(handler).toHaveBeenCalledWith("interactive");
    });

    it("should emit authSucceeded on AUTH_SUCCESS", async () => {
      const handler = vi.fn();
      machine.on("authSucceeded", handler);

      await machine.dispatch("START_AUTH", { method: "interactive" });
      await machine.dispatch("AUTH_SUCCESS", { method: "interactive", timestamp: Date.now() });

      expect(handler).toHaveBeenCalledWith("interactive");
    });

    it("should emit authFailed on AUTH_FAILED", async () => {
      const handler = vi.fn();
      machine.on("authFailed", handler);

      await machine.dispatch("START_AUTH", { method: "interactive" });
      await machine.dispatch("AUTH_FAILED", { reason: "Invalid", method: "interactive" });

      expect(handler).toHaveBeenCalledWith("Invalid");
    });

    it("should emit expired on COOKIES_EXPIRED", async () => {
      const handler = vi.fn();
      machine.on("expired", handler);

      await machine.dispatch("STATE_LOADED", { source: "state.json" });
      await machine.dispatch("COOKIES_EXPIRED", { expiredAt: Date.now() });

      expect(handler).toHaveBeenCalled();
    });

    it("should emit cleared on STATE_CLEARED", async () => {
      const handler = vi.fn();
      machine.on("cleared", handler);

      await machine.dispatch("STATE_LOADED", { source: "state.json" });
      await machine.dispatch("STATE_CLEARED", { reason: "test" });

      expect(handler).toHaveBeenCalled();
    });

    it("should emit cleared on LOGOUT", async () => {
      const handler = vi.fn();
      machine.on("cleared", handler);

      await machine.dispatch("STATE_LOADED", { source: "state.json" });
      await machine.dispatch("LOGOUT", { reason: "user request" });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe("history", () => {
    it("should record transitions in history", async () => {
      await machine.dispatch("START_AUTH", { method: "interactive" });
      await machine.dispatch("AUTH_SUCCESS", { method: "interactive", timestamp: Date.now() });

      expect(machine.history).toHaveLength(2);
      expect(machine.history[0].state).toBe("authenticating");
      expect(machine.history[0].event).toBe("START_AUTH");
      expect(machine.history[1].state).toBe("authenticated");
      expect(machine.history[1].event).toBe("AUTH_SUCCESS");
    });

    it("should limit history to 10 entries", async () => {
      // Create machine and do 12 transitions
      for (let i = 0; i < 12; i++) {
        if (machine.state === "unauthenticated") {
          await machine.dispatch("START_AUTH", { method: "interactive" });
        } else if (machine.state === "authenticating") {
          await machine.dispatch("AUTH_SUCCESS", { method: "interactive", timestamp: Date.now() });
        } else if (machine.state === "authenticated") {
          await machine.dispatch("LOGOUT", { reason: "test" });
        }
      }

      expect(machine.history.length).toBeLessThanOrEqual(10);
    });

    it("should include timestamp in history entries", async () => {
      const before = Date.now();
      await machine.dispatch("START_AUTH", { method: "interactive" });
      const after = Date.now();

      expect(machine.history[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(machine.history[0].timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("lastEvent", () => {
    it("should track the last event", async () => {
      await machine.dispatch("START_AUTH", { method: "interactive" });
      expect(machine.lastEvent).toBe("START_AUTH");

      await machine.dispatch("AUTH_SUCCESS", { method: "interactive", timestamp: Date.now() });
      expect(machine.lastEvent).toBe("AUTH_SUCCESS");
    });
  });

  describe("forceState", () => {
    it("should force state regardless of transitions", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await machine.forceState("authenticated", "recovery");

      expect(machine.state).toBe("authenticated");
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should record in history", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});

      await machine.forceState("error", "test");

      expect(machine.history).toHaveLength(1);
      expect(machine.history[0].state).toBe("error");
    });
  });

  describe("reset", () => {
    it("should reset to unauthenticated", async () => {
      await machine.dispatch("START_AUTH", { method: "interactive" });
      await machine.dispatch("AUTH_SUCCESS", { method: "interactive", timestamp: Date.now() });

      await machine.reset();

      expect(machine.state).toBe("unauthenticated");
    });

    it("should clear history", async () => {
      await machine.dispatch("START_AUTH", { method: "interactive" });
      await machine.reset();

      expect(machine.history).toHaveLength(0);
    });

    it("should clear lastEvent", async () => {
      await machine.dispatch("START_AUTH", { method: "interactive" });
      await machine.reset();

      expect(machine.lastEvent).toBeNull();
    });
  });

  describe("snapshot", () => {
    it("should return current state info", async () => {
      await machine.dispatch("START_AUTH", { method: "interactive" });
      await machine.dispatch("AUTH_SUCCESS", { method: "interactive", timestamp: Date.now() });

      const snapshot = machine.snapshot();

      expect(snapshot.state).toBe("authenticated");
      expect(snapshot.isAuthenticated).toBe(true);
      expect(snapshot.needsReauth).toBe(false);
      expect(snapshot.lastEvent).toBe("AUTH_SUCCESS");
      expect(snapshot.historyLength).toBe(2);
    });
  });

  describe("concurrent transitions", () => {
    it("should handle concurrent dispatch calls safely", async () => {
      // Dispatch multiple events concurrently
      const promises = [
        machine.dispatch("START_AUTH", { method: "interactive" }),
        machine.dispatch("START_AUTH", { method: "auto" }),
        machine.dispatch("START_AUTH", { method: "saved_state" }),
      ];

      vi.spyOn(console, "warn").mockImplementation(() => {});
      const results = await Promise.all(promises);

      // Only one should succeed (the first one)
      const successCount = results.filter(Boolean).length;
      expect(successCount).toBe(1);

      // Should be in authenticating state
      expect(machine.state).toBe("authenticating");
    });
  });
});

describe("createAuthStateMachine", () => {
  it("should create a new instance", () => {
    const machine = createAuthStateMachine();
    expect(machine).toBeInstanceOf(AuthStateMachine);
    expect(machine.state).toBe("unauthenticated");
  });

  it("should accept initial state", () => {
    const machine = createAuthStateMachine("authenticated");
    expect(machine.state).toBe("authenticated");
  });
});
