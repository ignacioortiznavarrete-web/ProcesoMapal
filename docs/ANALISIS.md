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
  ` Nov 2024`, `MAY0 2025` (con typo), `SEPTIEMBRE 2026`. Se busca sola la
  hoja del **mes en curso**; si todavía no existe se trae la más reciente y se
  avisa. Con `MESES_A_IMPORTAR` se pueden sumar meses anteriores (0 = todos).
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

1. **Importar**: se abre la hoja del mes en curso de la planilla origen (sólo
   lectura, nunca se le escribe) y se copia a `Planilla Exportada` en un
   formato único y en orden cronológico, guardando `Hoja origen` y
   `Fila origen` de cada camión.
2. **Cruce por guía**: para cada camión se busca `proveedor SAP + Nº de guía` en
   `Ingresos Sap` (sin ceros a la izquierda, sin puntos ni espacios). El
   proveedor es parte de la llave porque los números de guía se repiten entre
   proveedores.
   - Guía encontrada → **EN SAP**, cantidad real de esa carga.
   - Guía no encontrada y fecha **posterior** al corte de SAP de ese proveedor
     → **PENDIENTE**, se valoriza con el promedio `TS/carga` del proveedor
     (1 camión pendiente × promedio TS/carga).
   - Guía no encontrada y fecha **ya cubierta** por SAP → **SIN CRUCE**, suma
     0 TS. Ver "El corte de SAP" más abajo.
3. **Una carga = un camión = una guía.** Antes de promediar, las líneas de SAP
   se agrupan por `proveedor + guía`: una misma guía puede venir en dos
   posiciones del pedido y, contada línea por línea, el promedio por carga
   saldría a la mitad. Por eso el camión recibe la suma de sus líneas y el
   factor queda en el rango real (10 a 13 TS por carga en astilla verde). Si
   un promedio se sale de `TS_POR_CARGA_MINIMO`–`TS_POR_CARGA_MAXIMO`, se
   avisa en `Promedios SAP` y en las alertas del control.
4. **Promedio**: se calcula desde SAP por `proveedor + material`, con ventana
   móvil de 90 días medida desde la fecha SAP más reciente; si el proveedor no
   tiene suficientes camiones en la ventana se usa su histórico completo, y si
   no tiene nada (proveedor homologado sólo contra el Plan, como `CSC`), el
   promedio general. Todo queda auditable en `Promedios SAP`.
5. **Sólo SAP**: las guías que están en SAP y nunca se registraron a mano se
   suman aparte (`SOLO SAP`) para no perder cargas antiguas.
6. **Comparación con el plan**: se agrupa por el proveedor del `Plan`:
   `TS proyectada = TS real SAP + TS estimada de pendientes`.
7. **Homologación**: la hoja `homologacion` manda. El script propone candidatos
   comparando por palabras completas (ignora acentos, puntuación y
   LTDA/SPA/EIRL), de modo que `GUIVAR → COMERCIAL GUIVAR LTDA.` y
   `LEON → FORESTAL LEON LTDA` sin confundir `LEON` con `LEONERA`. El diálogo
   permite confirmar cada par a mano.

Una homologación puede tener **sólo el par del Plan** (proveedor que aún no
tiene movimientos en SAP): sus camiones igual se cuentan y se estiman con el
promedio general, marcados como `PENDIENTE (proveedor sin historial SAP)`.

## El corte de SAP

SAP va atrasado, pero no de forma indefinida: para cada proveedor hay una
**última fecha contabilizada** (`Fecha Contab.` máxima de ese proveedor). Esa
fecha es la frontera:

- **Hasta el corte**, SAP manda: su total real ya incluye todas las cargas de
  esos días. Un camión de la planilla en ese rango que no cruce por guía
  **no se estima** — se marca `SIN CRUCE` y suma 0 TS, porque su carga ya está
  contada en el total real de SAP. Estimarlo contaría dos veces lo mismo (una
  como estimación y otra como `SOLO SAP`). Lo que hay que revisar ahí es el
  Nº de guía, y la alerta del control lo dice.
