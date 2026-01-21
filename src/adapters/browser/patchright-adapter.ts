/**
 * Patchright Browser Adapter
 *
 * Implements IBrowserPort using Patchright (stealth Playwright fork).
 * Wraps the existing SharedContextManager while providing the port interface.
 *
 * This adapter allows:
 * - Clean separation between browser implementation and business logic
 * - Easy testing with mock implementations
 * - Future replacement of Patchright with other libraries
 */

import type { BrowserContext, Page } from "patchright";
import { injectable } from "tsyringe";
import type {
  IBrowserPort,
  IBrowserContext,
  IPage,
  BrowserContextOptions,
  NavigationOptions,
  SelectorOptions,
  ScreenshotOptions,
  BrowserCookie,
} from "../../core/ports/browser-port.js";
import { BrowserContextPool } from "./context-pool.js";
import type { EventBus } from "../../core/events/event-bus.js";
import { log } from "../../utils/logger.js";

/**
 * Page adapter wrapping Patchright Page
 */
class PatchrightPageAdapter implements IPage {
  constructor(private readonly page: Page) {}

  async goto(url: string, options?: NavigationOptions): Promise<void> {
    await this.page.goto(url, {
      timeout: options?.timeout,
      waitUntil: options?.waitUntil,
    });
  }

  url(): string {
    return this.page.url();
  }

  async waitForSelector(selector: string, options?: SelectorOptions): Promise<void> {
    await this.page.waitForSelector(selector, {
      timeout: options?.timeout,
      state: options?.state,
    });
  }

  async waitForNavigation(options?: NavigationOptions): Promise<void> {
    await this.page.waitForNavigation({
      timeout: options?.timeout,
      waitUntil: options?.waitUntil,
    });
  }

  async waitForTimeout(timeout: number): Promise<void> {
    await this.page.waitForTimeout(timeout);
  }

  async click(selector: string, options?: { timeout?: number }): Promise<void> {
    await this.page.click(selector, { timeout: options?.timeout });
  }

  async type(selector: string, text: string, options?: { delay?: number }): Promise<void> {
    await this.page.type(selector, text, { delay: options?.delay });
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.page.fill(selector, value);
  }

  async textContent(selector: string): Promise<string | null> {
    return this.page.textContent(selector);
  }

  async innerText(selector: string): Promise<string> {
    return this.page.innerText(selector);
  }

  async evaluate<R>(fn: string | (() => R)): Promise<R>;
  async evaluate<R, A>(fn: string | ((arg: A) => R), arg: A): Promise<R>;
  async evaluate<R, A>(fn: string | ((arg?: A) => R), arg?: A): Promise<R> {
    if (arg !== undefined) {
      // Use any to work around Playwright's complex type system
      return this.page.evaluate(fn as any, arg as any);
    }
    return this.page.evaluate(fn as any);
  }

  async querySelector(selector: string): Promise<boolean> {
    const element = await this.page.$(selector);
    return element !== null;
  }

  async screenshot(options?: ScreenshotOptions): Promise<Buffer> {
    return this.page.screenshot({
      path: options?.path,
      fullPage: options?.fullPage,
      type: options?.type,
    });
  }

  async close(): Promise<void> {
    await this.page.close();
  }

  isClosed(): boolean {
    return this.page.isClosed();
  }

  /**
   * Get the underlying Patchright Page (for advanced use cases)
   */
  getUnderlyingPage(): Page {
    return this.page;
  }
}

/**
 * Context adapter wrapping Patchright BrowserContext
 */
class PatchrightContextAdapter implements IBrowserContext {
  constructor(private readonly context: BrowserContext) {}

  async newPage(): Promise<IPage> {
    const page = await this.context.newPage();
    return new PatchrightPageAdapter(page);
  }

  pages(): IPage[] {
    return this.context.pages().map((p) => new PatchrightPageAdapter(p));
  }

