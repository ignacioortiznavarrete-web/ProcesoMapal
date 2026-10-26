/**
 * Control de ingreso en hojas.
 *
 * El cruce lo resuelve Motor.gs; acá sólo se agrupa por proveedor del Plan,
 * se compara contra el plan del mes y se escriben las hojas 'Control Ingreso'
 * y 'Detalle Camiones'.
 */
function actualizarControl(periodoSolicitado) {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const datos = resolverIngresos(libro);

  escribirHojaPromedios(libro, datos.promedios);

  const periodo = periodoSolicitado
    ? claveMes(periodoSolicitado)
    : periodoSeleccionado(libro, datos.plan);

  const agregados = agregarPorProveedor(datos, periodo);

  escribirHojaControl(libro, agregados, periodo, datos);
  escribirHojaDetalle(libro, datos.filas);

  return {
    periodo: periodo,
    proveedores: Object.keys(agregados).length,
    camionesPlanilla: datos.planilla.filas.length,
    filasSap: datos.sap.filas.length,
    cargasSap: datos.promedios.cargas.length
  };
}

/**
 * Agrupa las filas del período por producto y proveedor del Plan.
 *
 * El producto es parte de la llave porque el Plan también lo es: un proveedor
 * que trae astilla y viruta tiene dos compromisos distintos, y sumarlos en una
 * fila compararía el total contra el plan de uno solo.
 */
function agregarPorProveedor(datos, periodo) {
  const agregados = {};

  datos.filas.forEach(function (fila) {
    if (fila.mes !== periodo || fila.duplicado) return;

    const agregado = obtenerAgregado(agregados, fila);

    if (fila.estado === ESTADO.SOLO_SAP) {
      agregado.camionesSoloSap++;
      agregado.tsSoloSap += fila.ts;
      return;
    }

    agregado.camionesPlanilla++;

    if (fila.estado === ESTADO.EN_SAP) {
      agregado.camionesEnSap++;
      agregado.tsSap += fila.ts;
    } else if (fila.estado === ESTADO.SIN_HOMOLOGAR) {
      agregado.camionesSinHomologar++;
    } else if (fila.estado === ESTADO.SIN_CRUCE) {
      agregado.camionesSinCruce++;
    } else {
      agregado.camionesPendientes++;
      agregado.tsEstimada += fila.ts;
      if (fila.promedioUsado > 0) agregado.promedioUsado = fila.promedioUsado;
      if (fila.estado === ESTADO.SIN_PROMEDIO) agregado.camionesSinPromedio++;
    }
  });

  // Filas del Plan sin movimiento: un proveedor con plan y sin ingresos
  // también es noticia.
  datos.plan.filas.forEach(function (filaPlan) {
    const clave = 'PLAN|' + claveProducto(filaPlan.producto) + '|' +
      claveProveedor(filaPlan.proveedor);

    if (!agregados[clave]) {
      agregados[clave] = nuevoAgregado(
        productoCorto(filaPlan.producto), filaPlan.proveedor, ''
      );
    }

    const agregado = agregados[clave];

    agregado.plan += filaPlan.cantidades[periodo] || 0;
    if (filaPlan.precio !== null && filaPlan.precio !== undefined) {
      agregado.precio = filaPlan.precio;
    }
  });

  return agregados;
}

