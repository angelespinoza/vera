import { GoogleGenAI, createPartFromBase64, type ContentListUnion } from "@google/genai";
import type {
  LlmProvider,
  LlmStructuredRequest,
  LlmStructuredResult,
} from "./types";

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

export class GeminiProvider implements LlmProvider {
  readonly name = "gemini" as const;
  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey = process.env.GEMINI_API_KEY, model = DEFAULT_MODEL) {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY no está configurada.");
    }
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async generateStructured<T>(
    request: LlmStructuredRequest,
  ): Promise<LlmStructuredResult<T>> {
    const start = Date.now();

    const contents: ContentListUnion = [request.prompt];
    for (const image of request.images ?? []) {
      contents.push(createPartFromBase64(image.data, image.mimeType));
    }

    const response = await this.client.models.generateContent({
      model: this.model,
      contents,
      config: {
        systemInstruction: request.systemInstruction,
        responseMimeType: "application/json",
        responseJsonSchema: request.schema,
      },
    });

    const data = JSON.parse(response.text ?? "{}") as T;

    return {
      data,
      provider: this.name,
      model: this.model,
      latencyMs: Date.now() - start,
      inputTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
    };
  }
}
