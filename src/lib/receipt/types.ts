export interface ExtractedReceiptData {
  amount?: number;
  currency?: string;
  merchant?: string;
  /** Fecha en formato YYYY-MM-DD. */
  date?: string;
  /** Categoría estimada: meals | transport | hotels | software | entertainment | other. */
  category?: string;
  /** Confianza global de la extracción, 0 a 1. */
  confidence: number;
}

export const extractedReceiptJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["confidence"],
  properties: {
    amount: { type: "number" },
    currency: { type: "string", description: "Código ISO 4217, ej. USD" },
    merchant: { type: "string" },
    date: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
    category: {
      type: "string",
      description: "meals | transport | hotels | software | entertainment | other",
    },
    confidence: { type: "number", description: "Confianza global de la extracción, 0 a 1" },
  },
} as const;
