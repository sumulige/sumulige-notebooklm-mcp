/**
 * Response Observer
 *
 * Uses MutationObserver to detect DOM changes instead of polling.
 * Much more efficient than the 1Hz polling approach.
 *
 * Key Features:
 * - Event-driven DOM change detection
 * - Stability debouncing (waits for streaming to complete)
 * - Thinking state detection
 * - Memory-efficient hash comparison
 * - **Streaming support** (incremental text delivery)
 */

import type { IPage } from "../../core/ports/browser-port.js";
import { log } from "../../utils/logger.js";

/**
 * Observer options
 */
export interface ResponseObserverOptions {
  readonly timeoutMs?: number;
  readonly stabilityDelayMs?: number;
  readonly ignoreTexts?: readonly string[];
  readonly question?: string;
  readonly debug?: boolean;
}

/**
 * Streaming options (extends base options)
 */
export interface StreamingObserverOptions extends ResponseObserverOptions {
  /** Minimum interval between stream chunks (ms) */
  readonly minIntervalMs?: number;
  /** Maximum random jitter to add (ms) */
  readonly maxJitterMs?: number;
  /** Chunk size (characters per emission, 0 = character-by-character) */
  readonly chunkSize?: number;
}

/**
 * Stream callback for incremental text delivery
 */
export type StreamCallback = (chunk: string, fullText: string) => void | Promise<void>;

/**
 * Observer result
 */
export interface ObserverResult {
  readonly success: boolean;
  readonly response?: string;
  readonly error?: string;
  readonly durationMs: number;
  readonly pollCount?: number;
}

/**
 * Streaming result (extends base result)
 */
export interface StreamingResult extends ObserverResult {
  /** Total characters streamed */
  readonly totalChars?: number;
  /** Number of chunks emitted */
  readonly chunkCount?: number;
}

/**
 * Hash function for efficient text comparison
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash;
}

/**
 * Response Observer
 *
 * Observes DOM changes using MutationObserver for efficient response detection.
 */
