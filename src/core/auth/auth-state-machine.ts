/**
 * Authentication State Machine
 *
 * Solves the problem of multi-source auth state (state.json, session.json, Chrome Profile)
 * being out of sync and race conditions during authentication.
 *
 * Key Features:
 * - Single source of truth for auth state
 * - Well-defined state transitions
 * - Event emission for observers
 * - Prevents invalid state transitions
 * - Thread-safe (async-lock protected)
 */

import { EventEmitter } from "eventemitter3";
import AsyncLock from "async-lock";

/**
 * Authentication States
 */
export type AuthState =
  | "unauthenticated"    // No valid credentials
  | "authenticating"     // Login in progress
  | "authenticated"      // Successfully logged in
  | "expired"            // Credentials expired (needs re-auth)
  | "error";             // Auth error state

/**
 * Authentication Events
 */
export type AuthEvent =
  | "START_AUTH"         // Begin authentication process
  | "AUTH_SUCCESS"       // Authentication succeeded
  | "AUTH_FAILED"        // Authentication failed
  | "COOKIES_EXPIRED"    // Session cookies expired
  | "STATE_LOADED"       // Saved state loaded successfully
  | "STATE_CLEARED"      // Auth state was cleared
  | "LOGOUT";            // User logged out

/**
 * Event payloads for each event type
 */
export interface AuthEventPayloads {
  START_AUTH: { method: "interactive" | "auto" | "saved_state" };
  AUTH_SUCCESS: { method: string; timestamp: number };
  AUTH_FAILED: { reason: string; method: string };
  COOKIES_EXPIRED: { expiredAt: number };
  STATE_LOADED: { source: "state.json" | "chrome_profile" };
  STATE_CLEARED: { reason: string };
  LOGOUT: { reason: string };
}

/**
 * State transition definitions
 * Maps current state + event to next state
 */
const STATE_TRANSITIONS: Record<AuthState, Partial<Record<AuthEvent, AuthState>>> = {
  unauthenticated: {
    START_AUTH: "authenticating",
    STATE_LOADED: "authenticated",
  },
  authenticating: {
    AUTH_SUCCESS: "authenticated",
    AUTH_FAILED: "error",
  },
  authenticated: {
    COOKIES_EXPIRED: "expired",
    LOGOUT: "unauthenticated",
    STATE_CLEARED: "unauthenticated",
  },
  expired: {
    START_AUTH: "authenticating",
    STATE_CLEARED: "unauthenticated",
  },
  error: {
    START_AUTH: "authenticating",
    STATE_CLEARED: "unauthenticated",
  },
};

/**
 * State machine event types for external listeners
 */
export interface AuthStateMachineEvents {
  stateChanged: (newState: AuthState, oldState: AuthState, event: AuthEvent) => void;
  authStarted: (method: string) => void;
  authSucceeded: (method: string) => void;
  authFailed: (reason: string) => void;
  expired: () => void;
  cleared: () => void;
}

/**
 * Authentication State Machine
 *
 * Manages auth state with well-defined transitions and event emission.
 */
export class AuthStateMachine extends EventEmitter<AuthStateMachineEvents> {
  private _state: AuthState = "unauthenticated";
  private _lastEvent: AuthEvent | null = null;
  private _stateHistory: Array<{ state: AuthState; event: AuthEvent; timestamp: number }> = [];
  private readonly lock = new AsyncLock();

  constructor(initialState: AuthState = "unauthenticated") {
    super();
    this._state = initialState;
  }

  /**
   * Get current authentication state
   */
  get state(): AuthState {
    return this._state;
  }

  /**
   * Check if currently authenticated
   */
  get isAuthenticated(): boolean {
    return this._state === "authenticated";
  }

  /**
   * Check if authentication is in progress
   */
  get isAuthenticating(): boolean {
    return this._state === "authenticating";
  }

  /**
   * Check if state needs re-authentication
   */
  get needsReauth(): boolean {
    return this._state === "unauthenticated" || this._state === "expired" || this._state === "error";
  }

