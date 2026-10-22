/**
 * Trae la planilla manual de ingresos (archivo externo de sólo lectura)
 * hacia la hoja 'Planilla Exportada' de este archivo.
 *
 * Se copia tal cual (encabezados incluidos); el resto del código ubica las
 * columnas por nombre, así que no importa el orden en que vengan.
 */
function importarPlanillaOrigen() {
  if (!CONFIG.ORIGEN_ID || CONFIG.ORIGEN_ID.indexOf('PEGAR_AQUI') === 0) {
    throw new Error(
      'Falta configurar CONFIG.ORIGEN_ID en Config.gs con el ID de la planilla de ingresos.'
    );
  }

  const origen = SpreadsheetApp.openById(CONFIG.ORIGEN_ID);
  const hojaOrigen = CONFIG.ORIGEN_HOJA
    ? origen.getSheetByName(CONFIG.ORIGEN_HOJA)
    : origen.getSheets()[0];

  if (!hojaOrigen) {
    throw new Error('No se encontró la hoja "' + CONFIG.ORIGEN_HOJA + '" en la planilla origen.');
  }

  const filaEncabezado = Math.max(1, CONFIG.ORIGEN_FILA_ENCABEZADO);
  const ultimaFila = hojaOrigen.getLastRow();
  const ultimaColumna = hojaOrigen.getLastColumn();
  if (ultimaFila < filaEncabezado || ultimaColumna < 1) {
    throw new Error('La planilla origen no tiene datos.');
  }

  const datos = hojaOrigen
    .getRange(filaEncabezado, 1, ultimaFila - filaEncabezado + 1, ultimaColumna)
    .getValues();

  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const destino = obtenerHoja(libro, CONFIG.HOJA_PLANILLA, true);
  destino.clearContents();
  destino.getRange(1, 1, datos.length, ultimaColumna).setValues(datos);
  destino.setFrozenRows(1);

  const filasConDatos = contarFilasConDatos(datos);
  PropertiesService.getDocumentProperties().setProperties({
    ultimaImportacion: new Date().toISOString(),
    filasImportadas: String(filasConDatos),
    hojaOrigen: hojaOrigen.getName(),
    nombreOrigen: origen.getName()
  });

  return {
    archivo: origen.getName(),
    hoja: hojaOrigen.getName(),
    filas: filasConDatos
  };
}

/** Cuenta filas con algún dato, descontando el encabezado. */
function contarFilasConDatos(datos) {
  let total = 0;
  for (let i = 1; i < datos.length; i++) {
    const tieneDatos = datos[i].some(function (celda) {
      return celda !== '' && celda !== null && celda !== undefined;
    });
    if (tieneDatos) total++;
  }
  return total;
}

/** Fecha/hora de la última importación, o null. */
function ultimaImportacion() {
  const valor = PropertiesService.getDocumentProperties().getProperty('ultimaImportacion');
  return valor ? new Date(valor) : null;
}
