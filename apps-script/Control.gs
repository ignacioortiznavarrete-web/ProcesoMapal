/**
 * Motor del control de ingreso.
 *
 * Lógica:
 *   1. Cada fila de 'Planilla Exportada' es un camión que ingresó físicamente.
 *   2. Si su Nº de guía ya está en 'Ingresos Sap' -> se usa la cantidad real.
 *   3. Si todavía no está (desfase de las 5 fases de SAP) -> queda PENDIENTE y
 *      se valoriza con el promedio TS/camión de ese proveedor (ver Promedios.gs).
 *   4. Las guías que están en SAP y no en la planilla manual se suman como
 *      'SOLO SAP' para no perder cargas antiguas.
 *   5. Todo se agrupa por el proveedor del Plan (vía hoja 'homologacion') y se
 *      compara contra el plan del mes.
 */
function actualizarControl(periodoSolicitado) {
  const libro = SpreadsheetApp.getActiveSpreadsheet();

  const sap = cargarSap(libro);
  const planilla = cargarPlanilla(libro);
  const plan = cargarPlan(libro);
  const homologacion = cargarHomologacion(libro);
  const promedios = calcularPromedios(sap);
  escribirHojaPromedios(libro, promedios);

  const periodo = periodoSolicitado
    ? claveMes(periodoSolicitado)
    : periodoSeleccionado(libro, plan);

  // Índice de guías SAP por proveedor + guía: los números de guía se repiten
  // entre proveedores, así que la guía sola no identifica al camión.
  const porGuia = {};
  sap.filas.forEach(function (fila) {
    if (!fila.guia || !fila.desProveedor) return;
    const clave = claveProveedor(fila.desProveedor) + '|' + fila.guia;
    if (!porGuia[clave]) porGuia[clave] = [];
    porGuia[clave].push(fila);
  });

  const agregados = {};
  const detalle = [];
  const guiasVistas = {};

  // ---- 1) Camiones de la planilla manual -----------------------------------
  planilla.filas.forEach(function (fila) {
    const equivalencia = resolverProveedor(fila.proveedor, homologacion, sap, plan);
    const claveGuia = (fila.guia && equivalencia.sap)
      ? claveProveedor(equivalencia.sap) + '|' + fila.guia
      : '';
    const coincidencias = claveGuia ? (porGuia[claveGuia] || []) : [];
    const disponibles = coincidencias.filter(function (candidato) { return !candidato.usado; });
    const filaSap = disponibles.length ? disponibles[0] : null;
    if (filaSap) filaSap.usado = true;

    const mesPlanilla = claveMes(fila.fecha);
    const mesSap = filaSap ? claveMes(filaSap.fecha) : '';
    const mes = (CONFIG.FECHA_BASE === 'SAP' && mesSap) ? mesSap : (mesPlanilla || mesSap);

    let estado;
    let cantidad = 0;
    let fuente = '';
    let promedioUsado = 0;

    if (filaSap) {
      estado = ESTADO.EN_SAP;
      cantidad = filaSap.cantidad;
      fuente = 'SAP (real)';
    } else if (!equivalencia.sap && !equivalencia.plan) {
      estado = ESTADO.SIN_HOMOLOGAR;
      fuente = 'sin homologar';
    } else {
      const referencia = promedioPara(promedios, equivalencia.sap, fila.producto);
      promedioUsado = referencia.promedio;
      cantidad = referencia.promedio;
      fuente = 'estimado - ' + referencia.origen;
      if (referencia.promedio <= 0) estado = ESTADO.SIN_PROMEDIO;
      else if (!equivalencia.sap) estado = ESTADO.SIN_SAP;
      else estado = ESTADO.PENDIENTE;
    }

    if (fila.guia) {
      // El duplicado se mide por proveedor + guía, no por la guía sola.
      const claveDuplicado = claveProveedor(fila.proveedor) + '|' + fila.guia;
      if (guiasVistas[claveDuplicado]) estado = ESTADO.DUPLICADO + ' / ' + estado;
      guiasVistas[claveDuplicado] = true;
    }

    const esDuplicado = estado.indexOf(ESTADO.DUPLICADO) === 0;

    detalle.push([
      fila.filaHoja,
      fila.fecha || '',
      fila.producto,
      fila.proveedor,
      equivalencia.sap,
      equivalencia.plan,
      fila.guiaTexto,
      fila.patente,
      fila.pesoBruto === null ? '' : fila.pesoBruto,
      fila.ticket,
      estado,
      redondear(cantidad, 3),
      fuente,
      filaSap ? filaSap.documento : '',
      filaSap && filaSap.fecha ? filaSap.fecha : '',
      etiquetaMes(mes),
      fila.observacion,
      fila.hojaOrigen,
      fila.filaOrigen
    ]);

    if (mes !== periodo || esDuplicado) return;

    const agregado = obtenerAgregado(agregados, equivalencia, fila);
    agregado.camionesPlanilla++;
    if (filaSap) {
      agregado.camionesEnSap++;
      agregado.tsSap += cantidad;
    } else if (estado === ESTADO.SIN_HOMOLOGAR) {
      agregado.camionesSinHomologar++;
    } else {
      agregado.camionesPendientes++;
      agregado.tsEstimada += cantidad;
      if (promedioUsado > 0) agregado.promedioUsado = promedioUsado;
      if (estado === ESTADO.SIN_PROMEDIO) agregado.camionesSinPromedio++;
    }
  });

  // ---- 2) Guías que sólo están en SAP --------------------------------------
  sap.filas.forEach(function (filaSap) {
    if (filaSap.usado) return;
    const mes = claveMes(filaSap.fecha);
    const nombrePlan = resolverPlanDesdeSap(filaSap.desProveedor, homologacion, plan);

    detalle.push([
      '', filaSap.fecha || '', filaSap.desMaterial, '', filaSap.desProveedor, nombrePlan,
      filaSap.guiaTexto, '', '', '', ESTADO.SOLO_SAP,
      redondear(filaSap.cantidad, 3), 'SAP (real)', filaSap.documento,
      filaSap.fecha || '', etiquetaMes(mes), 'Sin registro en la planilla manual',
      CONFIG.HOJA_SAP, filaSap.filaHoja
    ]);

    if (mes !== periodo) return;

    const agregado = obtenerAgregado(agregados, {
      sap: filaSap.desProveedor,
      plan: nombrePlan,
      estado: nombrePlan ? 'OK' : 'SIN PLAN'
    }, { producto: filaSap.desMaterial, proveedor: filaSap.desProveedor });
    agregado.camionesSoloSap++;
    agregado.tsSoloSap += filaSap.cantidad;
  });

  // ---- 3) Filas del Plan sin movimiento ------------------------------------
  plan.filas.forEach(function (filaPlan) {
    const clave = 'PLAN|' + claveProveedor(filaPlan.proveedor);
    if (!agregados[clave]) {
      agregados[clave] = nuevoAgregado(filaPlan.producto, filaPlan.proveedor, '');
    }
    const agregado = agregados[clave];
    agregado.plan += filaPlan.cantidades[periodo] || 0;
    if (filaPlan.precio !== null && filaPlan.precio !== undefined) agregado.precio = filaPlan.precio;
    if (filaPlan.producto) agregado.producto = filaPlan.producto;
  });

  escribirHojaControl(libro, agregados, periodo, promedios, planilla);
  escribirHojaDetalle(libro, detalle);

  return {
    periodo: periodo,
    proveedores: Object.keys(agregados).length,
    camionesPlanilla: planilla.filas.length,
    filasSap: sap.filas.length
  };
}