- **Después del corte** (los días hábiles que SAP todavía no procesó), manda la
  planilla: cada fila es un camión y se multiplica por el promedio `TS/carga`
  de su proveedor.

El corte es por proveedor, no global: SAP puede estar al 22 con uno y al 16 con
otro. La columna `SAP hasta` del control muestra el de cada uno, y el
encabezado muestra el más reciente de todos.

Un proveedor sin ningún ingreso en SAP no tiene corte, así que todos sus
camiones se estiman.

## Período

El mes de cada camión se toma de la **fecha de ingreso físico** de la planilla
manual (`CONFIG.FECHA_BASE = 'PLANILLA'`), porque la fecha de contabilización
SAP está desfasada y movería cargas de un mes a otro. Se puede cambiar a
`'SAP'`. El mes a mostrar se escribe en `Control Ingreso!B2`.

## Productos

Se controlan `ASTILLA VERDE`, `ASERRIN*`, `COMBUSTIBLE` y `VIRUTA`
(`CONFIG.PRODUCTOS_INCLUIDOS`; el `*` final vale como prefijo, así `ASERRIN*`
toma también `ASERRIN SECO`). Cada producto lleva su propia fila de control:
si un proveedor entrega astilla y viruta, cada una se compara contra su plan,
nunca una suma de las dos.

### Cada fuente escribe el material a su manera

El mismo producto se llama distinto en las tres fuentes:

Los materiales que trae el export de SAP (verificado sobre octubre 2026, 779
líneas), con su factor real por carga:

| Código | SAP | Planilla manual | Plan | Cargas | TS/carga |
|---|---|---|---|---|---|
| 3000039 | `ASTILLA VERDE (TS)` | `ASTILLA VERDE` | `ASTILLA VERDE` | 608 | 11,32 |
| 3000043 | `ASERRIN (TS)` | `ASERRIN` | `ASERRIN` | 86 | 11,22 |
| 3000042 | `VIRUTA-ASERUTA (TS)` | `VIRUTA` | `VIRUTA` | 5 | 8,93 |
| 3009002 | `ASTILLA VERDE CON CORTEZA (TS)` | — | — | 29 | 9,42 |
| 3009003 | `ASTILLA VERDE OTRA ESPECIE MAD` | — | — | 40 | 15,83 |
| — | — | `COMBUSTIBLE` | — | — | — |

Tres cosas que se ven en esa tabla y conviene tener presentes:

- **Aserrín y viruta son materiales distintos en SAP** (`ASERRIN (TS)` y
  `VIRUTA-ASERUTA (TS)`), con factores que no se parecen: 11,22 contra 8,93.
- Las dos astillas que SAP separa (`CON CORTEZA`, `OTRA ESPECIE`) **no se
  mezclan** con la astilla verde: 9,42 y 15,83 contra 11,32. Quedan en su
  propia fila hasta que el negocio decida lo contrario; para juntarlas basta
  escribir `ASTILLA VERDE` en su columna `Producto Plan`.
- **`COMBUSTIBLE` no existe como material en SAP ni como línea del Plan.** Sus
  camiones se cuentan y se muestran en 0 TS, no desaparecen.

Con el nombre crudo eso rompe dos cosas, las dos sin avisar: el control abre
una fila por cada forma de escribirlo (la misma viruta partida en tres, ninguna
cuadrando contra el plan) y el promedio TS/carga del material no se encuentra,
así que los camiones que SAP todavía no procesó quedan en cero.

La hoja **`homologacion productos`** traduce los tres nombres, igual que
`homologacion` hace con los proveedores: `Producto SAP | Producto Planilla |
Producto Plan`. `Detectar proveedores y productos nuevos` la llena con una fila
por nombre encontrado y una sugerencia; lo que se escriba a mano manda.
`CONFIG.PRODUCTOS_EQUIVALENTES` trae las equivalencias conocidas de fábrica
para que el cruce funcione antes de que nadie toque la hoja.

