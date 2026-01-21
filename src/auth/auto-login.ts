/**
 * Auto Login Handler
 *
 * Handles automatic login with credentials:
 * - Email/password based login
 * - Account chooser handling
 * - Human-like typing and interactions
 */

import type { BrowserContext, Page } from "patchright";
import path from "path";
import { CONFIG, NOTEBOOKLM_AUTH_URL } from "../config.js";
import { log } from "../utils/logger.js";
import {
  humanType,
  randomDelay,
  realisticClick,
  randomMouseMovement,
} from "../utils/stealth-utils.js";
import type { IAutoLogin } from "./auth-types.js";
import { StateManager } from "./state-manager.js";
import { InteractiveLogin } from "./interactive-login.js";

export class AutoLogin implements IAutoLogin {
  private stateManager: StateManager;
  private interactiveLogin: InteractiveLogin;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.interactiveLogin = new InteractiveLogin();
  }

  /**
   * Attempt to authenticate using configured credentials
   */
  async loginWithCredentials(
    context: BrowserContext,
    page: Page,
    email: string,
    password: string
  ): Promise<boolean> {
    const maskedEmail = this.maskEmail(email);
    log.warning(`🔁 Attempting automatic login for ${maskedEmail}...`);

    // Log browser visibility
    if (!CONFIG.headless) {
      log.info("  👁️  Browser is VISIBLE for debugging");
    } else {
      log.info("  🙈 Browser is HEADLESS (invisible)");
    }

    log.info(`  🌐 Navigating to Google login...`);

    try {
      await page.goto(NOTEBOOKLM_AUTH_URL, {
        waitUntil: "domcontentloaded",
        timeout: CONFIG.browserTimeout,
      });
      log.success(`  ✅ Page loaded: ${page.url().slice(0, 80)}...`);
    } catch {
      log.warning(`  ⚠️  Page load timeout (continuing anyway)`);
    }

    const deadline = Date.now() + CONFIG.autoLoginTimeoutMs;
    log.info(`  ⏰ Auto-login timeout: ${CONFIG.autoLoginTimeoutMs / 1000}s`);

    // Already on NotebookLM?
    log.info("  🔍 Checking if already authenticated...");
    if (await this.interactiveLogin.waitForNotebook(page, CONFIG.autoLoginTimeoutMs)) {
      log.success("✅ Already authenticated");
      await this.stateManager.saveBrowserState(context, page);
      return true;
    }

    log.warning("  ❌ Not authenticated yet, proceeding with login...");

    // Handle possible account chooser
    log.info("  🔍 Checking for account chooser...");
    if (await this.handleAccountChooser(page, email)) {
      log.success("  ✅ Account selected from chooser");
      if (await this.interactiveLogin.waitForNotebook(page, CONFIG.autoLoginTimeoutMs)) {
        log.success("✅ Automatic login successful");
        await this.stateManager.saveBrowserState(context, page);
        return true;
      }
    }

    // Email step
    log.info("  📧 Entering email address...");
    if (!(await this.fillIdentifier(page, email))) {
      if (await this.interactiveLogin.waitForNotebook(page, CONFIG.autoLoginTimeoutMs)) {
        log.success("✅ Automatic login successful");
        await this.stateManager.saveBrowserState(context, page);
        return true;
      }
      log.warning("⚠️  Email input not detected");
    }

    // Password step (wait until visible)
    let waitAttempts = 0;
    log.warning("  ⏳ Waiting for password page to load...");

    while (Date.now() < deadline && !(await this.fillPassword(page, password))) {
      waitAttempts++;

      // Log every 10 seconds (20 attempts * 0.5s)
      if (waitAttempts % 20 === 0) {
        const secondsWaited = waitAttempts * 0.5;
        const secondsRemaining = (deadline - Date.now()) / 1000;
        log.warning(
          `  ⏳ Still waiting for password field... (${secondsWaited}s elapsed, ${secondsRemaining.toFixed(0)}s remaining)`
        );
        log.info(`  📍 Current URL: ${page.url().slice(0, 100)}`);
      }

      if (page.url().includes("challenge")) {
        log.warning("⚠️  Additional verification required (Google challenge page).");
        return false;
      }
      await page.waitForTimeout(500);
    }

    // Wait for Google redirect after login
    log.info("  🔄 Waiting for Google redirect to NotebookLM...");

    if (await this.interactiveLogin.waitForRedirectAfterLogin(page, deadline)) {
      log.success("✅ Automatic login successful");
      await this.stateManager.saveBrowserState(context, page);
      return true;
    }

    // Login failed - diagnose
    log.error("❌ Automatic login timed out");

    // Take screenshot for debugging
    try {
      const screenshotPath = path.join(CONFIG.dataDir, `login_failed_${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath });
      log.info(`  📸 Screenshot saved: ${screenshotPath}`);
    } catch (error) {
      log.warning(`  ⚠️  Could not save screenshot: ${error}`);
    }

    // Diagnose specific failure reason
    this.diagnoseLoginFailure(page.url());

    return false;
  }

  /**
   * Handle possible account chooser
   */
  private async handleAccountChooser(page: Page, email: string): Promise<boolean> {
    try {
      const chooser = await page.$$("div[data-identifier], li[data-identifier]");

      if (chooser.length > 0) {
        for (const item of chooser) {
          const identifier = (await item.getAttribute("data-identifier"))?.toLowerCase() || "";
          if (identifier === email.toLowerCase()) {
            await item.click();
            await randomDelay(150, 320);
            await page.waitForTimeout(500);
            return true;
          }
        }

        // Click "Use another account"
        await this.clickText(page, [
          "Use another account",
          "Weiteres Konto hinzufügen",
          "Anderes Konto verwenden",
        ]);
        await randomDelay(150, 320);
        return false;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Fill email identifier field with human-like typing
   */
  private async fillIdentifier(page: Page, email: string): Promise<boolean> {
    log.info("    📧 Looking for email field...");

    const emailSelectors = [
      "input#identifierId",
      "input[name='identifier']",
      "input[type='email']",
    ];

    let emailSelector: string | null = null;
    let emailField: any = null;

    for (const selector of emailSelectors) {
      try {
        const candidate = await page.waitForSelector(selector, {
          state: "attached",
          timeout: 3000,
        });
        if (!candidate) continue;

        try {
          if (!(await candidate.isVisible())) {
            continue; // Hidden field
          }
        } catch {
          continue;
        }

        emailField = candidate;
        emailSelector = selector;
        log.success(`    ✅ Email field visible: ${selector}`);
        break;
      } catch {
        continue;
      }
    }

    if (!emailField || !emailSelector) {
      log.warning("    ℹ️  No visible email field found (likely pre-filled)");
      log.info(`    📍 Current URL: ${page.url().slice(0, 100)}`);
      return false;
    }

    // Human-like mouse movement to field
    try {
      const box = await emailField.boundingBox();
      if (box) {
        const targetX = box.x + box.width / 2;
        const targetY = box.y + box.height / 2;
        await randomMouseMovement(page, targetX, targetY);
        await randomDelay(200, 500);
      }
    } catch {
      // Ignore errors
    }

    // Click to focus
    try {
      await realisticClick(page, emailSelector, false);
    } catch (error) {
      log.warning(`    ⚠️  Could not click email field (${error}); trying direct focus`);
      try {
        await emailField.focus();
      } catch {
        log.error("    ❌ Failed to focus email field");
        return false;
      }
    }

    // Programmer typing speed (from config)
    log.info(`    ⌨️  Typing email: ${this.maskEmail(email)}`);
    try {
      const wpm =
        CONFIG.typingWpmMin +
        Math.floor(Math.random() * (CONFIG.typingWpmMax - CONFIG.typingWpmMin + 1));
      await humanType(page, emailSelector, email, { wpm, withTypos: false });
      log.success("    ✅ Email typed successfully");
    } catch (error) {
      log.error(`    ❌ Typing failed: ${error}`);
      try {
        await page.fill(emailSelector, email);
        log.success("    ✅ Filled email using fallback");
      } catch {
        return false;
      }
    }

    // Human "thinking" pause before clicking Next
    await randomDelay(400, 1200);

    // Click Next button
    log.info("    🔘 Looking for Next button...");

    const nextSelectors = [
      "button:has-text('Next')",
      "button:has-text('Weiter')",
      "#identifierNext",
    ];

    let nextClicked = false;
    for (const selector of nextSelectors) {
      try {
        const button = await page.locator(selector);
        if ((await button.count()) > 0) {
          await realisticClick(page, selector, true);
          log.success(`    ✅ Next button clicked: ${selector}`);
          nextClicked = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!nextClicked) {
      log.warning("    ⚠️  Button not found, pressing Enter");
      await emailField.press("Enter");
    }

    // Variable delay
    await randomDelay(800, 1500);
    log.success("    ✅ Email step complete");
    return true;
  }

  /**
   * Fill password field with human-like typing
   */
  private async fillPassword(page: Page, password: string): Promise<boolean> {
    log.info("    🔐 Looking for password field...");

    const passwordSelectors = ["input[name='Passwd']", "input[type='password']"];

    let passwordSelector: string | null = null;
    let passwordField: any = null;

    for (const selector of passwordSelectors) {
      try {
        passwordField = await page.$(selector);
        if (passwordField) {
          passwordSelector = selector;
          log.success(`    ✅ Password field found: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    if (!passwordField) {
      // Not found yet, but don't fail - this is called in a loop
      return false;
    }

    // Human-like mouse movement to field
    try {
      const box = await passwordField.boundingBox();
      if (box) {
        const targetX = box.x + box.width / 2;
        const targetY = box.y + box.height / 2;
        await randomMouseMovement(page, targetX, targetY);
        await randomDelay(300, 700);
      }
    } catch {
      // Ignore errors
    }

    // Click to focus
    if (passwordSelector) {
      await realisticClick(page, passwordSelector, false);
    }

    // Programmer typing speed (from config)
    log.info("    ⌨️  Typing password...");
    try {
      const wpm =
        CONFIG.typingWpmMin +
        Math.floor(Math.random() * (CONFIG.typingWpmMax - CONFIG.typingWpmMin + 1));
      if (passwordSelector) {
        await humanType(page, passwordSelector, password, { wpm, withTypos: false });
      }
      log.success("    ✅ Password typed successfully");
    } catch (error) {
      log.error(`    ❌ Typing failed: ${error}`);
      return false;
    }

    // Human "review" pause before submitting password
    await randomDelay(300, 1000);

    // Click Next button
    log.info("    🔘 Looking for Next button...");

    const pwdNextSelectors = [
      "button:has-text('Next')",
      "button:has-text('Weiter')",
      "#passwordNext",
    ];

    let pwdNextClicked = false;
    for (const selector of pwdNextSelectors) {
      try {
        const button = await page.locator(selector);
        if ((await button.count()) > 0) {
          await realisticClick(page, selector, true);
          log.success(`    ✅ Next button clicked: ${selector}`);
          pwdNextClicked = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!pwdNextClicked) {
      log.warning("    ⚠️  Button not found, pressing Enter");
      await passwordField.press("Enter");
    }

    // Variable delay
    await randomDelay(800, 1500);
    log.success("    ✅ Password step complete");
    return true;
  }

  /**
   * Click text element
   */
  private async clickText(page: Page, texts: string[]): Promise<boolean> {
    for (const text of texts) {
      const selector = `text="${text}"`;
      try {
        const locator = page.locator(selector);
        if ((await locator.count()) > 0) {
          await realisticClick(page, selector, true);
          await randomDelay(120, 260);
          return true;
        }
      } catch {
        continue;
      }
    }
    return false;
  }

  /**
   * Mask email for logging
   */
  private maskEmail(email: string): string {
    if (!email.includes("@")) {
      return "***";
    }
    const [name, domain] = email.split("@");
    if (name.length <= 2) {
      return `${"*".repeat(name.length)}@${domain}`;
    }
    return `${name[0]}${"*".repeat(name.length - 2)}${name[name.length - 1]}@${domain}`;
  }

  /**
   * Diagnose specific failure reason
   */
  private diagnoseLoginFailure(currentUrl: string): void {
    log.warning("  🔍 Diagnosing failure...");

    if (currentUrl.includes("accounts.google.com")) {
      if (currentUrl.includes("/signin/identifier")) {
        log.error("  ❌ Still on email page - email input might have failed");
        log.info("  💡 Check if email is correct in .env");
      } else if (currentUrl.includes("/challenge")) {
        log.error(
          "  ❌ Google requires additional verification (2FA, CAPTCHA, suspicious login)"
        );
        log.info("  💡 Try logging in manually first: use setup_auth tool");
      } else if (currentUrl.includes("/pwd") || currentUrl.includes("/password")) {
        log.error("  ❌ Still on password page - password input might have failed");
        log.info("  💡 Check if password is correct in .env");
      } else {
        log.error(`  ❌ Stuck on Google accounts page: ${currentUrl.slice(0, 80)}...`);
      }
    } else if (currentUrl.includes("notebooklm.google.com")) {
      log.warning("  ⚠️  Reached NotebookLM but couldn't detect successful login");
      log.info("  💡 This might be a timing issue - try again");
    } else {
      log.error(`  ❌ Unexpected page: ${currentUrl.slice(0, 80)}...`);
    }
  }
}
