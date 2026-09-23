import { getLlmProvider } from "@/lib/llm";
import { structuredPolicyJsonSchema, type StructuredPolicy } from "./types";

const SYSTEM_INSTRUCTION = `Eres el "policy compiler" de un sistema de gestión de gastos corporativos.
Conviertes una política de gastos escrita en lenguaje natural en una estructura JSON de reglas por categoría.
Reglas:
- Identifica cada categoría de gasto mencionada (ej. meals, transport, hotels, software, entertainment, international).
- Usa "category" en snake_case y "label" legible para humanos.
- Solo incluye montos y periodos que estén explícitos o claramente implícitos en el texto.
- Usa "requiresRoleRelevance" cuando la política condicione el gasto a que sea relevante para el rol del empleado (ej. software necesario para su trabajo).
- Usa "requiresManagerApproval" cuando el texto lo exija explícitamente.
- Usa "disallowedItems" para elementos explícitamente prohibidos (ej. alcohol).
- No inventes categorías ni límites que no estén en el texto.`;

/** Convierte el texto de política en lenguaje natural a la estructura JSON. Etapa 2 / Módulo 3. */
export async function compilePolicy(rawText: string): Promise<StructuredPolicy> {
  const provider = getLlmProvider();
  const result = await provider.generateStructured<StructuredPolicy>({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: rawText,
    schemaName: "structured_policy",
    schema: structuredPolicyJsonSchema,
  });
  return result.data;
}
