/**
 * Capa de abstracción de proveedor LLM genérico (ver docs/ALCANCE_MVP.md §4.1).
 * Se usa para: extracción de comprobantes (visión), policy compiler y
 * escalamiento Nivel 3. Nunca se usa para JEV (eso va por Jev/TypeSafe).
 */

export interface LlmImageInput {
  /** Datos de la imagen en base64, sin el prefijo `data:...;base64,`. */
  data: string;
  mimeType: string;
}

export interface LlmStructuredRequest {
  /** Instrucción de sistema / rol del modelo. */
  systemInstruction?: string;
  /** Prompt principal en lenguaje natural. */
  prompt: string;
  /** Imágenes opcionales (para extracción de comprobantes). */
  images?: LlmImageInput[];
  /** Nombre corto del schema, usado por proveedores que lo requieren. */
  schemaName: string;
  /** JSON Schema que debe cumplir la respuesta. */
  schema: Record<string, unknown>;
}

export interface LlmStructuredResult<T> {
  data: T;
  provider: "openai" | "gemini";
  model: string;
  latencyMs: number;
}

export interface LlmProvider {
  readonly name: "openai" | "gemini";
  generateStructured<T>(request: LlmStructuredRequest): Promise<LlmStructuredResult<T>>;
}
