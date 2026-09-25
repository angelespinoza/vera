# Vera — Brief funcional

## Qué es

**Vera** es un agente de CFO autónomo para gestión de gastos y reembolsos. Recibe un
comprobante de gasto (foto o carga masiva), lo analiza, decide si cumple la
política de la empresa y, si lo aprueba, **paga el reembolso en USDC de forma
automática** — sin que un humano tenga que revisar y aprobar cada transacción
una por una.

Corre sobre Stellar (testnet), con Jev (TypeSafe AI) como motor de juicio
semántico y Gemini/OpenAI como soporte de visión y comparación.

## El problema que resuelve

- **Revisión manual repetitiva**: alguien de finanzas revisa cada recibo a mano.
- **Políticas difíciles de aplicar de forma consistente**: dos personas pueden
  interpretar "gasto razonable" distinto.
- **Reembolsos lentos**, sobre todo para equipos remotos/internacionales que
  esperan días para que les regresen su dinero.

## Cómo funciona (flujo de un gasto)

1. **El empleado sube un comprobante** (foto) o el CFO carga un Excel con
   varios gastos a la vez.
2. **Extracción**: si es una foto, un LLM con visión (Gemini/OpenAI) extrae
   monto, comercio, fecha y categoría del recibo.
3. **Reglas determinísticas**: ¿la categoría existe en la política?, ¿el monto
   está dentro del límite?, ¿hay algo explícitamente prohibido (ej. alcohol)?,
   ¿la fecha es válida? Si algo falla aquí, se rechaza de inmediato — sin
   gastar una sola llamada a un modelo.
4. **Jev evalúa el criterio semántico**: ¿cumple la política?, ¿el propósito de
   negocio es creíble?, ¿la evidencia es suficiente?, ¿amerita revisión
   humana? Cada pregunta regresa una probabilidad calibrada (0–1), no un sí/no
   binario.
5. **Motor de decisión**: combina reglas + Jev con un umbral de confianza y
   produce un veredicto: **Aprobado**, **Rechazado** o **Requiere revisión**.
6. **Pago automático**: si se aprueba, Vera firma y envía el reembolso en USDC
   a la wallet Stellar del empleado — en segundos, sin intervención humana.

En paralelo (nunca en el camino de la decisión), un **LLM genérico** evalúa el
mismo gasto con las mismas preguntas, solo para comparar qué tan seguido
coincide con Jev y a qué velocidad/costo. Esta vía es puramente informativa:
jamás autoriza un pago.

## El principio de seguridad

**AI recomienda. La política decide. Stellar ejecuta.**

Ningún modelo de lenguaje mueve dinero por sí mismo. La decisión de pagar sale
siempre del motor de reglas + Jev, nunca directamente de un LLM genérico ni de
un paso de "aprobación de IA" sin reglas debajo.

## Los módulos del producto

| Página | Para qué sirve |
|---|---|
| **Treasury** | Balance de la wallet de la empresa (XLM/USDC) en Stellar testnet, listo para fondear. |
| **Política** | La política de gastos en lenguaje natural, compilada automáticamente a reglas estructuradas (límites por categoría, ítems prohibidos, aprobaciones requeridas). |
| **Empleados** | Alta de empleados con su propia wallet Stellar, donde reciben el reembolso. |
| **Gastos** | Donde se analiza y ejecuta el reembolso: subir un comprobante individual, o una carga masiva de Excel con simulación en vivo (útil para demos). |
| **Historial** | Todo lo ya evaluado: filtrable por estado/empleado/categoría, con el detalle completo de cada decisión (reglas, lectura de Jev, comparación con el LLM genérico). |
| **Métricas** | KPIs del sistema (gastos procesados, latencia de Jev, USDC liquidado) y dos gráficas reales: gasto por categoría en el tiempo, y decisiones (aprobado/revisión/rechazado) por semana. |

## La demo en vivo (carga masiva)

Se puede cargar un Excel con decenas de gastos y verlos procesarse **uno por
uno, en tiempo real**: cada fila corre reglas → Jev → decisión → pago, y el
panel muestra un "análisis en vivo" estilo terminal — comercio actual, las
métricas de Jev como barras de confianza, un grid de comercios que se va
coloreando conforme se resuelven, y un feed tipo consola con el resultado de
cada fila y su latencia.

## Qué lo hace distinto

- **Jev no es "otro LLM"**: es un motor construido específicamente para dar
  probabilidades calibradas, no solo texto que suena convincente. En pruebas
  con datos reales, Jev se mantiene consistente entre gastos parecidos (ej.
  85–96% de confianza en gastos limpios), mientras que un LLM genérico
  respondiendo la misma pregunta oscila mucho más (de 5% a 90%+) — coinciden
  en el veredicto final solo ~1 de cada 3 veces.
- **El pago es real, no simulado**: cuando Vera aprueba, de verdad firma y
  envía una transacción Stellar con USDC. En testnet, pero con la misma
  mecánica que producción.
- **Todo queda auditado**: cada decisión guarda el detalle completo — qué
  regla pasó o falló, qué dijo Jev, qué dijo el LLM comparativo, y si hubo
  divergencia con la decisión real.

## Estado actual

MVP funcional de punta a punta: alta de empresa → política → empleados →
carga de gasto (individual o masiva) → decisión automática → pago en Stellar
→ historial y métricas auditables. Desplegado en Railway.

Pendiente de calibrar con datos de producción reales: los umbrales de
confianza del motor de decisión (hoy basados en mediciones de datos de
prueba, documentados como ajustables en el propio código).