function nuevoAgregado(producto, proveedorPlan, proveedorSap) {
  return {
    producto: producto || '',
    proveedorPlan: proveedorPlan || '',
    proveedorSap: proveedorSap || '',
    camionesPlanilla: 0,
    camionesEnSap: 0,
    camionesPendientes: 0,
    camionesSinHomologar: 0,
    camionesSinPromedio: 0,
    camionesSoloSap: 0,
    tsSap: 0,
    tsEstimada: 0,
    tsSoloSap: 0,
    promedioUsado: 0,
    plan: 0,
    precio: null
  };
}

/** Agrupa por proveedor del Plan; si no hay, por el de SAP; si no, el manual. */
function obtenerAgregado(agregados, equivalencia, fila) {
  let clave;
  let proveedorPlan;
  if (equivalencia.plan) {
    clave = 'PLAN|' + claveProveedor(equivalencia.plan);
    proveedorPlan = equivalencia.plan;
  } else if (equivalencia.sap) {
    clave = 'SAP|' + claveProveedor(equivalencia.sap);
    proveedorPlan = equivalencia.sap + ' (sin par en Plan)';
  } else {
    clave = 'MANUAL|' + claveProveedor(fila.proveedor);
    proveedorPlan = fila.proveedor + ' (sin homologar)';
  }
  if (!agregados[clave]) {
    agregados[clave] = nuevoAgregado(fila.producto, proveedorPlan, equivalencia.sap);
  }
  if (!agregados[clave].proveedorSap && equivalencia.sap) {
    agregados[clave].proveedorSap = equivalencia.sap;
  }
  return agregados[clave];
}

