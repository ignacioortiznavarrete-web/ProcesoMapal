/**
 * Promedio de cantidad (TS) por camión, calculado desde los ingresos reales
 * de SAP. Es el factor con que se valorizan los camiones que ya ingresaron
 * pero todavía no aparecen en SAP (desfase de las 5 fases).
 *
 * La ventana de días se mide desde la fecha más reciente que exista en SAP,
 * no desde hoy, para que un export atrasado no deje el promedio en cero.
 */
function calcularPromedios(sap) {
  const porProveedorMaterial = {};
  const porProveedor = {};
  const global = nuevoAcumulador();

  let fechaTope = null;
  sap.filas.forEach(function (fila) {
    if (fila.fecha && (!fechaTope || fila.fecha > fechaTope)) fechaTope = fila.fecha;
  });

  const dias = Number(CONFIG.PROMEDIO_VENTANA_DIAS) || 0;
  const inicioVentana = (dias > 0 && fechaTope)
    ? new Date(fechaTope.getTime() - (dias * 86400000))
    : null;

  sap.filas.forEach(function (fila) {
    if (!fila.desProveedor || !fila.cantidad) return;
    const enVentana = !inicioVentana || (fila.fecha && fila.fecha >= inicioVentana);

    const claveProv = claveProveedor(fila.desProveedor);
    const claveMat = claveProveedor(fila.desMaterial);
    const claveCombinada = claveProv + '|' + claveMat;

    if (!porProveedorMaterial[claveCombinada]) {
      porProveedorMaterial[claveCombinada] = nuevoAcumulador({
        proveedor: fila.desProveedor,
        material: fila.desMaterial,
        codigoMaterial: fila.material
      });
    }
    if (!porProveedor[claveProv]) {
      porProveedor[claveProv] = nuevoAcumulador({ proveedor: fila.desProveedor, material: '(todos)' });
    }

    acumular(porProveedorMaterial[claveCombinada], fila, enVentana);
    acumular(porProveedor[claveProv], fila, enVentana);
    acumular(global, fila, enVentana);
  });

  [porProveedorMaterial, porProveedor].forEach(function (mapa) {
    Object.keys(mapa).forEach(function (clave) { cerrarAcumulador(mapa[clave]); });
  });
  cerrarAcumulador(global);

  return {
    porProveedorMaterial: porProveedorMaterial,
    porProveedor: porProveedor,
    global: global,
    inicioVentana: inicioVentana,
    fechaTope: fechaTope
  };
}

function nuevoAcumulador(extra) {
  const base = {
    proveedor: '',
    material: '',
    codigoMaterial: '',
    camionesVentana: 0,
    totalVentana: 0,
    camionesHistorico: 0,
    totalHistorico: 0,
    ultimaFecha: null,
    promedio: 0,
    base: 'sin datos'
  };
  if (extra) Object.keys(extra).forEach(function (k) { base[k] = extra[k]; });
  return base;
}

function acumular(acumulador, fila, enVentana) {
  acumulador.camionesHistorico++;
  acumulador.totalHistorico += fila.cantidad;
  if (enVentana) {
    acumulador.camionesVentana++;
    acumulador.totalVentana += fila.cantidad;
  }
  if (fila.fecha && (!acumulador.ultimaFecha || fila.fecha > acumulador.ultimaFecha)) {
    acumulador.ultimaFecha = fila.fecha;
  }
}

/** Decide si se usa el promedio de la ventana o el del histórico completo. */
function cerrarAcumulador(acumulador) {
  const minimo = Number(CONFIG.PROMEDIO_MINIMO_CAMIONES) || 0;
  if (acumulador.camionesVentana >= Math.max(1, minimo)) {
    acumulador.promedio = acumulador.totalVentana / acumulador.camionesVentana;
    acumulador.base = 'ventana ' + (CONFIG.PROMEDIO_VENTANA_DIAS || 0) + ' días';
  } else if (acumulador.camionesHistorico > 0) {
    acumulador.promedio = acumulador.totalHistorico / acumulador.camionesHistorico;
    acumulador.base = 'histórico completo';
  } else {
    acumulador.promedio = 0;
    acumulador.base = 'sin datos';
  }
  return acumulador;
}

