/**
 * Actualización automática.
 *
 * Hay dos disparadores y cada uno resuelve un problema distinto:
 *
 *   1. Por tiempo (cada CONFIG.HORAS_ENTRE_ACTUALIZACIONES horas) → trae la
 *      planilla origen. Es obligatorio que sea por tiempo: la planilla de
 *      recepción es un archivo externo, los camiones que escribe otra persona
 *      allá no generan ningún evento en este archivo.
 *
 *   2. Por edición (onEdit instalable) → recalcula el control cuando alguien
 *      completa una fila acá: en la planilla ya importada, en la homologación
 *      o en el plan. No vuelve a importar, porque importar sobrescribiría lo
 *      que la persona acaba de escribir.
 *
 * El onEdit no recalcula al instante: escribir una fila son varias ediciones
 * seguidas (fecha, proveedor, guía, peso) y recalcular en cada una dejaría el
 * control a medio llenar y agotaría la cuota. En cambio marca que hay trabajo
 * pendiente y programa un único recálculo CONFIG.SEGUNDOS_ESPERA_EDICION
 * después de la última edición.
 */
const NOMBRE_FUNCION_TRIGGER = 'actualizarTodo';
const NOMBRE_FUNCION_EDICION = 'alEditar';
const NOMBRE_FUNCION_PENDIENTE = 'recalcularPendiente';

/** Propiedades que llevan la cuenta del recálculo diferido. */
const PROP_EDICION_PENDIENTE = 'edicionPendiente';
const PROP_EDICION_MARCA = 'edicionMarca';

/** Si un recálculo quedó colgado más de esto, se vuelve a programar. */
const MINUTOS_PENDIENTE_VENCIDO = 10;

/** Hojas de este archivo cuyas ediciones obligan a recalcular. */
function hojasQueDisparan() {
  return [CONFIG.HOJA_PLANILLA, CONFIG.HOJA_HOMOLOGACION,
    CONFIG.HOJA_HOMOLOGACION_PRODUCTOS, CONFIG.HOJA_PLAN, CONFIG.HOJA_SAP];
}

/** ¿Una edición en esta hoja cambia el resultado del control? */
function hojaDispara(nombre) {
  const clave = claveProveedor(nombre);
  return hojasQueDisparan().some(function (hoja) {
    return claveProveedor(hoja) === clave;
  });
}

/**
 * Trigger instalable onEdit. Se mantiene corto a propósito: lo único que hace
 * es anotar que hay que recalcular. El trabajo pesado lo hace
 * recalcularPendiente() una vez que la persona dejó de escribir.
 */
function alEditar(e) {
  try {
    const hoja = e && e.range ? e.range.getSheet().getName() : '';
    if (!hoja || !hojaDispara(hoja)) return;
    programarRecalculo();
  } catch (error) {
    // Un trigger que falla deja el archivo sin aviso ninguno: queda en el log.
    Logger.log('alEditar: ' + error.message);
  }
}

/**
 * Marca que hay ediciones sin procesar y deja programado un solo recálculo.
 * Cada edición posterior corre la marca de tiempo, así que el recálculo ocurre
 * SEGUNDOS_ESPERA_EDICION después de la última edición, no de la primera.
 */
function programarRecalculo() {
  const propiedades = PropertiesService.getDocumentProperties();
  const ahora = new Date();
  const pendiente = propiedades.getProperty(PROP_EDICION_PENDIENTE) === 'si';
  // El vencimiento se mide contra la marca anterior, así que se lee antes de
  // pisarla con la de esta edición.
  const vencido = pendienteVencido(propiedades, ahora);
  propiedades.setProperty(PROP_EDICION_PENDIENTE, 'si');
  propiedades.setProperty(PROP_EDICION_MARCA, ahora.toISOString());

  if (pendiente && !vencido) return false;

  quitarTriggersPendientes();
  const espera = Math.max(30, Number(CONFIG.SEGUNDOS_ESPERA_EDICION) || 60);
  ScriptApp.newTrigger(NOMBRE_FUNCION_PENDIENTE)
    .timeBased()
    .after(espera * 1000)
    .create();
  return true;
}

/**
 * Un recálculo programado que nunca corrió (el usuario cerró, falló el
 * trigger, se perdió la ejecución) dejaría la marca encendida para siempre y
 * ninguna edición volvería a programar nada. Después de unos minutos se da por
 * vencido y se reprograma.
 */
