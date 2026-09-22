# CFO Agent

## Autonomous spend management for global teams

**Versión:** 1.0  
**Estado:** Concepto aprobado para desarrollo de MVP / hackathon  
**Red:** Stellar  
**Activo principal:** USDC

---

## 1. Resumen ejecutivo

**CFO Agent** es una plataforma de gestión autónoma de gastos para equipos globales. La empresa define una política una sola vez y el sistema la aplica para decidir, pagar y conciliar cada gasto.

El producto unifica dos modalidades:

1. **Tarjetas corporativas:** el sistema evalúa una compra antes de autorizarla y posteriormente verifica su comprobante.
2. **Reembolsos:** el empleado paga con sus propios fondos, presenta la evidencia y recibe USDC cuando el gasto es aprobado.

El motor de decisión utiliza una arquitectura escalonada:

1. **Reglas determinísticas** para condiciones objetivas.
2. **JEV** para decisiones semánticas rápidas y de bajo costo.
3. **LLM o revisión humana** únicamente para excepciones complejas o ambiguas.
4. **Stellar** para ejecutar y registrar los movimientos de USDC.

La visión de largo plazo es construir una capa financiera autónoma para empresas distribuidas: tarjetas, reembolsos, políticas, pagos y conciliación operados por software, con supervisión humana por excepción.

---

## 2. Posicionamiento

### Categoría

**AI-native corporate spend management.**

### Propuesta principal

> **CFO Agent — Autonomous spend management for global teams.**

### Promesa

> **Set the policy once. The CFO Agent decides, pays and reconciles every expense.**

### Tesis de producto

> **Your CFO shouldn't review every expense. It should define the rules once and let software enforce them.**

### Explicación corta

CFO Agent permite a una empresa definir sus políticas de gasto en lenguaje natural. Luego evalúa automáticamente cada transacción, aprueba compras corporativas, reembolsa gastos válidos y escala únicamente las excepciones.

### Componentes de la propuesta

```text
Corporate cards
        +
Expense reimbursements
        +
AI policy enforcement
        +
USDC settlement on Stellar
```

---

## 3. El problema

La gestión de gastos corporativos sigue dependiendo de procesos fragmentados:

- el empleado paga o solicita fondos;
- guarda y presenta un comprobante;
- explica el propósito del gasto;
- una persona revisa la política;
- un responsable aprueba o rechaza;
- finanzas procesa el pago;
- contabilidad concilia la operación.

Este proceso genera cuatro fricciones principales:

### 3.1 Revisión manual repetitiva

Finanzas dedica tiempo a validar gastos pequeños y predecibles que podrían resolverse mediante reglas.

### 3.2 Políticas difíciles de aplicar de forma consistente

Una misma política puede interpretarse de manera diferente según la persona que revisa el gasto.

### 3.3 Reembolsos lentos para equipos internacionales

Los colaboradores pueden esperar días o semanas, especialmente cuando la empresa debe operar entre distintos países, monedas y sistemas bancarios.

### 3.4 Uso ineficiente de inteligencia artificial

Enviar cada comprobante a un modelo de frontera puede ser costoso e innecesario. Muchas decisiones son determinísticas y otras solo necesitan una evaluación semántica pequeña y específica.

---

## 4. La solución

CFO Agent convierte una política corporativa en decisiones financieras ejecutables.

```text
POLICY
   ↓
TRANSACTION + CONTEXT + EVIDENCE
   ↓
DECISION ENGINE
   ↓
APPROVE / DENY / REVIEW
   ↓
PAYMENT OR CARD AUTHORIZATION
   ↓
RECONCILIATION
```

El sistema no entrega a un modelo control irrestricto sobre el dinero. El modelo produce evaluaciones y niveles de confianza; el código aplica límites, umbrales y permisos antes de ejecutar una acción financiera.

### Principio de seguridad

> **AI recommends. Policy decides. Stellar executes.**

---

## 5. Dos modalidades de gasto

### 5.1 Tarjeta corporativa

La empresa asigna una tarjeta física o virtual a cada colaborador. Antes de autorizar una compra, CFO Agent revisa los datos disponibles contra la política y el presupuesto.

```text
Employee initiates purchase
            ↓
Card authorization request
            ↓
Rules → JEV → exception gate
            ↓
     APPROVE / DENY
            ↓
Card network processes purchase
            ↓
Receipt + justification
            ↓
Post-purchase verification
            ↓
Expense reconciled or escalated
```

En tiempo real suelen estar disponibles datos como:

