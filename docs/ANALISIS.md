# Control de ingreso de subproductos (astilla verde) — análisis del caso

## Problema

SAP registra los ingresos recién después de pasar por 5 fases, así que la
información de `Ingresos Sap` siempre viene atrasada: hay cargas de ayer y
cargas de hace semanas que todavía no aparecen. El registro físico sí existe
desde el primer día, pero vive en **otra planilla, escrita a mano y de sólo
lectura** (una fila = un camión por proveedor).

Para controlar contra el plan del mes hay que mezclar las dos fuentes sin
contar dos veces el mismo camión.

## Fuentes

| Hoja | Qué es | Llave útil |
|---|---|---|
| `Ingresos Sap` | ingresos reales SAP (A:V). `Cantidad` en TS | `Nº Guia` + `Des. Proveedor` |
| `Planilla Exportada` | copia de la planilla manual (1 fila = 1 camión) | `N° DE GUÍA` + `PROVEEDOR` |
| `Plan` | plan mensual por proveedor, con `Precio` y una columna por mes (`oct-2026`) | `Proveedor` |
| `homologacion` | equivalencia `Proveedor SAP` ↔ `Proveedor Planilla` ↔ `Proveedor Plan` | nombre |

## Cómo se calcula

1. **Importar**: el script abre la planilla manual por ID (sólo lectura, no se
   toca nada allá) y la copia completa a `Planilla Exportada`.
2. **Cruce por guía**: para cada camión de la planilla se busca su Nº de guía en
   SAP (comparación sin ceros a la izquierda, sin puntos ni espacios) exigiendo
   además que el proveedor homologado coincida.
   - Guía encontrada → **EN SAP**, se usa la cantidad real de SAP.
   - Guía no encontrada → **PENDIENTE**, se valoriza con el promedio
     `TS/camión` del proveedor (ese es el "multiplicar la carga por el promedio
     de cantidad de SAP": 1 camión pendiente × promedio TS/camión).
3. **Promedio**: se calcula desde SAP por `proveedor + material`, con ventana
   móvil de 90 días (configurable) medida desde la fecha SAP más reciente; si el
   proveedor no tiene suficientes camiones en la ventana se usa su histórico
   completo, y si no tiene nada, el promedio general. Queda auditable en la hoja
   `Promedios SAP`.
4. **Sólo SAP**: las guías que están en SAP y nunca se registraron a mano se
   suman aparte (`SOLO SAP`) para no perder cargas antiguas.
5. **Comparación con el plan**: todo se agrupa por el proveedor del `Plan` y se
   compara con la columna del mes:
   `TS proyectada = TS real SAP + TS estimada de pendientes`.
6. **Homologación**: la hoja `homologacion` manda. El script propone candidatos
   (similitud de nombres, ignorando acentos, puntuación y LTDA/SPA/EIRL) y hay un
   diálogo para confirmar a mano proveedor por proveedor.

## Período

El mes de cada camión se toma de la **fecha de ingreso físico** de la planilla
manual (`CONFIG.FECHA_BASE = 'PLANILLA'`), porque la fecha de contabilización SAP
está desfasada y movería cargas de un mes a otro. Se puede cambiar a `'SAP'`.
El mes a mostrar se escribe en la celda `B2` de `Control Ingreso`.

## Salidas

- **`Control Ingreso`**: una fila por proveedor con camiones (planilla / en SAP /
  pendientes / sólo SAP), TS real, factor TS/camión, TS estimada, TS proyectada,
  plan, avance %, desvío, precio y monto proyectado. Semáforo en avance %.
- **`Detalle Camiones`**: camión por camión con su estado (EN SAP, PENDIENTE,
  SIN HOMOLOGAR, SOLO SAP, GUIA DUPLICADA) y de dónde salió su cantidad.
- **`Promedios SAP`**: el factor usado por proveedor y material.

## Supuestos (confirmar)

1. La llave para saber si un camión ya está en SAP es el **Nº de guía**
   (`N° DE GUÍA` ↔ `Nº Guia`). Si la planilla manual no trae guía confiable, hay
   que cambiar a otra llave (fecha + patente, o Nº de ticket).
2. El plan está en **TS**, igual que `Cantidad` de SAP.
3. `PESO BRUTO` de la planilla manual es tonelada bruta de romana y **no** se usa
   para estimar: se informa sólo como referencia. Si se quisiera estimar con
   peso neto/bruto en vez del promedio, es un cambio chico.
4. Una guía puede repetirse en SAP en varias posiciones; se consume una por
   camión registrado.

## Pendiente

- ID de la planilla manual de ingresos (`CONFIG.ORIGEN_ID`).
- Si hay más materiales además de `ASTILLA VERDE (TS)` (3000039), conviene
  revisar cómo se escribe `PRODUCTO` en la planilla manual.
