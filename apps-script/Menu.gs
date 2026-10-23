/**
 * Menú, acciones manuales y actualización automática.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Control Ingreso')
    .addItem('1. Traer planilla de ingresos', 'accionImportar')
    .addItem('2. Homologar proveedores...', 'abrirHomologacion')
    .addItem('3. Actualizar control', 'accionActualizarControl')
    .addSeparator()
    .addItem('Actualizar todo (traer + control)', 'accionActualizarTodo')
    .addItem('Detectar proveedores nuevos', 'accionSincronizarHomologacion')
    .addSeparator()
    .addItem('Activar actualización automática', 'accionInstalarTrigger')
    .addItem('Desactivar actualización automática', 'accionQuitarTrigger')
    .addItem('Estado del proceso', 'accionEstado')
    .addItem('Verificar instalación', 'accionVerificar')
    .addToUi();
}

/** Importa + recalcula. Es la función que corre el trigger horario. */
function actualizarTodo() {
  const candado = LockService.getDocumentLock();
  if (!candado.tryLock(30000)) {
    throw new Error('Hay otra actualización en curso. Intenta de nuevo en un momento.');
  }
  try {
    const importacion = importarPlanillaOrigen();
    sincronizarHomologacion();
    const resumen = actualizarControl();
    PropertiesService.getDocumentProperties().setProperty('ultimaActualizacion', new Date().toISOString());
    return { importacion: importacion, control: resumen };
  } finally {
    candado.releaseLock();
  }
}

function accionImportar() {
  try {
    const resultado = importarPlanillaOrigen();
    SpreadsheetApp.getUi().alert(resumenImportacion(resultado));
  } catch (error) {
    SpreadsheetApp.getUi().alert('No se pudo importar:\n\n' + error.message);
  }
}

function accionActualizarControl() {
  try {
    const resumen = actualizarControl();
    SpreadsheetApp.getUi().alert(
      'Control actualizado para ' + etiquetaMes(resumen.periodo) + '.\n' +
      resumen.proveedores + ' proveedores, ' + resumen.camionesPlanilla + ' camiones en planilla, ' +
      resumen.filasSap + ' líneas SAP.'
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert('No se pudo actualizar el control:\n\n' + error.message);
  }
}

function accionActualizarTodo() {
  try {
    const resultado = actualizarTodo();
    SpreadsheetApp.getUi().alert(
      resumenImportacion(resultado.importacion) + '\n\n' +
      'Control del período ' + etiquetaMes(resultado.control.periodo) + ' recalculado.'
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert('Falló la actualización:\n\n' + error.message);
  }
}

/** Texto para contarle al usuario qué se trajo. */
function resumenImportacion(resultado) {
  const detalle = resultado.hojas.map(function (hoja) {
    return '  • ' + hoja.hoja + ': ' + hoja.filas + ' camiones';
  }).join('\n');
  return 'Planilla "' + resultado.archivo + '" traída a "' + CONFIG.HOJA_PLANILLA + '".\n' +
    detalle + '\n\nTotal: ' + resultado.filas + ' camiones.' +
    (resultado.aviso ? '\n\nAtención: ' + resultado.aviso : '');
}

function accionSincronizarHomologacion() {
  try {
    const resultado = sincronizarHomologacion();
    SpreadsheetApp.getUi().alert(
      resultado.agregadas + ' proveedor(es) nuevo(s) agregados a la hoja "' +
      CONFIG.HOJA_HOMOLOGACION + '". Revisa las sugerencias antes de actualizar el control.'
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert('No se pudo sincronizar la homologación:\n\n' + error.message);
  }
}

/**
 * Diagnóstico: qué versión está pegada, qué hojas hay y a qué columna quedó
 * asociado cada campo. Sirve para detectar un archivo pegado a medias.
 */
function verificarInstalacion() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const lineas = ['Versión del código: ' + VERSION, ''];

  [CONFIG.HOJA_SAP, CONFIG.HOJA_PLANILLA, CONFIG.HOJA_PLAN, CONFIG.HOJA_HOMOLOGACION]
    .forEach(function (nombre) {
      const hoja = libro.getSheetByName(nombre);
      lineas.push(hoja
        ? '✓ ' + nombre + ': ' + Math.max(0, hoja.getLastRow() - 1) + ' filas'
        : '✗ falta la hoja "' + nombre + '"');
    });

  const datos = leerHoja(libro, CONFIG.HOJA_PLANILLA);
  if (datos.length) {
    const col = ubicarColumnas(datos[0], COLUMNAS.PLANILLA);
    lineas.push('', 'Columnas de "' + CONFIG.HOJA_PLANILLA + '":');
    Object.keys(col).forEach(function (campo) {
      const indice = col[campo];
      lineas.push('  ' + campo + ': ' +
        (indice >= 0 ? columnaLetra(indice + 1) + ' (' + datos[0][indice] + ')' : 'NO ENCONTRADA'));
    });
  }

  const planilla = cargarPlanilla(libro);
  lineas.push('', 'Camiones leídos: ' + planilla.filas.length +
    ' | descartados: ' + planilla.excluidosProducto + ' por producto, ' +
    planilla.excluidosEstado + ' por estado');
  if (planilla.filas.length) {
    const primera = planilla.filas[0];
    lineas.push('Primer camión: hoja origen "' + primera.hojaOrigen +
      '", fila origen ' + primera.filaOrigen);
  }

  const texto = lineas.join('\n');
  Logger.log(texto);
  return texto;
}

function accionVerificar() {
  try {
    SpreadsheetApp.getUi().alert(verificarInstalacion());
  } catch (error) {
    SpreadsheetApp.getUi().alert('No se pudo verificar:\n\n' + error.message);
  }
}

function accionEstado() {
  const propiedades = PropertiesService.getDocumentProperties();
  const trigger = triggerActual();
  const mensaje = [
    'Planilla origen: ' + (propiedades.getProperty('nombreOrigen') || '(sin importar aún)'),
    'Hoja origen: ' + (propiedades.getProperty('hojaOrigen') || '-'),
    'Camiones importados: ' + (propiedades.getProperty('filasImportadas') || '0'),
    'Última importación: ' + (propiedades.getProperty('ultimaImportacion') || '-'),
    'Última actualización: ' + (propiedades.getProperty('ultimaActualizacion') || '-'),
    'Actualización automática: ' + (trigger ? 'activa cada ' + CONFIG.HORAS_ENTRE_ACTUALIZACIONES + ' h' : 'desactivada')
  ].join('\n');
  SpreadsheetApp.getUi().alert(mensaje);
}
