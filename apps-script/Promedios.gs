/**
 * Agrupa las líneas de SAP en cargas: una carga = un camión = una guía de un
 * proveedor. Una misma guía puede venir en más de una línea (dos posiciones
 * del pedido), y en ese caso las cantidades se suman; si se contara línea por
 * línea, el promedio por carga saldría a la mitad.
 */
function agruparCargasSap(sap) {
  const cargas = [];
  const porClave = {};

  sap.filas.forEach(function (fila) {
    if (!fila.desProveedor) return;
    const clave = fila.guia
      ? claveProveedor(fila.desProveedor) + '|' + fila.guia
      : 'SIN GUIA|' + fila.filaHoja;

    if (!porClave[clave]) {
      porClave[clave] = {
        clave: clave,
        proveedor: fila.desProveedor,
        material: fila.desMaterial,
        codigoMaterial: fila.material,
        guia: fila.guia,
        guiaTexto: fila.guiaTexto,
        filaHoja: fila.filaHoja,
        documentos: [],
        cantidad: 0,
        fecha: null,
        lineas: 0,
        usado: false
      };
      cargas.push(porClave[clave]);
    }

    const carga = porClave[clave];
    carga.cantidad += fila.cantidad;
    carga.lineas++;
    if (fila.documento) carga.documentos.push(fila.documento);
    if (fila.fecha && (!carga.fecha || fila.fecha > carga.fecha)) carga.fecha = fila.fecha;
    if (!carga.material && fila.desMaterial) carga.material = fila.desMaterial;
  });

  return { cargas: cargas, porClave: porClave };
}

/**
 * Promedio de cantidad (TS) por carga, calculado desde los ingresos reales
 * de SAP. Es el factor con que se valorizan los camiones que ya ingresaron
 * pero todavía no aparecen en SAP (desfase de las 5 fases).
 *
 * La ventana de días se mide desde la fecha más reciente que exista en SAP,
 * no desde hoy, para que un export atrasado no deje el promedio en cero.
 */
function calcularPromedios(sap) {
  const agrupadas = agruparCargasSap(sap);
  const porProveedorMaterial = {};
  const porProveedor = {};
  const global = nuevoAcumulador();
  // Hasta qué fecha llega SAP para cada proveedor: es la frontera entre lo que
  // ya está contabilizado y lo que todavía hay que estimar.
  const cortePorProveedor = {};

  let fechaTope = null;
  agrupadas.cargas.forEach(function (carga) {
    if (carga.fecha && (!fechaTope || carga.fecha > fechaTope)) fechaTope = carga.fecha;
  });

  const dias = Number(CONFIG.PROMEDIO_VENTANA_DIAS) || 0;
  const inicioVentana = (dias > 0 && fechaTope)
    ? new Date(fechaTope.getTime() - (dias * 86400000))
    : null;

  agrupadas.cargas.forEach(function (carga) {
    if (!carga.cantidad) return;
    const enVentana = !inicioVentana || (carga.fecha && carga.fecha >= inicioVentana);

    const claveProv = claveProveedor(carga.proveedor);
    const claveMat = claveProveedor(carga.material);
    const claveCombinada = claveProv + '|' + claveMat;

    if (!porProveedorMaterial[claveCombinada]) {
      porProveedorMaterial[claveCombinada] = nuevoAcumulador({
        proveedor: carga.proveedor,
        material: carga.material,
        codigoMaterial: carga.codigoMaterial
      });
    }
    if (!porProveedor[claveProv]) {
      porProveedor[claveProv] = nuevoAcumulador({ proveedor: carga.proveedor, material: '(todos)' });
    }

    if (carga.fecha && (!cortePorProveedor[claveProv] || carga.fecha > cortePorProveedor[claveProv])) {
      cortePorProveedor[claveProv] = carga.fecha;
    }

    acumular(porProveedorMaterial[claveCombinada], carga, enVentana);
    acumular(porProveedor[claveProv], carga, enVentana);
    acumular(global, carga, enVentana);
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
    fechaTope: fechaTope,
    cargas: agrupadas.cargas,
    porCarga: agrupadas.porClave,
    cortePorProveedor: cortePorProveedor,
    corteGlobal: fechaTope
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

function acumular(acumulador, carga, enVentana) {
  acumulador.camionesHistorico++;
  acumulador.totalHistorico += carga.cantidad;
  if (enVentana) {
    acumulador.camionesVentana++;
    acumulador.totalVentana += carga.cantidad;
  }
  if (carga.fecha && (!acumulador.ultimaFecha || carga.fecha > acumulador.ultimaFecha)) {
    acumulador.ultimaFecha = carga.fecha;
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
    'Cargas ventana', 'TS ventana', 'Cargas histórico', 'TS histórico',
    'TS/carga usado', 'Base del promedio', 'Última fecha SAP', 'Revisar'
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
  const alto = Math.max(filas.length, 1);
  hoja.getRange(2, 4, alto, 1).setNumberFormat('#,##0');       // camiones ventana
  hoja.getRange(2, 5, alto, 1).setNumberFormat('#,##0.000');   // TS ventana
  hoja.getRange(2, 6, alto, 1).setNumberFormat('#,##0');       // camiones histórico
  hoja.getRange(2, 7, alto, 2).setNumberFormat('#,##0.000');   // TS histórico y TS/camión
  hoja.getRange(2, 10, alto, 1).setNumberFormat('dd-mm-yyyy'); // última fecha SAP
  hoja.autoResizeColumns(1, encabezados.length);
}

/**
 * Hasta qué fecha llega SAP para un proveedor. null = no tiene ningún ingreso
 * contabilizado, así que todos sus camiones se estiman.
 */
function corteSapDe(promedios, proveedorSap) {
  if (!proveedorSap) return null;
  return promedios.cortePorProveedor[claveProveedor(proveedorSap)] || null;
}

/** ¿El factor quedó fuera del rango esperado por carga? */
function promedioFueraDeRango(promedio) {
  if (!promedio) return false;
  const minimo = Number(CONFIG.TS_POR_CARGA_MINIMO) || 0;
  const maximo = Number(CONFIG.TS_POR_CARGA_MAXIMO) || 0;
  if (minimo && promedio < minimo) return true;
  return !!(maximo && promedio > maximo);
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
    registro.ultimaFecha || '',
    promedioFueraDeRango(registro.promedio)
      ? 'Fuera del rango esperado (' + (CONFIG.TS_POR_CARGA_MINIMO || 0) + '-' +
        (CONFIG.TS_POR_CARGA_MAXIMO || 0) + ' TS por carga)'
      : ''
  ];
}
