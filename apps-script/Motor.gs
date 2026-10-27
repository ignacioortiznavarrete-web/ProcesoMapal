/**
 * Motor del cruce. Una sola verdad para las dos salidas.
 *
 * El control en hojas y el panel web leen de acá. Si cada uno resolviera el
 * cruce por su cuenta, tarde o temprano dirían cifras distintas del mismo
 * mes, y un panel que se contradice con su propia planilla no se vuelve a
 * mirar.
 *
 * Devuelve una fila por camión:
 *   - un camión de la planilla manual, con su cantidad real si su guía ya
 *     está en SAP, o estimada con el promedio TS/carga de su material;
 *   - una carga que está en SAP y que nadie registró a mano.
 *
 * La regla del cruce es la guía, y nada más: **proveedor + material + guía**.
 * Si esa guía está en SAP, manda SAP y la cantidad es la real. Si no está, el
 * camión se complementa con la planilla y se valoriza con el promedio del
 * material.
 *
 * Antes había además un corte por fecha: hasta la última fecha contabilizada
 * de cada proveedor se daba por hecho que SAP ya tenía todo, y un camión sin
 * cruzar en esos días se dejaba en cero para no contarlo dos veces. Ese
 * supuesto era falso: SAP no se carga en orden, va dejando huecos hacia atrás,
 * así que la regla botaba a cero camiones que de verdad faltaban y el mes
 * quedaba corto. Se cambió por un aviso, que es lo que la regla intentaba ser:
 * cuando un proveedor y material tiene cargas en SAP que nadie cruzó y además
 * camiones estimados, los dos lados quedan marcados para revisar el Nº de
 * guía. El número ya no se pierde; lo que se ve es la sospecha.
 */
