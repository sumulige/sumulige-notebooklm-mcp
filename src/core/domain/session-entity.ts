/**
 * Session Entity
 *
 * Immutable value object representing a NotebookLM chat session.
 * All modifications return new instances.
 *
 * Key Features:
 * - Immutable state (all fields readonly)
 * - Value object semantics
 * - Rich domain methods
 * - Serializable for persistence
 */

/**
 * Message in a session
 */
export interface SessionMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly timestamp: number;
}

/**
 * Session status
 */
export type SessionStatus =
  | "idle"           // Ready for messages
  | "processing"     // Processing a message
  | "waiting"        // Waiting for response
  | "error"          // Error state
  | "closed";        // Session closed

/**
 * Session configuration
 */
export interface SessionConfig {
  readonly notebookUrl: string;
  readonly headless: boolean;
  readonly timeout: number;
}

/**
 * Session state snapshot
 */
export interface SessionSnapshot {
  readonly id: string;
  readonly config: SessionConfig;
  readonly status: SessionStatus;
  readonly messages: readonly SessionMessage[];
  readonly createdAt: number;
  readonly lastActivityAt: number;
  readonly errorMessage?: string;
}

/**
 * Session Entity
 *
 * Represents a chat session with a NotebookLM notebook.
 * Immutable - all modifications return new instances.
 */
export class SessionEntity {
  readonly id: string;
  readonly config: SessionConfig;
  readonly status: SessionStatus;
  readonly messages: readonly SessionMessage[];
  readonly createdAt: number;
  readonly lastActivityAt: number;
  readonly errorMessage?: string;

  private constructor(snapshot: SessionSnapshot) {
    this.id = snapshot.id;
    this.config = Object.freeze({ ...snapshot.config });
    this.status = snapshot.status;
    this.messages = Object.freeze([...snapshot.messages]);
    this.createdAt = snapshot.createdAt;
    this.lastActivityAt = snapshot.lastActivityAt;
    this.errorMessage = snapshot.errorMessage;
    Object.freeze(this);
  }

  /**
   * Create a new session
   */
  static create(id: string, config: SessionConfig): SessionEntity {
    const now = Date.now();
    return new SessionEntity({
      id,
      config,
      status: "idle",
      messages: [],
      createdAt: now,
      lastActivityAt: now,
    });
  }

  /**
   * Restore a session from a snapshot
   */
  static fromSnapshot(snapshot: SessionSnapshot): SessionEntity {
    return new SessionEntity(snapshot);
  }

  /**
   * Get session age in seconds
   */
  get ageSeconds(): number {
    return Math.floor((Date.now() - this.createdAt) / 1000);
  }

  /**
   * Get inactive time in seconds
   */
  get inactiveSeconds(): number {
    return Math.floor((Date.now() - this.lastActivityAt) / 1000);
  }

  /**
   * Get message count
   */
  get messageCount(): number {
    return this.messages.length;
  }

  /**
   * Check if session is active (not closed/error)
   */
  get isActive(): boolean {
    return this.status !== "closed" && this.status !== "error";
  }

  /**
   * Check if session can accept new messages
   */
  get canAcceptMessage(): boolean {
    return this.status === "idle";
  }

  /**
   * Start processing a user message
   */
  startProcessing(userMessage: string): SessionEntity {
    if (!this.canAcceptMessage) {
      throw new Error(`Cannot process message in status: ${this.status}`);
    }

    const message: SessionMessage = {
      role: "user",
      content: userMessage,
      timestamp: Date.now(),
    };

    return new SessionEntity({
      ...this.toSnapshot(),
      status: "processing",
      messages: [...this.messages, message],
      lastActivityAt: Date.now(),
    });
  }

  /**
   * Transition to waiting for response
   */
  startWaiting(): SessionEntity {
    if (this.status !== "processing") {
      throw new Error(`Cannot wait in status: ${this.status}`);
    }

    return new SessionEntity({
      ...this.toSnapshot(),
      status: "waiting",
      lastActivityAt: Date.now(),
    });
  }

  /**
   * Complete with assistant response
   */
  completeWithResponse(response: string): SessionEntity {
    if (this.status !== "waiting" && this.status !== "processing") {
      throw new Error(`Cannot complete in status: ${this.status}`);
    }

    const message: SessionMessage = {
      role: "assistant",
      content: response,
      timestamp: Date.now(),
    };

    return new SessionEntity({
      ...this.toSnapshot(),
      status: "idle",
      messages: [...this.messages, message],
      lastActivityAt: Date.now(),
      errorMessage: undefined,
    });
  }

  /**
   * Mark session as error
   */
  markError(error: string): SessionEntity {
    return new SessionEntity({
      ...this.toSnapshot(),
      status: "error",
      lastActivityAt: Date.now(),
      errorMessage: error,
    });
  }

  /**
   * Reset session (clear messages, return to idle)
   */
  reset(): SessionEntity {
    return new SessionEntity({
      ...this.toSnapshot(),
      status: "idle",
      messages: [],
      lastActivityAt: Date.now(),
      errorMessage: undefined,
    });
  }

  /**
   * Close session
   */
  close(): SessionEntity {
    return new SessionEntity({
      ...this.toSnapshot(),
      status: "closed",
      lastActivityAt: Date.now(),
    });
  }

  /**
   * Update activity timestamp
   */
  touch(): SessionEntity {
    return new SessionEntity({
      ...this.toSnapshot(),
      lastActivityAt: Date.now(),
    });
  }

  /**
   * Get conversation history as formatted string
   */
  getConversationHistory(): string {
    return this.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n\n");
  }

  /**
   * Get last N messages
   */
  getLastMessages(count: number): readonly SessionMessage[] {
    return this.messages.slice(-count);
  }

  /**
   * Export to snapshot for serialization
   */
  toSnapshot(): SessionSnapshot {
    return {
      id: this.id,
      config: this.config,
      status: this.status,
      messages: this.messages,
      createdAt: this.createdAt,
      lastActivityAt: this.lastActivityAt,
      errorMessage: this.errorMessage,
    };
  }

  /**
   * Export for API response
   */
  toInfo(): {
    id: string;
    created_at: number;
    last_activity: number;
    age_seconds: number;
    inactive_seconds: number;
    message_count: number;
    notebook_url: string;
    status: SessionStatus;
  } {
    return {
      id: this.id,
      created_at: this.createdAt,
      last_activity: this.lastActivityAt,
      age_seconds: this.ageSeconds,
      inactive_seconds: this.inactiveSeconds,
      message_count: this.messageCount,
      notebook_url: this.config.notebookUrl,
      status: this.status,
    };
  }
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `session-${timestamp}-${random}`;
}