  /**
   * Get the last event that caused a state change
   */
  get lastEvent(): AuthEvent | null {
    return this._lastEvent;
  }

  /**
   * Get state history (last 10 transitions)
   */
  get history(): ReadonlyArray<{ state: AuthState; event: AuthEvent; timestamp: number }> {
    return this._stateHistory;
  }

  /**
   * Check if a transition is valid from current state
   */
  canTransition(event: AuthEvent): boolean {
    const transitions = STATE_TRANSITIONS[this._state];
    return transitions !== undefined && event in transitions;
  }

  /**
   * Get the next state for an event (without transitioning)
   */
  getNextState(event: AuthEvent): AuthState | null {
    const transitions = STATE_TRANSITIONS[this._state];
    if (!transitions) return null;
    return transitions[event] ?? null;
  }

  /**
   * Dispatch an event to trigger a state transition
   * Uses async-lock to prevent concurrent transitions
   */
  async dispatch<E extends AuthEvent>(
    event: E,
    payload?: E extends keyof AuthEventPayloads ? AuthEventPayloads[E] : never
  ): Promise<boolean> {
    return this.lock.acquire("state", async () => {
      const nextState = this.getNextState(event);

      if (nextState === null) {
        // Invalid transition - log but don't throw
        console.warn(
          `[AuthStateMachine] Invalid transition: ${this._state} + ${event}. Ignoring.`
        );
        return false;
      }

      const oldState = this._state;
      this._state = nextState;
      this._lastEvent = event;

      // Record in history (keep last 10)
      this._stateHistory.push({
        state: nextState,
        event,
        timestamp: Date.now(),
      });
      if (this._stateHistory.length > 10) {
        this._stateHistory.shift();
      }

      // Emit state change event
      this.emit("stateChanged", nextState, oldState, event);

      // Emit specific events
      switch (event) {
        case "START_AUTH":
          this.emit("authStarted", (payload as AuthEventPayloads["START_AUTH"])?.method ?? "unknown");
          break;
        case "AUTH_SUCCESS":
          this.emit("authSucceeded", (payload as AuthEventPayloads["AUTH_SUCCESS"])?.method ?? "unknown");
          break;
        case "AUTH_FAILED":
          this.emit("authFailed", (payload as AuthEventPayloads["AUTH_FAILED"])?.reason ?? "unknown");
          break;
        case "COOKIES_EXPIRED":
          this.emit("expired");
          break;
        case "STATE_CLEARED":
        case "LOGOUT":
          this.emit("cleared");
          break;
      }

      return true;
    });
  }

  /**
   * Force a state (use sparingly - for recovery scenarios)
   */
  async forceState(state: AuthState, reason: string): Promise<void> {
    return this.lock.acquire("state", async () => {
      const oldState = this._state;
      this._state = state;
      this._stateHistory.push({
        state,
        event: "STATE_CLEARED" as AuthEvent, // Synthetic event
        timestamp: Date.now(),
      });
      console.warn(`[AuthStateMachine] State forced: ${oldState} → ${state}. Reason: ${reason}`);
    });
  }

  /**
   * Reset state machine to initial state
   */
  async reset(): Promise<void> {
    return this.lock.acquire("state", async () => {
      this._state = "unauthenticated";
      this._lastEvent = null;
      this._stateHistory = [];
    });
  }

  /**
   * Create a snapshot of current state (for debugging/logging)
   */
  snapshot(): {
    state: AuthState;
    isAuthenticated: boolean;
    needsReauth: boolean;
    lastEvent: AuthEvent | null;
    historyLength: number;
  } {
    return {
      state: this._state,
      isAuthenticated: this.isAuthenticated,
      needsReauth: this.needsReauth,
      lastEvent: this._lastEvent,
      historyLength: this._stateHistory.length,
    };
  }
}

/**
 * Create a new AuthStateMachine instance
 */
export function createAuthStateMachine(initialState?: AuthState): AuthStateMachine {
  return new AuthStateMachine(initialState);
}
