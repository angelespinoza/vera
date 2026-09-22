import OpenAI from "openai";
import type {
  LlmProvider,
  LlmStructuredRequest,
  LlmStructuredResult,
} from "./types";

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.5";

export class OpenAiProvider implements LlmProvider {
  readonly name = "openai" as const;
  private client: OpenAI;
  private model: string;

  constructor(apiKey = process.env.OPENAI_API_KEY, model = DEFAULT_MODEL) {
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY no está configurada.");
    }
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generateStructured<T>(
    request: LlmStructuredRequest,
  ): Promise<LlmStructuredResult<T>> {
    const start = Date.now();

    const content: OpenAI.Responses.ResponseInputContent[] = [
      { type: "input_text", text: request.prompt },
    ];
    for (const image of request.images ?? []) {
      content.push({
        type: "input_image",
        detail: "auto",
        image_url: `data:${image.mimeType};base64,${image.data}`,
      });
    }

    const response = await this.client.responses.create({
      model: this.model,
      instructions: request.systemInstruction,
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: request.schemaName,
          schema: request.schema,
          strict: true,
        },
      },
    });

    const data = JSON.parse(response.output_text) as T;

    return {
      data,
      provider: this.name,
      model: this.model,
      latencyMs: Date.now() - start,
    };
  }
}
