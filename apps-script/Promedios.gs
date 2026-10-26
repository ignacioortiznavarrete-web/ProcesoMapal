/**
 * Agrupa las líneas de SAP en cargas: una carga = un camión = una guía de un
 * proveedor para un material. Una misma guía puede venir en más de una línea
 * (dos posiciones del pedido), y en ese caso las cantidades se suman; si se
 * contara línea por línea, el promedio por carga saldría a la mitad.
 *
 * El material es parte de la llave porque los números de guía se repiten: la
 * misma guía de un proveedor puede corresponder a un camión de astilla y a
 * otro de aserrín, y cruzarlos al revés le daría a cada uno la cantidad del
 * otro.
 */
function agruparCargasSap(sap) {
  const cargas = [];
  const porClave = {};

  sap.filas.forEach(function (fila) {
    if (!fila.desProveedor) return;
    const clave = fila.guia
      ? claveCarga(fila.desProveedor, fila.desMaterial, fila.guia)
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
/**
 * Llave de una carga: proveedor + material + guía. Es la misma fórmula para
 * las dos puntas del cruce, así que vive en un solo lugar.
 */
function claveCarga(proveedor, material, guia) {
  return claveProveedor(proveedor) + '|' + claveProducto(material) + '|' + guia;
}

function calcularPromedios(sap) {
  const agrupadas = agruparCargasSap(sap);
  const porProveedorMaterial = {};
  const porProveedor = {};
  // Por material, juntando a todos los proveedores. Es el respaldo cuando un
  // proveedor estrena un material: un camión de viruta no pesa lo que uno de
  // astilla, así que el promedio del proveedor en OTRO material no sirve.
  const porMaterial = {};
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
    if (!porMaterial[claveMat]) {
      porMaterial[claveMat] = nuevoAcumulador({
        proveedor: '(todos los proveedores)',
        material: carga.material,
        codigoMaterial: carga.codigoMaterial
      });
    }

    if (carga.fecha && (!cortePorProveedor[claveProv] || carga.fecha > cortePorProveedor[claveProv])) {
      cortePorProveedor[claveProv] = carga.fecha;
    }

    acumular(porProveedorMaterial[claveCombinada], carga, enVentana);
    acumular(porProveedor[claveProv], carga, enVentana);
    acumular(porMaterial[claveMat], carga, enVentana);
    acumular(global, carga, enVentana);
  });

  [porProveedorMaterial, porProveedor, porMaterial].forEach(function (mapa) {
    Object.keys(mapa).forEach(function (clave) { cerrarAcumulador(mapa[clave]); });
  });
  cerrarAcumulador(global);

  return {
    porProveedorMaterial: porProveedorMaterial,
    porProveedor: porProveedor,
    porMaterial: porMaterial,
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
 * El registro cuyo material calza con el producto del camión.
 *
 * El nombre no es el mismo en las dos planillas: SAP escribe
 * 'ASTILLA VERDE (TS)' y la planilla 'ASTILLA VERDE', así que se compara por
 * contención en cualquier dirección y, si eso no alcanza, por parecido.
 */
function buscarPorMaterial(mapa, prefijo, claveProd) {
  const candidatos = Object.keys(mapa).filter(function (clave) {
    return !prefijo || clave.indexOf(prefijo) === 0;
  });

  if (!candidatos.length) return null;

  // Sin producto escrito no hay con qué elegir: sólo sirve si hay uno solo.
  if (!claveProd) {
    return candidatos.length === 1 ? mapa[candidatos[0]] : null;
  }

  let elegido = '';

  // Exacto primero. 'ASTILLA VERDE' está contenido en 'ASTILLA VERDE CON
  // CORTEZA' y en 'ASTILLA VERDE OTRA ESPECIE', que rinden 9,4 y 15,8 contra
  // 11,3: elegir por contención tomaría el material equivocado.
  candidatos.some(function (clave) {
    const claveMat = prefijo ? clave.substring(prefijo.length) : clave;
    if (claveMat === claveProd) {
      elegido = clave;
      return true;
    }
    return false;
  });

  if (!elegido) {
    candidatos.some(function (clave) {
      const claveMat = prefijo ? clave.substring(prefijo.length) : clave;

      if (claveMat && (claveMat.indexOf(claveProd) >= 0 || claveProd.indexOf(claveMat) >= 0)) {
        elegido = clave;
        return true;
      }

      return false;
    });
  }

  if (!elegido) {
    let mejor = 0;

    candidatos.forEach(function (clave) {
      const puntaje = similitud(claveProd, claveProveedor(mapa[clave].material));

      if (puntaje > mejor && puntaje >= 0.8) {
        mejor = puntaje;
        elegido = clave;
      }
    });
  }

  return elegido ? mapa[elegido] : null;
}

/**
 * Promedio aplicable a un camión pendiente.
 *
 * El material manda. Antes se caía al promedio del proveedor en cualquier
 * material y, si no, al general: con un solo material eso daba lo mismo, pero
 * al entrar viruta, aserrín y combustible pasaría a valorizar un camión de
 * viruta con el promedio de la astilla, que pesa bastante más. El error no se
 * vería en ninguna parte.
 *
 * Así que: proveedor + material, o el mismo material de los demás proveedores,
 * o nada. Un cero con el motivo escrito es mejor que una cifra inventada.
 */
function promedioPara(promedios, proveedorSap, producto, materialSap) {
  // El nombre homologado de SAP es el que coincide de verdad con las claves de
  // los promedios; el de la planilla sólo sirve de respaldo y para el mensaje.
  const claveProd = claveProducto(materialSap) || claveProducto(producto);

  if (proveedorSap) {
    const propio = buscarPorMaterial(
      promedios.porProveedorMaterial,
      claveProveedor(proveedorSap) + '|',
      claveProd
    );

    if (propio && propio.promedio > 0) {
      return {
        promedio: propio.promedio,
        origen: 'proveedor + material (' + propio.base + ')',
        camiones: propio.camionesVentana || propio.camionesHistorico
      };
    }
  }

  const delMaterial = buscarPorMaterial(promedios.porMaterial, '', claveProd);

  if (delMaterial && delMaterial.promedio > 0) {
    return {
      promedio: delMaterial.promedio,
      origen: 'promedio del material (' + delMaterial.base + '), sin historial ' +
        'de este proveedor',
      camiones: delMaterial.camionesVentana || delMaterial.camionesHistorico
    };
  }

  return {
    promedio: 0,
    origen: productoCorto(producto)
      ? 'sin histórico SAP de ' + productoCorto(producto)
      : 'sin producto escrito en la planilla',
    camiones: 0
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
  Object.keys(promedios.porMaterial).sort().forEach(function (clave) {
    filas.push(filaPromedio(promedios.porMaterial[clave]));
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
