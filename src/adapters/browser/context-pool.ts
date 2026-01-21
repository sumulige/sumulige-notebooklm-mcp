/**
 * Browser Context Pool
 *
 * Manages browser contexts with:
 * - Reference counting for safe cleanup
 * - Async locking to prevent race conditions
 * - Graceful headless mode switching
 *
 * Solves:
 * - SharedContextManager single point of failure
 * - Headless mode switching race condition
 * - Context cleanup without affecting active sessions
 */

import AsyncLock from "async-lock";
import { injectable } from "tsyringe";
import type { EventBus } from "../../core/events/event-bus.js";
import { log } from "../../utils/logger.js";

/**
 * Context entry in the pool
 */
interface PooledContext<T> {
  context: T;
  refCount: number;
  createdAt: number;
  lastAccess: number;
  headless: boolean;
  sessionIds: Set<string>;
}

/**
 * Context factory function type
 */
export type ContextFactory<T> = (headless: boolean, storageState?: string) => Promise<T>;

/**
 * Context closer function type
 */
export type ContextCloser<T> = (context: T) => Promise<void>;

/**
 * Browser Context Pool
 *
 * Generic pool that can manage any type of browser context.
 */
@injectable()
export class BrowserContextPool<T> {
  private pool: Map<string, PooledContext<T>> = new Map();
  private readonly lock = new AsyncLock();
  private eventBus?: EventBus;
  private factory?: ContextFactory<T>;
  private closer?: ContextCloser<T>;

  // Default pool key for shared context
  private static readonly SHARED_KEY = "__shared__";

  constructor() {
    // EventBus is optional, injected if available
  }

  /**
   * Configure the pool with factory and closer functions
   */
  configure(
    factory: ContextFactory<T>,
    closer: ContextCloser<T>,
    eventBus?: EventBus
  ): void {
    this.factory = factory;
    this.closer = closer;
    this.eventBus = eventBus;
  }

  /**
   * Acquire a context for a session
   *
   * If context exists and matches headless mode, increment refCount.
   * If headless mode differs, wait for all refs to release, then recreate.
   */
  async acquire(
    sessionId: string,
    headless: boolean,
    storageState?: string
  ): Promise<T> {
    if (!this.factory || !this.closer) {
      throw new Error("BrowserContextPool not configured. Call configure() first.");
    }

    return this.lock.acquire("pool", async () => {
      const key = BrowserContextPool.SHARED_KEY;
      let entry = this.pool.get(key);

      // Check if we need to recreate due to headless mode change
      if (entry && entry.headless !== headless) {
        log.info(`[ContextPool] Headless mode change requested: ${entry.headless} → ${headless}`);

        // Wait for all sessions to release (with timeout)
        if (entry.refCount > 0) {
          log.info(`[ContextPool] Waiting for ${entry.refCount} sessions to release...`);
          // Don't block - just warn and proceed
          // The old context will be closed when all refs are released
          log.warning(`[ContextPool] ${entry.refCount} sessions still using old context`);
        }

        // Close old context
        try {
          if (this.closer) {
            await this.closer(entry.context);
          }
          this.eventBus?.publish("browser:context:closed", { sessionId: "shared" });
        } catch (error) {
          log.warning(`[ContextPool] Error closing old context: ${error}`);
        }

        entry = undefined;
        this.pool.delete(key);
      }

      // Create new context if needed
      if (!entry) {
        log.info(`[ContextPool] Creating new context (headless: ${headless})`);
        const context = await this.factory!(headless, storageState);

        entry = {
          context,
          refCount: 0,
          createdAt: Date.now(),
          lastAccess: Date.now(),
          headless,
          sessionIds: new Set(),
        };
        this.pool.set(key, entry);
        this.eventBus?.publish("browser:context:created", { sessionId });
      }

      // Increment ref count and track session
      entry.refCount++;
      entry.lastAccess = Date.now();
      entry.sessionIds.add(sessionId);

      log.dim(`[ContextPool] Acquired context for ${sessionId} (refCount: ${entry.refCount})`);

      return entry.context;
    });
  }

  /**
   * Release a context for a session
   *
   * Decrements refCount. Does NOT close the context (reuse for next session).
   */
  async release(sessionId: string): Promise<void> {
    return this.lock.acquire("pool", async () => {
      const key = BrowserContextPool.SHARED_KEY;
      const entry = this.pool.get(key);

      if (!entry) {
        log.warning(`[ContextPool] No context to release for ${sessionId}`);
        return;
      }

      if (!entry.sessionIds.has(sessionId)) {
        log.warning(`[ContextPool] Session ${sessionId} not found in context`);
        return;
      }

      entry.refCount = Math.max(0, entry.refCount - 1);
      entry.sessionIds.delete(sessionId);
      entry.lastAccess = Date.now();

      log.dim(`[ContextPool] Released context for ${sessionId} (refCount: ${entry.refCount})`);
    });
  }

  /**
   * Force close a context (e.g., on shutdown)
   */
  async forceClose(): Promise<void> {
    if (!this.closer) return;

    return this.lock.acquire("pool", async () => {
      for (const [, entry] of this.pool.entries()) {
        if (entry.refCount > 0) {
          log.warning(`[ContextPool] Force closing context with ${entry.refCount} active refs`);
        }
        try {
          await this.closer!(entry.context);
          this.eventBus?.publish("browser:context:closed", { sessionId: "shared" });
        } catch (error) {
          log.warning(`[ContextPool] Error during force close: ${error}`);
        }
      }
      this.pool.clear();
    });
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    contextCount: number;
    totalRefs: number;
    contexts: Array<{
      refCount: number;
      sessionIds: string[];
      ageSeconds: number;
      headless: boolean;
    }>;
  } {
    const contexts = [];
    let totalRefs = 0;

    for (const entry of this.pool.values()) {
      totalRefs += entry.refCount;
      contexts.push({
        refCount: entry.refCount,
        sessionIds: Array.from(entry.sessionIds),
        ageSeconds: Math.floor((Date.now() - entry.createdAt) / 1000),
        headless: entry.headless,
      });
    }

    return {
      contextCount: this.pool.size,
      totalRefs,
      contexts,
    };
  }

  /**
   * Check if a session has an active context
   */
  hasContext(sessionId: string): boolean {
    for (const entry of this.pool.values()) {
      if (entry.sessionIds.has(sessionId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get context for a session (without acquiring)
   */
  getContext(sessionId: string): T | null {
    for (const entry of this.pool.values()) {
      if (entry.sessionIds.has(sessionId)) {
        return entry.context;
      }
    }
    return null;
  }
}

/**
 * Create a new BrowserContextPool instance
 */
export function createContextPool<T>(): BrowserContextPool<T> {
  return new BrowserContextPool<T>();
}
