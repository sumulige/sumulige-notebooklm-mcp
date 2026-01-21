/**
 * Interactive Login Handler
 *
 * Handles manual/interactive login flow:
 * - User sees a browser window and logs in manually
 * - Waits for URL to change to notebooklm.google.com
 */

import type { Page } from "patchright";
import { NOTEBOOKLM_AUTH_URL } from "../config.js";
import { log } from "../utils/logger.js";
import type { ProgressCallback, IInteractiveLogin } from "./auth-types.js";

export class InteractiveLogin implements IInteractiveLogin {
  /**
   * Perform interactive login
   * User will see a browser window and login manually
   *
   * SIMPLE & RELIABLE: Just wait for URL to change to notebooklm.google.com
   */
  async performLogin(page: Page, sendProgress?: ProgressCallback): Promise<boolean> {
    try {
      log.info("🌐 Opening Google login page...");
      log.warning("📝 Please login to your Google account");
      log.warning("⏳ Browser will close automatically once you reach NotebookLM");
      log.info("");

      // Progress: Navigating
      await sendProgress?.("Navigating to Google login...", 3, 10);

      // Navigate to Google login (redirects to NotebookLM after auth)
      await page.goto(NOTEBOOKLM_AUTH_URL, { timeout: 60000 });

      // Progress: Waiting for login
      await sendProgress?.("Waiting for manual login (up to 10 minutes)...", 4, 10);

      // Wait for user to complete login
      log.warning("⏳ Waiting for login (up to 10 minutes)...");

      const checkIntervalMs = 1000; // Check every 1 second
      const maxAttempts = 600; // 10 minutes total
      let lastProgressUpdate = 0;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const currentUrl = page.url();
          const elapsedSeconds = Math.floor(attempt * (checkIntervalMs / 1000));

          // Send progress every 10 seconds
          if (elapsedSeconds - lastProgressUpdate >= 10) {
            lastProgressUpdate = elapsedSeconds;
            const progressStep = Math.min(8, 4 + Math.floor(elapsedSeconds / 60));
            await sendProgress?.(
              `Waiting for login... (${elapsedSeconds}s elapsed)`,
              progressStep,
              10
            );
          }

          // SIMPLE: Check if we're on NotebookLM (any path!)
          if (currentUrl.startsWith("https://notebooklm.google.com/")) {
            await sendProgress?.("Login successful! NotebookLM detected!", 9, 10);
            log.success("✅ Login successful! NotebookLM URL detected.");
            log.success(`✅ Current URL: ${currentUrl}`);

            // Short wait to ensure page is loaded
            await page.waitForTimeout(2000);
            return true;
          }

          // Still on accounts.google.com - log periodically
          if (currentUrl.includes("accounts.google.com") && attempt % 30 === 0 && attempt > 0) {
            log.warning(`⏳ Still waiting... (${elapsedSeconds}s elapsed)`);
          }

          await page.waitForTimeout(checkIntervalMs);
        } catch {
          await page.waitForTimeout(checkIntervalMs);
          continue;
        }
      }

      // Timeout reached - final check
      const currentUrl = page.url();
      if (currentUrl.startsWith("https://notebooklm.google.com/")) {
        await sendProgress?.("Login successful (detected on timeout check)!", 9, 10);
        log.success("✅ Login successful (detected on timeout check)");
        return true;
      }

      log.error("❌ Login verification failed - timeout reached");
      log.warning(`Current URL: ${currentUrl}`);
      return false;
    } catch (error) {
      log.error(`❌ Login failed: ${error}`);
      return false;
    }
  }

  /**
   * Wait for NotebookLM URL to appear (SIMPLE & RELIABLE)
   *
   * Just checks if URL starts with notebooklm.google.com - no complex UI element searching!
   */
  async waitForNotebook(page: Page, timeoutMs: number): Promise<boolean> {
    const endTime = Date.now() + timeoutMs;

    while (Date.now() < endTime) {
      try {
        const currentUrl = page.url();

        // Simple check: Are we on NotebookLM?
        if (currentUrl.startsWith("https://notebooklm.google.com/")) {
          log.success("  ✅ NotebookLM URL detected");
          return true;
        }
      } catch {
        // Ignore errors
      }

      await page.waitForTimeout(1000);
    }

    return false;
  }

  /**
   * Wait for Google to redirect to NotebookLM after successful login (SIMPLE & RELIABLE)
   *
   * Just checks if URL changes to notebooklm.google.com - no complex UI element searching!
   */
  async waitForRedirectAfterLogin(page: Page, deadline: number): Promise<boolean> {
    log.info("    ⏳ Waiting for redirect to NotebookLM...");

    while (Date.now() < deadline) {
      try {
        const currentUrl = page.url();

        // Simple check: Are we on NotebookLM?
        if (currentUrl.startsWith("https://notebooklm.google.com/")) {
          log.success("    ✅ NotebookLM URL detected!");
          // Short wait to ensure page is loaded
          await page.waitForTimeout(2000);
          return true;
        }
      } catch {
        // Ignore errors
      }

      await page.waitForTimeout(500);
    }

    log.error("    ❌ Redirect timeout - NotebookLM URL not reached");
    return false;
  }
}