El nombre con que se agrupa es el del **Plan** si existe (es contra ese plan
que hay que cuadrar) y si no el de la planilla; nunca el de SAP, que es el
menos legible. El detalle sí guarda el nombre original de cada fuente, para
poder rastrear de dónde salió cada fila.

La tabla se consulta **antes** del filtro `PRODUCTOS_INCLUIDOS`: si alguien
escribe `VIRUTILLA` y la tabla la traduce a viruta, el camión entra. Si no la
traduce y el nombre igual pasa el filtro (`ASERRIN HUMEDO` con `ASERRIN*`),
queda en 0 TS y el panel lo avisa, en vez de desaparecer sin dejar rastro.

### El promedio

El promedio TS/carga también es por material, y en ese orden:

1. el histórico SAP de **ese proveedor en ese material**;
2. si no tiene, el promedio de **ese material** en todos los proveedores;
3. si tampoco hay, **0 TS** con el motivo escrito en el detalle.

El paso 3 es deliberado: valorizar un camión de viruta con el factor de la
astilla del mismo proveedor (13 TS vs. 7,8) infla el avance sin que nadie lo
note. Es mejor que el camión quede visible en 0 con la alerta
"sin histórico SAP de \<producto\>" hasta que el export de SAP traiga el
material.

> El export de `Ingresos Sap` tiene que traer los materiales que se quieren
> controlar. Los que no estén ahí quedan en `PENDIENTE SIN PROMEDIO` con 0 TS
> y su alerta; si además el `Plan` no tiene filas para ellos, salen con
> "sin plan".

## Actualización automática

Dos disparadores, porque resuelven cosas distintas:

| | Qué corre | Cuándo |
|---|---|---|
| **Tiempo** (`actualizarTodo`) | importar + homologar + recalcular | cada `HORAS_ENTRE_ACTUALIZACIONES` |
| **Edición** (`alEditar` → `recalcularPendiente`) | homologar + recalcular | `SEGUNDOS_ESPERA_EDICION` después de la última edición en `Planilla Exportada`, `homologacion`, `homologacion productos`, `Plan` o `Ingresos Sap` |

El de tiempo no se puede reemplazar por el de edición: la planilla de
recepción es un **archivo externo**, y los camiones que otra persona escribe
allá no generan ningún evento en este archivo.

El de edición es un `onEdit` **instalable** (el simple no puede programar
triggers ni tomar el candado del documento) y está amortiguado: completar una
fila son varias celdas seguidas, así que `alEditar` sólo marca que hay trabajo
pendiente y corre la marca de tiempo; un único trigger diferido hace el
recálculo cuando la persona ya dejó de escribir. Ese recálculo **no vuelve a
importar**, porque importar sobrescribiría la fila recién escrita.

Dos detalles que evitan que quede colgado: si el recálculo encuentra el candado
tomado (hay una actualización horaria en curso) se reprograma en vez de perder
las ediciones, y si una marca pendiente lleva más de 10 minutos sin resolverse
se da por vencida y la siguiente edición vuelve a programar. `Estado del
proceso` muestra si hay ediciones sin procesar, y `Recalcular ahora` fuerza la
pasada.

## Salidas

- **`Control Ingreso`**: una fila por **producto + proveedor** con camiones (planilla / en SAP
  / pendientes / sólo SAP), TS real, factor TS/camión, TS estimada, TS
  proyectada, plan, avance %, desvío, precio y monto proyectado. Semáforo en
  avance %. Los proveedores del Plan sin plan ni movimiento no se listan.
- **`Detalle Camiones`**: camión por camión con su estado (EN SAP, PENDIENTE,
  PENDIENTE sin historial SAP, SIN HOMOLOGAR, SIN CRUCE, SOLO SAP,
  GUIA DUPLICADA), su producto, de
  dónde salió su cantidad y su hoja/fila de origen.
- **`Promedios SAP`**: el factor usado por proveedor y material.

## Ojo con esto

