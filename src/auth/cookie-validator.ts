/**
 * Cookie Validator
 *
 * Handles validation of browser cookies:
 * - Check for Google auth cookies
 * - Validate cookie expiration
 * - Check critical authentication cookies
 */

import type { BrowserContext } from "patchright";
import { log } from "../utils/logger.js";
import { CRITICAL_COOKIE_NAMES, type ICookieValidator } from "./auth-types.js";
import { StateManager } from "./state-manager.js";

export class CookieValidator implements ICookieValidator {
  private stateManager: StateManager;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  /**
   * Validate if saved state is still valid
   */
  async validateState(context: BrowserContext): Promise<boolean> {
    try {
      const cookies = await context.cookies();
      if (cookies.length === 0) {
        log.warning("⚠️  No cookies found in state");
        return false;
      }

      // Check for Google auth cookies
      const googleCookies = cookies.filter((c) => c.domain.includes("google.com"));
      if (googleCookies.length === 0) {
        log.warning("⚠️  No Google cookies found");
        return false;
      }

      // Check if important cookies are expired
      const currentTime = Date.now() / 1000;

      for (const cookie of googleCookies) {
        const expires = cookie.expires ?? -1;
        if (expires !== -1 && expires < currentTime) {
          log.warning(`⚠️  Cookie '${cookie.name}' has expired`);
          return false;
        }
      }

      log.success("✅ State validation passed");
      return true;
    } catch (error) {
      log.warning(`⚠️  State validation failed: ${error}`);
      return false;
    }
  }

  /**
   * Validate if critical authentication cookies are still valid
   */
  async validateCookiesExpiry(context: BrowserContext): Promise<boolean> {
    try {
      const cookies = await context.cookies();
      if (cookies.length === 0) {
        log.warning("⚠️  No cookies found");
        return false;
      }

      // Find critical cookies
      const criticalCookies = cookies.filter((c) =>
        CRITICAL_COOKIE_NAMES.includes(c.name as (typeof CRITICAL_COOKIE_NAMES)[number])
      );

      if (criticalCookies.length === 0) {
        log.warning("⚠️  No critical auth cookies found");
        return false;
      }

      // Check expiration for each critical cookie
      const currentTime = Date.now() / 1000;
      const expiredCookies: string[] = [];

      for (const cookie of criticalCookies) {
        const expires = cookie.expires ?? -1;

        // -1 means session cookie (valid until browser closes)
        if (expires === -1) {
          continue;
        }

        // Check if cookie is expired
        if (expires < currentTime) {
          expiredCookies.push(cookie.name);
        }
      }

      if (expiredCookies.length > 0) {
        log.warning(`⚠️  Expired cookies: ${expiredCookies.join(", ")}`);
        return false;
      }

      log.success(`✅ All ${criticalCookies.length} critical cookies are valid`);
      return true;
    } catch (error) {
      log.warning(`⚠️  Cookie validation failed: ${error}`);
      return false;
    }
  }

  /**
   * Check if the saved state file is too old (>24 hours)
   */
  async isStateExpired(): Promise<boolean> {
    return this.stateManager.isStateExpired();
  }
}