function resolverIngresos(libro) {
  const sap = cargarSap(libro);
  const planilla = cargarPlanilla(libro);
  const plan = cargarPlan(libro);
  const homologacion = cargarHomologacion(libro);
  const homologacionProductos = cargarHomologacionProductos(libro);
  const faltantes = cargarGuiasFaltantes(libro);
  const promedios = calcularPromedios(sap);

  // ---- 1) Cruce por proveedor + material + guía ---------------------------
  // Se resuelve TODO el cruce antes de valorizar nada: para saber si una
  // estimación es sospechosa hay que saber qué cargas de SAP quedaron sueltas,
  // y eso sólo se sabe una vez que pasaron todos los camiones.
  const pendientesDeCruce = planilla.filas.map(function (fila) {
    const equivalencia = resolverProveedor(fila.proveedor, homologacion, sap, plan);
    const material = resolverProducto(fila.producto, homologacionProductos, sap, plan);

    const cargaSap = buscarCargaSap(promedios, equivalencia.sap, material.sap, fila.guia);
    if (cargaSap) cargaSap.usado = true;

    return { fila: fila, equivalencia: equivalencia, material: material, cargaSap: cargaSap };
  });

  // Las cargas de SAP que ningún camión reclamó se emparejan con los camiones
  // que no cruzaron, dentro del mismo proveedor y material y por cercanía de
  // fecha. Cada carga suelta marca a UN camión, el más probable: avisar a
  // todos los pendientes del proveedor por una sola carga suelta dejaría el
  // mes entero marcado, y una marca que está en todas partes no se mira.
  emparejarSospechas(promedios, pendientesDeCruce);

  const filas = [];
  const guiasVistas = {};

  // ---- 2) Una fila por camión de la planilla ------------------------------
  pendientesDeCruce.forEach(function (item) {
    const fila = item.fila;
    const equivalencia = item.equivalencia;
    const material = item.material;
    const cargaSap = item.cargaSap;

    const mesPlanilla = claveMes(fila.fecha);
    const mesSap = cargaSap ? claveMes(cargaSap.fecha) : '';
    const mes = (CONFIG.FECHA_BASE === 'SAP' && mesSap) ? mesSap : (mesPlanilla || mesSap);

    const fechaBase = (CONFIG.FECHA_BASE === 'SAP' && cargaSap && cargaSap.fecha)
      ? cargaSap.fecha
      : (fila.fecha || (cargaSap ? cargaSap.fecha : null));

    let estado;
    let fuente;
    let cantidad = 0;
    let detalleFuente = '';
    let promedioUsado = 0;
    let revisarGuia = false;
    let sinCruzar = false;
    let contada = true;
    let tsSinCruce = 0;

    if (cargaSap) {
      estado = ESTADO.EN_SAP;
      fuente = 'SAP';
      cantidad = cargaSap.cantidad;
      detalleFuente = cargaSap.lineas > 1
        ? 'SAP (real, ' + cargaSap.lineas + ' líneas)'
        : 'SAP (real)';
    } else if (!equivalencia.sap && !equivalencia.plan) {
      estado = ESTADO.SIN_HOMOLOGAR;
      fuente = 'SIN DATO';
      detalleFuente = 'sin homologar';
    } else {
      sinCruzar = true;

      const referencia = promedioPara(
        promedios, equivalencia.sap, material.canonico, material.sap);
      const decision = decidirSiSeCuenta(
        faltantes, equivalencia, material, fila, promedios.corteGlobal);

      promedioUsado = referencia.promedio;
      contada = decision.contar;
      // Lo que vale este camión, se cuente o no: la hoja de revisión lo
      // necesita para mostrar cuánto está aportando cada guía que falta.
      tsSinCruce = referencia.promedio;
      cantidad = decision.contar ? referencia.promedio : 0;

      if (!decision.contar) {
        estado = ESTADO.NO_CONTADA;
        fuente = 'SIN DATO';
        detalleFuente = decision.motivo;
      } else {
        fuente = referencia.promedio > 0 ? 'ESTIMADO' : 'SIN DATO';
        detalleFuente = 'estimado - ' + referencia.origen;
        if (decision.motivo) detalleFuente += ' - ' + decision.motivo;
        if (referencia.promedio <= 0) estado = ESTADO.SIN_PROMEDIO;
        else if (!equivalencia.sap) estado = ESTADO.SIN_SAP;
        else estado = ESTADO.PENDIENTE;
      }

      if (item.sospecha) {
        revisarGuia = true;
        detalleFuente += ' - SAP tiene sin cruzar la guía ' + item.sospecha.guia +
          ' del ' + claveFecha(item.sospecha.fecha) +
          ', mismo proveedor y material: puede ser este camión';
      }
    }

    let duplicado = false;

    if (fila.guia) {
      // El duplicado se mide por proveedor + material + guía, igual que el cruce.
      const claveDuplicado = claveCarga(fila.proveedor, material.canonico, fila.guia);
      if (guiasVistas[claveDuplicado]) {
        duplicado = true;
        estado = ESTADO.DUPLICADO + ' / ' + estado;
        fuente = 'SIN DATO';
        cantidad = 0;
        revisarGuia = false;
        // Un duplicado no es una guía que falte: es la misma dos veces.
        sinCruzar = false;
        tsSinCruce = 0;
      }
      guiasVistas[claveDuplicado] = true;
    }

    filas.push({
      mes: mes,
      fecha: fechaBase || null,
      fechaClave: claveFecha(fechaBase),
      estado: estado,
      fuente: fuente,
      detalleFuente: detalleFuente,
      duplicado: duplicado,
      revisarGuia: revisarGuia,
      guiaSospechosa: item.sospecha ? item.sospecha.guia : '',
      sinCruzar: sinCruzar,
      contada: contada,
      tsSinCruce: tsSinCruce,
      producto: fila.producto,
      productoCorto: material.canonico,
      productoSap: material.sap,
      productoSinHomologar: !material.homologado,
      proveedorPlanilla: fila.proveedor,
      proveedorSap: equivalencia.sap,
      proveedorPlan: equivalencia.plan,
      proveedor: equivalencia.plan || equivalencia.sap || fila.proveedor,
      sinHomologar: !equivalencia.sap && !equivalencia.plan,
      sinPlan: !equivalencia.plan,
      comuna: fila.comuna,
      guia: fila.guiaTexto,
      patente: fila.patente,
      pesoBruto: fila.pesoBruto,
      ticket: fila.ticket,
      observacion: fila.observacion,
      ts: cantidad,
      promedioUsado: promedioUsado,
      documento: cargaSap ? cargaSap.documentos.join(' / ') : '',
      fechaSap: cargaSap && cargaSap.fecha ? cargaSap.fecha : null,
      hojaOrigen: fila.hojaOrigen,
      filaOrigen: fila.filaOrigen,
      filaPlanilla: fila.filaHoja
    });
  });

  // ---- 3) Cargas que sólo están en SAP ------------------------------------
  promedios.cargas.forEach(function (carga) {
    if (carga.usado) return;

    const nombrePlan = resolverPlanDesdeSap(carga.proveedor, homologacion, plan);
    const nombreProducto = resolverProductoDesdeSap(
      carga.material, homologacionProductos, plan);

    filas.push({
      mes: claveMes(carga.fecha),
      fecha: carga.fecha || null,
      fechaClave: claveFecha(carga.fecha),
      estado: ESTADO.SOLO_SAP,
      fuente: 'SAP',
      detalleFuente: carga.lineas > 1
        ? 'SAP (real, ' + carga.lineas + ' líneas)'
        : 'SAP (real)',
      duplicado: false,
      revisarGuia: false,
      guiaSospechosa: '',
      sinCruzar: false,
      contada: true,
      tsSinCruce: 0,
      producto: carga.material,
      productoCorto: nombreProducto,
      productoSap: carga.material,
      productoSinHomologar: false,
      proveedorPlanilla: '',
      proveedorSap: carga.proveedor,
      proveedorPlan: nombrePlan,
      proveedor: nombrePlan || carga.proveedor,
      sinHomologar: false,
      sinPlan: !nombrePlan,
      comuna: '',
      guia: carga.guiaTexto,
      patente: '',
      pesoBruto: null,
      ticket: '',
      observacion: 'Sin registro en la planilla manual',
      ts: carga.cantidad,
      promedioUsado: 0,
      documento: carga.documentos.join(' / '),
      fechaSap: carga.fecha || null,
      hojaOrigen: CONFIG.HOJA_SAP,
      filaOrigen: carga.filaHoja,
      filaPlanilla: ''
    });
  });

  return {
    filas: filas,
    sap: sap,
    planilla: planilla,
    plan: plan,
    homologacion: homologacion,
    homologacionProductos: homologacionProductos,
    faltantes: faltantes,
    promedios: promedios
  };
}

