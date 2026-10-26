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
 *     está en SAP, o estimada con el promedio TS/carga de su proveedor;
 *   - una carga que está en SAP y que nadie registró a mano.
 *
 * El criterio de cuándo se estima y cuándo no está en corteCubre(): hasta la
 * última fecha que SAP tiene de ese proveedor manda SAP, porque su total ya
 * incluye esos días. Después del corte manda la planilla.
 */
function resolverIngresos(libro) {
  const sap = cargarSap(libro);
  const planilla = cargarPlanilla(libro);
  const plan = cargarPlan(libro);
  const homologacion = cargarHomologacion(libro);
  const promedios = calcularPromedios(sap);

  const filas = [];
  const guiasVistas = {};

  // ---- 1) Camiones de la planilla manual ----------------------------------
  planilla.filas.forEach(function (fila) {
    const equivalencia = resolverProveedor(fila.proveedor, homologacion, sap, plan);

    // Las cargas de SAP están indexadas por proveedor + guía: los números de
    // guía se repiten entre proveedores, así que la guía sola no identifica
    // al camión.
    const claveCarga = (fila.guia && equivalencia.sap)
      ? claveProveedor(equivalencia.sap) + '|' + fila.guia
      : '';
    const candidata = claveCarga ? promedios.porCarga[claveCarga] : null;
    const cargaSap = (candidata && !candidata.usado) ? candidata : null;
    if (cargaSap) cargaSap.usado = true;

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
    } else if (corteCubre(promedios, equivalencia.sap, fila.fecha)) {
      estado = ESTADO.SIN_CRUCE;
      fuente = 'SIN DATO';
      detalleFuente = 'SAP ya cubre este día: revisar el Nº de guía';
    } else {
      const referencia = promedioPara(promedios, equivalencia.sap, fila.producto);
      promedioUsado = referencia.promedio;
      cantidad = referencia.promedio;
      fuente = referencia.promedio > 0 ? 'ESTIMADO' : 'SIN DATO';
      detalleFuente = 'estimado - ' + referencia.origen;
      if (referencia.promedio <= 0) estado = ESTADO.SIN_PROMEDIO;
      else if (!equivalencia.sap) estado = ESTADO.SIN_SAP;
      else estado = ESTADO.PENDIENTE;
    }

    let duplicado = false;

    if (fila.guia) {
      // El duplicado se mide por proveedor + guía, no por la guía sola.
      const claveDuplicado = claveProveedor(fila.proveedor) + '|' + fila.guia;
      if (guiasVistas[claveDuplicado]) {
        duplicado = true;
        estado = ESTADO.DUPLICADO + ' / ' + estado;
        fuente = 'SIN DATO';
        cantidad = 0;
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
      producto: fila.producto,
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

  // ---- 2) Cargas que sólo están en SAP ------------------------------------
  promedios.cargas.forEach(function (carga) {
    if (carga.usado) return;

    const nombrePlan = resolverPlanDesdeSap(carga.proveedor, homologacion, plan);

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
      producto: carga.material,
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
    promedios: promedios
  };
}

/**
 * ¿La fecha del camión ya está dentro de lo que SAP tiene contabilizado para
 * ese proveedor? Si lo está, su carga ya figura en el total real de SAP y
 * estimarla sería contar dos veces lo mismo.
 */
function corteCubre(promedios, proveedorSap, fecha) {
  if (!proveedorSap || !fecha) return false;
  const corte = corteSapDe(promedios, proveedorSap);
  if (!corte) return false;
  return fecha <= corte;
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