- monto y moneda;
- comercio y categoría del comercio;
- país y ubicación;
- fecha y hora;
- empleado y tarjeta;
- presupuesto disponible;
- viaje o proyecto asociado;
- historial relevante de gasto.

La factura y la justificación pueden llegar después. Por eso la autorización previa y la verificación posterior son dos decisiones separadas.

### 5.2 Reembolso

El empleado paga con dinero propio y presenta el comprobante junto con el propósito del gasto.

```text
Employee pays personally
          ↓
Uploads receipt + purpose
          ↓
OCR / structured extraction
          ↓
Rules → JEV → LLM/Human exception
          ↓
APPROVE / REJECT / REQUEST INFO
          ↓
USDC reimbursement on Stellar
          ↓
Expense reconciled
```

Este será el flujo funcional principal del MVP porque permite demostrar la tesis completa sin emitir una tarjeta real.

---

## 6. Motor de decisión

El motor evalúa cada gasto con la herramienta menos costosa y compleja capaz de resolverlo de manera segura.

### Nivel 1 — Reglas determinísticas

Se usan cuando la condición es objetiva.

Ejemplos:

- monto menor o igual al límite;
- categoría permitida;
- presupuesto disponible;
- comercio no bloqueado;
- viaje previamente aprobado;
- país coincidente con el viaje;
- comprobante no duplicado;
- fecha dentro del periodo autorizado;
- wallet o destinatario incluido en una lista permitida.

### Nivel 2 — JEV

Se usa cuando la decisión requiere interpretación semántica acotada.

Ejemplos:

- ¿El propósito declarado corresponde a la función del empleado?
- ¿La compra parece relacionada con el proyecto indicado?
- ¿La descripción del gasto satisface la política escrita?
- ¿El comprobante y la justificación describen razonablemente la misma operación?
- ¿La evidencia disponible es suficiente o debe pedirse más información?

Resultados de ejemplo:

```text
complies_with_policy:    0.96
business_purpose_valid:  0.93
evidence_sufficient:     0.98
requires_review:         0.04
```

JEV no mueve dinero. Devuelve señales y niveles de confianza que el motor interpreta mediante políticas programadas.

### Nivel 3 — LLM o persona

Se reserva para:

- contradicciones entre evidencia y política;
- gastos inusuales o de alto valor;
- justificaciones complejas;
- excepciones solicitadas por un gerente;
- baja confianza de JEV;
- posibles abusos o disputas;
- situaciones que requieran juicio humano.

### Confidence gate inicial

```python
if hard_rules_failed:
    deny_or_request_correction()

elif compliance_confidence >= 0.95 and requires_review <= 0.10:
    approve()

elif compliance_confidence >= 0.70:
    escalate_to_llm_or_manager()

else:
    request_more_evidence_or_reject()
```

Los umbrales son configurables según monto, categoría, cargo del empleado, historial y nivel de riesgo.

---

## 7. Ejemplo de política

```text
TRAVEL POLICY

Meals
• Maximum: $50 per day
• Alcohol: not allowed
• Receipt required above $15

Transport
• Taxi or rideshare: maximum $40 per trip
• Must occur during an approved business trip

Hotels
• Maximum: $180 per night
• Country and dates must match approved trip

Software
• Maximum: $300 annually per tool
• Must be relevant to the employee's role

Entertainment
• Requires manager approval

International transactions
• Allowed only during approved travel or for approved software vendors
```

La política puede escribirse en lenguaje natural, pero debe convertirse a una representación estructurada para ejecutar las reglas y dejar auditables las decisiones.

---

## 8. Ejemplo de autorización de tarjeta

### Transacción

```text
Merchant: Hilton Bogotá
Category: Hotel
Amount: 156 USDC
Employee: Angel
Trip: Bogotá — Client Meeting
Dates: September 20–22
Remaining travel budget: 720 USDC
```

### Evaluación

```text
✓ Approved trip
✓ Merchant category = Hotel
✓ Amount below $180 per night
✓ Budget available
✓ Country matches approved trip
```

### Decisión

```text
APPROVED
Reason: All deterministic travel rules passed
AI evaluation: Not required
```

Este ejemplo demuestra una característica esencial: el producto no usa IA cuando no la necesita.

---

## 9. Ejemplo de decisión semántica

### Transacción

```text
Merchant: Notion Labs
Amount: 240 USDC
Employee role: Product Manager
Description: Annual software subscription
```

### Política

> Software required for an employee's work can be purchased up to $300 annually.

### Reglas

```text
✓ Amount below annual software limit
✓ Budget available
? Tool relevance cannot be determined deterministically
```

### JEV

```text
relevant_to_role:       0.97
complies_with_policy:   0.94
requires_review:        0.08
```

