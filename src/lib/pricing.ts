/**
 * Precios por millón de tokens, para el panel comparativo de costo (Jev vs.
 * LLM genérico). Configurables por variable de entorno porque no tenemos
 * forma de verificar en código el precio vigente de cada proveedor — se deja
 * en `undefined` (costo "sin configurar" en la UI) hasta que se defina
 * explícitamente, en vez de asumir una tarifa que podría estar desactualizada.
 */

interface TokenPricing {
  /** USD por 1,000,000 de tokens de entrada. */
  inputPerMillion: number;
  /** USD por 1,000,000 de tokens de salida. */
  outputPerMillion: number;
}

function pricingFromEnv(inputVar: string, outputVar: string): TokenPricing | undefined {
  const input = process.env[inputVar];
  const output = process.env[outputVar];
  if (!input || !output) return undefined;
  const inputPerMillion = Number(input);
  const outputPerMillion = Number(output);
  if (Number.isNaN(inputPerMillion) || Number.isNaN(outputPerMillion)) return undefined;
  return { inputPerMillion, outputPerMillion };
}

const JEV_PRICING = pricingFromEnv("JEV_INPUT_PRICE_PER_MILLION", "JEV_OUTPUT_PRICE_PER_MILLION");
const OPENAI_PRICING = pricingFromEnv("OPENAI_INPUT_PRICE_PER_MILLION", "OPENAI_OUTPUT_PRICE_PER_MILLION");
const GEMINI_PRICING = pricingFromEnv("GEMINI_INPUT_PRICE_PER_MILLION", "GEMINI_OUTPUT_PRICE_PER_MILLION");

export type PricingSource = "jev" | "openai" | "gemini";

/** Costo en USD para una llamada, o `undefined` si no hay precio configurado para esa fuente. */
export function estimateCostUsd(
  source: PricingSource,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): number | undefined {
  if (inputTokens === undefined || outputTokens === undefined) return undefined;
  const pricing = source === "jev" ? JEV_PRICING : source === "openai" ? OPENAI_PRICING : GEMINI_PRICING;
  if (!pricing) return undefined;
  return (inputTokens / 1_000_000) * pricing.inputPerMillion + (outputTokens / 1_000_000) * pricing.outputPerMillion;
}
