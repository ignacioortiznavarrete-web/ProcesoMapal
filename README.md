# ProcesoMapal — Control de ingreso de subproductos

Apps Script para controlar el ingreso de subproductos (astilla verde) contra el
plan mensual, mezclando los ingresos reales de SAP —que llegan desfasados por
las 5 fases— con la planilla manual de camiones.

La explicación del cálculo está en [`docs/ANALISIS.md`](docs/ANALISIS.md).

## Qué hace

- Trae la hoja del **mes en curso** de la planilla manual de ingresos
  (`RECEPCION DIARIA MADERAS`, archivo externo de sólo lectura, con una hoja
  por mes y encabezados irregulares) a la hoja `Planilla Exportada`.
- Cruza cada camión por Nº de guía contra `Ingresos Sap`.
- Los camiones de días que SAP todavía no procesó se valorizan con el promedio
  TS/carga del proveedor (hoja `Promedios SAP`). Una carga es una guía: si el
  pedido vino en varias posiciones, las líneas se suman antes de promediar.
- El corte es por proveedor: hasta su última fecha contabilizada manda SAP;
  desde ahí en adelante, la planilla por promedio. El peso bruto nunca se suma.
- Agrupa por proveedor del `Plan` usando la hoja `homologacion` y arma
  `Control Ingreso` (avance %, desvío, monto) y `Detalle Camiones`.
- Se actualiza solo con un trigger horario.

## Instalación

1. Abrir la planilla `Ingreso astilla verde mapal` →
   **Extensiones › Apps Script**.
2. Crear un archivo por cada `.gs` de `apps-script/` y pegar el contenido
   (también `HomologacionUI.html`). Si se usa [clasp](https://github.com/google/clasp):

   ```bash
   cd apps-script
   clasp login
   clasp clone <ID_DEL_SCRIPT>   # o clasp create --parentId <ID_DE_LA_PLANILLA>
   clasp push
   ```

3. `Config.gs` ya viene apuntando a `RECEPCION DIARIA MADERAS`
   (`ORIGEN_ID`) y a la hoja del mes en curso; revisar `PRODUCTOS_INCLUIDOS`.
   La cuenta que autorice el script tiene que tener acceso de lectura a esa
   planilla.
4. Recargar la planilla: aparece el menú **Control Ingreso**.
5. Correr, en orden:
   - `1. Traer planilla de ingresos`
   - `2. Homologar proveedores...` (confirmar los pares sugeridos)
   - `3. Actualizar control`
6. `Activar actualización automática` deja corriendo
   `traer + homologar + recalcular` cada hora (`CONFIG.HORAS_ENTRE_ACTUALIZACIONES`).

> La planilla origen sólo se lee: el script nunca escribe en ella.

## Ajustes frecuentes (`apps-script/Config.gs`)

| Parámetro | Para qué |
|---|---|
| `ORIGEN_ID` | planilla manual de ingresos |
| `ORIGEN_HOJA` | vacío = la hoja del mes en curso; con nombre = sólo esa |
| `MESES_A_IMPORTAR` | hojas mensuales a traer desde el mes actual (1 = sólo el mes en curso, 0 = todas) |
| `PRODUCTOS_INCLUIDOS` | productos a controlar (`['ASTILLA VERDE']`) |
| `ESTADOS_EXCLUIDOS` | estados de la planilla que se descartan (ANULADO...) |
| `PROMEDIO_VENTANA_DIAS` | días del promedio TS/camión (0 = todo el histórico) |
| `PROMEDIO_MINIMO_CAMIONES` | mínimo de cargas para confiar en la ventana |
| `TS_POR_CARGA_MINIMO` / `MAXIMO` | rango esperado por carga; fuera de él se avisa |
| `FECHA_BASE` | `'PLANILLA'` (fecha de ingreso físico) o `'SAP'` |
| `HORAS_ENTRE_ACTUALIZACIONES` | frecuencia del trigger |
| `UMBRAL_SUGERENCIA` | exigencia para sugerir una homologación |

El mes que muestra el control se escribe en `Control Ingreso!B2`
(por ejemplo `oct-2026`); vacío = mes en curso.

## Pruebas

La lógica de cálculo se puede correr fuera de Google con un simulador de las
APIs de Apps Script:

```bash
node tests/prueba.js
```

Reproduce las dos planillas reales (incluidas las hojas mensuales con
encabezados sucios) y valida: números con coma decimal, fechas `dd-mm-aaaa`,
claves de mes (`oct-2026`, `MAY0 2025`), guías con ceros a la izquierda,
`GUIVAR → COMERCIAL GUIVAR LTDA.` sin confundir `LEON` con `LEONERA`, el
descarte de productos y filas anuladas, el peso bruto normalizado a toneladas y
el cruce completo planilla ↔ SAP ↔ plan.
