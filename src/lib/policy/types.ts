/**
 * Forma estructurada de una política de gastos, producida por el policy
 * compiler (Etapa 2 / Módulo 3, ver docs/ALCANCE_FUNCIONAL_ETAPAS.md).
 *
 * Se guarda como JSON en Policy.structured. Esta estructura es lo que
 * consumirá el motor de reglas determinísticas en la Etapa 4 — mantenerla
 * simple y explícita.
 */
export interface PolicyCategoryRule {
  /** Identificador de categoría en snake_case, p.ej. "meals", "hotels". */
  category: string;
  /** Etiqueta legible, p.ej. "Meals". */
  label: string;
  /** Monto máximo permitido, si aplica. */
  maxAmount?: number;
  /** Periodo al que aplica maxAmount. */
  maxAmountPeriod?: "per_transaction" | "per_day" | "per_night" | "per_trip" | "annually";
  /**
   * A qué se suma maxAmount dentro del periodo: el total de la categoría
   * completa ("category", default) o solo los gastos del mismo comercio
   * ("merchant" — ej. "software hasta $300 anuales POR HERRAMIENTA" debe
   * trackear cada herramienta por separado, no el total de software).
   */
  maxAmountScope?: "category" | "merchant";
  /** Monto a partir del cual se exige comprobante. */
  receiptRequiredAboveAmount?: number;
  /** El gasto debe ocurrir dentro de un viaje previamente aprobado. */
  requiresApprovedTrip?: boolean;
  /** Requiere aprobación explícita de un gerente. */
  requiresManagerApproval?: boolean;
  /** Requiere validación semántica (JEV) de que el gasto es relevante al rol del empleado. */
  requiresRoleRelevance?: boolean;
  /** Elementos explícitamente no permitidos dentro de esta categoría, p.ej. ["alcohol"]. */
  disallowedItems?: string[];
  /** Nota libre para casos no cubiertos por los campos anteriores. */
  notes?: string;
}

export interface StructuredPolicy {
  currency: string;
  categories: PolicyCategoryRule[];
}

/** JSON Schema equivalente, para pedir salida estructurada a un LLM genérico. */
export const structuredPolicyJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["currency", "categories"],
  properties: {
    currency: { type: "string", description: 'Ej. "USD"' },
    categories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "label"],
        properties: {
          category: { type: "string", description: "snake_case, ej. meals, hotels, software" },
          label: { type: "string" },
          maxAmount: { type: "number" },
          maxAmountPeriod: {
            type: "string",
            enum: ["per_transaction", "per_day", "per_night", "per_trip", "annually"],
          },
          maxAmountScope: {
            type: "string",
            enum: ["category", "merchant"],
            description:
              '"merchant" si el límite es por herramienta/proveedor individual (ej. "per tool"); "category" (default) si es el total de la categoría.',
          },
          receiptRequiredAboveAmount: { type: "number" },
          requiresApprovedTrip: { type: "boolean" },
          requiresManagerApproval: { type: "boolean" },
          requiresRoleRelevance: { type: "boolean" },
          disallowedItems: { type: "array", items: { type: "string" } },
          notes: { type: "string" },
        },
      },
    },
  },
} as const;