### Decisión

```text
APPROVED
Reason: Amount is within policy and tool is highly relevant to employee role
```

---

## 10. Arquitectura conceptual

```text
                       CFO POLICY
                            │
                            ▼
                 ┌─────────────────────┐
                 │   DECISION ENGINE   │
                 │                     │
                 │  1. Rules           │
                 │  2. JEV             │
                 │  3. LLM / Human     │
                 └──────────┬──────────┘
                            │
                 Financial decision
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
       CARD AUTHORIZATION            REIMBURSEMENT
              │                           │
              └─────────────┬─────────────┘
                            ▼
                   STELLAR TREASURY
                            │
                            ▼
                       USDC LEDGER
```

### Componentes

1. **Company dashboard**  
   Administración de empresa, empleados, presupuestos, políticas y revisiones.

2. **Employee interface**  
   Presentación de gastos, comprobantes, justificaciones y seguimiento del reembolso.

3. **Policy compiler**  
   Convierte políticas escritas en lenguaje natural en reglas estructuradas y preguntas semánticas.

4. **Decision engine**  
   Orquesta reglas, JEV, escalamiento y acciones financieras.

5. **Evidence service**  
   Extrae información de comprobantes y relaciona evidencia con transacciones.

6. **Stellar treasury**  
   Mantiene fondos, ejecuta reembolsos y registra movimientos en USDC.

7. **Card adapter**  
   Simula autorizaciones en el MVP y, en una etapa posterior, conecta con un emisor o procesador.

8. **Audit log**  
   Conserva inputs, reglas aplicadas, scores, decisión, responsable y transacción relacionada.

---

## 11. Rol de Stellar

Stellar no es un elemento decorativo del producto. Resuelve la capa de movimiento y registro del dinero.

### En el MVP

- tesorería corporativa en USDC;
- depósitos de prueba;
- wallets de empresa y empleados;
- reembolsos automáticos;
- identificador on-chain de la operación;
- trazabilidad del pago aprobado.

### En la visión futura

- fondeo de programas de tarjetas vinculados a stablecoins;
- liquidación entre tesorería e infraestructura de tarjetas;
- pagos a equipos internacionales;
- manejo programático de presupuestos;
- integración con rampas de entrada y salida locales;
- contratos o controles adicionales mediante Soroban cuando agreguen valor real.

### Distinción fundamental

La **autorización de tarjeta**, el **clearing** y el **settlement** no son el mismo evento. Una tarjeta real puede utilizar Visa o Mastercard frente al comercio, mientras Stellar y USDC operan detrás como infraestructura de tesorería o liquidación. El MVP simulará la autorización de tarjeta y ejecutará en Stellar únicamente los movimientos que sea razonable demostrar on-chain.

---

## 12. Ventaja diferencial

CFO Agent no debe presentarse únicamente como “IA que revisa gastos”. Esa función ya forma parte de la evolución natural del mercado.

El diferencial es la combinación de:

### 12.1 Arquitectura eficiente de decisión

> **Rules when possible. JEV when judgment is needed. LLMs only for exceptions.**

### 12.2 Liquidación global

Reembolsos en USDC sobre Stellar, sin depender de construir una integración bancaria distinta para cada país en la primera versión.

### 12.3 Un solo motor para gastos antes y después del pago

El mismo sistema puede evaluar una autorización de tarjeta, verificar el comprobante posterior y aprobar un reembolso pagado con fondos personales.

### 12.4 Supervisión por excepción

El CFO no revisa cada gasto. Define políticas, observa resultados y participa únicamente cuando el sistema identifica ambigüedad, riesgo o una excepción material.

### 12.5 Auditabilidad

Cada decisión debe poder explicar:

- qué política se aplicó;
- qué reglas pasaron o fallaron;
- qué evidencia fue utilizada;
- qué confianza produjo el evaluador;
- por qué se aprobó, rechazó o escaló;
- quién tomó la decisión final;
- qué pago o autorización se generó.

---

## 13. Usuario inicial

### Perfil de empresa

- startup o empresa digital;
- equipo remoto o distribuido;
- colaboradores en más de un país;
- gastos frecuentes pero de bajo o mediano monto;
- uso de contratistas además de empleados;
- necesidad de reducir revisiones manuales;
- disposición a operar con stablecoins.

### Usuario comprador

- CFO;
- Head of Finance;
- Operations Manager;
- fundador responsable de finanzas.

### Usuario operativo

- empleado;
- contratista;
- gerente aprobador;
- analista financiero o contable.

---

## 14. Alcance del MVP para la hackathon

### Objetivo

