/**
 * Google Auth Adapter
 *
 * Implements IAuthPort using the existing auth modules.
 * Integrates with AuthStateMachine for unified state management.
 *
 * This adapter:
 * - Wraps existing auth/auth-manager.ts functionality
 * - Uses AuthStateMachine for state tracking
 * - Emits events through EventBus
 * - Provides clean interface for application layer
 */

import { injectable } from "tsyringe";
import type {
  IAuthPort,
  AuthProgressCallback,
  AuthResult,
  SavedStateInfo,
  CookieValidationResult,
} from "../../core/ports/auth-port.js";
import type { IBrowserContext, IPage } from "../../core/ports/browser-port.js";
import { AuthStateMachine, type AuthState } from "../../core/auth/auth-state-machine.js";
import type { EventBus } from "../../core/events/event-bus.js";
import { log } from "../../utils/logger.js";

/**
 * Google Auth Adapter
 *
 * Provides authentication functionality with state machine integration.
 */
@injectable()
export class GoogleAuthAdapter implements IAuthPort {
  private readonly stateMachine: AuthStateMachine;
  private eventBus?: EventBus;

  // Lazy-loaded auth modules (to avoid circular dependencies)
  private authManager?: any;
  private stateManager?: any;
  private cookieValidator?: any;

  constructor() {
    this.stateMachine = new AuthStateMachine();
  }

  /**
   * Set event bus for publishing auth events
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;

    // Forward state machine events to event bus
    this.stateMachine.on("authStarted", (method) => {
      this.eventBus?.publish("auth:started", { method });
    });

    this.stateMachine.on("authSucceeded", (method) => {
      this.eventBus?.publish("auth:succeeded", { method, durationMs: 0 });
    });

    this.stateMachine.on("authFailed", (reason) => {
      this.eventBus?.publish("auth:failed", { reason });
    });

    this.stateMachine.on("expired", () => {
      this.eventBus?.publish("auth:expired", { reason: "cookies expired" });
    });

    this.stateMachine.on("cleared", () => {
      this.eventBus?.publish("auth:cleared", { reason: "manual clear" });
    });
  }

  /**
   * Lazy load auth modules
   */
  private async loadAuthModules(): Promise<void> {
    if (!this.authManager) {
      const { AuthManager } = await import("../../auth/auth-manager.js");
      this.authManager = new AuthManager();
    }
    if (!this.stateManager) {
      const { StateManager } = await import("../../auth/state-manager.js");
      this.stateManager = new StateManager();
    }
    if (!this.cookieValidator) {
      const { CookieValidator } = await import("../../auth/cookie-validator.js");
      this.cookieValidator = new CookieValidator(this.stateManager);
    }
  }

  getState(): AuthState {
    return this.stateMachine.state;
  }

  isAuthenticated(): boolean {
    return this.stateMachine.isAuthenticated;
  }

  needsReauth(): boolean {
    return this.stateMachine.needsReauth;
  }