/**
 * ¿Se complementa este camión con la planilla, o se deja fuera?
 *
 * Primero manda lo que esté escrito a mano en 'guias faltantes'. Si ahí no hay
 * nada, decide la regla: un camión que SAP todavía no alcanzó es desfase y se
 * cuenta; uno que SAP ya pasó de largo hace días, no.
 */
function decidirSiSeCuenta(faltantes, equivalencia, material, fila, corteSap) {
  const clave = claveCarga(
    equivalencia.sap || fila.proveedor,
    material.sap || material.canonico,
    fila.guia
  );
  const registro = faltantes.porCarga[clave];

  if (registro && registro.accion === ACCION_GUIA.CONTAR) {
    return { contar: true, motivo: 'se cuenta por decisión en "' +
      CONFIG.HOJA_GUIAS_FALTANTES + '"' };
  }
  if (registro && registro.accion === ACCION_GUIA.NO_CONTAR) {
    return { contar: false, motivo: 'no se cuenta por decisión en "' +
      CONFIG.HOJA_GUIAS_FALTANTES + '"' };
  }

  if (guiaVencida(fila.fecha, corteSap)) {
    return {
      contar: false,
      motivo: 'SAP ya llegó hasta el ' + claveFecha(corteSap) + ' y esta guía ' +
        'sigue sin aparecer (' + diasSinCruzar(fila.fecha, corteSap) + ' días): ' +
        'no se cuenta. Revisar en "' + CONFIG.HOJA_GUIAS_FALTANTES + '"'
    };
  }

  return { contar: true, motivo: '' };
}

/**
 * Busca en SAP la carga de un camión: proveedor + material + guía.
 *
 * Cuando el producto de la planilla todavía no tiene par en SAP no se puede
 * exigir el material, porque no hay con qué compararlo; en ese caso se cae a
 * proveedor + guía, que es lo que se usaba antes. Es menos estricto, pero
 * perder un cruce verdadero por un nombre de producto sin homologar es peor
 * que el riesgo de pegarle a la carga de otro material del mismo proveedor
 * con la misma guía.
 */
