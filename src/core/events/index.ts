/**
 * Events Module
 *
 * Exports event bus and domain event types.
 */

export { EventBus, createEventBus } from "./event-bus.js";

export type {
  EventCategory,
  DomainEvents,
  EventType,
  EventPayload,
  EventHandler,
  EventMetadata,
  EventHistoryEntry,
} from "./event-bus.js";
