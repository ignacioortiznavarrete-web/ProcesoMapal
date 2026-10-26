/**
 * Homologación de proveedores entre las tres fuentes:
 *   Proveedor SAP  <->  Proveedor Planilla (escrito a mano)  <->  Proveedor Plan
 *
 * La hoja 'homologacion' es la fuente de verdad: lo que se escribe ahí manda.
 * El script sólo propone candidatos y deja las filas listas para corregir.
 */

const HOMOLOGACION_EXTRA = ['Confianza', 'Estado'];

/**
 * Agrega a la hoja 'homologacion' los proveedores que todavía no están,
 * con una sugerencia de equivalencia. Nunca modifica filas ya existentes.
 */
function sincronizarHomologacion() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = obtenerHoja(libro, CONFIG.HOJA_HOMOLOGACION, true);
  asegurarEncabezadosHomologacion(hoja);

  const sap = cargarSap(libro);
  const plan = cargarPlan(libro);
  const planilla = cargarPlanilla(libro);
  const homologacion = cargarHomologacion(libro);

  const nuevas = [];

  planilla.proveedores.forEach(function (nombre) {
    if (homologacion.porPlanilla[claveProveedor(nombre)]) return;
    const candidatoSap = mejorCoincidencia(nombre, sap.proveedores);
    const base = candidatoSap.puntaje >= CONFIG.UMBRAL_SUGERENCIA ? candidatoSap.valor : nombre;
    const candidatoPlan = mejorCoincidencia(base, plan.proveedores);
    nuevas.push([
      candidatoSap.puntaje >= CONFIG.UMBRAL_SUGERENCIA ? candidatoSap.valor : '',
      nombre,
      candidatoPlan.puntaje >= CONFIG.UMBRAL_SUGERENCIA ? candidatoPlan.valor : '',
      redondear(Math.min(candidatoSap.puntaje, candidatoPlan.puntaje || candidatoSap.puntaje), 2),
      candidatoSap.puntaje >= CONFIG.UMBRAL_SUGERENCIA ? 'Sugerido - revisar' : 'Revisar a mano'
    ]);
  });

  sap.proveedores.forEach(function (nombre) {
    if (homologacion.porSap[claveProveedor(nombre)]) return;
    if (nuevas.some(function (fila) { return claveProveedor(fila[0]) === claveProveedor(nombre); })) return;
    const candidatoPlan = mejorCoincidencia(nombre, plan.proveedores);
    nuevas.push([
      nombre,
      '',
      candidatoPlan.puntaje >= CONFIG.UMBRAL_SUGERENCIA ? candidatoPlan.valor : '',
      redondear(candidatoPlan.puntaje, 2),
      'Sin nombre en la planilla manual aún'
    ]);
  });

  if (nuevas.length) {
    hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, 5).setValues(nuevas);
    hoja.autoResizeColumns(1, 5);
  }
  return { agregadas: nuevas.length, total: homologacion.filas.length + nuevas.length };
}

/** Asegura encabezados A:E en la hoja de homologación. */
function asegurarEncabezadosHomologacion(hoja) {
  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, 3).setValues([['Proveedor SAP', 'Proveedor Planilla', 'Proveedor Plan']]);
  }
  const ancho = Math.max(hoja.getLastColumn(), 3);
  const encabezados = hoja.getRange(1, 1, 1, ancho).getValues()[0];
  HOMOLOGACION_EXTRA.forEach(function (titulo, i) {
    const columna = 4 + i;
    if (!encabezados[columna - 1]) hoja.getRange(1, columna).setValue(titulo);
  });
  hoja.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');
  hoja.setFrozenRows(1);
}

/**
 * Traduce un nombre escrito a mano en la planilla a su par SAP y Plan.
 * Devuelve { sap, plan, estado }.
 */