Demostrar que una empresa puede definir una política, evaluar gastos automáticamente y ejecutar reembolsos en USDC mediante una arquitectura de decisión segura y eficiente.

### Flujo A — Reembolso real en testnet

1. El CFO crea una empresa.
2. La empresa conecta o genera una treasury wallet.
3. Deposita USDC de prueba.
4. Define una política de gastos.
5. Registra a un empleado y su wallet.
6. El empleado carga un comprobante.
7. El sistema extrae monto, comercio, fecha y categoría.
8. El empleado añade la justificación.
9. Reglas determinísticas evalúan el gasto.
10. JEV resuelve una condición semántica.
11. El motor aprueba, rechaza o escala.
12. Si se aprueba, se envía USDC al empleado.
13. El dashboard muestra la decisión y el hash de la transacción.

### Flujo B — Tarjeta corporativa simulada

1. El CFO crea una tarjeta virtual simulada.
2. Asigna empleado, presupuesto y política.
3. Llega un evento de autorización simulado.
4. Reglas y JEV evalúan la compra.
5. La interfaz muestra `APPROVED` o `DENIED` en tiempo real.
6. La transacción aparece como pendiente de comprobante.
7. El empleado carga el recibo.
8. El sistema verifica coincidencia y cumplimiento.
9. El gasto se concilia o pasa a revisión.

### Funciones incluidas

- dashboard de empresa;
- creación de empleados;
- treasury wallet en Stellar testnet;
- políticas simples editables;
- formulario de gasto y carga de comprobante;
- extracción estructurada de datos;
- motor de reglas;
- una o más evaluaciones con JEV;
- escalamiento simulado a revisión;
- pago de reembolso en USDC de prueba;
- historial y explicación de decisiones;
- simulador de autorización de tarjeta.

---

## 15. Fuera del alcance del MVP

Para conservar el foco, la primera versión no incluirá:

- emisión real de tarjetas Visa o Mastercard;
- integración con un sponsor bank;
- manejo completo de KYC, KYB o AML;
- certificación PCI;
- conversión automática a todas las monedas locales;
- integración profunda con ERPs o sistemas contables;
- detección general de fraude financiero;
- contabilidad tributaria por país;
- múltiples chains;
- gestión completa de viajes corporativos;
- promesas de autonomía absoluta sin revisión humana.

Estos elementos pertenecen al roadmap comercial, no a la prueba de concepto.

---

## 16. Demo sugerida

### Escena 1 — Política

El CFO escribe:

> Meals up to $50 per day. Hotels up to $180 per night during approved trips. Software up to $300 annually when relevant to the employee's role. Alcohol is not reimbursable.

La plataforma muestra la política estructurada.

### Escena 2 — Gasto simple

Un empleado intenta pagar un hotel por 156 USDC durante un viaje aprobado.

```text
Rules passed: 5/5
JEV calls: 0
Decision: APPROVED
```

### Escena 3 — Gasto semántico

Un Product Manager solicita una suscripción anual de Notion por 240 USDC.

```text
Rules passed: 2/2
Semantic question: Is this tool relevant to the employee's role?
JEV confidence: 97%
Decision: APPROVED
```

### Escena 4 — Reembolso

El empleado carga un recibo de taxi, el sistema verifica política y propósito, y transfiere USDC desde la treasury wallet.

```text
Reimbursement: 38.20 USDC
Status: PAID
Network: Stellar
Transaction: G... / hash
```

### Escena 5 — Excepción

Un gasto ambiguo obtiene baja confianza.

```text
Decision: REVIEW REQUIRED
Reason: Insufficient evidence of business purpose
Money moved: No
```

La última escena refuerza que el sistema sabe cuándo no debe decidir por sí solo.

---

## 17. Métricas principales

### Métrica norte

**Porcentaje de gastos procesados correctamente sin revisión humana.**

### Métricas de producto

- tiempo medio desde presentación hasta reembolso;
- costo medio por decisión financiera;
- porcentaje resuelto solo con reglas;
- porcentaje resuelto con JEV;
- porcentaje escalado a LLM;
- porcentaje escalado a humano;
- tasa de falsos aprobados;
- tasa de falsos rechazos;
- tiempo de respuesta para autorizaciones;
- porcentaje de gastos conciliados automáticamente;
- volumen de USDC procesado;
- costo por cada 1,000 decisiones.

### Métricas para la demo

```text
Expenses processed
Rules-only decisions
JEV decisions
LLM calls avoided
Human reviews avoided
Average decision latency
Average decision cost
Reimbursements settled on Stellar
```

No se deben presentar porcentajes de ahorro o precisión sin un benchmark reproducible.

