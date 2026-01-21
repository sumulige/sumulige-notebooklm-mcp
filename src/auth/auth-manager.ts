/**
 * Authentication Manager for NotebookLM
 *
 * This is the main facade that coordinates all authentication functionality:
 * - Browser state persistence (StateManager)
 * - Cookie validation (CookieValidator)
 * - Interactive login (InteractiveLogin)
 * - Auto-login with credentials (AutoLogin)
 * - Setup and cleanup (AuthSetup)
 *
 * New Architecture (via feature flags):
 * - AuthStateMachine for state tracking
 *
 * Based on the Python implementation from auth.py
 */

import type { BrowserContext, Page } from "patchright";
import type { ProgressCallback } from "./auth-types.js";
import { StateManager } from "./state-manager.js";
import { CookieValidator } from "./cookie-validator.js";
import { InteractiveLogin } from "./interactive-login.js";
import { AutoLogin } from "./auto-login.js";
import { AuthSetup } from "./auth-setup.js";

// New Architecture Components
import { isEnabled, AuthStateMachine, createAuthStateMachine } from "../core/index.js";
import { log } from "../utils/logger.js";

export class AuthManager {
  // Sub-modules
  private stateManager: StateManager;
  private cookieValidator: CookieValidator;
  private interactiveLogin: InteractiveLogin;
  private autoLogin: AutoLogin;
  private authSetup: AuthSetup;

  // New Architecture Components (enabled via feature flags)
  private stateMachine?: AuthStateMachine;

  constructor() {
    // Initialize sub-modules
    this.stateManager = new StateManager();
    this.cookieValidator = new CookieValidator(this.stateManager);
    this.interactiveLogin = new InteractiveLogin();
    this.autoLogin = new AutoLogin(this.stateManager);
    this.authSetup = new AuthSetup(this.stateManager);

    // Initialize AuthStateMachine if feature flag enabled
    if (isEnabled("USE_AUTH_STATE_MACHINE")) {
      this.stateMachine = createAuthStateMachine();
      this.setupStateMachineListeners();
      log.info("🔐 AuthStateMachine enabled (new architecture)");
    }
  }

  /**
   * Setup listeners for state machine events
   */
  private setupStateMachineListeners(): void {
    if (!this.stateMachine) return;

    this.stateMachine.on("stateChanged", (newState, oldState, event) => {
      log.info(`🔐 Auth state: ${oldState} → ${newState} (${event})`);
    });

    this.stateMachine.on("authFailed", (reason) => {
      log.warning(`🔐 Auth failed: ${reason}`);
    });

    this.stateMachine.on("expired", () => {
      log.warning("🔐 Auth expired, re-authentication required");
    });
  }

  /**
   * Get current auth state (if state machine is enabled)
   */
  getAuthState(): string | null {
    return this.stateMachine?.state ?? null;
  }

  /**
   * Check if authentication is needed (using state machine if enabled)
   */
  needsAuth(): boolean {
    if (this.stateMachine) {
      return this.stateMachine.needsReauth;
    }
    // Fallback to legacy check
    return true;
  }

  // ============================================================================
  // Browser State Management (delegated to StateManager)
  // ============================================================================

  /**
   * Save entire browser state (cookies + localStorage)
   */
  async saveBrowserState(context: BrowserContext, page?: Page): Promise<boolean> {
    return this.stateManager.saveBrowserState(context, page);
  }

  /**
   * Check if saved browser state exists
   */
  async hasSavedState(): Promise<boolean> {
    return this.stateManager.hasSavedState();
  }

  /**
   * Get path to saved browser state
   */
  getStatePath(): string | null {
    return this.stateManager.getStatePath();
  }

  /**
   * Get valid state path (checks expiry)
   */
  async getValidStatePath(): Promise<string | null> {
    return this.stateManager.getValidStatePath();
  }

  /**
   * Load sessionStorage from file
   */
  async loadSessionStorage(): Promise<Record<string, string> | null> {
    return this.stateManager.loadSessionStorage();
  }

  /**
   * Load authentication state from a specific file path
   */
  async loadAuthState(context: BrowserContext, statePath: string): Promise<boolean> {
    return this.stateManager.loadAuthState(context, statePath);
  }

  // ============================================================================
  // Cookie Validation (delegated to CookieValidator)
  // ============================================================================

  /**
   * Validate if saved state is still valid
   */
  async validateState(context: BrowserContext): Promise<boolean> {
    return this.cookieValidator.validateState(context);
  }

  /**
   * Validate if critical authentication cookies are still valid
   */
  async validateCookiesExpiry(context: BrowserContext): Promise<boolean> {
    return this.cookieValidator.validateCookiesExpiry(context);
  }

  /**
   * Check if the saved state file is too old (>24 hours)
   */
  async isStateExpired(): Promise<boolean> {
    return this.cookieValidator.isStateExpired();
  }

  // ============================================================================
  // Interactive Login (delegated to InteractiveLogin)
  // ============================================================================

  /**
   * Perform interactive login
   * User will see a browser window and login manually
   */
  async performLogin(page: Page, sendProgress?: ProgressCallback): Promise<boolean> {
    return this.interactiveLogin.performLogin(page, sendProgress);
  }

  // ============================================================================
  // Auto-Login with Credentials (delegated to AutoLogin)
  // ============================================================================

  /**
   * Attempt to authenticate using configured credentials
   */
  async loginWithCredentials(
    context: BrowserContext,
    page: Page,
    email: string,
    password: string
  ): Promise<boolean> {
    return this.autoLogin.loginWithCredentials(context, page, email, password);
  }

  // ============================================================================
  // Setup and Cleanup (delegated to AuthSetup)
  // ============================================================================

  /**
   * Perform interactive setup (for setup_auth tool)
   * Opens a PERSISTENT browser for manual login
   */
  async performSetup(
    sendProgress?: ProgressCallback,
    overrideHeadless?: boolean
  ): Promise<boolean> {
    // Update state machine if enabled
    if (this.stateMachine) {
      await this.stateMachine.dispatch("START_AUTH", { method: "interactive" });
    }

    const result = await this.authSetup.performSetup(sendProgress, overrideHeadless);

    // Update state machine based on result
    if (this.stateMachine) {
      if (result) {
        await this.stateMachine.dispatch("AUTH_SUCCESS", {
          method: "interactive",
          timestamp: Date.now(),
        });
      } else {
        await this.stateMachine.dispatch("AUTH_FAILED", {
          reason: "Interactive setup failed",
          method: "interactive",
        });
      }
    }

    return result;
  }

  /**
   * Clear ALL authentication data for account switching
   */
  async clearAllAuthData(): Promise<void> {
    return this.authSetup.clearAllAuthData();
  }

  /**
   * Clear all saved authentication state
   */
  async clearState(): Promise<boolean> {
    const result = await this.authSetup.clearState();

    // Update state machine if enabled
    if (this.stateMachine && result) {
      await this.stateMachine.dispatch("STATE_CLEARED", { reason: "manual clear" });
    }

    return result;
  }

  /**
   * HARD RESET: Completely delete ALL authentication state
   */
  async hardResetState(): Promise<boolean> {
    return this.authSetup.hardResetState();
  }
}
