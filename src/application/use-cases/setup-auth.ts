/**
 * Setup Auth Use Case
 *
 * Orchestrates the authentication setup process.
 * Uses dependency injection for all external dependencies.
 *
 * Key Features:
 * - Clean separation from infrastructure
 * - Progress reporting support
 * - State machine integration
 * - Domain event emission
 */

import { injectable } from "tsyringe";
import type { IAuthPort, AuthProgressCallback } from "../../core/ports/auth-port.js";
import type { EventBus } from "../../core/events/event-bus.js";
import type { AuthState } from "../../core/auth/auth-state-machine.js";

/**
 * Setup auth input
 */
export interface SetupAuthInput {
  readonly showBrowser?: boolean;
  readonly forceReauth?: boolean;
}

/**
 * Setup auth output
 */
export interface SetupAuthOutput {
  readonly success: boolean;
  readonly authenticated: boolean;
  readonly message: string;
  readonly state: AuthState;
  readonly durationMs: number;
}

/**
 * Dependencies interface
 */
export interface SetupAuthDeps {
  authPort: IAuthPort;
  eventBus?: EventBus;
}

/**
 * Setup Auth Use Case
 *
 * Handles the business logic of setting up authentication.
 */
@injectable()
export class SetupAuthUseCase {
  private authPort?: IAuthPort;
  private eventBus?: EventBus;

  /**
   * Configure dependencies (for manual DI)
   */
  configure(deps: SetupAuthDeps): void {
    this.authPort = deps.authPort;
    this.eventBus = deps.eventBus;
  }

  /**
   * Execute the use case
   */
  async execute(
    input: SetupAuthInput,
    progress?: AuthProgressCallback
  ): Promise<SetupAuthOutput> {
    const startTime = Date.now();

    if (!this.authPort) {
      return {
        success: false,
        authenticated: false,
        message: "Use case not configured. Call configure() first.",
        state: "error",
        durationMs: Date.now() - startTime,
      };
    }

    try {
      await progress?.("Checking authentication status...", 0, 100);

      // Check if already authenticated
      if (!input.forceReauth && this.authPort.isAuthenticated()) {
        const stateInfo = await this.authPort.getSavedStateInfo();

        if (!stateInfo.isExpired) {
          await progress?.("Already authenticated", 100, 100);

          return {
            success: true,
            authenticated: true,
            message: "Already authenticated with valid session",
            state: this.authPort.getState(),
            durationMs: Date.now() - startTime,
          };
        }
      }

      // Check for saved state
      await progress?.("Checking for saved credentials...", 10, 100);
      const savedState = await this.authPort.getSavedStateInfo();

      if (!input.forceReauth && savedState.exists && !savedState.isExpired) {
        await progress?.("Using saved credentials...", 20, 100);

        // Saved state exists and is valid
        return {
          success: true,
          authenticated: true,
          message: "Loaded saved authentication state",
          state: this.authPort.getState(),
          durationMs: Date.now() - startTime,
        };
      }

      // Need to authenticate
      await progress?.("Starting authentication...", 30, 100);

      const headless = input.showBrowser === true ? false : undefined;
      const result = await this.authPort.setupAuth(headless, progress);

      if (result.success) {
        this.eventBus?.publish("auth:succeeded", {
          method: result.method,
          durationMs: Date.now() - startTime,
        });

        return {
          success: true,
          authenticated: true,
          message: result.message,
          state: this.authPort.getState(),
          durationMs: Date.now() - startTime,
        };
      } else {
        this.eventBus?.publish("auth:failed", {
          reason: result.message,
        });

        return {
          success: false,
          authenticated: false,
          message: result.message,
          state: this.authPort.getState(),
          durationMs: Date.now() - startTime,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.eventBus?.publish("auth:failed", {
        reason: errorMessage,
      });

      return {
        success: false,
        authenticated: false,
        message: errorMessage,
        state: this.authPort?.getState() ?? "error",
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Clear authentication data
   */
  async clearAuth(progress?: AuthProgressCallback): Promise<SetupAuthOutput> {
    const startTime = Date.now();

    if (!this.authPort) {
      return {
        success: false,
        authenticated: false,
        message: "Use case not configured",
        state: "error",
        durationMs: Date.now() - startTime,
      };
    }

    try {
      await progress?.("Clearing authentication data...", 0, 100);

      await this.authPort.clearAuth();

      this.eventBus?.publish("auth:cleared", {
        reason: "manual clear",
      });

      await progress?.("Authentication cleared", 100, 100);

      return {
        success: true,
        authenticated: false,
        message: "Authentication data cleared",
        state: this.authPort.getState(),
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        authenticated: this.authPort.isAuthenticated(),
        message: errorMessage,
        state: this.authPort.getState(),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get current auth status
   */
  async getStatus(): Promise<{
    authenticated: boolean;
    state: AuthState;
    savedState: {
      exists: boolean;
      isExpired: boolean;
      ageHours?: number;
    };
  }> {
    if (!this.authPort) {
      return {
        authenticated: false,
        state: "error",
        savedState: { exists: false, isExpired: true },
      };
    }

    const savedState = await this.authPort.getSavedStateInfo();

    return {
      authenticated: this.authPort.isAuthenticated(),
      state: this.authPort.getState(),
      savedState: {
        exists: savedState.exists,
        isExpired: savedState.isExpired,
        ageHours: savedState.ageHours,
      },
    };
  }
}

/**
 * Create a configured SetupAuthUseCase
 */
export function createSetupAuthUseCase(deps: SetupAuthDeps): SetupAuthUseCase {
  const useCase = new SetupAuthUseCase();
  useCase.configure(deps);
  return useCase;
}
