/**
 * Ask Question Use Case
 *
 * Orchestrates the process of asking a question to NotebookLM.
 * Uses dependency injection for all external dependencies.
 *
 * Key Features:
 * - Clean separation from infrastructure
 * - Testable with mock dependencies
 * - Progress reporting support
 * - Error handling with domain events
 */

import { injectable } from "tsyringe";
import type { IBrowserPort, IPage } from "../../core/ports/browser-port.js";
import type { IAuthPort, AuthProgressCallback } from "../../core/ports/auth-port.js";
import type { EventBus } from "../../core/events/event-bus.js";

/**
 * Ask question input
 */
export interface AskQuestionInput {
  readonly sessionId: string;
  readonly question: string;
  readonly notebookUrl: string;
  readonly headless?: boolean;
}

/**
 * Ask question output
 */
export interface AskQuestionOutput {
  readonly success: boolean;
  readonly sessionId: string;
  readonly response?: string;
  readonly error?: string;
  readonly durationMs: number;
}

/**
 * Dependencies interface
 */
export interface AskQuestionDeps {
  browserPort: IBrowserPort;
  authPort: IAuthPort;
  eventBus?: EventBus;
}

/**
 * Ask Question Use Case
 *
 * Handles the business logic of asking questions.
 * Infrastructure concerns are delegated to ports.
 */
@injectable()
export class AskQuestionUseCase {
  private browserPort?: IBrowserPort;
  private authPort?: IAuthPort;
  private eventBus?: EventBus;

  /**
   * Configure dependencies (for manual DI)
   */
  configure(deps: AskQuestionDeps): void {
    this.browserPort = deps.browserPort;
    this.authPort = deps.authPort;
    this.eventBus = deps.eventBus;
  }

  /**
   * Execute the use case
   */
  async execute(
    input: AskQuestionInput,
    progress?: AuthProgressCallback
  ): Promise<AskQuestionOutput> {
    const startTime = Date.now();

    if (!this.browserPort || !this.authPort) {
      return {
        success: false,
        sessionId: input.sessionId,
        error: "Use case not configured. Call configure() first.",
        durationMs: Date.now() - startTime,
      };
    }

    try {
      await progress?.("Starting question processing...", 0, 100);

      // Check authentication
      if (this.authPort.needsReauth()) {
        await progress?.("Authentication required...", 10, 100);
        const authResult = await this.authPort.setupAuth(input.headless, progress);
        if (!authResult.success) {
          return {
            success: false,
            sessionId: input.sessionId,
            error: `Authentication failed: ${authResult.message}`,
            durationMs: Date.now() - startTime,
          };
        }
      }

      await progress?.("Getting browser context...", 20, 100);

      // Get browser context
      const statePath = await this.authPort.getValidStatePath();
      const context = await this.browserPort.getSharedContext(input.sessionId, {
        headless: input.headless ?? true,
        storageState: statePath ?? undefined,
      });

      await progress?.("Navigating to notebook...", 30, 100);

      // Create page and navigate
      const page = await context.newPage();

      try {
        await page.goto(input.notebookUrl, { timeout: 30000 });

        await progress?.("Waiting for chat interface...", 40, 100);

        // Wait for chat input
        await page.waitForSelector('div[contenteditable="true"]', { timeout: 30000 });

        await progress?.("Typing question...", 50, 100);

        // Type question
        await page.click('div[contenteditable="true"]');
        await page.type('div[contenteditable="true"]', input.question, { delay: 50 });

        await progress?.("Submitting question...", 60, 100);

        // Submit (Enter key) - use string to avoid TypeScript DOM type issues
        await page.evaluate(`
          const event = new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true,
          });
          document.activeElement?.dispatchEvent(event);
        `);

        await progress?.("Waiting for response...", 70, 100);

        // Wait for response (simplified - real implementation would use MutationObserver)
        await page.waitForTimeout(2000);

        // Get response
        const response = await this.extractResponse(page);

        await progress?.("Response received", 100, 100);

        // Publish event
        this.eventBus?.publish("session:message", {
          sessionId: input.sessionId,
          role: "assistant",
          preview: response.substring(0, 100),
        });

        return {
          success: true,
          sessionId: input.sessionId,
          response,
          durationMs: Date.now() - startTime,
        };
      } finally {
        // Don't close page - keep for session reuse
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.eventBus?.publish("session:error", {
        sessionId: input.sessionId,
        error: errorMessage,
      });

      return {
        success: false,
        sessionId: input.sessionId,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Extract response from page
   * This is a simplified version - real implementation would be more robust
   */
  private async extractResponse(page: IPage): Promise<string> {
    try {
      // Try to find response element
      const responseSelector = 'div[data-message-role="assistant"]';
      const hasResponse = await page.querySelector(responseSelector);

      if (hasResponse) {
        const text = await page.textContent(responseSelector);
        return text ?? "No response content";
      }

      // Fallback to generic selector
      return "Response extraction pending - check browser";
    } catch (error) {
      return `Error extracting response: ${error}`;
    }
  }
}

/**
 * Create a configured AskQuestionUseCase
 */
export function createAskQuestionUseCase(deps: AskQuestionDeps): AskQuestionUseCase {
  const useCase = new AskQuestionUseCase();
  useCase.configure(deps);
  return useCase;
}
