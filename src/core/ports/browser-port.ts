/**
 * Browser Port Interface
 *
 * Defines the contract for browser interactions.
 * Adapters (e.g., PatchrightAdapter) implement this interface.
 *
 * This allows the domain/application layer to be independent of
 * the specific browser automation library (Patchright, Playwright, Puppeteer, etc.)
 */

/**
 * Browser context options
 */
export interface BrowserContextOptions {
  readonly headless?: boolean;
  readonly viewport?: Readonly<{ width: number; height: number }>;
  readonly userAgent?: string;
  readonly locale?: string;
  readonly timezoneId?: string;
  readonly storageState?: string; // Path to state.json
}

/**
 * Page navigation options
 */
export interface NavigationOptions {
  readonly timeout?: number;
  readonly waitUntil?: "load" | "domcontentloaded" | "networkidle";
}

/**
 * Element selector options
 */
export interface SelectorOptions {
  readonly timeout?: number;
  readonly state?: "attached" | "detached" | "visible" | "hidden";
}

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
  readonly path?: string;
  readonly fullPage?: boolean;
  readonly type?: "png" | "jpeg";
}

/**
 * Cookie structure
 */
export interface BrowserCookie {
  readonly name: string;
  readonly value: string;
  readonly domain: string;
  readonly path: string;
  readonly expires?: number;
  readonly httpOnly?: boolean;
  readonly secure?: boolean;
  readonly sameSite?: "Strict" | "Lax" | "None";
}

/**
 * Page interface (abstraction over browser page)
 */
export interface IPage {
  /**
   * Navigate to a URL
   */
  goto(url: string, options?: NavigationOptions): Promise<void>;

  /**
   * Get current URL
   */
  url(): string;

  /**
   * Wait for a selector to appear
   */
  waitForSelector(selector: string, options?: SelectorOptions): Promise<void>;

  /**
   * Wait for navigation to complete
   */
  waitForNavigation(options?: NavigationOptions): Promise<void>;

  /**
   * Wait for a timeout
   */
  waitForTimeout(timeout: number): Promise<void>;

  /**
   * Click an element
   */
  click(selector: string, options?: { timeout?: number }): Promise<void>;

  /**
   * Type text into an element
   */
  type(selector: string, text: string, options?: { delay?: number }): Promise<void>;

  /**
   * Fill an input element (faster than type)
   */
  fill(selector: string, value: string): Promise<void>;

  /**
   * Get text content of an element
   */
  textContent(selector: string): Promise<string | null>;

  /**
   * Get inner text of an element
   */
  innerText(selector: string): Promise<string>;

  /**
   * Evaluate JavaScript in page context
   */
  evaluate<R>(fn: string | (() => R)): Promise<R>;
  evaluate<R, A>(fn: string | ((arg: A) => R), arg: A): Promise<R>;

  /**
   * Query selector for element existence
   */
  querySelector(selector: string): Promise<boolean>;

  /**
   * Take a screenshot
   */
  screenshot(options?: ScreenshotOptions): Promise<Buffer>;

  /**
   * Close the page
   */
  close(): Promise<void>;

  /**
   * Check if page is closed
   */
  isClosed(): boolean;
}

/**
 * Browser context interface (abstraction over browser context)
 */
export interface IBrowserContext {
  /**
   * Create a new page in this context
   */
  newPage(): Promise<IPage>;

  /**
   * Get all pages in this context
   */
  pages(): IPage[];

  /**
   * Get all cookies
   */
  cookies(urls?: string | string[]): Promise<BrowserCookie[]>;

  /**
   * Add cookies to context
   */
  addCookies(cookies: BrowserCookie[]): Promise<void>;

  /**
   * Clear all cookies
   */
  clearCookies(): Promise<void>;

  /**
   * Save storage state to file
   */
  storageState(options: { path: string }): Promise<void>;

  /**
   * Close the context
   */
  close(): Promise<void>;
}

/**
 * Browser Port Interface
 *
 * Main interface for browser operations.
 * This is what the application layer depends on.
 */
export interface IBrowserPort {
  /**
   * Create a new browser context
   */
  createContext(options?: BrowserContextOptions): Promise<IBrowserContext>;

  /**
   * Get or create a shared context (for session reuse)
   */
  getSharedContext(
    sessionId: string,
    options?: BrowserContextOptions
  ): Promise<IBrowserContext>;

  /**
   * Release a shared context (decrement reference count)
   */
  releaseContext(sessionId: string): Promise<void>;

  /**
   * Close a specific context
   */
  closeContext(sessionId: string): Promise<boolean>;

  /**
   * Close all contexts
   */
  closeAllContexts(): Promise<void>;

  /**
   * Check if browser is ready
   */
  isReady(): boolean;

  /**
   * Get browser status
   */
  getStatus(): {
    ready: boolean;
    activeContexts: number;
    headless: boolean;
  };

  /**
   * Initialize browser (lazy)
   */
  initialize(): Promise<void>;

  /**
   * Shutdown browser completely
   */
  shutdown(): Promise<void>;
}
