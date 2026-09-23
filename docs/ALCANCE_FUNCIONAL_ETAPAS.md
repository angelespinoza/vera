# CFO Agent — Detalle funcional y etapas de construcción

**Basado en:** `CFO_Agent_Concepto_v1.md` y `ALCANCE_MVP.md`
**Alcance:** Flujo A (reembolso real en testnet) únicamente. Flujo B (tarjeta simulada) queda como etapa opcional al final.

---

## 1. Detalle funcional por módulo

### Módulo 1 — Empresa (CFO)

- Registro de empresa (nombre, email del CFO).
- Login simple basado en rol (CFO / empleado).
- Generación automática de **treasury wallet** en Stellar testnet (custodial).
- Fondeo de la treasury con USDC de prueba (friendbot + trustline USDC testnet).
- Visualización del balance de la treasury en tiempo real.
- Creación/edición de la **política de gastos** (texto libre).
- Alta y listado de empleados.
- Historial global de gastos y decisiones (audit log).
- Panel de métricas agregadas (ver módulo 9).

### Módulo 2 — Empleado

- Alta por el CFO (nombre, rol, email).
- Generación automática de wallet Stellar testnet (custodial) al crear el empleado.
- Login simple.
- Visualización de la política vigente (resumen legible).
- Carga de comprobante (imagen o PDF).
- Ingreso de justificación del gasto (texto libre).
- Visualización del estado del gasto: `PENDING` / `APPROVED` / `REJECTED` / `REVIEW REQUIRED`.
- Historial personal de gastos y reembolsos, con hash de transacción cuando aplica.

### Módulo 3 — Policy compiler

- Input: texto de política en lenguaje natural (ej. "Meals up to $50/day. Hotels up to $180/night during approved trips. Software up to $300/year when relevant to role. Alcohol not reimbursable.").
- Proceso: LLM genérico (OpenAI o Gemini, vía capa de abstracción — ver `ALCANCE_MVP.md` §4.1) convierte el texto a una estructura JSON de reglas por categoría (límite de monto, umbral que exige comprobante, restricciones binarias, si requiere validación semántica de relevancia).
- Output: estructura editable manualmente por el CFO si la conversión automática no es correcta.
- Se persiste tanto el texto original como la estructura.

### Módulo 4 — Extracción de evidencia (visión)

- Input: imagen/PDF del comprobante.
- Proceso: LLM genérico con visión (OpenAI GPT-4o o Gemini, vía capa de abstracción — ver `ALCANCE_MVP.md` §4.1) extrae monto, moneda, comercio, fecha y categoría estimada.
- Si la confianza de extracción es baja o hay campos faltantes, se pide al empleado confirmar o corregir manualmente antes de continuar.

### Módulo 5 — Motor de reglas determinísticas

Evalúa condiciones objetivas contra la política estructurada y los datos del gasto:

- Monto ≤ límite de la categoría.
- Comprobante presente si el monto supera el umbral que lo exige.
- Restricciones binarias (ej. alcohol no permitido).
- Presupuesto disponible en el periodo.
- Comprobante no duplicado (hash de archivo).
- Fecha dentro del periodo permitido.

Output: lista de reglas evaluadas con resultado pasa/falla.

### Módulo 6 — JEV (juicio semántico)

- Se invoca solo si las reglas determinísticas no bastan para decidir (ej. "¿el software es relevante al rol del empleado?", "¿el comprobante y la justificación describen el mismo gasto?").
- Implementado con **Jev de TypeSafe** (`docs.typesafe.ai`), su "System One model": recibe un estado + preguntas tipadas en una sola llamada y devuelve resultados estructurados con probabilidad/confianza, sin necesidad de parseo.
- Tres primitivas disponibles, combinables en una misma llamada:
  - **Choice** — selecciona una opción de una lista; retorna elección + probabilidades + confianza.
  - **Score** — califica el estado contra una rúbrica; retorna puntuación + probabilidades + confianza.
  - **Noul** — valida una afirmación sí/no; retorna probabilidad 0–1 (mapea directo a los scores del concepto: `complies_with_policy`, `business_purpose_valid`, `evidence_sufficient`, `requires_review`).
- SDK de JavaScript disponible (`TypeSafeClient`, métodos `choice()` / `score()` / `noul()`) — se integra directo en el backend Next.js.
- JEV **no ejecuta acciones financieras**, solo retorna señales que el motor de decisión interpreta.
- Pendiente antes de la Etapa 5: conseguir credenciales/API key de TypeSafe y el detalle exacto de payloads (ver `ALCANCE_MVP.md` §4.2).

### Módulo 7 — Motor de decisión (orquestador)

Aplica el *confidence gate*:

```
si reglas_duras_fallan          → DENY / REQUEST CORRECTION
si compliance ≥ 0.95 y review ≤ 0.10 → APPROVE
si compliance ≥ 0.70            → REVIEW REQUIRED (escalamiento simulado)
si no                           → REJECT / REQUEST MORE EVIDENCE
```

- Registra en el audit log: política aplicada, reglas evaluadas, scores JEV, decisión final, timestamp.

### Módulo 8 — Pago en Stellar

- Si la decisión es `APPROVE`, se ejecuta una transferencia de USDC testnet desde la treasury wallet a la wallet del empleado.
- Se captura y persiste el hash de la transacción.
- Manejo de errores (balance insuficiente, fallo de red): el gasto no se marca como pagado y queda visible el error.

### Módulo 9 — Dashboard, audit log y métricas

