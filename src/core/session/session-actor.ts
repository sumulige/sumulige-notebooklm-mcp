/**
 * Session Actor
 *
 * Implements the Actor model for session management.
 * Ensures sequential message processing without race conditions.
 *
 * Key Features:
 * - Async message queue
 * - Sequential processing (one message at a time)
 * - State encapsulation
 * - Event emission for observers
 */

import { EventEmitter } from "eventemitter3";
import AsyncLock from "async-lock";
import { SessionEntity, type SessionConfig } from "../domain/session-entity.js";
import type { EventBus } from "../events/event-bus.js";

/**
 * Actor message types
 */
export type ActorMessageType =
  | "ASK_QUESTION"
  | "RESET"
  | "CLOSE"
  | "TOUCH";

/**
 * Actor message payloads
 */
export interface ActorMessages {
  ASK_QUESTION: {
    question: string;
    resolve: (response: string) => void;
    reject: (error: Error) => void;
  };
  RESET: {
    resolve: () => void;
    reject: (error: Error) => void;
  };
  CLOSE: {
    resolve: () => void;
    reject: (error: Error) => void;
  };
  TOUCH: {
    resolve: () => void;
  };
}

/**
 * Actor message envelope
 */
interface MessageEnvelope<T extends ActorMessageType = ActorMessageType> {
  type: T;
  payload: ActorMessages[T];
  timestamp: number;
}

/**
 * Question handler function type
 */
export type QuestionHandler = (
  session: SessionEntity,
  question: string
) => Promise<string>;

/**
 * Session Actor events
 */
export interface SessionActorEvents {
  stateChanged: (newState: SessionEntity, oldState: SessionEntity) => void;
  messageQueued: (type: ActorMessageType) => void;
  messageProcessed: (type: ActorMessageType, durationMs: number) => void;
  error: (error: Error) => void;
}

/**
 * Session Actor
 *
 * Manages a session using the Actor model.
 * All state changes go through the message queue.
 */
export class SessionActor extends EventEmitter<SessionActorEvents> {
  private state: SessionEntity;
  private readonly lock = new AsyncLock();
  private questionHandler?: QuestionHandler;
  private eventBus?: EventBus;
  private processing = false;
  private queueLength = 0;

  constructor(id: string, config: SessionConfig) {
    super();
    this.state = SessionEntity.create(id, config);
  }

  /**
   * Set the question handler (browser interaction logic)
   */
  setQuestionHandler(handler: QuestionHandler): void {
    this.questionHandler = handler;
  }

  /**
   * Set event bus for domain events
   */
  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * Get current session state (read-only snapshot)
   */
  getState(): SessionEntity {
    return this.state;
  }

  /**
   * Get session ID
   */
  get id(): string {
    return this.state.id;
  }

  /**
   * Check if session is active
   */
  get isActive(): boolean {
    return this.state.isActive;
  }

  /**
   * Get queue length
   */
  get pendingMessages(): number {
    return this.queueLength;
  }

