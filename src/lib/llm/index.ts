import type { LlmProvider } from "./types";
import { OpenAiProvider } from "./openai";
import { GeminiProvider } from "./gemini";

export type { LlmProvider, LlmStructuredRequest, LlmStructuredResult, LlmImageInput } from "./types";

/**
 * Proveedor LLM genérico activo, seleccionado por variable de entorno
 * `LLM_PROVIDER` ("openai" | "gemini"). Ver docs/ALCANCE_MVP.md §4.1:
 * se elige el que tenga créditos disponibles, sin reescribir código.
 */
export function getLlmProvider(): LlmProvider {
  const provider = process.env.LLM_PROVIDER?.toLowerCase();

  switch (provider) {
    case "openai":
      return new OpenAiProvider();
    case "gemini":
      return new GeminiProvider();
    default:
      throw new Error(
        `LLM_PROVIDER inválido o no configurado: "${process.env.LLM_PROVIDER}". Usa "openai" o "gemini".`,
      );
  }
}