export class ResponseObserver {
  /**
   * Wait for a new response using MutationObserver
   */
  async waitForResponse(
    page: IPage,
    options: ResponseObserverOptions = {}
  ): Promise<ObserverResult> {
    const {
      timeoutMs = 120000,
      stabilityDelayMs = 500,
      ignoreTexts = [],
      question = "",
      debug = false,
    } = options;

    const startTime = Date.now();

    // Build set of known hashes
    const knownHashes = new Set<number>();
    for (const text of ignoreTexts) {
      if (text.trim()) {
        knownHashes.add(hashString(text.trim()));
      }
    }

    const sanitizedQuestion = question.trim().toLowerCase();

    try {
      // Inject MutationObserver script and wait for response
      const response = await page.evaluate(`
        (async function() {
          const TIMEOUT_MS = ${timeoutMs};
          const STABILITY_DELAY_MS = ${stabilityDelayMs};
          const KNOWN_HASHES = new Set(${JSON.stringify(Array.from(knownHashes))});
          const SANITIZED_QUESTION = ${JSON.stringify(sanitizedQuestion)};
          const DEBUG = ${debug};

          // Hash function
          function hashString(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
              const char = str.charCodeAt(i);
              hash = (hash << 5) - hash + char;
              hash = hash & hash;
            }
            return hash;
          }

          // Extract response text from container
          function extractResponseText() {
            const containers = document.querySelectorAll('.to-user-container');
            for (let i = containers.length - 1; i >= 0; i--) {
              const container = containers[i];
              const textEl = container.querySelector('.message-text-content');
              if (textEl) {
                const text = textEl.innerText?.trim();
                if (text && text.length > 0) {
                  const hash = hashString(text);
                  if (!KNOWN_HASHES.has(hash)) {
                    // Check if it's the question echo
                    if (text.toLowerCase() !== SANITIZED_QUESTION) {
                      return text;
                    }
                  }
                }
              }
            }
            return null;
          }

          // Check if still thinking
          function isThinking() {
            const thinkingEl = document.querySelector('div.thinking-message');
            if (thinkingEl) {
              const style = window.getComputedStyle(thinkingEl);
              return style.display !== 'none' && style.visibility !== 'hidden';
            }
            return false;
          }

          return new Promise((resolve, reject) => {
            const startTime = Date.now();
            let lastText = null;
            let stabilityTimer = null;
            let observer = null;

            // Cleanup function
            const cleanup = () => {
              if (observer) {
                observer.disconnect();
                observer = null;
              }
              if (stabilityTimer) {
                clearTimeout(stabilityTimer);
                stabilityTimer = null;
              }
            };

            // Timeout handler
            const timeoutId = setTimeout(() => {
              cleanup();
              resolve({ success: false, error: 'Timeout waiting for response' });
            }, TIMEOUT_MS);

            // Check for response and handle stability
            const checkResponse = () => {
              // If still thinking, wait
              if (isThinking()) {
                if (DEBUG) console.log('[Observer] Still thinking...');
                return;
              }

              const text = extractResponseText();
              if (text) {
                if (text === lastText) {
                  // Text is stable, start/continue stability timer
                  if (!stabilityTimer) {
                    if (DEBUG) console.log('[Observer] Text detected, waiting for stability...');
                    stabilityTimer = setTimeout(() => {
                      // Text has been stable for stabilityDelayMs
                      clearTimeout(timeoutId);
                      cleanup();
                      resolve({ success: true, response: text });
                    }, STABILITY_DELAY_MS);
                  }
                } else {
                  // Text changed, reset stability timer
                  if (stabilityTimer) {
                    clearTimeout(stabilityTimer);
                    stabilityTimer = null;
                  }
                  lastText = text;
                  if (DEBUG) console.log('[Observer] Text changed:', text.substring(0, 50) + '...');
                }
              }
            };

            // Create MutationObserver
            observer = new MutationObserver((mutations) => {
              // Debounce rapid mutations
              checkResponse();
            });

            // Start observing
            const targetNode = document.body;
            observer.observe(targetNode, {
              childList: true,
              subtree: true,
              characterData: true,
              attributes: true,
              attributeFilter: ['class', 'style']
            });

            // Initial check
            checkResponse();

            // Also poll occasionally as a fallback (every 2 seconds)
            const pollInterval = setInterval(() => {
              checkResponse();
            }, 2000);

            // Store interval for cleanup
            const originalCleanup = cleanup;
            cleanup = () => {
              clearInterval(pollInterval);
              originalCleanup();
            };
          });
        })()
      `);

      const result = response as { success: boolean; response?: string; error?: string };

      return {
        success: result.success,
        response: result.response,
        error: result.error,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`[ResponseObserver] Error: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Wait for response with streaming (incremental text delivery)
   *
   * Unlike waitForResponse which waits for completion,
   * this method emits text chunks as they arrive.
   */
  async streamResponse(
    page: IPage,
    onChunk: StreamCallback,
    options: StreamingObserverOptions = {}
  ): Promise<StreamingResult> {
    const {
      timeoutMs = 120000,
      stabilityDelayMs = 500,
      ignoreTexts = [],
      question = "",
      debug = false,
      minIntervalMs = 100,
      maxJitterMs = 50,
      chunkSize = 0,
    } = options;

    const startTime = Date.now();
    let emittedLength = 0;
    let chunkCount = 0;
    let lastEmitTime = 0;

    // Build set of known hashes
    const knownHashes = new Set<number>();
    for (const text of ignoreTexts) {
      if (text.trim()) {
        knownHashes.add(hashString(text.trim()));
      }
    }

    const sanitizedQuestion = question.trim().toLowerCase();

    try {
      // Use a polling approach for streaming to enable incremental callbacks
      const result = await new Promise<{ success: boolean; response?: string; error?: string }>(
        async (resolve) => {
          let lastText = "";
          let stableCount = 0;
          const requiredStableChecks = Math.ceil(stabilityDelayMs / 100);

          const timeoutId = setTimeout(() => {
            resolve({ success: false, error: "Timeout waiting for response" });
          }, timeoutMs);

          // Helper to add jitter
          const getJitter = () => Math.floor(Math.random() * maxJitterMs);

          // Helper to emit chunk with rate limiting
          const emitChunk = async (newText: string) => {
            if (newText.length <= emittedLength) return;

            const now = Date.now();
            const elapsed = now - lastEmitTime;
            const interval = minIntervalMs + getJitter();

            // Rate limit emissions
            if (elapsed < interval && lastEmitTime > 0) {
              return; // Skip this emission, next poll will catch it
            }

            // Extract new content
            const newContent = newText.slice(emittedLength);

            if (chunkSize > 0) {
              // Emit in fixed chunks
              const chunks = Math.ceil(newContent.length / chunkSize);
              for (let i = 0; i < chunks; i++) {
                const start = i * chunkSize;
                const chunk = newContent.slice(start, start + chunkSize);
                if (chunk) {
                  try {
                    await onChunk(chunk, newText.slice(0, emittedLength + start + chunk.length));
                    chunkCount++;
                  } catch (err) {
                    if (debug) log.warning(`[StreamObserver] Chunk callback error: ${err}`);
                  }

                  // Add delay between chunks for safety
                  if (i < chunks - 1) {
                    await new Promise((r) => setTimeout(r, minIntervalMs + getJitter()));
                  }
                }
              }
            } else {
              // Character-by-character streaming
              for (let i = 0; i < newContent.length; i++) {
                const char = newContent[i];
                try {
                  await onChunk(char, newText.slice(0, emittedLength + i + 1));
                  chunkCount++;
                } catch (err) {
                  if (debug) log.warning(`[StreamObserver] Chunk callback error: ${err}`);
                }

                // Micro-delay for character streaming (human-like)
                if (i < newContent.length - 1) {
                  const charDelay = 10 + Math.floor(Math.random() * 20);
                  await new Promise((r) => setTimeout(r, charDelay));
                }
              }
            }

            emittedLength = newText.length;
            lastEmitTime = Date.now();
          };

          // Poll for text changes
          const poll = async () => {
            try {
              // Check thinking state
              const isThinking = await this.isThinking(page);
              if (isThinking) {
                if (debug) log.dim("[StreamObserver] Still thinking...");
                stableCount = 0;
                return;
              }

              // Extract current text
              const currentText = await page.evaluate(`
                (function() {
                  const KNOWN_HASHES = new Set(${JSON.stringify(Array.from(knownHashes))});
                  const SANITIZED_QUESTION = ${JSON.stringify(sanitizedQuestion)};

                  function hashString(str) {
                    let hash = 0;
                    for (let i = 0; i < str.length; i++) {
                      const char = str.charCodeAt(i);
                      hash = (hash << 5) - hash + char;
                      hash = hash & hash;
                    }
                    return hash;
                  }

                  const containers = document.querySelectorAll('.to-user-container');
                  for (let i = containers.length - 1; i >= 0; i--) {
                    const container = containers[i];
                    const textEl = container.querySelector('.message-text-content');
                    if (textEl) {
                      const text = textEl.innerText?.trim();
                      if (text && text.length > 0) {
                        const hash = hashString(text);
                        if (!KNOWN_HASHES.has(hash)) {
                          if (text.toLowerCase() !== SANITIZED_QUESTION) {
                            return text;
                          }
                        }
                      }
                    }
                  }
                  return null;
                })()
              `) as string | null;

              if (currentText) {
                // Emit new content
                await emitChunk(currentText);

                // Check stability
                if (currentText === lastText) {
                  stableCount++;
                  if (debug) {
                    log.dim(`[StreamObserver] Stability check ${stableCount}/${requiredStableChecks}`);
                  }
                  if (stableCount >= requiredStableChecks) {
                    clearTimeout(timeoutId);
                    resolve({ success: true, response: currentText });
                    return;
                  }
                } else {
                  stableCount = 0;
                  lastText = currentText;
                }
              }
            } catch (err) {
              if (debug) log.warning(`[StreamObserver] Poll error: ${err}`);
            }
          };

          // Start polling at 100ms intervals
          const pollInterval = setInterval(poll, 100);

          // Initial poll
          await poll();

          // Cleanup on resolve
          const originalResolve = resolve;
          const wrappedResolve = (value: { success: boolean; response?: string; error?: string }) => {
            clearInterval(pollInterval);
            clearTimeout(timeoutId);
            originalResolve(value);
          };

          // Replace resolve with wrapped version
          // Note: This is a bit hacky but works for our use case
          (resolve as typeof wrappedResolve) = wrappedResolve;
        }
      );

      return {
        success: result.success,
        response: result.response,
        error: result.error,
        durationMs: Date.now() - startTime,
        totalChars: emittedLength,
        chunkCount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`[StreamObserver] Error: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        durationMs: Date.now() - startTime,
        totalChars: emittedLength,
        chunkCount,
      };
    }
  }

  /**
   * Snapshot all current responses
   */
  async snapshotResponses(page: IPage): Promise<string[]> {
    try {
      const responses = await page.evaluate(`
        (function() {
          const texts = [];
          const containers = document.querySelectorAll('.to-user-container');
          for (const container of containers) {
            const textEl = container.querySelector('.message-text-content');
            if (textEl) {
              const text = textEl.innerText?.trim();
              if (text) {
                texts.push(text);
              }
            }
          }
          return texts;
        })()
      `);

      return (responses as string[]) ?? [];
    } catch (error) {
      log.warning(`[ResponseObserver] Failed to snapshot: ${error}`);
      return [];
    }
  }

  /**
   * Check if page is in thinking state
   */
  async isThinking(page: IPage): Promise<boolean> {
    try {
      const thinking = await page.evaluate(`
        (function() {
          const el = document.querySelector('div.thinking-message');
          if (el) {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
          }
          return false;
        })()
      `);

      return thinking as boolean;
    } catch {
      return false;
    }
  }
}

/**
 * Create a new ResponseObserver instance
 */
export function createResponseObserver(): ResponseObserver {
  return new ResponseObserver();
}
