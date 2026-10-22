# ProcesoMapal — Control de ingreso de subproductos

Apps Script para controlar el ingreso de subproductos (astilla verde) contra el
plan mensual, mezclando los ingresos reales de SAP —que llegan desfasados por
las 5 fases— con la planilla manual de camiones.

La explicación del cálculo está en [`docs/ANALISIS.md`](docs/ANALISIS.md).

## Qué hace

- Trae la planilla manual de ingresos (archivo externo, de sólo lectura) a la
  hoja `Planilla Exportada`.
- Cruza cada camión por Nº de guía contra `Ingresos Sap`.
- Los camiones que todavía no están en SAP se valorizan con el promedio
  TS/camión del proveedor (hoja `Promedios SAP`).
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

3. En `Config.gs` completar `ORIGEN_ID` con el ID de la planilla manual de
   ingresos (lo que va entre `/d/` y `/edit` en su URL) y, si corresponde,
   `ORIGEN_HOJA`.
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
| `ORIGEN_ID`, `ORIGEN_HOJA` | planilla manual de ingresos |
| `PROMEDIO_VENTANA_DIAS` | días del promedio TS/camión (0 = todo el histórico) |
| `PROMEDIO_MINIMO_CAMIONES` | mínimo de camiones para confiar en la ventana |
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

Valida el parseo de números con coma decimal, fechas `dd-mm-aaaa`, claves de
mes (`oct-2026`), guías con ceros a la izquierda, similitud de razones sociales
y el cruce completo planilla ↔ SAP ↔ plan.
