/**
 * Actualización automática por tiempo.
 *
 * Se usa un trigger horario (no onEdit) porque la planilla origen es un archivo
 * externo: los cambios de otra gente no disparan eventos en este archivo.
 */
const NOMBRE_FUNCION_TRIGGER = 'actualizarTodo';

function instalarTrigger() {
  quitarTrigger();
  const horas = Math.max(1, Number(CONFIG.HORAS_ENTRE_ACTUALIZACIONES) || 1);
  ScriptApp.newTrigger(NOMBRE_FUNCION_TRIGGER)
    .timeBased()
    .everyHours(horas)
    .create();
  return horas;
}

function quitarTrigger() {
  let quitados = 0;
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === NOMBRE_FUNCION_TRIGGER) {
      ScriptApp.deleteTrigger(trigger);
      quitados++;
    }
  });
  return quitados;
}

function triggerActual() {
  const triggers = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === NOMBRE_FUNCION_TRIGGER;
  });
  return triggers.length ? triggers[0] : null;
}

function accionInstalarTrigger() {
  try {
    const horas = instalarTrigger();
    SpreadsheetApp.getUi().alert(
      'Actualización automática activada: cada ' + horas + ' hora(s) se trae la planilla ' +
      'de ingresos y se recalcula el control.'
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
