# Vera — CFO Agent

Autonomous spend management for global teams. Reglas determinísticas + JEV (Jev de TypeSafe) + LLM/humano para excepciones, con liquidación en USDC sobre Stellar.

> **Set the policy once. The CFO Agent decides, pays and reconciles every expense.**

## Documentación

Toda la documentación funcional vive en [`docs/`](./docs):

- [`docs/CFO_Agent_Concepto_v1.md`](./docs/CFO_Agent_Concepto_v1.md) — concepto de producto original.
- [`docs/ALCANCE_MVP.md`](./docs/ALCANCE_MVP.md) — alcance del MVP, stack técnico y decisiones de arquitectura.
- [`docs/ALCANCE_FUNCIONAL_ETAPAS.md`](./docs/ALCANCE_FUNCIONAL_ETAPAS.md) — detalle funcional por módulo y etapas de construcción secuenciales.

## Stack

- **Next.js** (App Router) + TypeScript
- **Prisma 7** + Postgres (driver adapter `@prisma/adapter-pg`)
- **Stellar** (`@stellar/stellar-sdk`) — testnet, wallets custodiales
- **Jev (TypeSafe)** — juicio semántico (Nivel 2 del motor de decisión)
- **OpenAI / Gemini** — capa de proveedor LLM genérico intercambiable, usada para extracción de comprobantes (visión), policy compiler y escalamiento (Nivel 3)

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
```

## Estado

En construcción por etapas — ver el detalle y el progreso en [`docs/ALCANCE_FUNCIONAL_ETAPAS.md`](./docs/ALCANCE_FUNCIONAL_ETAPAS.md).