  async setupAuth(
    headless?: boolean,
    progress?: AuthProgressCallback
  ): Promise<AuthResult> {
    await this.loadAuthModules();

    const startTime = Date.now();
    const method = headless === false ? "interactive" : "auto";

    // Transition to authenticating state
    await this.stateMachine.dispatch("START_AUTH", { method });

    try {
      // Use existing auth manager for actual auth
      const success = await this.authManager.performSetup(
        progress,
        headless === false ? true : undefined
      );

      const durationMs = Date.now() - startTime;

      if (success) {
        await this.stateMachine.dispatch("AUTH_SUCCESS", {
          method,
          timestamp: Date.now(),
        });

        return {
          success: true,
          method,
          message: "Authentication successful",
          durationMs,
        };
      } else {
        await this.stateMachine.dispatch("AUTH_FAILED", {
          reason: "Authentication failed",
          method,
        });

        return {
          success: false,
          method,
          message: "Authentication failed",
          durationMs,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.stateMachine.dispatch("AUTH_FAILED", {
        reason: message,
        method,
      });

      return {
        success: false,
        method,
        message,
        durationMs: Date.now() - startTime,
      };
    }
  }

  async loadSavedState(context: IBrowserContext): Promise<boolean> {
    await this.loadAuthModules();

    try {
      const statePath = await this.stateManager.getValidStatePath();
      if (!statePath) {
        return false;
      }

      // Get the underlying Patchright context if available
      const underlyingContext = (context as any).getUnderlyingContext?.() ?? context;
      const success = await this.stateManager.loadAuthState(underlyingContext, statePath);

      if (success) {
        await this.stateMachine.dispatch("STATE_LOADED", { source: "state.json" });
      }

      return success;
    } catch (error) {
      log.warning(`[GoogleAuthAdapter] Failed to load saved state: ${error}`);
      return false;
    }
  }

  async saveState(context: IBrowserContext, page?: IPage): Promise<boolean> {
    await this.loadAuthModules();

    try {
      // Get the underlying Patchright objects if available
      const underlyingContext = (context as any).getUnderlyingContext?.() ?? context;
      const underlyingPage = page ? ((page as any).getUnderlyingPage?.() ?? page) : undefined;

      return await this.stateManager.saveBrowserState(underlyingContext, underlyingPage);
    } catch (error) {
      log.warning(`[GoogleAuthAdapter] Failed to save state: ${error}`);
      return false;
    }
  }

  async clearAuth(): Promise<void> {
    await this.loadAuthModules();

    try {
      await this.authManager.clearAllAuthData();
      await this.stateMachine.dispatch("STATE_CLEARED", { reason: "manual clear" });
    } catch (error) {
      log.warning(`[GoogleAuthAdapter] Failed to clear auth: ${error}`);
    }
  }

  async getSavedStateInfo(): Promise<SavedStateInfo> {
    await this.loadAuthModules();

    try {
      const statePath = this.stateManager.getStatePath();
      const exists = statePath !== null;
      const isExpired = exists ? await this.stateManager.isStateExpired() : false;

      let ageHours: number | undefined;
      if (exists && statePath) {
        const fs = await import("fs/promises");
        try {
          const stats = await fs.stat(statePath);
          ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
        } catch {
          // File may not exist
        }
      }

      return {
        exists,
        path: statePath,
        isExpired,
        ageHours,
      };
    } catch (error) {
      return {
        exists: false,
        path: null,
        isExpired: true,
      };
    }
  }

  async validateCookies(context: IBrowserContext): Promise<CookieValidationResult> {
    await this.loadAuthModules();

    try {
      // Get the underlying Patchright context if available
      const underlyingContext = (context as any).getUnderlyingContext?.() ?? context;

      const isValid = await this.cookieValidator.validateState(underlyingContext);
      const hasExpiry = await this.cookieValidator.validateCookiesExpiry(underlyingContext);

      // Check for expired cookies
      if (!hasExpiry && this.stateMachine.isAuthenticated) {
        await this.stateMachine.dispatch("COOKIES_EXPIRED", {
          expiredAt: Date.now(),
        });
      }

      return {
        valid: isValid && hasExpiry,
        hasCriticalCookies: isValid,
        expiredCookies: hasExpiry ? [] : ["session cookies"],
        missingCookies: isValid ? [] : ["critical cookies"],
      };
    } catch (error) {
      return {
        valid: false,
        hasCriticalCookies: false,
        expiredCookies: [],
        missingCookies: ["validation failed"],
      };
    }
  }

  async getValidStatePath(): Promise<string | null> {
    await this.loadAuthModules();
    return this.stateManager.getValidStatePath();
  }

  onStateChange(callback: (newState: AuthState, oldState: AuthState) => void): () => void {
    const handler = (newState: AuthState, oldState: AuthState) => {
      callback(newState, oldState);
    };

    this.stateMachine.on("stateChanged", handler);

    return () => {
      this.stateMachine.off("stateChanged", handler);
    };
  }

  getStateSnapshot(): {
    state: AuthState;
    isAuthenticated: boolean;
    needsReauth: boolean;
    lastEvent: string | null;
  } {
    return this.stateMachine.snapshot();
  }

  /**
   * Get the underlying state machine (for advanced use cases)
   */
  getStateMachine(): AuthStateMachine {
    return this.stateMachine;
  }
}

/**
 * Create a new GoogleAuthAdapter instance
 */
export function createGoogleAuthAdapter(): GoogleAuthAdapter {
  return new GoogleAuthAdapter();
}
