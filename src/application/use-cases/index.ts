/**
 * Use Cases Module
 *
 * Exports application use cases.
 */

export {
  AskQuestionUseCase,
  createAskQuestionUseCase,
} from "./ask-question.js";
export type {
  AskQuestionInput,
  AskQuestionOutput,
  AskQuestionDeps,
} from "./ask-question.js";

export {
  SetupAuthUseCase,
  createSetupAuthUseCase,
} from "./setup-auth.js";
export type {
  SetupAuthInput,
  SetupAuthOutput,
  SetupAuthDeps,
} from "./setup-auth.js";