function nuevoAgregado(producto, proveedorPlan, proveedorSap) {
  return {
    producto: producto || '',
    proveedorPlan: proveedorPlan || '',
    proveedorSap: proveedorSap || '',
    camionesPlanilla: 0,
    camionesEnSap: 0,
    camionesPendientes: 0,
    camionesSinCruce: 0,
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
function obtenerAgregado(agregados, fila) {
  // La llave va por el nombre homologado, no por el que trae cada fuente: SAP
  // escribe 'VIRUTA-ASERUTA (TS)', la planilla 'viruta' y el Plan 'VIRUTA', y
  // con el nombre crudo el mismo material abriría tres filas distintas.
  const producto = claveProducto(fila.productoCorto || fila.producto);
  let clave;
  let proveedorPlan;

  if (fila.proveedorPlan) {
    clave = 'PLAN|' + producto + '|' + claveProveedor(fila.proveedorPlan);
    proveedorPlan = fila.proveedorPlan;
  } else if (fila.proveedorSap) {
    clave = 'SAP|' + producto + '|' + claveProveedor(fila.proveedorSap);
    proveedorPlan = fila.proveedorSap + ' (sin par en Plan)';
  } else {
    clave = 'MANUAL|' + producto + '|' + claveProveedor(fila.proveedorPlanilla);
    proveedorPlan = fila.proveedorPlanilla + ' (sin homologar)';
  }

  if (!agregados[clave]) {
    agregados[clave] = nuevoAgregado(
      fila.productoCorto || productoCorto(fila.producto),
      proveedorPlan,
      fila.proveedorSap
    );
  }
  if (!agregados[clave].proveedorSap && fila.proveedorSap) {
    agregados[clave].proveedorSap = fila.proveedorSap;
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
  'Camiones planilla', 'Camiones en SAP', 'Camiones pendientes', 'Camiones sin cruce',
  'Cargas sólo SAP', 'TS real SAP', 'TS/carga prom.', 'TS estimada pendientes',
  'TS proyectada', 'Plan TS', 'Avance %', 'Desvío TS', 'Precio', 'Monto proyectado',
  'SAP hasta', 'Alertas'
];

// Posiciones (1 = A) que se usan para fórmulas y formatos.
const COL_CONTROL = {
  primeraSuma: 4,     // Camiones planilla
  ultimaSuma: 13,     // Plan TS
  factor: 10,         // TS/carga prom.: no se suma
  proyectada: 12,
  plan: 13,
  avance: 14,
  desvio: 15,
  precio: 16,
  monto: 17,
  corteSap: 18,
  alertas: 19
};

function escribirHojaControl(libro, agregados, periodo, datos) {
  const hoja = obtenerHoja(libro, CONFIG.HOJA_CONTROL, true);
  const promedios = datos.promedios;
  const planilla = datos.planilla;

  hoja.clear();

  const importacion = ultimaImportacion();
  const propiedades = PropertiesService.getDocumentProperties();
  const productos = (CONFIG.PRODUCTOS_INCLUIDOS || []).join(', ') || '(todos)';

  hoja.getRange(1, 1).setValue('CONTROL DE INGRESO vs PLAN')
    .setFontWeight('bold').setFontSize(14);

  hoja.getRange(2, 1, 3, 8).setValues([
    ['Período', etiquetaMes(periodo), 'Actualizado', new Date(),
     'Base de fecha', CONFIG.FECHA_BASE, 'Productos', productos],
    ['Planilla origen', propiedades.getProperty('nombreOrigen') || '(sin importar)',
     'Última importación', importacion || '(sin importar)',
     'Promedio', 'ventana ' + (CONFIG.PROMEDIO_VENTANA_DIAS || 0) + ' días',
     'Filas descartadas', planilla.excluidosProducto + ' por producto / ' +
       planilla.excluidosEstado + ' por estado'],
    ['SAP cubre hasta', promedios.corteGlobal || '(sin datos)',
     'Rango por carga', (CONFIG.TS_POR_CARGA_MINIMO || 0) + ' a ' +
       (CONFIG.TS_POR_CARGA_MAXIMO || 0) + ' TS', '', '', '', '']
  ]);

  hoja.getRange(4, 2).setNumberFormat('dd-mm-yyyy');
  hoja.getRange(2, 1, 3, 1).setFontWeight('bold');
  hoja.getRange(2, 3, 3, 1).setFontWeight('bold');
  hoja.getRange(2, 5, 2, 1).setFontWeight('bold');
  hoja.getRange(2, 7, 2, 1).setFontWeight('bold');
  hoja.getRange(2, 2).setNote(
    'Escribe aquí el mes a controlar (por ejemplo oct-2026 o 2026-10) y vuelve a actualizar.'
  );
  hoja.getRange(2, 4).setNumberFormat('dd-mm-yyyy hh:mm');
  hoja.getRange(3, 4).setNumberFormat('dd-mm-yyyy hh:mm');

  const filaEncabezado = 6;

  hoja.getRange(filaEncabezado, 1, 1, ENCABEZADOS_CONTROL.length)
    .setValues([ENCABEZADOS_CONTROL])
    .setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff')
    .setWrap(true);

  const filas = [];

  Object.keys(agregados).sort(function (a, b) {
    const porProducto = agregados[a].producto.localeCompare(agregados[b].producto);

    return porProducto !== 0
      ? porProducto
      : agregados[a].proveedorPlan.localeCompare(agregados[b].proveedorPlan);
  }).forEach(function (clave) {
    const dato = agregados[clave];
    const sinMovimiento = !dato.camionesPlanilla && !dato.camionesSoloSap &&
      !dato.tsSap && !dato.tsEstimada;

    if (!dato.plan && sinMovimiento) return;  // proveedor del Plan sin plan ni ingresos

    const tsReal = dato.tsSap + dato.tsSoloSap;
    // Si el proveedor no tiene camiones pendientes, se muestra igual su factor
    // TS/carga como referencia.
    const factor = dato.promedioUsado || (dato.proveedorSap
      ? promedioPara(promedios, dato.proveedorSap, dato.producto).promedio
      : 0);
    // Hasta qué día SAP ya tiene contabilizado a este proveedor: desde ahí en
    // adelante los camiones de la planilla se estiman.
    const corteSap = corteSapDe(promedios, dato.proveedorSap);
    const tsProyectada = tsReal + dato.tsEstimada;
    const alertas = [];

    if (dato.camionesSinHomologar) {
      alertas.push(dato.camionesSinHomologar + ' camión(es) sin homologar');
    }
    if (dato.camionesSinPromedio) {
      alertas.push(dato.camionesSinPromedio + ' pendiente(s) sin histórico SAP ' +
        'de este producto: suman 0 TS');
    }
    if (dato.camionesSinCruce) {
      alertas.push(dato.camionesSinCruce + ' camión(es) sin cruce en días que SAP ya cubre');
    }
    if (promedioFueraDeRango(factor)) {
      alertas.push('TS/carga fuera de rango (' + redondear(factor, 3) + ')');
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
      dato.camionesSinCruce,
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
      corteSap || '',
      alertas.join(' | ')
    ]);
  });

  if (filas.length) {
    hoja.getRange(filaEncabezado + 1, 1, filas.length, ENCABEZADOS_CONTROL.length)
      .setValues(filas);

    const primera = filaEncabezado + 1;
    const ultima = filaEncabezado + filas.length;
    const filaTotal = ultima + 1;
    const total = [];

    for (let columna = 1; columna <= ENCABEZADOS_CONTROL.length; columna++) {
      const letra = columnaLetra(columna);

      if (columna === 1) {
        total.push('TOTAL');
      } else if (columna === COL_CONTROL.factor) {
        total.push('');  // el promedio por carga no se suma
      } else if (columna >= COL_CONTROL.primeraSuma && columna <= COL_CONTROL.ultimaSuma) {
        total.push('=SUM(' + letra + primera + ':' + letra + ultima + ')');
      } else if (columna === COL_CONTROL.avance) {
        total.push('=IFERROR(' + columnaLetra(COL_CONTROL.proyectada) + filaTotal + '/' +
          columnaLetra(COL_CONTROL.plan) + filaTotal + ',"")');
      } else if (columna === COL_CONTROL.desvio) {
        total.push('=' + columnaLetra(COL_CONTROL.proyectada) + filaTotal + '-' +
          columnaLetra(COL_CONTROL.plan) + filaTotal);
      } else if (columna === COL_CONTROL.monto) {
        total.push('=SUM(' + letra + primera + ':' + letra + ultima + ')');
      } else {
        total.push('');
      }
    }

    hoja.getRange(filaTotal, 1, 1, total.length).setValues([total])
      .setFontWeight('bold').setBackground('#d9e1f2');

    const alto = filas.length + 1;

    hoja.getRange(primera, COL_CONTROL.primeraSuma, alto, 5).setNumberFormat('#,##0');
    hoja.getRange(primera, 9, alto, 5).setNumberFormat('#,##0.000');  // TS real a Plan TS
    hoja.getRange(primera, COL_CONTROL.avance, alto, 1).setNumberFormat('0.0%');
    hoja.getRange(primera, COL_CONTROL.desvio, alto, 1).setNumberFormat('#,##0.000');
    hoja.getRange(primera, COL_CONTROL.precio, alto, 1).setNumberFormat('#,##0.00');
    hoja.getRange(primera, COL_CONTROL.monto, alto, 1).setNumberFormat('#,##0');
    hoja.getRange(primera, COL_CONTROL.corteSap, alto, 1).setNumberFormat('dd-mm-yyyy');
    aplicarSemaforo(hoja, primera, alto);
  }

  hoja.setFrozenRows(filaEncabezado);
  hoja.autoResizeColumns(1, ENCABEZADOS_CONTROL.length);
  hoja.setColumnWidth(2, 240);
  hoja.setColumnWidth(COL_CONTROL.alertas, 300);
}

/** Semáforo sobre la columna Avance %. */
function aplicarSemaforo(hoja, filaInicio, cantidadFilas) {
  const rango = hoja.getRange(filaInicio, COL_CONTROL.avance, cantidadFilas, 1);

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

function escribirHojaDetalle(libro, filas) {
  const hoja = obtenerHoja(libro, CONFIG.HOJA_DETALLE, true);

  hoja.clear();
  hoja.getRange(1, 1, 1, ENCABEZADOS_DETALLE.length).setValues([ENCABEZADOS_DETALLE])
    .setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');

  const detalle = filas.map(function (fila) {
    return [
      fila.filaPlanilla,
      fila.fecha || '',
      fila.producto,
      fila.proveedorPlanilla,
      fila.proveedorSap,
      fila.proveedorPlan,
      fila.guia,
      fila.patente,
      fila.pesoBruto === null || fila.pesoBruto === undefined ? '' : fila.pesoBruto,
      fila.ticket,
      fila.estado,
      redondear(fila.ts, 3),
      fila.detalleFuente,
      fila.documento,
      fila.fechaSap || '',
      etiquetaMes(fila.mes),
      fila.observacion,
      fila.hojaOrigen,
      fila.filaOrigen
    ];
  });

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