function buscarCargaSap(promedios, proveedorSap, materialSap, guia) {
  if (!guia || !proveedorSap) return null;

  if (materialSap) {
    const exacta = promedios.porCarga[claveCarga(proveedorSap, materialSap, guia)];
    return (exacta && !exacta.usado) ? exacta : null;
  }

  const prefijo = claveProveedor(proveedorSap) + '|';
  const sufijo = '|' + guia;
  let encontrada = null;

  Object.keys(promedios.porCarga).some(function (clave) {
    if (clave.indexOf(prefijo) !== 0) return false;
    if (clave.length < sufijo.length ||
        clave.substring(clave.length - sufijo.length) !== sufijo) {
      return false;
    }
    const carga = promedios.porCarga[clave];
    if (carga.usado) return false;
    encontrada = carga;
    return true;
  });

  return encontrada;
}

/**
 * Empareja las cargas de SAP que nadie cruzó con los camiones de la planilla
 * que no encontraron su guía, dentro del mismo proveedor y material.
 *
 * Las dos puntas son el mismo hecho visto dos veces: un camión que entró y
 * quedó escrito con un número de guía distinto en cada sistema. Emparejarlas
 * por cercanía de fecha deja el aviso donde se puede actuar —nombra la guía
 * que SAP tiene sin cruzar— y, sobre todo, lo acota: nunca se marcan más
 * camiones que cargas sueltas hay.
 *
 * No cambia ninguna cantidad: el camión se estima igual. Lo que se marca es
 * la sospecha, no una corrección.
 */
function emparejarSospechas(promedios, pendientesDeCruce) {
  const grupos = {};

  function grupo(clave) {
    if (!grupos[clave]) grupos[clave] = { sueltas: [], camiones: [] };
    return grupos[clave];
  }

  promedios.cargas.forEach(function (carga) {
    if (carga.usado || !carga.fecha) return;
    grupo(claveGrupoSospecha(carga.proveedor, carga.material)).sueltas.push(carga);
  });

  pendientesDeCruce.forEach(function (item) {
    if (item.cargaSap || !item.equivalencia.sap || !item.fila.fecha) return;
    grupo(claveGrupoSospecha(item.equivalencia.sap, item.material.sap)).camiones.push(item);
  });

  const tope = (Number(CONFIG.DIAS_SOSPECHA_GUIA) || 15) * 86400000;

  Object.keys(grupos).forEach(function (clave) {
    const sueltas = grupos[clave].sueltas.slice().sort(function (a, b) {
      return a.fecha - b.fecha;
    });
    const camiones = grupos[clave].camiones;

    sueltas.forEach(function (carga) {
      let elegido = null;
      let menor = Infinity;

      camiones.forEach(function (item) {
        if (item.sospecha) return;
        const distancia = Math.abs(item.fila.fecha - carga.fecha);
        if (distancia <= tope && distancia < menor) {
          menor = distancia;
          elegido = item;
        }
      });

      if (elegido) {
        elegido.sospecha = { guia: carga.guiaTexto || carga.guia, fecha: carga.fecha };
      }
    });
  });
}

function claveGrupoSospecha(proveedorSap, materialSap) {
  return claveProveedor(proveedorSap) + '|' + claveProducto(materialSap);
}

/** Precio unitario que el Plan le fija a un producto y proveedor. */
function precioDelPlan(plan, producto, proveedorPlan) {
  if (!proveedorPlan) return null;

  const claveProv = claveProveedor(proveedorPlan);
  const claveProd = claveProveedor(producto);

  let precio = null;

  (plan.filas || []).forEach(function (fila) {
    if (claveProveedor(fila.proveedor) !== claveProv) return;
    if (claveProd && claveProveedor(fila.producto) &&
        claveProveedor(fila.producto) !== claveProd) {
      return;
    }
    if (fila.precio !== null && fila.precio !== undefined) precio = fila.precio;
  });

  return precio;
}
