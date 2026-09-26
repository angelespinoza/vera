# Vera — CFO Agent

Autonomous spend management for global teams. Reglas determinísticas + JEV (Jev de TypeSafe) + LLM/humano para excepciones, con liquidación en USDC sobre Stellar.

> **Set the policy once. The CFO Agent decides, pays and reconciles every expense.**

## Qué es

Vera es un agente de CFO autónomo para gestión de gastos y reembolsos. Recibe un
comprobante de gasto (foto o carga masiva), lo analiza, decide si cumple la
política de la empresa y, si lo aprueba, **paga el reembolso en USDC de forma
automática** — sin que un humano tenga que revisar y aprobar cada transacción
una por una.

Corre sobre Stellar (testnet), con Jev (TypeSafe AI) como motor de juicio
semántico, Gemini/OpenAI como soporte de visión y comparación, y un contrato
Soroban opcional (`contracts/spending-vault`) que acota el radio de daño de la
llave que paga día a día.

### El problema que resuelve

- **Revisión manual repetitiva**: alguien de finanzas revisa cada recibo a mano.
- **Políticas difíciles de aplicar de forma consistente**: dos personas pueden
  interpretar "gasto razonable" distinto.
- **Reembolsos lentos**, sobre todo para equipos remotos/internacionales que
  esperan días para que les regresen su dinero.

## Cómo funciona (flujo de un gasto)

1. **El empleado sube un comprobante** (foto) o el CFO carga un Excel con
   varios gastos a la vez (hasta 200 filas, 5 en paralelo).
2. **Extracción**: si es una foto, un LLM con visión (Gemini/OpenAI) extrae
   monto, comercio, fecha y categoría del recibo.
3. **Reglas determinísticas**: ¿la categoría existe en la política?, ¿el monto
   está dentro del límite (por categoría o por herramienta/merchant)?, ¿hay
   algo explícitamente prohibido (ej. alcohol)?, ¿la fecha es válida? Si algo
   falla aquí, se rechaza de inmediato — sin gastar una sola llamada a un modelo.
4. **Jev evalúa el criterio semántico**: ¿cumple la política?, ¿el propósito de
   negocio es creíble?, ¿la evidencia es suficiente?, ¿amerita revisión
   humana? Cada pregunta regresa una probabilidad calibrada (0–1), no un sí/no
   binario.
5. **Motor de decisión**: combina reglas + Jev con un umbral de confianza y
   produce un veredicto: **Aprobado**, **Rechazado** o **Requiere revisión**.
6. **Pago automático**: si se aprueba, Vera firma y envía el reembolso en USDC
   a la wallet Stellar del empleado — en segundos, sin intervención humana. Si
   el vault on-chain está activo y el empleado está registrado en él, el pago
   sale vía el contrato (`release_payment`); si no, vía pago clásico firmado
   por el treasury.

En paralelo (nunca en el camino de la decisión), un **LLM genérico** evalúa el
mismo gasto con las mismas preguntas, solo para comparar qué tan seguido
coincide con Jev y a qué velocidad/costo. Esta vía es puramente informativa:
jamás autoriza un pago.

## El principio de seguridad

**AI recomienda. La política decide. Stellar ejecuta.**

Ningún modelo de lenguaje mueve dinero por sí mismo. La decisión de pagar sale
siempre del motor de reglas + Jev, nunca directamente de un LLM genérico ni de
un paso de "aprobación de IA" sin reglas debajo.

Una segunda capa, opcional, vive on-chain: el contrato Soroban `SpendingVault`
(`contracts/spending-vault`) hace que la llave "operadora" que paga día a día
**solo pueda enviar a empleados registrados y nunca más de su tope de vida**.
Si esa llave se filtra, el daño máximo es acotado por el contrato — no el
treasury completo. El admin (treasury) es quien registra empleados y puede
rotar la operadora (`set_operator`); el operador nunca puede subir su propio
poder.

## Los módulos del producto

| Página | Para qué sirve |
|---|---|
| **Treasury** | Balance de la wallet de la empresa (XLM/USDC) en Stellar testnet, estado del vault on-chain (contrato, balance, empleados registrados) y botón para fondearlo desde el treasury. |
| **Métricas** | KPIs del sistema (gastos procesados, latencia de Jev, USDC liquidado) y dos gráficas reales: gasto por categoría en el tiempo, y decisiones (aprobado/revisión/rechazado) por semana. |
| **Política** | La política de gastos en lenguaje natural, compilada automáticamente a reglas estructuradas (límites por categoría o por herramienta, ítems prohibidos, aprobaciones requeridas). |
| **Empleados** | Alta de empleados con su propia wallet Stellar, donde reciben el reembolso; si el vault está activo, quedan registrados en el contrato automáticamente. |
| **Gastos** | Donde se analiza y ejecuta el reembolso: subir un comprobante individual, o una carga masiva de Excel con simulación en vivo (útil para demos). |
| **Historial** | Todo lo ya evaluado: filtrable por estado/empleado/categoría, con el detalle completo de cada decisión (reglas, lectura de Jev, comparación con el LLM genérico, hash de pago). |

