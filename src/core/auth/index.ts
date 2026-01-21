/**
 * Core Auth Module
 *
 * Exports authentication state machine and related types.
 */

export {
  AuthStateMachine,
  createAuthStateMachine,
} from "./auth-state-machine.js";

export type {
  AuthState,
  AuthEvent,
  AuthEventPayloads,
  AuthStateMachineEvents,
} from "./auth-state-machine.js";
