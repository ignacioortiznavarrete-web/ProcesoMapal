/**
 * Homologación de productos entre las tres fuentes:
 *   Producto SAP  <->  Producto Planilla (escrito a mano)  <->  Producto Plan
 *
 * Es el mismo problema que con los proveedores, y por el mismo motivo: cada
 * fuente escribe el material a su manera. SAP le agrega la unidad y usa su
 * propia nomenclatura ('VIRUTA-ASERUTA (TS)'), la planilla de recepción se
 * llena a mano ('viruta') y el Plan usa el nombre comercial. Sin traducir esos
 * nombres pasan dos cosas, las dos silenciosas:
 *
 *   - el control abre una fila por cada forma de escribirlo, así que la misma
 *     viruta queda partida en dos y ninguna cuadra contra el plan;
 *   - el promedio TS/carga del material no se encuentra, y los camiones que
 *     SAP todavía no procesó quedan en cero.
 *
 * La hoja 'homologacion productos' es la fuente de verdad; CONFIG.PRODUCTOS_
 * EQUIVALENTES sólo da el punto de partida.
 */

/**
 * Traduce el producto escrito a mano en la planilla.
 * Devuelve { sap, plan, canonico, homologado }.
 *
 * 'canonico' es el nombre con que ese material se agrupa en el control: el del
 * Plan si existe (es contra ese plan que hay que cuadrar), y si no, el de la
 * planilla. Nunca el de SAP, que es el menos legible de los tres.
 */
function resolverProducto(nombrePlanilla, homologacionProductos, sap, plan) {
  const limpio = productoCorto(nombrePlanilla);
  const vacio = { sap: '', plan: '', canonico: limpio, homologado: false };
  if (!limpio) return vacio;

  const clave = claveProducto(limpio);
  const registro = homologacionProductos.porPlanilla[clave];
  let nombreSap = registro && registro.sap ? registro.sap : '';
  let nombrePlan = registro && registro.plan ? registro.plan : '';

  // Si el nombre manual ya coincide con uno de SAP salvo la unidad, no hace
  // falta mapa: 'VIRUTA' contra 'VIRUTA (TS)' es el mismo material.
  if (!nombreSap) nombreSap = materialSapExacto(limpio, sap);
  if (!nombrePlan) nombrePlan = productoPlanExacto(nombreSap || limpio, plan);

  return {
    sap: nombreSap,
    plan: nombrePlan,
    canonico: nombrePlan || limpio,
    // Un producto que figura en la tabla ya está reconocido, aunque no tenga
    // par en SAP ni en el Plan: no hay nada que homologar, y avisar de él cada
    // mes sería ruido que tapa los de verdad.
    homologado: !!(registro || nombreSap || nombrePlan)
  };
}

/**
 * Nombre con que se agrupa un material que sólo aparece en SAP. Una carga sin
 * registro manual tiene que caer en la MISMA fila del control que los camiones
 * de ese material, no en una fila aparte con el nombre de SAP.
 */
function resolverProductoDesdeSap(nombreSap, homologacionProductos, plan) {
  const limpio = productoCorto(nombreSap);
  if (!limpio) return '';

  const registro = homologacionProductos.porSap[claveProducto(limpio)];
  if (registro) {
    if (registro.plan) return registro.plan;
    if (registro.planilla) return productoCorto(registro.planilla);
  }

  const delPlan = productoPlanExacto(limpio, plan);
  return delPlan || limpio;
}

/** Material de SAP que corresponde a un nombre, comparando sin la unidad. */
function materialSapExacto(nombre, sap) {
  const clave = claveProducto(nombre);
  if (!clave) return '';
  const exacto = (sap && sap.materiales ? sap.materiales : []).filter(function (candidato) {
    return claveProducto(candidato) === clave;
  });
  return exacto.length === 1 ? exacto[0] : '';
}

/** Producto del Plan que corresponde a un nombre. */
function productoPlanExacto(nombre, plan) {
  const clave = claveProducto(nombre);
  if (!clave) return '';
  const exacto = (plan && plan.productos ? plan.productos : []).filter(function (candidato) {
    return claveProducto(candidato) === clave;
  });
  return exacto.length === 1 ? exacto[0] : '';
}

/**
 * Agrega a 'homologacion productos' los nombres que todavía no están, con una
 * sugerencia. Nunca toca filas existentes.
 */
function sincronizarHomologacionProductos() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = obtenerHoja(libro, CONFIG.HOJA_HOMOLOGACION_PRODUCTOS, true);
  asegurarEncabezadosProductos(hoja);

  const sap = cargarSap(libro);
  const plan = cargarPlan(libro);
  const planilla = cargarPlanilla(libro);
  const tabla = cargarHomologacionProductos(libro);

  // Lo que viene de CONFIG no está escrito en la hoja: se baja para que quede
  // a la vista y se pueda corregir sin tocar el código.
  const enHoja = {};
  tabla.filas.forEach(function (registro) {
    if (registro.filaHoja > 0 && registro.planilla) {
      enHoja[claveProducto(registro.planilla)] = true;
    }
    if (registro.filaHoja > 0 && registro.sap) {
      enHoja[claveProducto(registro.sap)] = true;
    }
  });

  const nuevas = [];
  const agregadas = {};

  function pendiente(clave) {
    return !enHoja[clave] && !agregadas[clave];
  }

  (CONFIG.PRODUCTOS_EQUIVALENTES || []).forEach(function (equivalencia) {
    const clave = claveProducto(equivalencia.planilla || equivalencia.sap);
    if (!clave || !pendiente(clave)) return;
    agregadas[clave] = true;
    nuevas.push([
      comoTexto(equivalencia.sap),
      comoTexto(equivalencia.planilla),
      comoTexto(equivalencia.plan),
      1,
      'Equivalencia por defecto - revisar'
    ]);
  });

  planilla.productos.forEach(function (nombre) {
    const clave = claveProducto(nombre);
    if (!clave || !pendiente(clave)) return;
    agregadas[clave] = true;
    const candidatoSap = mejorCoincidencia(productoCorto(nombre), sap.materiales);
    const base = candidatoSap.puntaje >= CONFIG.UMBRAL_SUGERENCIA ? candidatoSap.valor : nombre;
    const candidatoPlan = mejorCoincidencia(productoCorto(base), plan.productos || []);
    nuevas.push([
      candidatoSap.puntaje >= CONFIG.UMBRAL_SUGERENCIA ? candidatoSap.valor : '',
      productoCorto(nombre),
      candidatoPlan.puntaje >= CONFIG.UMBRAL_SUGERENCIA ? candidatoPlan.valor : '',
      redondear(Math.min(candidatoSap.puntaje, candidatoPlan.puntaje || candidatoSap.puntaje), 2),
      candidatoSap.puntaje >= CONFIG.UMBRAL_SUGERENCIA ? 'Sugerido - revisar' : 'Revisar a mano'
    ]);
  });

  sap.materiales.forEach(function (nombre) {
    const clave = claveProducto(nombre);
    if (!clave || !pendiente(clave)) return;
    if (nuevas.some(function (fila) { return claveProducto(fila[0]) === clave; })) return;
    agregadas[clave] = true;
    const candidatoPlan = mejorCoincidencia(productoCorto(nombre), plan.productos || []);
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
  return { agregadas: nuevas.length, total: tabla.filas.length + nuevas.length };
}

function asegurarEncabezadosProductos(hoja) {
  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, 3).setValues([['Producto SAP', 'Producto Planilla', 'Producto Plan']]);
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