  /**
   * Ask a question (async, queued)
   */
  async ask(question: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.enqueue("ASK_QUESTION", { question, resolve, reject });
    });
  }

  /**
   * Reset session (async, queued)
   */
  async reset(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.enqueue("RESET", { resolve, reject });
    });
  }

  /**
   * Close session (async, queued)
   */
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.enqueue("CLOSE", { resolve, reject });
    });
  }

  /**
   * Touch session (update activity)
   */
  touch(): void {
    this.enqueue("TOUCH", { resolve: () => {} });
  }

  /**
   * Enqueue a message for processing
   */
  private enqueue<T extends ActorMessageType>(
    type: T,
    payload: ActorMessages[T]
  ): void {
    this.queueLength++;
    this.emit("messageQueued", type);

    // Process through lock to ensure sequential execution
    void this.lock.acquire("actor", async () => {
      await this.processMessage({ type, payload, timestamp: Date.now() });
      this.queueLength--;
    });
  }

  /**
   * Process a message
   */
  private async processMessage<T extends ActorMessageType>(
    envelope: MessageEnvelope<T>
  ): Promise<void> {
    const startTime = Date.now();
    this.processing = true;

    try {
      switch (envelope.type) {
        case "ASK_QUESTION":
          await this.handleAskQuestion(
            envelope.payload as ActorMessages["ASK_QUESTION"]
          );
          break;
        case "RESET":
          await this.handleReset(envelope.payload as ActorMessages["RESET"]);
          break;
        case "CLOSE":
          await this.handleClose(envelope.payload as ActorMessages["CLOSE"]);
          break;
        case "TOUCH":
          this.handleTouch();
          break;
      }

      const durationMs = Date.now() - startTime;
      this.emit("messageProcessed", envelope.type, durationMs);
    } catch (error) {
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.processing = false;
    }
  }

  /**
   * Handle ASK_QUESTION message
   */
  private async handleAskQuestion(
    payload: ActorMessages["ASK_QUESTION"]
  ): Promise<void> {
    const { question, resolve, reject } = payload;

    if (!this.questionHandler) {
      reject(new Error("No question handler configured"));
      return;
    }

    if (!this.state.canAcceptMessage) {
      reject(new Error(`Session cannot accept messages in status: ${this.state.status}`));
      return;
    }

    const oldState = this.state;

    try {
      // Start processing
      this.state = this.state.startProcessing(question);
      this.emitStateChange(oldState);

      this.eventBus?.publish("session:message", {
        sessionId: this.id,
        role: "user",
        preview: question.substring(0, 100),
      });

      // Wait for response
      this.state = this.state.startWaiting();
      this.emitStateChange(oldState);

      // Execute handler
      const response = await this.questionHandler(this.state, question);

      // Complete with response
      this.state = this.state.completeWithResponse(response);
      this.emitStateChange(oldState);

      this.eventBus?.publish("session:message", {
        sessionId: this.id,
        role: "assistant",
        preview: response.substring(0, 100),
      });

      resolve(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.state = this.state.markError(errorMessage);
      this.emitStateChange(oldState);

      this.eventBus?.publish("session:error", {
        sessionId: this.id,
        error: errorMessage,
      });

      reject(error instanceof Error ? error : new Error(errorMessage));
    }
  }

  /**
   * Handle RESET message
   */
  private async handleReset(payload: ActorMessages["RESET"]): Promise<void> {
    const { resolve } = payload;
    const oldState = this.state;

    this.state = this.state.reset();
    this.emitStateChange(oldState);

    resolve();
  }

  /**
   * Handle CLOSE message
   */
  private async handleClose(payload: ActorMessages["CLOSE"]): Promise<void> {
    const { resolve } = payload;
    const oldState = this.state;

    this.state = this.state.close();
    this.emitStateChange(oldState);

    this.eventBus?.publish("session:closed", {
      sessionId: this.id,
      reason: "manual close",
    });

    resolve();
  }

  /**
   * Handle TOUCH message
   */
  private handleTouch(): void {
    this.state = this.state.touch();
    // Don't emit state change for touch (too noisy)
  }

  /**
   * Emit state change event
   */
  private emitStateChange(oldState: SessionEntity): void {
    this.emit("stateChanged", this.state, oldState);
  }

  /**
   * Get actor info for debugging
   */
  getInfo(): {
    id: string;
    status: string;
    messageCount: number;
    queueLength: number;
    processing: boolean;
    ageSeconds: number;
    inactiveSeconds: number;
  } {
    return {
      id: this.id,
      status: this.state.status,
      messageCount: this.state.messageCount,
      queueLength: this.queueLength,
      processing: this.processing,
      ageSeconds: this.state.ageSeconds,
      inactiveSeconds: this.state.inactiveSeconds,
    };
  }
}

/**
 * Create a new SessionActor instance
 */
export function createSessionActor(id: string, config: SessionConfig): SessionActor {
  return new SessionActor(id, config);
}
