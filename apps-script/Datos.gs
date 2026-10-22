/**
 * Lectura y normalización de las cuatro fuentes:
 * Ingresos Sap, Planilla Exportada, Plan y homologacion.
 */

/** Ingresos reales de SAP. */
function cargarSap(libro) {
  const datos = leerHoja(libro, CONFIG.HOJA_SAP);
  if (datos.length < 2) return { filas: [], proveedores: [], materiales: [] };

  const col = ubicarColumnas(datos[0], COLUMNAS.SAP);
  if (col.guia < 0 || col.cantidad < 0 || col.desProveedor < 0) {
    throw new Error(
      'La hoja "' + CONFIG.HOJA_SAP + '" no tiene las columnas Nº Guia, Cantidad y Des. Proveedor.'
    );
  }

  const filas = [];
  const proveedores = {};
  const materiales = {};

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    const desProveedor = String(fila[col.desProveedor] || '').trim();
    const cantidad = aNumero(fila[col.cantidad]);
    const guiaTexto = col.guia >= 0 ? String(fila[col.guia] || '').trim() : '';
    if (!desProveedor && !guiaTexto && cantidad === null) continue;

    const registro = {
      filaHoja: i + 1,
      documento: col.documento >= 0 ? String(fila[col.documento] || '').trim() : '',
      guiaTexto: guiaTexto,
      guia: normalizarGuia(guiaTexto),
      material: col.material >= 0 ? String(fila[col.material] || '').trim() : '',
      desMaterial: col.desMaterial >= 0 ? String(fila[col.desMaterial] || '').trim() : '',
      fecha: col.fecha >= 0 ? aFecha(fila[col.fecha]) : null,
      cantidad: cantidad === null ? 0 : cantidad,
      proveedor: col.proveedor >= 0 ? String(fila[col.proveedor] || '').trim() : '',
      desProveedor: desProveedor,
      comuna: col.comuna >= 0 ? String(fila[col.comuna] || '').trim() : '',
      predio: col.predio >= 0 ? String(fila[col.predio] || '').trim() : '',
      usado: false
    };
    filas.push(registro);
    if (desProveedor) proveedores[desProveedor] = true;
    if (registro.desMaterial) materiales[registro.desMaterial] = true;
  }

  return {
    filas: filas,
    proveedores: Object.keys(proveedores).sort(),
    materiales: Object.keys(materiales).sort()
  };
}

/** Camiones registrados a mano (hoja importada). */
function cargarPlanilla(libro) {
  const datos = leerHoja(libro, CONFIG.HOJA_PLANILLA);
  if (datos.length < 2) return { filas: [], proveedores: [], productos: [] };

  const col = ubicarColumnas(datos[0], COLUMNAS.PLANILLA);
  if (col.proveedor < 0) {
    throw new Error('La hoja "' + CONFIG.HOJA_PLANILLA + '" no tiene la columna PROVEEDOR.');
  }

  const filas = [];
  const proveedores = {};
  const productos = {};

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    const proveedor = String(fila[col.proveedor] || '').trim();
    const guiaTexto = col.guia >= 0 ? String(fila[col.guia] || '').trim() : '';
    const fecha = col.fecha >= 0 ? aFecha(fila[col.fecha]) : null;
    if (!proveedor && !guiaTexto && !fecha) continue;

    const producto = col.producto >= 0 ? String(fila[col.producto] || '').trim() : '';
    filas.push({
      filaHoja: i + 1,
      numero: col.numero >= 0 ? fila[col.numero] : '',
      fecha: fecha,
      producto: producto,
      proveedor: proveedor,
      comuna: col.comuna >= 0 ? String(fila[col.comuna] || '').trim() : '',
      guiaTexto: guiaTexto,
      guia: normalizarGuia(guiaTexto),
      patente: col.patente >= 0 ? String(fila[col.patente] || '').trim() : '',
      pesoBruto: col.pesoBruto >= 0 ? aNumero(fila[col.pesoBruto]) : null,
      ticket: col.ticket >= 0 ? String(fila[col.ticket] || '').trim() : '',
      observacion: col.observacion >= 0 ? String(fila[col.observacion] || '').trim() : ''
    });
    if (proveedor) proveedores[proveedor] = true;
    if (producto) productos[producto] = true;
  }

  return {
    filas: filas,
    proveedores: Object.keys(proveedores).sort(),
    productos: Object.keys(productos).sort()
  };
}

/**
 * Plan mensual. Las columnas de mes se detectan por encabezado
 * ('oct-2026', '2026-10', fecha, etc.).
 */
function cargarPlan(libro) {
  const datos = leerHoja(libro, CONFIG.HOJA_PLAN);
  if (datos.length < 2) return { filas: [], proveedores: [], meses: [] };

  const encabezados = datos[0];
  const col = ubicarColumnas(encabezados, COLUMNAS.PLAN);
  if (col.proveedor < 0) {
    throw new Error('La hoja "' + CONFIG.HOJA_PLAN + '" no tiene la columna Proveedor.');
  }

  // Columnas de mes: cualquier encabezado que se pueda interpretar como mes.
  const columnasMes = {};
  const meses = [];
  encabezados.forEach(function (encabezado, indice) {
    if (indice === col.producto || indice === col.proveedor || indice === col.precio) return;
    const clave = claveMes(encabezado);
    if (clave) {
      columnasMes[clave] = indice;
      meses.push(clave);
    }
  });
  meses.sort();

  const filas = [];
  const proveedores = {};
  let productoActual = '';

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    // La columna Producto viene con celdas combinadas: se arrastra el último valor.
    const producto = col.producto >= 0 ? String(fila[col.producto] || '').trim() : '';
    if (producto) productoActual = producto;
    const proveedor = String(fila[col.proveedor] || '').trim();
    if (!proveedor) continue;

    const cantidades = {};
    meses.forEach(function (clave) {
      const valor = aNumero(fila[columnasMes[clave]]);
      cantidades[clave] = valor === null ? 0 : valor;
    });

    filas.push({
      filaHoja: i + 1,
      producto: productoActual,
      proveedor: proveedor,
      precio: col.precio >= 0 ? aNumero(fila[col.precio]) : null,
      cantidades: cantidades
    });
    proveedores[proveedor] = true;
  }

  return {
    filas: filas,
    proveedores: Object.keys(proveedores).sort(),
    meses: meses
  };
}

/**
 * Tabla de homologación.
 * Devuelve un índice por nombre de la planilla manual y otro por nombre SAP.
 */
function cargarHomologacion(libro) {
  const datos = leerHoja(libro, CONFIG.HOJA_HOMOLOGACION);
  const porPlanilla = {};
  const porSap = {};
  const filas = [];
  if (datos.length < 2) return { porPlanilla: porPlanilla, porSap: porSap, filas: filas };

  const col = ubicarColumnas(datos[0], COLUMNAS.HOMOLOGACION);
  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    const sap = col.sap >= 0 ? String(fila[col.sap] || '').trim() : '';
    const planilla = col.planilla >= 0 ? String(fila[col.planilla] || '').trim() : '';
    const plan = col.plan >= 0 ? String(fila[col.plan] || '').trim() : '';
    if (!sap && !planilla && !plan) continue;

    const registro = { filaHoja: i + 1, sap: sap, planilla: planilla, plan: plan };
    filas.push(registro);
    if (planilla) porPlanilla[claveProveedor(planilla)] = registro;
    if (sap) porSap[claveProveedor(sap)] = registro;
  }
  return { porPlanilla: porPlanilla, porSap: porSap, filas: filas };
}
