# CFO Agent — Alcance del MVP (definido)

**Basado en:** `CFO_Agent_Concepto_v1.md`
**Fecha de definición:** 2026-09-22

---

## 1. Prioridad de construcción

Se construye **únicamente el Flujo A (Reembolso real en testnet)** durante esta fase. El Flujo B (tarjeta corporativa simulada) queda **fuera de esta primera iteración** y se retoma solo si sobra tiempo después de que el Flujo A esté demo-ready.

---

## 2. Alcance funcional — Flujo A

1. El CFO crea una empresa.
2. La empresa recibe una treasury wallet en Stellar testnet (custodial, generada por la plataforma).
3. Se depositan USDC de prueba en la treasury.
4. El CFO define una política de gastos (texto simple → representación estructurada).
5. Se registra un empleado con su wallet (custodial, generada por la plataforma).
6. El empleado carga un comprobante (imagen/PDF).
7. Un modelo con visión (Claude) extrae monto, comercio, fecha y categoría.
8. El empleado añade la justificación del gasto.
9. Reglas determinísticas evalúan el gasto contra la política.
10. JEV resuelve la(s) condición(es) semánticas (score de confianza).
11. El motor decide: `APPROVE` / `REJECT` / `REVIEW REQUIRED`.
12. Si se aprueba, se transfieren USDC de la treasury al empleado en Stellar testnet.
13. El dashboard muestra la decisión, el razonamiento (reglas + JEV) y el hash de la transacción.

## 3. Fuera de alcance (esta fase)

- Flujo B — tarjeta corporativa simulada (diferido, no cancelado).
- Emisión real de tarjetas, sponsor bank, KYC/KYB/AML, PCI.
- Multi-chain, integración con ERPs, contabilidad tributaria por país.
- Wallets non-custodial (se evalúa en fases posteriores).
- Detección general de fraude.

## 4. Stack técnico

| Capa | Elección |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Base de datos | Postgres (Neon/Vercel Postgres) + Prisma |
| Blockchain | `stellar-sdk` (JS) sobre Horizon testnet |
| Wallets | Custodial — generadas server-side, llaves cifradas |
| Extracción de comprobantes (visión) | Proveedor LLM genérico (OpenAI o Gemini, intercambiable — ver 4.1) |
| JEV (juicio semántico, Nivel 2) | **Jev de TypeSafe** — servicio dedicado, no depende de créditos de Anthropic/OpenAI/Gemini. SDK JavaScript disponible (`TypeSafeClient`, métodos `choice()`, `score()`, `noul()`). Devuelve resultados tipados con probabilidad/confianza. Sin control directo sobre la wallet. |
| Policy compiler (texto → reglas) | Proveedor LLM genérico (OpenAI o Gemini, intercambiable — ver 4.1) |
| Escalamiento (Nivel 3, excepciones) | Proveedor LLM genérico (OpenAI o Gemini, intercambiable — ver 4.1) o revisión humana simulada |
| Storage de archivos | Vercel Blob |
| Auth | Simple, basada en rol (CFO / empleado), sin proveedor externo |
| Deploy | Vercel |

### 4.1 Proveedor LLM genérico (extracción, policy compiler, escalamiento)

No se usará la API de Claude/Anthropic en el proyecto (restricción de créditos). Para las tareas de LLM genérico (extracción con visión, conversión de política a reglas, y evaluación de excepciones) se construye una **capa de abstracción de proveedor** que permite alternar entre:

- **OpenAI** (GPT-4o / GPT-4o-mini), o
- **Google Gemini** (2.x Flash/Pro, con visión nativa),

según cuál tenga créditos disponibles en el momento de desarrollo. La interfaz interna (inputs/outputs) es la misma sin importar el proveedor activo; el cambio se hace por configuración, no por reescritura de código.

### 4.2 Jev de TypeSafe — integrado (Etapa 5)

SDK: `@typesafe-ai/sdk` (`TypeSafeClient`, funciones `choice()`/`score()`/`noul()`). Cliente lee `TYPESAFE_API_KEY` del entorno automáticamente. Integración en `src/lib/jev/evaluate.ts`.

- `client.systemOne({ state, questions })` evalúa varias preguntas en una sola llamada, en paralelo (no se ven las respuestas entre sí). `state` debe ser JSON plano (texto, objeto o array) — un objeto tipado con interfaces TS sin index signature no es asignable directamente; se normaliza con `JSON.parse(JSON.stringify(...))`.
- `noul(instructions, {true, false})` devuelve `{ noul: number }` — probabilidad de "sí", sin campo de confianza separado (un valor cerca de 0.5 significa probabilidad similar sí/no, no "confianza media").
- `choice()`/`score()` devuelven además `confidence` (concentración de la distribución, no corrección del flujo completo) y `probabilities`.
- Preguntas usadas para evaluar un gasto: `complies_with_policy`, `business_purpose_valid`, `evidence_sufficient`, `requires_review` (siempre), más `role_relevant` cuando la categoría tiene `requiresRoleRelevance`.
- Verificado con la API real: reproduce casi exactamente los ejemplos del concepto original (Notion/PM → ~97% relevancia de rol; justificación vaga → confianza de propósito de negocio cae a ~12% y "requiere revisión" sube a ~76%).
- Umbrales del *confidence gate* (Módulo 7 / Etapa 6) siguen pendientes de calibrar con datos reales.

## 5. Principio de seguridad (heredado del concepto)

> AI recommends. Policy decides. Stellar executes.

El LLM y JEV nunca ejecutan movimientos de fondos directamente; solo producen señales/confianza que el motor de reglas interpreta antes de autorizar un pago.

## 6. Decisiones aún abiertas (no bloquean el inicio del desarrollo)

- Formato exacto del policy schema (a definir al construir el policy compiler).
- Preguntas/outputs exactos enviados a JEV por categoría de gasto.
- Umbrales de confianza por categoría y monto (se parte de los valores de ejemplo del concepto: ≥0.95 aprueba, ≥0.70 escala, <0.70 rechaza/pide evidencia).
- Nombre definitivo del producto y disponibilidad de marca.

---

*Este documento fija el alcance del MVP. Los detalles de implementación (esquema de datos, endpoints, componentes) se definen en la siguiente etapa de planificación.*
