/**
 * Auth Port Interface
 *
 * Defines the contract for authentication operations.
 * Adapters (e.g., GoogleAuthAdapter) implement this interface.
 *
 * This allows the domain/application layer to be independent of
 * the specific authentication implementation.
 */

import type { AuthState } from "../auth/auth-state-machine.js";
import type { IBrowserContext, IPage } from "./browser-port.js";

/**
 * Progress callback for long-running operations
 */
export type AuthProgressCallback = (
  message: string,
  progress?: number,
  total?: number
) => Promise<void>;

/**
 * Authentication result
 */
export interface AuthResult {
  readonly success: boolean;
  readonly method: "interactive" | "auto" | "saved_state";
  readonly message: string;
  readonly durationMs?: number;
}

/**
 * Saved auth state info
 */
export interface SavedStateInfo {
  readonly exists: boolean;
  readonly path: string | null;
  readonly isExpired: boolean;
  readonly ageHours?: number;
}

/**
 * Cookie validation result
 */
export interface CookieValidationResult {
  readonly valid: boolean;
  readonly hasCriticalCookies: boolean;
  readonly expiredCookies: string[];
  readonly missingCookies: string[];
}

/**
 * Auth Port Interface
 *
 * Main interface for authentication operations.
 */
export interface IAuthPort {
  /**
   * Get current authentication state
   */
  getState(): AuthState;

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean;

  /**
   * Check if re-authentication is needed
   */
  needsReauth(): boolean;

  /**
   * Setup authentication (interactive or auto)
   * @param headless - Override headless setting (false = show browser)
   * @param progress - Progress callback for UI updates
   */
  setupAuth(
    headless?: boolean,
    progress?: AuthProgressCallback
  ): Promise<AuthResult>;

  /**
   * Load saved authentication state
   */
  loadSavedState(context: IBrowserContext): Promise<boolean>;

  /**
   * Save current authentication state
   */
  saveState(context: IBrowserContext, page?: IPage): Promise<boolean>;

  /**
   * Clear all authentication data
   */
  clearAuth(): Promise<void>;

  /**
   * Get info about saved state
   */
  getSavedStateInfo(): Promise<SavedStateInfo>;

  /**
   * Validate cookies in a context
   */
  validateCookies(context: IBrowserContext): Promise<CookieValidationResult>;

  /**
   * Get path to valid saved state (null if expired/missing)
   */
  getValidStatePath(): Promise<string | null>;

  /**
   * Subscribe to auth state changes
   */
  onStateChange(callback: (newState: AuthState, oldState: AuthState) => void): () => void;

  /**
   * Get state machine snapshot for debugging
   */
  getStateSnapshot(): {
    state: AuthState;
    isAuthenticated: boolean;
    needsReauth: boolean;
    lastEvent: string | null;
  };
}