/** Período a mostrar: celda B2 del control, si no el mes actual, si no el del Plan. */
function periodoSeleccionado(libro, plan) {
  const hoja = libro.getSheetByName(CONFIG.HOJA_CONTROL);
  if (hoja && hoja.getLastRow() >= 2) {
    const clave = claveMes(hoja.getRange(2, 2).getValue());
    if (clave) return clave;
  }
  const actual = mesActual();
  if (!plan.meses.length || plan.meses.indexOf(actual) >= 0) return actual;

  const anteriores = plan.meses.filter(function (mes) { return mes <= actual; });
  return anteriores.length ? anteriores[anteriores.length - 1] : plan.meses[0];
}

const ENCABEZADOS_CONTROL = [
  'Producto', 'Proveedor (Plan)', 'Proveedor SAP',
  'Camiones planilla', 'Camiones en SAP', 'Camiones pendientes', 'Camiones sólo SAP',
  'TS real SAP', 'TS/camión prom.', 'TS estimada pendientes', 'TS proyectada',
  'Plan TS', 'Avance %', 'Desvío TS', 'Precio', 'Monto proyectado', 'Alertas'
];

function escribirHojaControl(libro, agregados, periodo, promedios, planilla) {
  const hoja = obtenerHoja(libro, CONFIG.HOJA_CONTROL, true);
  hoja.clear();

  const importacion = ultimaImportacion();
  const propiedades = PropertiesService.getDocumentProperties();

  hoja.getRange(1, 1).setValue('CONTROL DE INGRESO vs PLAN')
    .setFontWeight('bold').setFontSize(14);
  const productos = (CONFIG.PRODUCTOS_INCLUIDOS || []).join(', ') || '(todos)';
  hoja.getRange(2, 1, 2, 8).setValues([
    ['Período', etiquetaMes(periodo), 'Actualizado', new Date(),
     'Base de fecha', CONFIG.FECHA_BASE, 'Productos', productos],
    ['Planilla origen', propiedades.getProperty('nombreOrigen') || '(sin importar)',
     'Última importación', importacion || '(sin importar)',
     'Promedio', 'ventana ' + (CONFIG.PROMEDIO_VENTANA_DIAS || 0) + ' días',
     'Filas descartadas', planilla.excluidosProducto + ' por producto / ' +
       planilla.excluidosEstado + ' por estado']
  ]);
  hoja.getRange(2, 1, 2, 1).setFontWeight('bold');
  hoja.getRange(2, 3, 2, 1).setFontWeight('bold');
  hoja.getRange(2, 5, 2, 1).setFontWeight('bold');
  hoja.getRange(2, 7, 2, 1).setFontWeight('bold');
  hoja.getRange(2, 2).setNote(
    'Escribe aquí el mes a controlar (por ejemplo oct-2026 o 2026-10) y vuelve a actualizar.'
  );
  hoja.getRange(2, 4).setNumberFormat('dd-mm-yyyy hh:mm');
  hoja.getRange(3, 4).setNumberFormat('dd-mm-yyyy hh:mm');

  const filaEncabezado = 5;
  hoja.getRange(filaEncabezado, 1, 1, ENCABEZADOS_CONTROL.length)
    .setValues([ENCABEZADOS_CONTROL])
    .setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff')
    .setWrap(true);

  const filas = [];
  Object.keys(agregados).sort(function (a, b) {
    return agregados[a].proveedorPlan.localeCompare(agregados[b].proveedorPlan);
  }).forEach(function (clave) {
    const dato = agregados[clave];
    const sinMovimiento = !dato.camionesPlanilla && !dato.camionesSoloSap &&
      !dato.tsSap && !dato.tsEstimada;
    if (!dato.plan && sinMovimiento) return;  // proveedor del Plan sin plan ni ingresos

    const tsReal = dato.tsSap + dato.tsSoloSap;
    // Si el proveedor no tiene camiones pendientes, se muestra igual su factor
    // TS/camión como referencia.
    const factor = dato.promedioUsado || (dato.proveedorSap
      ? promedioPara(promedios, dato.proveedorSap, dato.producto).promedio
      : 0);
    const tsProyectada = tsReal + dato.tsEstimada;
    const alertas = [];
    if (dato.camionesSinHomologar) {
      alertas.push(dato.camionesSinHomologar + ' camión(es) sin homologar');
    }
    if (dato.camionesSinPromedio) {
      alertas.push(dato.camionesSinPromedio + ' pendiente(s) sin promedio SAP');
    }
    if (!dato.plan && tsProyectada) alertas.push('Proveedor sin plan en el mes');
    if (dato.plan && !tsProyectada) alertas.push('Con plan y sin ingresos');

    filas.push([
      dato.producto,
      dato.proveedorPlan,
      dato.proveedorSap,
      dato.camionesPlanilla,
      dato.camionesEnSap,
      dato.camionesPendientes,
      dato.camionesSoloSap,
      redondear(tsReal, 3),
      redondear(factor, 3),
      redondear(dato.tsEstimada, 3),
      redondear(tsProyectada, 3),
      redondear(dato.plan, 3),
      dato.plan ? tsProyectada / dato.plan : '',
      redondear(tsProyectada - dato.plan, 3),
      dato.precio === null ? '' : dato.precio,
      dato.precio ? redondear(tsProyectada * dato.precio, 0) : '',
      alertas.join(' | ')
    ]);
  });

  if (filas.length) {
    hoja.getRange(filaEncabezado + 1, 1, filas.length, ENCABEZADOS_CONTROL.length).setValues(filas);

    const filaTotal = filaEncabezado + filas.length + 1;
    const primera = filaEncabezado + 1;
    const ultima = filaEncabezado + filas.length;
    const total = ['TOTAL', '', ''];
    for (let columna = 4; columna <= 12; columna++) {
      const letra = columnaLetra(columna);
      total.push('=SUM(' + letra + primera + ':' + letra + ultima + ')');
    }
    total[8] = '';  // el promedio TS/camión no se suma
    total.push('=IFERROR(K' + filaTotal + '/L' + filaTotal + ',"")');
    total.push('=K' + filaTotal + '-L' + filaTotal);
    total.push('');
    total.push('=SUM(P' + primera + ':P' + ultima + ')');
    total.push('');
    hoja.getRange(filaTotal, 1, 1, total.length).setValues([total])
      .setFontWeight('bold').setBackground('#d9e1f2');

    hoja.getRange(primera, 8, filas.length + 1, 7).setNumberFormat('#,##0.000');
    hoja.getRange(primera, 13, filas.length + 1, 1).setNumberFormat('0.0%');
    hoja.getRange(primera, 15, filas.length + 1, 1).setNumberFormat('#,##0.00');
    hoja.getRange(primera, 16, filas.length + 1, 1).setNumberFormat('#,##0');
    aplicarSemaforo(hoja, primera, filas.length + 1);
  }

  hoja.setFrozenRows(filaEncabezado);
  hoja.autoResizeColumns(1, ENCABEZADOS_CONTROL.length);
  hoja.setColumnWidth(2, 240);
  hoja.setColumnWidth(17, 280);
}