/**
 * Promedio aplicable a un camión pendiente.
 * Busca proveedor + material; si no hay, proveedor; si tampoco, el global.
 */
function promedioPara(promedios, proveedorSap, producto) {
  if (!proveedorSap) {
    return { promedio: promedios.global.promedio, origen: 'promedio general', camiones: promedios.global.camionesHistorico };
  }
  const claveProv = claveProveedor(proveedorSap);

  const candidatos = Object.keys(promedios.porProveedorMaterial).filter(function (clave) {
    return clave.indexOf(claveProv + '|') === 0;
  });

  if (candidatos.length && producto) {
    const claveProd = claveProveedor(producto);
    let elegido = '';
    candidatos.some(function (clave) {
      const claveMat = clave.substring(claveProv.length + 1);
      if (claveMat && (claveMat.indexOf(claveProd) >= 0 || claveProd.indexOf(claveMat) >= 0)) {
        elegido = clave;
        return true;
      }
      return false;
    });
    if (!elegido) {
      let mejorPuntaje = 0;
      candidatos.forEach(function (clave) {
        const registro = promedios.porProveedorMaterial[clave];
        const puntaje = similitud(producto, registro.material);
        if (puntaje > mejorPuntaje && puntaje >= 0.8) {
          mejorPuntaje = puntaje;
          elegido = clave;
        }
      });
    }
    if (elegido) {
      const registro = promedios.porProveedorMaterial[elegido];
      return {
        promedio: registro.promedio,
        origen: 'proveedor + material (' + registro.base + ')',
        camiones: registro.camionesVentana || registro.camionesHistorico
      };
    }
  }

  if (candidatos.length === 1) {
    const unico = promedios.porProveedorMaterial[candidatos[0]];
    return {
      promedio: unico.promedio,
      origen: 'proveedor + material (' + unico.base + ')',
      camiones: unico.camionesVentana || unico.camionesHistorico
    };
  }

  const registroProveedor = promedios.porProveedor[claveProv];
  if (registroProveedor && registroProveedor.promedio > 0) {
    return {
      promedio: registroProveedor.promedio,
      origen: 'proveedor (' + registroProveedor.base + ')',
      camiones: registroProveedor.camionesVentana || registroProveedor.camionesHistorico
    };
  }

  return {
    promedio: promedios.global.promedio,
    origen: 'promedio general',
    camiones: promedios.global.camionesHistorico
  };
}

/** Escribe la hoja 'Promedios SAP' para poder auditar el factor usado. */
function escribirHojaPromedios(libro, promedios) {
  const hoja = obtenerHoja(libro, CONFIG.HOJA_PROMEDIOS, true);
  hoja.clear();

  const encabezados = [
    'Proveedor SAP', 'Material', 'Código material',
    'Camiones ventana', 'TS ventana', 'Camiones histórico', 'TS histórico',
    'TS/camión usado', 'Base del promedio', 'Última fecha SAP'
  ];

  const filas = [];
  Object.keys(promedios.porProveedorMaterial).sort().forEach(function (clave) {
    filas.push(filaPromedio(promedios.porProveedorMaterial[clave]));
  });
  Object.keys(promedios.porProveedor).sort().forEach(function (clave) {
    filas.push(filaPromedio(promedios.porProveedor[clave]));
  });
  const fila = filaPromedio(promedios.global);
  fila[0] = '(TODOS LOS PROVEEDORES)';
  fila[1] = '(todos)';
  filas.push(fila);

  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados])
    .setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');
  if (filas.length) {
    hoja.getRange(2, 1, filas.length, encabezados.length).setValues(filas);
  }
  hoja.setFrozenRows(1);
  hoja.getRange(2, 4, Math.max(filas.length, 1), 5).setNumberFormat('#,##0.000');
  hoja.autoResizeColumns(1, encabezados.length);
}

function filaPromedio(registro) {
  return [
    registro.proveedor,
    registro.material,
    registro.codigoMaterial,
    registro.camionesVentana,
    redondear(registro.totalVentana, 3),
    registro.camionesHistorico,
    redondear(registro.totalHistorico, 3),
    redondear(registro.promedio, 3),
    registro.base,
    registro.ultimaFecha || ''
  ];
}