function resolverProveedor(nombrePlanilla, homologacion, sap, plan) {
  const vacio = { sap: '', plan: '', estado: ESTADO.SIN_HOMOLOGAR };
  if (!nombrePlanilla) return vacio;

  const clave = claveProveedor(nombrePlanilla);
  const registro = homologacion.porPlanilla[clave];
  let nombreSap = registro && registro.sap ? registro.sap : '';
  let nombrePlan = registro && registro.plan ? registro.plan : '';

  // Si el nombre manual coincide exactamente con uno de SAP, no hace falta mapa.
  if (!nombreSap) {
    const exacto = sap.proveedores.filter(function (candidato) {
      return claveProveedor(candidato) === clave;
    });
    if (exacto.length === 1) nombreSap = exacto[0];
  }

  // Proveedor homologado sólo contra el Plan: todavía no tiene historial en
  // SAP, pero sus camiones igual se cuentan y se estiman con el promedio general.
  if (!nombreSap) {
    if (!nombrePlan) nombrePlan = planExacto(nombrePlanilla, plan);
    return nombrePlan
      ? { sap: '', plan: nombrePlan, estado: 'SIN SAP' }
      : vacio;
  }

  if (!nombrePlan) {
    const registroSap = homologacion.porSap[claveProveedor(nombreSap)];
    if (registroSap && registroSap.plan) nombrePlan = registroSap.plan;
  }
  if (!nombrePlan) nombrePlan = planExacto(nombreSap, plan);

  return {
    sap: nombreSap,
    plan: nombrePlan,
    estado: nombrePlan ? 'OK' : 'SIN PLAN'
  };
}

/** Par en el Plan para un nombre SAP, usando la tabla y luego coincidencia exacta. */
function resolverPlanDesdeSap(nombreSap, homologacion, plan) {
  if (!nombreSap) return '';
  const registro = homologacion.porSap[claveProveedor(nombreSap)];
  if (registro && registro.plan) return registro.plan;
  return planExacto(nombreSap, plan);
}

function planExacto(nombre, plan) {
  const clave = claveProveedor(nombre);
  const exacto = plan.proveedores.filter(function (candidato) {
    return claveProveedor(candidato) === clave;
  });
  return exacto.length === 1 ? exacto[0] : '';
}

// ---------------------------------------------------------------------------
// Diálogo de homologación
// ---------------------------------------------------------------------------

/** Abre la ventana para homologar proveedores a mano. */
function abrirHomologacion() {
  const html = HtmlService.createHtmlOutputFromFile('HomologacionUI')
    .setWidth(900)
    .setHeight(620);
  SpreadsheetApp.getUi().showModalDialog(html, 'Homologar proveedores');
}

/** Datos que consume el diálogo. */
function obtenerDatosHomologacion() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const sap = cargarSap(libro);
  const plan = cargarPlan(libro);
  const planilla = cargarPlanilla(libro);
  const homologacion = cargarHomologacion(libro);

  // Un ítem por proveedor de la planilla manual, más los SAP sin uso aún.
  const items = [];
  const vistos = {};

  planilla.proveedores.forEach(function (nombre) {
    const clave = claveProveedor(nombre);
    vistos[clave] = true;
    const registro = homologacion.porPlanilla[clave];
    const sugerenciaSap = registro && registro.sap
      ? { valor: registro.sap, puntaje: 1 }
      : mejorCoincidencia(nombre, sap.proveedores);
    const basePlan = registro && registro.plan ? registro.plan : sugerenciaSap.valor || nombre;
    const sugerenciaPlan = registro && registro.plan
      ? { valor: registro.plan, puntaje: 1 }
      : mejorCoincidencia(basePlan, plan.proveedores);
    items.push({
      origen: 'planilla',
      planilla: nombre,
      sap: sugerenciaSap.puntaje >= CONFIG.UMBRAL_SUGERENCIA ? sugerenciaSap.valor : '',
      plan: sugerenciaPlan.puntaje >= CONFIG.UMBRAL_SUGERENCIA ? sugerenciaPlan.valor : '',
      confirmado: !!(registro && registro.sap),
      camiones: planilla.filas.filter(function (fila) {
        return claveProveedor(fila.proveedor) === clave;
      }).length
    });
  });

  sap.proveedores.forEach(function (nombre) {
    const clave = claveProveedor(nombre);
    const yaMapeado = homologacion.porSap[clave] || items.some(function (item) {
      return claveProveedor(item.sap) === clave;
    });
    if (yaMapeado) return;
    const registro = homologacion.porSap[clave];
    const sugerenciaPlan = registro && registro.plan
      ? { valor: registro.plan, puntaje: 1 }
      : mejorCoincidencia(nombre, plan.proveedores);
    items.push({
      origen: 'sap',
      planilla: '',
      sap: nombre,
      plan: sugerenciaPlan.puntaje >= CONFIG.UMBRAL_SUGERENCIA ? sugerenciaPlan.valor : '',
      confirmado: false,
      camiones: 0
    });
  });

  return {
    items: items,
    proveedoresSap: sap.proveedores,
    proveedoresPlan: plan.proveedores
  };
}