/** Semáforo sobre la columna Avance %. */
function aplicarSemaforo(hoja, filaInicio, cantidadFilas) {
  const rango = hoja.getRange(filaInicio, 13, cantidadFilas, 1);
  const reglas = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(0.85).setBackground('#f8cbad').setRanges([rango]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberBetween(0.85, 1.05).setBackground('#c6efce').setRanges([rango]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(1.05).setBackground('#ffe699').setRanges([rango]).build()
  ];
  hoja.setConditionalFormatRules(reglas);
}

const ENCABEZADOS_DETALLE = [
  'Fila planilla', 'Fecha ingreso', 'Producto', 'Proveedor planilla', 'Proveedor SAP',
  'Proveedor Plan', 'Nº guía', 'Patente', 'Peso bruto', 'Nº ticket', 'Estado',
  'TS asignada', 'Fuente', 'Documento MM', 'Fecha SAP', 'Mes', 'Observación',
  'Hoja origen', 'Fila origen'
];

function escribirHojaDetalle(libro, detalle) {
  const hoja = obtenerHoja(libro, CONFIG.HOJA_DETALLE, true);
  hoja.clear();
  hoja.getRange(1, 1, 1, ENCABEZADOS_DETALLE.length).setValues([ENCABEZADOS_DETALLE])
    .setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');

  if (detalle.length) {
    hoja.getRange(2, 1, detalle.length, ENCABEZADOS_DETALLE.length).setValues(detalle);
    hoja.getRange(2, 2, detalle.length, 1).setNumberFormat('dd-mm-yyyy');
    hoja.getRange(2, 15, detalle.length, 1).setNumberFormat('dd-mm-yyyy');
    hoja.getRange(2, 9, detalle.length, 1).setNumberFormat('#,##0.000');
    hoja.getRange(2, 12, detalle.length, 1).setNumberFormat('#,##0.000');
  }
  hoja.setFrozenRows(1);
  hoja.autoResizeColumns(1, ENCABEZADOS_DETALLE.length);
}

/** Número de columna a letra (1 -> A). */
function columnaLetra(numero) {
  let letra = '';
  let n = numero;
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - 1) / 26);
  }
  return letra;
}
