import { narrateStream } from '../llm/narrator.js';

/**
 * Thin pass-through to the LLM narrator's streaming generator.
 * Keeps the LLM layer decoupled from Express request/response handling.
 */
export function streamNarration({ query, action, result, messages }) {
  return narrateStream({ query, action, result, messages });
}