- **`Ingresos Sap` también es un export manual** y hoy sólo tiene
  27-01-2026 a 27-02-2026. Mientras no se actualice, los camiones de meses
  posteriores van a aparecer todos como PENDIENTE (estimados). El control sirve
  igual, pero el cruce real depende de refrescar ese export.
- Como por defecto se trae **sólo el mes en curso**, si se quiere mirar el
  control de un mes anterior hay que subir `MESES_A_IMPORTAR` (o poner ese mes
  en `CONFIG.ORIGEN_HOJA`) y volver a importar.
- El plan está en **TS**, igual que `Cantidad` de SAP.
- `PESO BRUTO` es peso de romana con camión incluido: se informa como
  referencia y **nunca** se suma ni se usa para estimar. Las TS salen siempre
  de SAP (real) o del promedio TS/carga (estimado).
- Proveedores que aparecen en la planilla pero no están en el Plan (por
  ejemplo `MASISA` en astilla verde) salen listados con la alerta
  "Proveedor sin plan en el mes".

## El panel web

`Tablero.gs` (el código) + `Panel.html` (la vista). Una sola llamada
(`getDashboardData`) entrega todo lo que la pantalla necesita; el navegador
filtra y dibuja sin volver al servidor.

Los nombres son distintos a propósito: Apps Script no admite dos archivos con
el mismo nombre aunque uno sea `.gs` y el otro `.html`, así que un `Panel.gs`
al lado de `Panel.html` no se puede crear.

El cruce no se repite ahí: lo resuelve `Motor.gs`, el mismo que escribe las
hojas. Si cada salida lo resolviera por su cuenta, tarde o temprano dirían
cifras distintas del mismo mes, y un panel que se contradice con su propia
planilla no se vuelve a mirar.

Lo que el panel agrega sobre las filas del motor:

- **Días hábiles con feriados calculados** (`Feriados.gs`): Pascua por el
  algoritmo gregoriano, el solsticio de junio por Meeus (el Día de los Pueblos
  Indígenas no es un 20 ni un 21 fijo) y las leyes 19.973 y 20.299, que corren
  el 29 de junio, el 12 de octubre y el 31 de octubre según el día en que
  caen. Lo único a mano es `FERIADOS_EXTRA`, para el feriado que declara una
  ley puntual y ninguna regla predice.
- **El plan prorrateado**: plan del mes × días hábiles corridos / días hábiles
  del mes. Sólo se compara dentro del mes vigente y sin filtro de fuente ni
  búsqueda: contra un rango que cruza meses sería comparar con otra cosa y
  llamarla cumplimiento.
- **El precio de cada fila**, del Plan por producto y proveedor, y de ahí el
  monto proyectado y la cobertura de precio.

### Qué muestra

| Sección | Para qué |
|---|---|
| La regla del mes | lo real, lo estimado, el plan a la fecha y el cierre, en un solo instrumento |
| Lectura | ocho cifras: real, estimado, plan, desvío, cierre, ritmo, sin cruce, cobertura de precio |
| Qué mirar hoy | las desviaciones escritas en una frase, con su cifra |
| Confiabilidad | cuánto del avance está cruzado y de cuántos proveedores depende |
| Acumulado vs plan | avance, plan prorrateado y proyección al ritmo observado |
| Ingreso diario | verde lo cruzado, rayado madera lo estimado, línea el plan diario |
| Mezcla y Pareto | participación por producto y concentración por proveedor |
| Proveedor por proveedor | plan, camiones, TS, brecha, factor TS/carga y hasta dónde cubre SAP |
| Detalle | camión por camión, con su estado y de dónde salió su cantidad |
| Homologación | los nombres sin par, con su asignación en la misma pantalla |

### Qué NO trae todavía

Comparación mes a mes, mapa de aserraderos con rutas, apuntes de reunión con
pauta automática y plan de acción por proveedor. Nada de eso necesita datos
nuevos salvo el mapa; se pueden agregar sobre esta misma base.