function pendienteVencido(propiedades, ahora) {
  const marca = propiedades.getProperty(PROP_EDICION_MARCA);
  if (!marca) return true;
  const antes = new Date(marca);
  if (isNaN(antes.getTime())) return true;
  const minutos = (ahora.getTime() - antes.getTime()) / 60000;
  return minutos > MINUTOS_PENDIENTE_VENCIDO;
}

/**
 * Recalcula el control por las ediciones acumuladas. No importa la planilla:
 * eso lo hace el trigger horario, y hacerlo acá borraría lo que la persona
 * acaba de escribir en la hoja importada.
 */
function recalcularPendiente() {
  quitarTriggersPendientes();
  const propiedades = PropertiesService.getDocumentProperties();
  if (propiedades.getProperty(PROP_EDICION_PENDIENTE) !== 'si') return null;

  const candado = LockService.getDocumentLock();
  if (!candado.tryLock(30000)) {
    // Hay una actualización en curso; esa va a recalcular igual. Se reintenta
    // más tarde para no perder las ediciones que llegaron mientras tanto.
    propiedades.setProperty(PROP_EDICION_MARCA, new Date().toISOString());
    ScriptApp.newTrigger(NOMBRE_FUNCION_PENDIENTE)
      .timeBased()
      .after(60 * 1000)
      .create();
    return null;
  }

  try {
    sincronizarEquivalencias();
    const resumen = actualizarControl();
    propiedades.deleteProperty(PROP_EDICION_PENDIENTE);
    propiedades.deleteProperty(PROP_EDICION_MARCA);
    propiedades.setProperty('ultimoRecalculoEdicion', new Date().toISOString());
    return resumen;
  } finally {
    candado.releaseLock();
  }
}

function instalarTrigger() {
  quitarTrigger();
  const horas = Math.max(1, Number(CONFIG.HORAS_ENTRE_ACTUALIZACIONES) || 1);
  ScriptApp.newTrigger(NOMBRE_FUNCION_TRIGGER)
    .timeBased()
    .everyHours(horas)
    .create();
  const segundos = instalarTriggerEdicion();
  return { horas: horas, segundos: segundos };
}

/**
 * onEdit instalable (no el simple): el simple no puede programar triggers ni
 * tomar el candado del documento, que es justo lo que necesita el recálculo.
 */
function instalarTriggerEdicion() {
  quitarTriggerEdicion();
  ScriptApp.newTrigger(NOMBRE_FUNCION_EDICION)
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  return Math.max(30, Number(CONFIG.SEGUNDOS_ESPERA_EDICION) || 60);
}

function quitarTriggersDe(nombreFuncion) {
  let quitados = 0;
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === nombreFuncion) {
      ScriptApp.deleteTrigger(trigger);
      quitados++;
    }
  });
  return quitados;
}

function quitarTrigger() {
  return quitarTriggersDe(NOMBRE_FUNCION_TRIGGER) +
    quitarTriggerEdicion();
}

function quitarTriggerEdicion() {
  const quitados = quitarTriggersDe(NOMBRE_FUNCION_EDICION) + quitarTriggersPendientes();
  const propiedades = PropertiesService.getDocumentProperties();
  propiedades.deleteProperty(PROP_EDICION_PENDIENTE);
  propiedades.deleteProperty(PROP_EDICION_MARCA);
  return quitados;
}

function quitarTriggersPendientes() {
  return quitarTriggersDe(NOMBRE_FUNCION_PENDIENTE);
}

function triggerDe(nombreFuncion) {
  const triggers = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === nombreFuncion;
  });
  return triggers.length ? triggers[0] : null;
}

function triggerActual() {
  return triggerDe(NOMBRE_FUNCION_TRIGGER);
}

function triggerEdicionActual() {
  return triggerDe(NOMBRE_FUNCION_EDICION);
}

function accionInstalarTrigger() {
  try {
    const instalado = instalarTrigger();
    SpreadsheetApp.getUi().alert(
      'Actualización automática activada.\n\n' +
      '• Cada ' + instalado.horas + ' hora(s) se trae la planilla de ingresos y se recalcula todo.\n' +
      '• Al editar "' + hojasQueDisparan().join('", "') + '" se recalcula el control ' +
      instalado.segundos + ' segundos después de la última edición.'
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert('No se pudo activar:\n\n' + error.message);
  }
}

function accionQuitarTrigger() {
  const quitados = quitarTrigger();
  SpreadsheetApp.getUi().alert(
    quitados ? 'Actualización automática desactivada.' : 'No había actualización automática activa.'
  );
}
