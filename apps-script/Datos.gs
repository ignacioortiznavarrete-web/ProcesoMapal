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
    const desProveedor = comoTexto(fila[col.desProveedor]);
    const cantidad = aNumero(fila[col.cantidad]);
    const guiaTexto = col.guia >= 0 ? comoTexto(fila[col.guia]) : '';
    if (!desProveedor && !guiaTexto && cantidad === null) continue;

    const registro = {
      filaHoja: i + 1,
      documento: col.documento >= 0 ? comoTexto(fila[col.documento]) : '',
      guiaTexto: guiaTexto,
      guia: normalizarGuia(guiaTexto),
      material: col.material >= 0 ? comoTexto(fila[col.material]) : '',
      desMaterial: col.desMaterial >= 0 ? comoTexto(fila[col.desMaterial]) : '',
      fecha: col.fecha >= 0 ? aFecha(fila[col.fecha]) : null,
      cantidad: cantidad === null ? 0 : cantidad,
      proveedor: col.proveedor >= 0 ? comoTexto(fila[col.proveedor]) : '',
      desProveedor: desProveedor,
      comuna: col.comuna >= 0 ? comoTexto(fila[col.comuna]) : '',
      predio: col.predio >= 0 ? comoTexto(fila[col.predio]) : '',
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

/**
 * Camiones registrados a mano (hoja importada y ya consolidada).
 * Se aplican los filtros de producto y de estado de CONFIG.
 */
function cargarPlanilla(libro) {
  const vacio = { filas: [], proveedores: [], productos: [], excluidosProducto: 0, excluidosEstado: 0 };
  const datos = leerHoja(libro, CONFIG.HOJA_PLANILLA);
  if (datos.length < 2) return vacio;

  const col = ubicarColumnas(datos[0], COLUMNAS.PLANILLA);
  if (col.proveedor < 0) {
    throw new Error('La hoja "' + CONFIG.HOJA_PLANILLA + '" no tiene la columna PROVEEDOR.');
  }

  const filas = [];
  const proveedores = {};
  const productos = {};
  // La tabla de productos se consulta antes de descartar por producto, para que
  // una variante escrita a mano se pueda rescatar homologándola.
  const tablaProductos = cargarHomologacionProductos(libro);
  let excluidosProducto = 0;
  let excluidosEstado = 0;

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    const proveedor = comoTexto(fila[col.proveedor]);
    const guiaTexto = col.guia >= 0 ? comoTexto(fila[col.guia]) : '';
    const fecha = col.fecha >= 0 ? aFecha(fila[col.fecha]) : null;
    if (!proveedor && !guiaTexto && !fecha) continue;

    const producto = col.producto >= 0 ? comoTexto(fila[col.producto]) : '';
    const estado = col.estado >= 0 ? comoTexto(fila[col.estado]) : '';
    if (producto) productos[producto] = true;

    if (!productoIncluido(producto, tablaProductos)) { excluidosProducto++; continue; }
    if (estadoExcluido(estado)) { excluidosEstado++; continue; }

    filas.push({
      filaHoja: i + 1,
      numero: col.numero >= 0 ? fila[col.numero] : '',
      fecha: fecha,
      producto: producto,
      proveedor: proveedor,
      comuna: col.comuna >= 0 ? comoTexto(fila[col.comuna]) : '',
      guiaTexto: guiaTexto,
      guia: normalizarGuia(guiaTexto),
      patente: col.patente >= 0 ? comoTexto(fila[col.patente]) : '',
      pesoBruto: col.pesoBruto >= 0 ? aNumero(fila[col.pesoBruto]) : null,
      ticket: col.ticket >= 0 ? comoTexto(fila[col.ticket]) : '',
      estado: estado,
      observacion: col.observacion >= 0 ? comoTexto(fila[col.observacion]) : '',
      hojaOrigen: col.hojaOrigen >= 0 ? comoTexto(fila[col.hojaOrigen]) : '',
      filaOrigen: col.filaOrigen >= 0 ? fila[col.filaOrigen] : ''
    });
    if (proveedor) proveedores[proveedor] = true;
  }

  return {
    filas: filas,
    proveedores: Object.keys(proveedores).sort(),
    productos: Object.keys(productos).sort(),
    excluidosProducto: excluidosProducto,
    excluidosEstado: excluidosEstado
  };
}

/** ¿El producto está en CONFIG.PRODUCTOS_INCLUIDOS? (lista vacía = todos). */
function productoIncluido(producto, tablaProductos) {
  if (coincideProductoIncluido(producto)) return true;

  // Un nombre escrito distinto ('VIRUTILLA' por viruta) se traduce antes de
  // descartarlo: si no, la tabla de homologación nunca podría rescatar una
  // variante escrita a mano, que es justo para lo que existe.
  if (tablaProductos) {
    const registro = tablaProductos.porPlanilla[claveProducto(producto)];
    if (registro) {
      return coincideProductoIncluido(registro.plan) ||
        coincideProductoIncluido(registro.sap);
    }
  }

  return false;
}