  async cookies(urls?: string | string[]): Promise<BrowserCookie[]> {
    const cookies = await this.context.cookies(urls);
    return cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
    }));
  }

  async addCookies(cookies: BrowserCookie[]): Promise<void> {
    await this.context.addCookies(cookies);
  }

  async clearCookies(): Promise<void> {
    await this.context.clearCookies();
  }

  async storageState(options: { path: string }): Promise<void> {
    await this.context.storageState({ path: options.path });
  }

  async close(): Promise<void> {
    await this.context.close();
  }

  /**
   * Get the underlying Patchright BrowserContext (for advanced use cases)
   */
  getUnderlyingContext(): BrowserContext {
    return this.context;
  }
}

/**
 * Patchright Browser Adapter
 *
 * Implements IBrowserPort using Patchright and BrowserContextPool.
 */
@injectable()
export class PatchrightAdapter implements IBrowserPort {
  private readonly pool: BrowserContextPool<BrowserContext>;
  private eventBus?: EventBus;
  private initialized = false;
  private defaultHeadless = true;

  constructor() {
    this.pool = new BrowserContextPool<BrowserContext>();
  }

  /**
   * Initialize the adapter with dependencies
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Import Patchright dynamically to avoid issues at module load time
    const { chromium } = await import("patchright");
    const { CONFIG } = await import("../../config.js");

    this.defaultHeadless = CONFIG.headless;

    // Configure the pool with Patchright-specific factory and closer
    this.pool.configure(
      async (headless: boolean, storageState?: string) => {
        log.info(`[PatchrightAdapter] Launching persistent context (headless: ${headless})`);

        const launchOptions = {
          headless,
          channel: "chrome" as const,
          viewport: CONFIG.viewport,
          locale: "en-US",
          timezoneId: "Europe/Berlin",
          ...(storageState && { storageState }),
          args: [
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
            "--no-first-run",
            "--no-default-browser-check",
          ],
        };

        const context = await chromium.launchPersistentContext(
          CONFIG.chromeProfileDir,
          launchOptions
        );

        return context;
      },
      async (context: BrowserContext) => {
        log.info("[PatchrightAdapter] Closing context");
        await context.close();
      },
      this.eventBus
    );

    this.initialized = true;
    this.eventBus?.publish("browser:initialized", { headless: this.defaultHeadless });
  }

  /**
   * Set event bus for publishing browser events
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  async createContext(options?: BrowserContextOptions): Promise<IBrowserContext> {
    await this.initialize();

    const headless = options?.headless ?? this.defaultHeadless;
    const sessionId = `temp-${Date.now()}`;

    const context = await this.pool.acquire(sessionId, headless, options?.storageState);
    return new PatchrightContextAdapter(context);
  }

  async getSharedContext(
    sessionId: string,
    options?: BrowserContextOptions
  ): Promise<IBrowserContext> {
    await this.initialize();

    const headless = options?.headless ?? this.defaultHeadless;
    const context = await this.pool.acquire(sessionId, headless, options?.storageState);
    return new PatchrightContextAdapter(context);
  }

  async releaseContext(sessionId: string): Promise<void> {
    await this.pool.release(sessionId);
  }

  async closeContext(sessionId: string): Promise<boolean> {
    if (this.pool.hasContext(sessionId)) {
      await this.pool.release(sessionId);
      return true;
    }
    return false;
  }

  async closeAllContexts(): Promise<void> {
    await this.pool.forceClose();
  }

  isReady(): boolean {
    return this.initialized;
  }

  getStatus(): {
    ready: boolean;
    activeContexts: number;
    headless: boolean;
  } {
    const stats = this.pool.getStats();
    return {
      ready: this.initialized,
      activeContexts: stats.contextCount,
      headless: this.defaultHeadless,
    };
  }

  async shutdown(): Promise<void> {
    log.info("[PatchrightAdapter] Shutting down");
    await this.pool.forceClose();
    this.initialized = false;
    this.eventBus?.publish("browser:shutdown", { reason: "adapter shutdown" });
  }
}

/**
 * Create a new PatchrightAdapter instance
 */
export function createPatchrightAdapter(): PatchrightAdapter {
  return new PatchrightAdapter();
}