---

## 18. Riesgos y controles

| Riesgo | Control propuesto |
|---|---|
| Aprobación incorrecta | Límites por monto, confidence gates y revisión por excepción |
| Manipulación de comprobantes | Validaciones de duplicidad, consistencia y metadatos disponibles |
| Política ambigua | Conversión a reglas estructuradas y confirmación del CFO |
| Respuesta errónea de IA | La IA no controla la wallet; el código aplica permisos y límites |
| Latencia en tarjeta | Reglas rápidas primero; evitar LLM en el camino crítico |
| Pérdida o abuso de fondos | Wallets con límites, roles, allowlists y controles de tesorería |
| Cumplimiento regulatorio | MVP en testnet; partners regulados para una implementación comercial |
| Volatilidad | Uso de stablecoin denominada en USD |
| Falta de explicación | Registro completo de reglas, scores, evidencia y decisión |

---

## 19. Roadmap

### Fase 1 — Hackathon MVP

- políticas básicas;
- reembolsos en Stellar testnet;
- reglas + JEV;
- dashboard y audit log;
- tarjeta simulada.

### Fase 2 — Piloto

- USDC real con límites reducidos;
- wallets empresariales con mejores controles;
- aprobaciones por roles;
- integración contable básica;
- soporte de varias políticas y centros de costo;
- aplicación móvil o experiencia optimizada para empleados.

### Fase 3 — Corporate cards

- integración con proveedor de emisión;
- autorizaciones en tiempo real;
- tarjetas virtuales por empleado o presupuesto;
- funding y settlement con stablecoins según infraestructura disponible;
- cumplimiento regulatorio y operacional junto a partners.

### Fase 4 — Autonomous finance layer

- facturas de proveedores;
- pagos recurrentes;
- presupuestos dinámicos;
- procurement ligero;
- agentes financieros especializados;
- conciliación e integración profunda con contabilidad.

---

## 20. Narrativa para la hackathon

### Problema

Los equipos globales siguen usando personas y sistemas fragmentados para decidir si cada gasto pequeño debe pagarse.

### Insight

La mayoría de los gastos no necesita un CFO, un modelo de frontera ni una revisión manual. Necesita la combinación correcta de reglas, juicio semántico económico y escalamiento seguro.

### Solución

CFO Agent transforma la política de la empresa en decisiones y pagos programáticos.

### Uso de JEV

JEV ofrece la capa de juicio semántico para grandes volúmenes de decisiones pequeñas sin enviar cada operación a un modelo más costoso.

### Uso de Stellar

Stellar permite que un gasto aprobado se convierta inmediatamente en un movimiento de USDC trazable y programático.

### Frase de cierre

> **Rules when possible. JEV when judgment is needed. LLMs only for exceptions. Stellar when money needs to move.**

---

## 21. Pitch de 30 segundos

> CFO Agent is an autonomous spend manager for global teams. A company defines its expense policy once, and our decision engine evaluates every corporate purchase or reimbursement using deterministic rules first, JEV for low-cost semantic judgment, and LLMs or humans only for exceptions. Approved reimbursements are settled instantly in USDC on Stellar. For the hackathon, we demonstrate a real reimbursement flow and a simulated corporate card authorization using the same policy engine.

---

## 22. Decisiones de producto cerradas

- El nombre de trabajo será **CFO Agent**.
- El posicionamiento será **Autonomous spend management for global teams**.
- El producto cubrirá tarjetas corporativas y reembolsos bajo un mismo motor.
- El MVP funcional priorizará reembolsos.
- La tarjeta se demostrará mediante un flujo de autorización simulado.
- La arquitectura será `Rules → JEV → LLM/Human`.
- JEV no tendrá control directo sobre la wallet.
- Stellar y USDC serán la capa de tesorería y pago.
- La revisión humana se mantendrá para excepciones y baja confianza.
- La demo mostrará explicaciones y trazabilidad, no una caja negra.

---

## 23. Decisiones pendientes

- nombre definitivo y disponibilidad de marca;
- custodial vs. non-custodial para empresa y empleados;
- proveedor de extracción de comprobantes;
- formato exacto del policy schema;
- preguntas y outputs finales enviados a JEV;
- umbrales de confianza por categoría y monto;
- framework y stack técnico del MVP;
- modelo de autorización sobre la treasury wallet;
- diseño de integración futura con emisores de tarjetas;
- país y perfil de empresa para el primer piloto.

---

## 24. Definición del producto en una línea

> **CFO Agent applies company policy to every expense, authorizes or reimburses it, and settles approved payments in USDC on Stellar.**
