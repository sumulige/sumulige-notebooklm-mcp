/**
 * Type definitions for Authentication module
 */

import type { BrowserContext, Page } from "patchright";

/**
 * Progress callback function for MCP progress notifications
 */
export type ProgressCallback = (
  message: string,
  progress?: number,
  total?: number
) => Promise<void>;

/**
 * Critical cookie names for Google authentication
 */
export const CRITICAL_COOKIE_NAMES = [
  "SID",
  "HSID",
  "SSID", // Google session
  "APISID",
  "SAPISID", // API auth
  "OSID",
  "__Secure-OSID", // NotebookLM-specific
  "__Secure-1PSID",
  "__Secure-3PSID", // Secure variants
] as const;

/**
 * Browser state data structure
 */
export interface BrowserStateData {
  cookies?: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
  }>;
  origins?: Array<{
    origin: string;
    localStorage?: Array<{ name: string; value: string }>;
  }>;
}

/**
 * Session storage data structure
 */
export type SessionStorageData = Record<string, string>;

/**
 * Interface for browser state management
 */
export interface IStateManager {
  saveBrowserState(context: BrowserContext, page?: Page): Promise<boolean>;
  hasSavedState(): Promise<boolean>;
  getStatePath(): string | null;
  getValidStatePath(): Promise<string | null>;
  loadSessionStorage(): Promise<SessionStorageData | null>;
  loadAuthState(context: BrowserContext, statePath: string): Promise<boolean>;
}

/**
 * Interface for cookie validation
 */
export interface ICookieValidator {
  validateState(context: BrowserContext): Promise<boolean>;
  validateCookiesExpiry(context: BrowserContext): Promise<boolean>;
  isStateExpired(): Promise<boolean>;
}

/**
 * Interface for interactive login
 */
export interface IInteractiveLogin {
  performLogin(page: Page, sendProgress?: ProgressCallback): Promise<boolean>;
}

/**
 * Interface for auto login
 */
export interface IAutoLogin {
  loginWithCredentials(
    context: BrowserContext,
    page: Page,
    email: string,
    password: string
  ): Promise<boolean>;
}

/**
 * Interface for auth setup and cleanup
 */
export interface IAuthSetup {
  performSetup(sendProgress?: ProgressCallback, overrideHeadless?: boolean): Promise<boolean>;
  clearAllAuthData(): Promise<void>;
  clearState(): Promise<boolean>;
  hardResetState(): Promise<boolean>;
}
