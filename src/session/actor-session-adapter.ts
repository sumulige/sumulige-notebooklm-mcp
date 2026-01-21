/**
 * Actor Session Adapter
 *
 * Bridges the SessionActor (new architecture) with BrowserSession (existing).
 * Provides Actor model benefits while reusing existing browser interaction logic.
 *
 * Key Benefits:
 * - Sequential message processing (no race conditions)
 * - State encapsulation via SessionEntity
 * - Event emission for observers
 * - Backward compatible with existing tools
 */

import { BrowserSession } from "./browser-session.js";
import { SharedContextManager } from "./shared-context-manager.js";
import { AuthManager } from "../auth/auth-manager.js";
import {
  SessionActor,
  createSessionActor,
  EventBus,
  SessionEntity,
  type QuestionHandler,
  type SessionConfig,
} from "../core/index.js";
import { log } from "../utils/logger.js";
import type { SessionInfo, ProgressCallback, ResponseStreamCallback } from "../types.js";
import type { StreamingResult } from "../utils/page-utils.js";

/**
 * Actor-managed session that wraps BrowserSession
 *
 * Uses SessionActor for state management and message queuing,
 * while delegating browser interactions to BrowserSession.
 */
export class ActorSessionAdapter {
  private readonly actor: SessionActor;
  private readonly browserSession: BrowserSession;
  private currentProgress?: ProgressCallback;

  constructor(
    sessionId: string,
    sharedContextManager: SharedContextManager,
    authManager: AuthManager,
    notebookUrl: string,
    eventBus?: EventBus
  ) {
    // Create SessionActor with config
    const config: SessionConfig = {
      notebookUrl,
      headless: true,
      timeout: 120000,
    };
    this.actor = createSessionActor(sessionId, config);

    // Create underlying BrowserSession
    this.browserSession = new BrowserSession(
      sessionId,
      sharedContextManager,
      authManager,
      notebookUrl
    );

    // Set up question handler that delegates to BrowserSession
    this.actor.setQuestionHandler(this.createQuestionHandler());

    // Connect EventBus if provided
    if (eventBus) {
      this.actor.setEventBus(eventBus);
    }

    // Log state changes
    this.actor.on("stateChanged", (newState, oldState) => {
      log.info(`🎭 [${sessionId}] State: ${oldState.status} → ${newState.status}`);
    });

    log.info(`🎭 ActorSessionAdapter ${sessionId} created`);
  }

  /**
   * Create question handler that delegates to BrowserSession
   */
  private createQuestionHandler(): QuestionHandler {
    return async (_session: SessionEntity, question: string): Promise<string> => {
      // Delegate to BrowserSession.ask()
      return this.browserSession.ask(question, this.currentProgress);
    };
  }

  /**
   * Initialize the session
   */
  async init(): Promise<void> {
    await this.browserSession.init();
  }

  /**
   * Ask a question (goes through Actor queue)
   */
  async ask(question: string, sendProgress?: ProgressCallback): Promise<string> {
    // Store progress callback for use in handler
    this.currentProgress = sendProgress;

    try {
      // Use actor's ask method (ensures sequential processing)
      return await this.actor.ask(question);
    } finally {
      this.currentProgress = undefined;
    }
  }

  /**
   * Ask a question with streaming response (goes through Actor queue)
   */
  async askWithStreaming(
    question: string,
    onChunk: ResponseStreamCallback,
    options?: {
      sendProgress?: ProgressCallback;
      minIntervalMs?: number;
      maxJitterMs?: number;
      chunkSize?: number;
    }
  ): Promise<StreamingResult> {
    const { sendProgress, ...streamOptions } = options ?? {};
    this.currentProgress = sendProgress;

    try {
      // For streaming, we delegate directly to BrowserSession
      // The Actor ensures sequential processing of messages
      return await this.browserSession.askWithStreaming(question, onChunk, {
        sendProgress,
        ...streamOptions,
      });
    } finally {
      this.currentProgress = undefined;
    }
  }

  /**
   * Reset the session
   */
  async reset(): Promise<void> {
    // Reset actor state
    await this.actor.reset();

    // Reset browser session
    await this.browserSession.reset();
  }

  /**
   * Close the session
   */
  async close(): Promise<void> {
    // Close actor
    await this.actor.close();

    // Close browser session
    await this.browserSession.close();
  }

  /**
   * Update activity timestamp
   */
  updateActivity(): void {
    this.actor.touch();
    this.browserSession.updateActivity();
  }

  /**
   * Check if session has expired
   */
  isExpired(timeoutSeconds: number): boolean {
    return this.browserSession.isExpired(timeoutSeconds);
  }

  /**
   * Get session information (combines actor and browser session info)
   */
  getInfo(): SessionInfo {
    const browserInfo = this.browserSession.getInfo();
    const actorState = this.actor.getState();

    return {
      ...browserInfo,
      // Add actor state info
      status: actorState.status,
      pending_messages: this.actor.pendingMessages,
    } as SessionInfo;
  }

  /**
   * Get the underlying BrowserSession (for advanced operations)
   */
  getBrowserSession(): BrowserSession {
    return this.browserSession;
  }

  /**
   * Get the SessionActor (for advanced operations)
   */
  getActor(): SessionActor {
    return this.actor;
  }

  /**
   * Get session ID
   */
  get sessionId(): string {
    return this.browserSession.sessionId;
  }

  /**
   * Get notebook URL
   */
  get notebookUrl(): string {
    return this.browserSession.notebookUrl;
  }

  /**
   * Get created timestamp
   */
  get createdAt(): number {
    return this.browserSession.createdAt;
  }

  /**
   * Get last activity timestamp
   */
  get lastActivity(): number {
    return this.browserSession.lastActivity;
  }

  /**
   * Get message count
   */
  get messageCount(): number {
    return this.browserSession.messageCount;
  }

  /**
   * Check if session is initialized
   */
  isInitialized(): boolean {
    return this.browserSession.isInitialized();
  }

  /**
   * Check if actor is active
   */
  get isActive(): boolean {
    return this.actor.isActive;
  }
}

/**
 * Create an ActorSessionAdapter
 */
export function createActorSession(
  sessionId: string,
  sharedContextManager: SharedContextManager,
  authManager: AuthManager,
  notebookUrl: string,
  eventBus?: EventBus
): ActorSessionAdapter {
  return new ActorSessionAdapter(
    sessionId,
    sharedContextManager,
    authManager,
    notebookUrl,
    eventBus
  );
}
