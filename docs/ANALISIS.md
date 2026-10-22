# Control de ingreso de subproductos (astilla verde) — análisis del caso

## Problema

SAP registra los ingresos recién después de pasar por 5 fases, así que la
información de `Ingresos Sap` siempre viene atrasada: hay cargas de ayer y
cargas de hace semanas que todavía no aparecen. El registro físico sí existe
desde el primer día, pero vive en **otra planilla, escrita a mano y de sólo
lectura** (`RECEPCION DIARIA MADERAS`, una fila = un camión).

Para controlar contra el plan del mes hay que mezclar las dos fuentes sin
contar dos veces el mismo camión.

## Fuentes

| Dónde | Qué es | Llave útil |
|---|---|---|
| `Ingreso astilla verde mapal` › `Ingresos Sap` | ingresos reales SAP (A:V), `Cantidad` en TS | `Nº Guia` + `Des. Proveedor` |
| `RECEPCION DIARIA MADERAS` (externa) | recepción diaria, **una hoja por mes** | `N° DE GUÍA` + `PROVEEDOR` |
| `Ingreso astilla verde mapal` › `Plan` | plan mensual por proveedor, `Precio` y una columna por mes (`oct-2026`) | `Proveedor` |
| `Ingreso astilla verde mapal` › `homologacion` | equivalencia SAP ↔ Planilla ↔ Plan | nombre |

### Rarezas de la planilla origen (resueltas en el importador)

- **Una hoja por mes**, con nombres irregulares: `Junio 2024`, `Sept 2024`,
  ` Nov 2024`, `MAY0 2025` (con typo), `SEPTIEMBRE 2026`. Se detectan por
  nombre y se importan las de los últimos `MESES_ATRAS_IMPORTAR` meses.
  `Hoja 4` y cualquier hoja que no sea un mes se ignoran.
- **Layouts distintos**: hasta abril 2025 la columna A es la fecha; desde mayo
  2025 la A es el correlativo `N°` y la fecha pasa a la B.
- **Encabezados sucios**: la columna A aparece como `fdd`, `Columna 1`, `Mas`,
  `gracias`, `{` o `,`. Las columnas se ubican por nombre y, cuando el nombre
  no sirve, la fecha se detecta por contenido.
- **`ESTADO` sin título**: en las hojas nuevas su encabezado quedó como
  `Columna 10`; se detecta por contenido (`OK`, `ANULADO`, ...).
- **`ORIGEN` / `COMUNA` / `Columna 5`**: los tres nombres apuntan a lo mismo.
- **`PESO BRUTO` en dos unidades**: toneladas en las hojas viejas (`33.190`) y
  kilos en las nuevas (`43660`). Se normaliza a toneladas (corte en 1.000).
- **Varios productos**: `ASTILLA VERDE`, `ASTILLA SECA`, `VIRUTA`,
  `COMBUSTIBLE`, `ASERRIN viruta`, `ASTILLA VERDE C/CORTEZA`. Se controla sólo
  lo que esté en `CONFIG.PRODUCTOS_INCLUIDOS` (por defecto `ASTILLA VERDE`,
  que es lo que hay en SAP y en el Plan).
- **Nombres de proveedor cortos**: `GUIVAR`, `COLLICURA`, `LEON`, `LEONERA`,
  `CSC`, `VOLCAN`, `MASISA`, `F.LEON`. De ahí la homologación.

## Cómo se calcula

1. **Importar**: se abren las hojas mensuales de la planilla origen (sólo
   lectura, nunca se le escribe) y se consolidan en `Planilla Exportada` con un
   formato único, guardando `Hoja origen` y `Fila origen` de cada camión.
2. **Cruce por guía**: para cada camión se busca `proveedor SAP + Nº de guía` en
   `Ingresos Sap` (sin ceros a la izquierda, sin puntos ni espacios). El
   proveedor es parte de la llave porque los números de guía se repiten entre
   proveedores.
   - Guía encontrada → **EN SAP**, cantidad real de SAP.
   - Guía no encontrada → **PENDIENTE**, se valoriza con el promedio
     `TS/camión` del proveedor (el "carga × promedio de cantidad de SAP":
     1 camión pendiente × promedio TS/camión).
3. **Promedio**: se calcula desde SAP por `proveedor + material`, con ventana
   móvil de 90 días medida desde la fecha SAP más reciente; si el proveedor no
   tiene suficientes camiones en la ventana se usa su histórico completo, y si
   no tiene nada (proveedor homologado sólo contra el Plan, como `CSC`), el
   promedio general. Todo queda auditable en `Promedios SAP`.
4. **Sólo SAP**: las guías que están en SAP y nunca se registraron a mano se
   suman aparte (`SOLO SAP`) para no perder cargas antiguas.
5. **Comparación con el plan**: se agrupa por el proveedor del `Plan`:
   `TS proyectada = TS real SAP + TS estimada de pendientes`.
6. **Homologación**: la hoja `homologacion` manda. El script propone candidatos
   comparando por palabras completas (ignora acentos, puntuación y
   LTDA/SPA/EIRL), de modo que `GUIVAR → COMERCIAL GUIVAR LTDA.` y
   `LEON → FORESTAL LEON LTDA` sin confundir `LEON` con `LEONERA`. El diálogo
   permite confirmar cada par a mano.

Una homologación puede tener **sólo el par del Plan** (proveedor que aún no
tiene movimientos en SAP): sus camiones igual se cuentan y se estiman con el
promedio general, marcados como `PENDIENTE (proveedor sin historial SAP)`.

## Período

El mes de cada camión se toma de la **fecha de ingreso físico** de la planilla
manual (`CONFIG.FECHA_BASE = 'PLANILLA'`), porque la fecha de contabilización
SAP está desfasada y movería cargas de un mes a otro. Se puede cambiar a
`'SAP'`. El mes a mostrar se escribe en `Control Ingreso!B2`.

## Salidas

- **`Control Ingreso`**: una fila por proveedor con camiones (planilla / en SAP
  / pendientes / sólo SAP), TS real, factor TS/camión, TS estimada, TS
  proyectada, plan, avance %, desvío, precio y monto proyectado. Semáforo en
  avance %. Los proveedores del Plan sin plan ni movimiento no se listan.
- **`Detalle Camiones`**: camión por camión con su estado (EN SAP, PENDIENTE,
  PENDIENTE sin historial SAP, SIN HOMOLOGAR, SOLO SAP, GUIA DUPLICADA), de
  dónde salió su cantidad y su hoja/fila de origen.
- **`Promedios SAP`**: el factor usado por proveedor y material.

## Ojo con esto

- **`Ingresos Sap` también es un export manual** y hoy sólo tiene
  27-01-2026 a 27-02-2026. Mientras no se actualice, los camiones de meses
  posteriores van a aparecer todos como PENDIENTE (estimados). El control sirve
  igual, pero el cruce real depende de refrescar ese export.
- El plan está en **TS**, igual que `Cantidad` de SAP.
- `PESO BRUTO` es peso de romana con camión incluido: se informa como
  referencia y **no** se usa para estimar.
- Proveedores que aparecen en la planilla pero no están en el Plan (por
  ejemplo `MASISA` en astilla verde) salen listados con la alerta
  "Proveedor sin plan en el mes".
