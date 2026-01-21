/**
 * Browser State Manager
 *
 * Handles browser state persistence:
 * - Save/load cookies and localStorage
 * - Save/load sessionStorage
 * - State file management
 */

import type { BrowserContext, Page } from "patchright";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { CONFIG } from "../config.js";
import { log } from "../utils/logger.js";
import type { IStateManager, SessionStorageData, BrowserStateData } from "./auth-types.js";

export class StateManager implements IStateManager {
  private stateFilePath: string;
  private sessionFilePath: string;

  constructor() {
    this.stateFilePath = path.join(CONFIG.browserStateDir, "state.json");
    this.sessionFilePath = path.join(CONFIG.browserStateDir, "session.json");
  }

  /**
   * Get the state file path
   */
  getStateFilePath(): string {
    return this.stateFilePath;
  }

  /**
   * Get the session file path
   */
  getSessionFilePath(): string {
    return this.sessionFilePath;
  }

  /**
   * Save entire browser state (cookies + localStorage)
   */
  async saveBrowserState(context: BrowserContext, page?: Page): Promise<boolean> {
    try {
      // Save storage state (cookies + localStorage + IndexedDB)
      await context.storageState({ path: this.stateFilePath });

      // Also save sessionStorage if page is provided
      if (page) {
        try {
          const sessionStorageData: string = await page.evaluate((): string => {
            // Properly extract sessionStorage as a plain object
            const storage: Record<string, string> = {};
            // @ts-expect-error - sessionStorage exists in browser context
            for (let i = 0; i < sessionStorage.length; i++) {
              // @ts-expect-error - sessionStorage exists in browser context
              const key = sessionStorage.key(i);
              if (key) {
                // @ts-expect-error - sessionStorage exists in browser context
                storage[key] = sessionStorage.getItem(key) || "";
              }
            }
            return JSON.stringify(storage);
          });

          await fs.writeFile(this.sessionFilePath, sessionStorageData, {
            encoding: "utf-8",
          });

          const entries = Object.keys(JSON.parse(sessionStorageData)).length;
          log.success(`✅ Browser state saved (incl. sessionStorage: ${entries} entries)`);
        } catch (error) {
          log.warning(`⚠️  State saved, but sessionStorage failed: ${error}`);
        }
      } else {
        log.success("✅ Browser state saved");
      }

      return true;
    } catch (error) {
      log.error(`❌ Failed to save browser state: ${error}`);
      return false;
    }
  }

  /**
   * Check if saved browser state exists
   */
  async hasSavedState(): Promise<boolean> {
    try {
      await fs.access(this.stateFilePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get path to saved browser state (synchronous check)
   */
  getStatePath(): string | null {
    if (existsSync(this.stateFilePath)) {
      return this.stateFilePath;
    }
    return null;
  }

  /**
   * Get valid state path (checks expiry)
   */
  async getValidStatePath(): Promise<string | null> {
    const statePath = this.getStatePath();
    if (!statePath) {
      return null;
    }

    if (await this.isStateExpired()) {
      log.warning("⚠️  Saved state is expired (>24h old)");
      log.info("💡 Run setup_auth tool to re-authenticate");
      return null;
    }

    return statePath;
  }

  /**
   * Load sessionStorage from file
   */
  async loadSessionStorage(): Promise<SessionStorageData | null> {
    try {
      const data = await fs.readFile(this.sessionFilePath, { encoding: "utf-8" });
      const sessionData = JSON.parse(data) as SessionStorageData;
      log.success(`✅ Loaded sessionStorage (${Object.keys(sessionData).length} entries)`);
      return sessionData;
    } catch (error) {
      log.warning(`⚠️  Failed to load sessionStorage: ${error}`);
      return null;
    }
  }

  /**
   * Load authentication state from a specific file path
   */
  async loadAuthState(context: BrowserContext, statePath: string): Promise<boolean> {
    try {
      // Read state.json
      const stateData = await fs.readFile(statePath, { encoding: "utf-8" });
      const state = JSON.parse(stateData) as BrowserStateData;

      // Add cookies to context
      if (state.cookies) {
        await context.addCookies(state.cookies);
        log.success(`✅ Loaded ${state.cookies.length} cookies from ${statePath}`);
        return true;
      }

      log.warning(`⚠️  No cookies found in state file`);
      return false;
    } catch (error) {
      log.error(`❌ Failed to load auth state: ${error}`);
      return false;
    }
  }

  /**
   * Check if the saved state file is too old (>24 hours)
   */
  async isStateExpired(): Promise<boolean> {
    try {
      const stats = await fs.stat(this.stateFilePath);
      const fileAgeSeconds = (Date.now() - stats.mtimeMs) / 1000;
      const maxAgeSeconds = 24 * 60 * 60; // 24 hours

      if (fileAgeSeconds > maxAgeSeconds) {
        const hoursOld = fileAgeSeconds / 3600;
        log.warning(`⚠️  Saved state is ${hoursOld.toFixed(1)}h old (max: 24h)`);
        return true;
      }

      return false;
    } catch {
      return true; // File doesn't exist = expired
    }
  }

  /**
   * Delete state files
   */
  async deleteStateFiles(): Promise<{ stateDeleted: boolean; sessionDeleted: boolean }> {
    let stateDeleted = false;
    let sessionDeleted = false;

    try {
      await fs.unlink(this.stateFilePath);
      stateDeleted = true;
    } catch {
      // File doesn't exist
    }

    try {
      await fs.unlink(this.sessionFilePath);
      sessionDeleted = true;
    } catch {
      // File doesn't exist
    }

    return { stateDeleted, sessionDeleted };
  }
}