- Vista CFO: listado de gastos con filtros (estado, empleado, categoría), detalle completo de cada decisión (reglas, scores JEV, razón, hash de tx).
- Vista empleado: sus propios gastos y estado.
- Métricas agregadas para la demo: gastos procesados, % resuelto solo con reglas, % resuelto con JEV, % escalado, latencia promedio de decisión, USDC liquidado en Stellar.

### Módulo 10 — Panel comparativo: Jev vs. LLM genérico (demo)

Objetivo: demostrar cuantitativamente la eficacia de Jev (velocidad y acierto) frente a la alternativa de resolver la misma pregunta semántica con un LLM genérico (prompt-and-parse).

**Funcionamiento:**

- Para cada gasto que requiere evaluación semántica (no resuelto solo con reglas), el sistema ejecuta **dos vías en paralelo sobre el mismo estado** (política + datos del gasto + evidencia):
  - **Vía Jev (oficial):** llamada a TypeSafe (Choice/Score/Noul) — es la única vía que alimenta el motor de decisión real y puede derivar en un pago.
  - **Vía LLM genérico (shadow/comparativa):** mismas preguntas formuladas como prompt a OpenAI/Gemini pidiendo salida estructurada equivalente (decisión + confianza). Es puramente informativa.
- Se mide y persiste por vía: latencia de respuesta, decisión resultante (`approve`/`reject`/`review`) y confianza/score reportado.

**Restricción de seguridad (no negociable):** la vía comparativa nunca autoriza ni dispara transferencias de fondos. Está aislada del Módulo 8 (Pago). Solo la vía Jev puede resultar en un `APPROVE` que ejecute un pago real.

**UI:**

- Detalle por gasto: panel lado a lado con ambas vías (tiempo, decisión, confianza), la vía Jev marcada como "oficial".
- Vista agregada: tabla de gastos evaluados con latencia Jev vs. latencia LLM genérico, y coincidencia/discrepancia de decisión entre ambas vías.
- Métricas agregadas: latencia promedio por vía, % de coincidencia de decisión Jev vs. LLM genérico, distribución de confianza por vía.

---

## 2. Etapas de construcción (secuenciales)

Cada etapa produce un incremento demostrable y verificable antes de avanzar a la siguiente. Si algo falla, el punto de retorno es el final de la última etapa completada.

| Etapa | Estado | Contenido | Entregable verificable |
|---|---|---|---|
| **0. Fundaciones** | ✅ Hecho | Repo Next.js + TS, Prisma + Postgres, conexión Stellar testnet (keypair + friendbot + trustline USDC), variables de entorno, capa de abstracción de proveedor LLM genérico (OpenAI/Gemini) con validación de acceso, y credenciales de Jev/TypeSafe. | Se genera y fondea una wallet de prueba visible en Stellar Expert (testnet); llamada de prueba al proveedor LLM genérico y a Jev funcionan. |
| **1. Empresa, treasury y empleados** | ✅ Hecho | CRUD empresa, generación/fondeo de treasury, balance en vivo, CRUD empleados con wallet automática. | Se crea una empresa, se fondea su treasury, se da de alta un empleado con wallet visible on-chain. |
| **2. Política** | ✅ Hecho | UI de texto libre para el CFO, policy compiler (texto → JSON estructurado), edición manual. | Una política queda persistida y visible en su forma estructurada y editable. |
| **3. Envío de gasto + evidencia** | ✅ Hecho | Formulario de carga de comprobante, extracción con visión, confirmación/corrección manual. | Un gasto queda registrado con datos extraídos y confirmados, aún sin evaluar. |
| **4. Motor de reglas** | ✅ Hecho | Evaluación de reglas determinísticas contra política + gasto, resultado visible. | Cualquier gasto muestra qué reglas objetivas cumple o falla. |
| **5. JEV** | ⬜ Pendiente | Integración con Jev de TypeSafe (Choice/Score/Noul) con preguntas por categoría, resultados visibles. | El detalle del gasto muestra reglas + resultados de Jev (con confianza), sin decisión automática todavía. |
| **6. Motor de decisión** | ⬜ Pendiente | Orquestación completa del confidence gate, registro en audit log. | Cada gasto recibe una decisión automática explicada (sin mover fondos aún). |
| **7. Panel comparativo Jev vs. LLM genérico** | ⬜ Pendiente | Vía shadow con LLM genérico corriendo en paralelo a Jev sobre el mismo estado; captura de latencia y decisión de ambas vías; aislamiento estricto respecto al módulo de pago. | El detalle de un gasto muestra lado a lado tiempo y veredicto de Jev vs. LLM genérico, sin que la vía shadow pueda mover fondos. |
| **8. Pago en Stellar** | ⬜ Pendiente | Ejecución de transferencia USDC al aprobar (solo vía Jev/oficial), hash de transacción, manejo de errores. | Flujo end-to-end: comprobante → decisión → USDC recibido en wallet del empleado. |
| **9. Dashboard, métricas y pulido de demo** | ⬜ Pendiente | Historial, filtros, métricas agregadas (incluyendo comparativa Jev vs. LLM genérico), ajuste de UI a las 5 escenas de la demo del concepto original. | Producto demo-ready según el guión de la sección 16 del concepto, con panel de eficacia de Jev visible. |
| **10. (Opcional) Flujo B** | ⬜ Pendiente | Tarjeta corporativa simulada, reutilizando el mismo motor de decisión. | Solo se aborda si las etapas 0–9 están completas y sobra tiempo. |

---

*Siguiente paso sugerido: iniciar Etapa 0 (Fundaciones).*
