/**
 * Event Bus
 *
 * Central event bus for domain events.
 * Enables loose coupling between modules through publish/subscribe pattern.
 *
 * Key Features:
 * - Type-safe event definitions
 * - Async event handlers
 * - Event history for debugging
 * - Wildcard subscriptions
 */

import { EventEmitter } from "eventemitter3";
import { injectable } from "tsyringe";

/**
 * Domain Event Categories
 */
export type EventCategory =
  | "auth"
  | "session"
  | "browser"
  | "notebook"
  | "system"
  | "transport"
  | "usecase";

/**
 * Domain Events
 */
export interface DomainEvents {
  // Auth events
  "auth:started": { method: string };
  "auth:succeeded": { method: string; durationMs: number };
  "auth:failed": { reason: string };
  "auth:expired": { reason: string };
  "auth:cleared": { reason: string };

  // Session events
  "session:created": { sessionId: string; notebookUrl: string };
  "session:closed": { sessionId: string; reason: string };
  "session:message": { sessionId: string; role: "user" | "assistant"; preview: string };
  "session:error": { sessionId: string; error: string };
  "session:timeout": { sessionId: string };

  // Browser events
  "browser:initialized": { headless: boolean };
  "browser:context:created": { sessionId: string };
  "browser:context:closed": { sessionId: string };
  "browser:shutdown": { reason: string };
  "browser:error": { error: string };

  // Notebook events
  "notebook:added": { notebookId: string; name: string };
  "notebook:selected": { notebookId: string; name: string };
  "notebook:removed": { notebookId: string };

  // System events
  "system:startup": { version: string };
  "system:shutdown": { reason: string };
  "system:error": { error: string; context: string };
  "system:warning": { message: string; context: string };

  // Transport events
  "transport:started": { type: string; address: string; port: number };
  "transport:stopped": { type: string };

  // UseCase events
  "usecase:started": { useCase: string; input: Record<string, unknown> };
  "usecase:completed": { useCase: string; success: boolean; sessionId?: string };
  "usecase:failed": { useCase: string; error: string };
}

/**
 * Event type union
 */
export type EventType = keyof DomainEvents;

/**
 * Event payload for a specific event type
 */
export type EventPayload<T extends EventType> = DomainEvents[T];

/**
 * Event handler function
 */
export type EventHandler<T extends EventType> = (
  payload: EventPayload<T>,
  metadata: EventMetadata
) => void | Promise<void>;

/**
 * Event metadata
 */
export interface EventMetadata {
  readonly eventType: EventType;
  readonly timestamp: number;
  readonly correlationId?: string;
}

/**
 * Event history entry
 */
export interface EventHistoryEntry<T extends EventType = EventType> {
  readonly eventType: T;
  readonly payload: EventPayload<T>;
  readonly metadata: EventMetadata;
}

/**
 * Event Bus Implementation
 *
 * Central hub for domain events.
 */
@injectable()
export class EventBus {
  private readonly emitter = new EventEmitter();
  private readonly history: EventHistoryEntry[] = [];
  private readonly maxHistorySize = 100;
  private correlationId?: string;

  /**
   * Publish an event
   */
  async publish<T extends EventType>(
    eventType: T,
    payload: EventPayload<T>
  ): Promise<void> {
    const metadata: EventMetadata = {
      eventType,
      timestamp: Date.now(),
      correlationId: this.correlationId,
    };

    // Record in history
    this.recordHistory(eventType, payload, metadata);

    // Emit to specific subscribers
    this.emitter.emit(eventType, payload, metadata);

    // Emit to category subscribers (e.g., "auth:*")
    const category = eventType.split(":")[0] as EventCategory;
    this.emitter.emit(`${category}:*`, payload, metadata);

    // Emit to wildcard subscribers
    this.emitter.emit("*", payload, metadata);
  }

  /**
   * Subscribe to a specific event type
   */
  subscribe<T extends EventType>(
    eventType: T,
    handler: EventHandler<T>
  ): () => void {
    this.emitter.on(eventType, handler as (...args: unknown[]) => void);
    return () => {
      this.emitter.off(eventType, handler as (...args: unknown[]) => void);
    };
  }

  /**
   * Subscribe to all events in a category
   */
  subscribeToCategory(
    category: EventCategory,
    handler: EventHandler<EventType>
  ): () => void {
    const wildcardEvent = `${category}:*`;
    this.emitter.on(wildcardEvent, handler as (...args: unknown[]) => void);
    return () => {
      this.emitter.off(wildcardEvent, handler as (...args: unknown[]) => void);
    };
  }

  /**
   * Subscribe to all events
   */
  subscribeToAll(handler: EventHandler<EventType>): () => void {
    this.emitter.on("*", handler as (...args: unknown[]) => void);
    return () => {
      this.emitter.off("*", handler as (...args: unknown[]) => void);
    };
  }

  /**
   * Subscribe to an event once
   */
  once<T extends EventType>(
    eventType: T,
    handler: EventHandler<T>
  ): () => void {
    this.emitter.once(eventType, handler as (...args: unknown[]) => void);
    return () => {
      this.emitter.off(eventType, handler as (...args: unknown[]) => void);
    };
  }

  /**
   * Wait for a specific event
   */
  waitFor<T extends EventType>(
    eventType: T,
    timeoutMs?: number
  ): Promise<{ payload: EventPayload<T>; metadata: EventMetadata }> {
    return new Promise((resolve, reject) => {
      const cleanup = this.once(eventType, (payload, metadata) => {
        if (timer) clearTimeout(timer);
        resolve({ payload, metadata });
      });

      let timer: NodeJS.Timeout | undefined;
      if (timeoutMs) {
        timer = setTimeout(() => {
          cleanup();
          reject(new Error(`Timeout waiting for event: ${eventType}`));
        }, timeoutMs);
      }
    });
  }

  /**
   * Set correlation ID for event tracking
   */
  setCorrelationId(id: string | undefined): void {
    this.correlationId = id;
  }

  /**
   * Get event history
   */
  getHistory(limit?: number): readonly EventHistoryEntry[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Get events of a specific type from history
   */
  getHistoryByType<T extends EventType>(eventType: T): readonly EventHistoryEntry<T>[] {
    return this.history.filter(
      (entry) => entry.eventType === eventType
    ) as EventHistoryEntry<T>[];
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.history.length = 0;
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }

  /**
   * Get listener count for an event
   */
  listenerCount(eventType: EventType): number {
    return this.emitter.listenerCount(eventType);
  }

  private recordHistory<T extends EventType>(
    eventType: T,
    payload: EventPayload<T>,
    metadata: EventMetadata
  ): void {
    this.history.push({ eventType, payload, metadata } as EventHistoryEntry);

    // Trim history if needed
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }
}

/**
 * Create a new EventBus instance
 */
export function createEventBus(): EventBus {
  return new EventBus();
}