## La demo en vivo (carga masiva)

Se puede cargar un Excel con decenas de gastos y verlos procesarse **uno por
uno, en tiempo real**: cada fila corre reglas → Jev + LLM en paralelo →
decisión → pago, y el panel muestra un "análisis en vivo" estilo terminal —
comercio actual, las métricas de Jev como barras de confianza, un grid de
comercios que se va coloreando conforme se resuelven, y un feed tipo consola
con el resultado de cada fila y su latencia.

## Qué lo hace distinto

- **Jev no es "otro LLM"**: es un motor construido específicamente para dar
  probabilidades calibradas, no solo texto que suena convincente. En pruebas
  con datos reales, Jev se mantiene consistente entre gastos parecidos (ej.
  85–96% de confianza en gastos limpios), mientras que un LLM genérico
  respondiendo la misma pregunta oscila mucho más (de 5% a 90%+) — coinciden
  en el veredicto final solo ~1 de cada 3 veces.
- **El pago es real, no simulado**: cuando Vera aprueba, de verdad firma y
  envía una transacción Stellar (clásica o vía contrato Soroban) con USDC. En
  testnet, pero con la misma mecánica que producción.
- **Todo queda auditado**: cada decisión guarda el detalle completo — qué
  regla pasó o falló, qué dijo Jev, qué dijo el LLM comparativo, si hubo
  divergencia con la decisión real, y si el pago salió por el vault o de forma
  clásica.

## Stack

- **Next.js** (App Router) + TypeScript
- **Prisma 7** + Postgres (driver adapter `@prisma/adapter-pg`)
- **Stellar** (`@stellar/stellar-sdk`) — testnet, wallets custodiales, pagos clásicos y llamadas a contrato (`@stellar/stellar-sdk/contract`)
- **Soroban** (`contracts/spending-vault`, Rust + `soroban-sdk`) — contrato `SpendingVault` con tope de gasto forzado on-chain (ver [`contracts/spending-vault/README.md`](./contracts/spending-vault/README.md))
- **Jev (TypeSafe)** — juicio semántico (Nivel 2 del motor de decisión)
- **OpenAI / Gemini** — capa de proveedor LLM genérico intercambiable, usada para extracción de comprobantes (visión), policy compiler y escalamiento (Nivel 3)

## Documentación

Toda la documentación funcional vive en [`docs/`](./docs):

- [`docs/CFO_Agent_Concepto_v1.md`](./docs/CFO_Agent_Concepto_v1.md) — concepto de producto original.
- [`docs/ALCANCE_MVP.md`](./docs/ALCANCE_MVP.md) — alcance del MVP, stack técnico y decisiones de arquitectura.
- [`docs/ALCANCE_FUNCIONAL_ETAPAS.md`](./docs/ALCANCE_FUNCIONAL_ETAPAS.md) — detalle funcional por módulo y etapas de construcción secuenciales.
- [`docs/BRIEF_FUNCIONAL_PRESENTACION.md`](./docs/BRIEF_FUNCIONAL_PRESENTACION.md) — brief corto pensado para armar una presentación.

## Desarrollo

```bash
npm install
cp .env.example .env   # completa las credenciales
npm run dev
```

### Scripts útiles

```bash
# Genera una wallet de testnet, la fondea con Friendbot y establece trustline USDC
node scripts/stellar/create-test-wallet.ts

# Prisma
npx prisma generate
npx prisma migrate dev

# Contrato Soroban (desde contracts/spending-vault/)
stellar contract build
cargo test
```

## Estado

MVP funcional de punta a punta: alta de empresa → política → empleados →
carga de gasto (individual o masiva) → decisión automática → pago en Stellar
(clásico o vía contrato Soroban) → historial y métricas auditables. Desplegado
en Railway.

Pendiente de calibrar con datos de producción reales: los umbrales de
confianza del motor de decisión (hoy basados en mediciones de datos de
prueba, documentados como ajustables en el propio código).