function coincideProductoIncluido(producto) {
  const lista = CONFIG.PRODUCTOS_INCLUIDOS || [];
  if (!lista.length) return true;
  const clave = normalizar(productoCorto(producto));
  if (!clave) return false;
  return lista.some(function (incluido) {
    const patron = normalizar(incluido);
    if (!patron) return false;
    if (patron.charAt(patron.length - 1) === '*') {
      return clave.indexOf(patron.slice(0, -1).trim()) === 0;
    }
    return clave === patron;
  });
}

/** ¿La fila viene anulada o rechazada? */
function estadoExcluido(estado) {
  const clave = normalizar(estado);
  if (!clave) return false;
  return (CONFIG.ESTADOS_EXCLUIDOS || []).some(function (excluido) {
    return normalizar(excluido) === clave;
  });
}

/**
 * Plan mensual. Las columnas de mes se detectan por encabezado
 * ('oct-2026', '2026-10', fecha, etc.).
 */
function cargarPlan(libro) {
  const datos = leerHoja(libro, CONFIG.HOJA_PLAN);
  if (datos.length < 2) return { filas: [], proveedores: [], productos: [], meses: [] };

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
  const productos = {};
  let productoActual = '';

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    // La columna Producto viene con celdas combinadas: se arrastra el último valor.
    const producto = col.producto >= 0 ? comoTexto(fila[col.producto]) : '';
    if (producto) productoActual = producto;
    const proveedor = comoTexto(fila[col.proveedor]);
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
    if (productoActual) productos[productoActual] = true;
  }

  return {
    filas: filas,
    proveedores: Object.keys(proveedores).sort(),
    productos: Object.keys(productos).sort(),
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
    const sap = col.sap >= 0 ? comoTexto(fila[col.sap]) : '';
    const planilla = col.planilla >= 0 ? comoTexto(fila[col.planilla]) : '';
    const plan = col.plan >= 0 ? comoTexto(fila[col.plan]) : '';
    if (!sap && !planilla && !plan) continue;

    const registro = { filaHoja: i + 1, sap: sap, planilla: planilla, plan: plan };
    filas.push(registro);
    if (planilla) porPlanilla[claveProveedor(planilla)] = registro;
    if (sap) porSap[claveProveedor(sap)] = registro;
  }
  return { porPlanilla: porPlanilla, porSap: porSap, filas: filas };
}

/**
 * Tabla de homologación de productos: el mismo material escrito como lo
 * escribe SAP, como lo escribe la mano en la planilla y como lo nombra el Plan.
 *
 * Arranca con CONFIG.PRODUCTOS_EQUIVALENTES para que el cruce funcione sin que
 * nadie haya llenado nada, y la hoja pisa esos valores: lo que se escribe a
 * mano manda.
 */
function cargarHomologacionProductos(libro) {
  const porPlanilla = {};
  const porSap = {};
  const porPlan = {};
  const filas = [];

  function registrar(registro) {
    if (!registro.sap && !registro.planilla && !registro.plan) return;
    filas.push(registro);
    if (registro.planilla) porPlanilla[claveProducto(registro.planilla)] = registro;
    if (registro.sap) porSap[claveProducto(registro.sap)] = registro;
    if (registro.plan) porPlan[claveProducto(registro.plan)] = registro;
  }

  (CONFIG.PRODUCTOS_EQUIVALENTES || []).forEach(function (equivalencia) {
    registrar({
      filaHoja: 0,
      sap: comoTexto(equivalencia.sap),
      planilla: comoTexto(equivalencia.planilla),
      plan: comoTexto(equivalencia.plan),
      deConfig: true
    });
  });

  const datos = leerHoja(libro, CONFIG.HOJA_HOMOLOGACION_PRODUCTOS);
  if (datos.length >= 2) {
    const col = ubicarColumnas(datos[0], COLUMNAS.HOMOLOGACION_PRODUCTOS);
    for (let i = 1; i < datos.length; i++) {
      const fila = datos[i];
      registrar({
        filaHoja: i + 1,
        sap: col.sap >= 0 ? comoTexto(fila[col.sap]) : '',
        planilla: col.planilla >= 0 ? comoTexto(fila[col.planilla]) : '',
        plan: col.plan >= 0 ? comoTexto(fila[col.plan]) : '',
        deConfig: false
      });
    }
  }

  return { porPlanilla: porPlanilla, porSap: porSap, porPlan: porPlan, filas: filas };
}
