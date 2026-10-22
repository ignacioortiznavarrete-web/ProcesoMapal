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
    SpreadsheetApp.getUi().alert(
      'Planilla traída desde "' + resultado.archivo + '" (hoja ' + resultado.hoja + ').\n' +
      resultado.filas + ' camiones cargados en "' + CONFIG.HOJA_PLANILLA + '".'
    );
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
      'Listo.\n\n' + resultado.importacion.filas + ' camiones importados.\n' +
      'Control del período ' + etiquetaMes(resultado.control.periodo) + ' recalculado.'
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert('Falló la actualización:\n\n' + error.message);
  }
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