/**
 * Escribe un par desde el panel web, sin recalcular las hojas.
 *
 * El panel recarga sus datos después, y recalcular el control acá además
 * dejaría la pantalla esperando por hojas que nadie está mirando.
 */
function asignarDesdePanel(proveedorPlanilla, proveedorSap, proveedorPlan) {
  const nombrePlanilla = String(proveedorPlanilla || '').trim();
  const nombreSap = String(proveedorSap || '').trim();
  const nombrePlan = String(proveedorPlan || '').trim();

  if (!nombrePlanilla) {
    throw new Error('Falta el nombre escrito en la planilla.');
  }

  if (!nombreSap && !nombrePlan) {
    throw new Error(
      'Elige al menos el proveedor SAP o el del Plan: si no, no hay ' +
      'equivalencia que escribir.'
    );
  }

  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = obtenerHoja(libro, CONFIG.HOJA_HOMOLOGACION, true);

  asegurarEncabezadosHomologacion(hoja);

  const homologacion = cargarHomologacion(libro);
  const registro = homologacion.porPlanilla[claveProveedor(nombrePlanilla)];
  const valores = [nombreSap, nombrePlanilla, nombrePlan, 1, 'Confirmado en el panel'];

  if (registro) {
    hoja.getRange(registro.filaHoja, 1, 1, 5).setValues([valores]);
  } else {
    hoja.getRange(hoja.getLastRow() + 1, 1, 1, 5).setValues([valores]);
  }

  return {
    planilla: nombrePlanilla,
    sap: nombreSap,
    plan: nombrePlan,
    actualizado: !!registro
  };
}

/**
 * Guarda el mapeo que viene del diálogo.
 * mapeos = [{ planilla, sap, plan }]
 */
function guardarHomologacion(mapeos) {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = obtenerHoja(libro, CONFIG.HOJA_HOMOLOGACION, true);
  asegurarEncabezadosHomologacion(hoja);
  const homologacion = cargarHomologacion(libro);

  let actualizadas = 0;
  const nuevas = [];

  (mapeos || []).forEach(function (mapeo) {
    const nombrePlanilla = String(mapeo.planilla || '').trim();
    const nombreSap = String(mapeo.sap || '').trim();
    const nombrePlan = String(mapeo.plan || '').trim();
    if (!nombrePlanilla && !nombreSap) return;

    const registro = nombrePlanilla
      ? homologacion.porPlanilla[claveProveedor(nombrePlanilla)]
      : homologacion.porSap[claveProveedor(nombreSap)];

    if (registro) {
      hoja.getRange(registro.filaHoja, 1, 1, 5).setValues([
        [nombreSap, nombrePlanilla, nombrePlan, 1, 'Confirmado a mano']
      ]);
      actualizadas++;
    } else {
      nuevas.push([nombreSap, nombrePlanilla, nombrePlan, 1, 'Confirmado a mano']);
    }
  });

  if (nuevas.length) {
    hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, 5).setValues(nuevas);
  }
  hoja.autoResizeColumns(1, 5);

  const resumen = actualizarControl();
  return {
    actualizadas: actualizadas,
    agregadas: nuevas.length,
    periodo: resumen.periodo
  };
}
