import { getLlmProvider } from "@/lib/llm";
import { extractedReceiptJsonSchema, type ExtractedReceiptData } from "./types";

const SYSTEM_INSTRUCTION = `Eres un extractor de datos de comprobantes de gasto (recibos, facturas).
Analiza la imagen y extrae: monto, moneda (código ISO 4217), comercio, fecha (YYYY-MM-DD) y categoría
estimada (meals, transport, hotels, software, entertainment, u other si no encaja).
Si un campo no es legible o no está presente, omítelo en vez de inventarlo.
Reporta en "confidence" tu confianza global (0 a 1) en la extracción completa.`;

/** Extrae datos estructurados de una imagen de comprobante. Etapa 3 / Módulo 4. */
export async function extractReceiptData(
  imageBase64: string,
  mimeType: string,
): Promise<ExtractedReceiptData> {
  const provider = getLlmProvider();
  const result = await provider.generateStructured<ExtractedReceiptData>({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: "Extrae los datos de este comprobante.",
    images: [{ data: imageBase64, mimeType }],
    schemaName: "extracted_receipt_data",
    schema: extractedReceiptJsonSchema,
  });
  return result.data;
}
