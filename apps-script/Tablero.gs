/**
 * Tablero web: una sola llamada entrega todo lo que la pantalla necesita.
 *
 * El código va en 'Tablero.gs' y la vista en 'Panel.html' a propósito: Apps
 * Script no admite dos archivos con el mismo nombre aunque uno sea .gs y el
 * otro .html, así que un 'Panel.gs' al lado de 'Panel.html' no se puede
 * crear.
 *
 * El cruce lo resuelve Motor.gs, el mismo que escribe las hojas, así que el
 * panel y el 'Control Ingreso' no pueden decir cifras distintas del mismo mes.
 *
 * Acá se agrega lo que el navegador no puede calcular solo: días hábiles con
 * feriados, el plan mes a mes, el precio de cada fila y los avisos de estado.
 */
const HTML_PANEL = 'Panel';

function doGet() {
  return HtmlService.createTemplateFromFile(HTML_PANEL)
    .evaluate()
    .setTitle('Mapal · Control de ingreso de subproductos')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function abrirPanel() {
  const salida = HtmlService.createTemplateFromFile(HTML_PANEL)
    .evaluate()
    .setWidth(1700)
    .setHeight(950);

  SpreadsheetApp.getUi().showModalDialog(salida, 'Control de ingreso de subproductos');
}

/** Todo lo que consume el panel. */
function getDashboardData() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const datos = resolverIngresos(libro);

  const zona = libro.getSpreadsheetTimeZone() || 'America/Santiago';
  const mes = ventanaDelMes_(zona);
  const historiaDesde = mesClaveDesplazada(
    mes.prefijo, -Math.max(0, (Number(CONFIG.PANEL_MESES_HISTORIA) || 1) - 1)
  );

  const filas = [];
  const proveedores = {};
  const productos = {};
  const comunas = {};

  datos.filas.forEach(function (fila) {
    if (!fila.mes || fila.mes < historiaDesde) return;

    // El precio se busca por el nombre homologado: el Plan no conoce los
    // nombres de SAP ni las variantes escritas a mano.
    const precio = precioDelPlan(datos.plan, fila.productoCorto, fila.proveedorPlan);

    filas.push({
      fecha: fila.fechaClave,
      mes: fila.mes,
      estado: fila.estado,
      fuente: fila.fuente,
      detalleFuente: fila.detalleFuente,
      producto: fila.productoCorto,
      productoOrigen: fila.producto,
      proveedor: fila.proveedor,
      proveedorSap: fila.proveedorSap,
      proveedorPlan: fila.proveedorPlan,
      proveedorPlanilla: fila.proveedorPlanilla,
      comuna: fila.comuna,
      guia: fila.guia,
      patente: fila.patente,
      ticket: fila.ticket,
      pesoBruto: fila.pesoBruto,
      ts: redondear(fila.ts, 3),
      precio: precio,
      costo: precio === null ? null : redondear(fila.ts * precio, 2),
      promedioUsado: redondear(fila.promedioUsado, 3),
      documento: fila.documento,
      hojaOrigen: fila.hojaOrigen,
      filaOrigen: fila.filaOrigen,
      sinPlan: fila.sinPlan,
      sinHomologar: fila.sinHomologar,
      duplicado: fila.duplicado,
      revisarGuia: fila.revisarGuia,
      observacion: fila.observacion
    });

    if (fila.proveedor) proveedores[fila.proveedor] = true;
    if (fila.productoCorto) productos[fila.productoCorto] = true;
    if (fila.comuna) comunas[fila.comuna] = true;
  });

  const habiles = infoDiasHabiles_(zona, mes, historiaDesde, datos);
  const propiedades = PropertiesService.getDocumentProperties();
  const importacion = ultimaImportacion();

  return {
    generadoEn: Utilities.formatDate(new Date(), zona, "yyyy-MM-dd'T'HH:mm:ss"),
    zona: zona,
    unidad: 'TS',
    version: VERSION,
    mes: mes,
    habiles: habiles,
    feriados: feriados().filter(function (f) {
      return f >= historiaDesde + '-01' && f <= mes.endKey;
    }),
    filtros: {
      productos: Object.keys(productos).sort(),
      proveedores: Object.keys(proveedores).sort(),
      comunas: Object.keys(comunas).sort()
    },
    plan: {
      filas: datos.plan.filas.map(function (fila) {
        return {
          producto: fila.producto,
          proveedor: fila.proveedor,
          precio: fila.precio,
          cantidades: fila.cantidades
        };
      }),
      meses: datos.plan.meses,
      hoja: CONFIG.HOJA_PLAN
    },
    promedios: listaPromedios_(datos.promedios),
    fuente: resumenFuente_(datos, propiedades, importacion, historiaDesde, mes),
    filas: filas
  };
}

/** Ventana del mes en curso, con sus etiquetas. */
function ventanaDelMes_(zona) {
  const prefijo = Utilities.formatDate(new Date(), zona, 'yyyy-MM');
  const partes = prefijo.split('-');
  const anio = Number(partes[0]);
  const mes = Number(partes[1]);
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();

  const nombres = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  return {
    prefijo: prefijo,
    anio: anio,
    mes: mes,
    startKey: prefijo + '-01',
    endKey: prefijo + '-' + dosDigitos(ultimo),
    etiqueta: nombres[mes] + ' de ' + anio
  };
}

/**
 * Días hábiles.
 *
 * 'total', 'transcurridos' y 'restantes' son del MES en curso: es lo que usa
 * el prorrateo del plan, que sólo tiene sentido dentro del mes. 'claves'
 * cubre toda la ventana de historia, porque es el eje de los gráficos.
 *
 * La fecha de referencia —hasta dónde se considera transcurrido el mes— es la
 * más reciente entre el último ingreso y la última planilla, sin pasarse de
 * hoy ni del fin de mes. Si se usara hoy a secas, un mes sin cargar todavía
 * mostraría el plan corriendo contra nada.
 */
function infoDiasHabiles_(zona, mes, historiaDesde, datos) {
  const hoy = Utilities.formatDate(new Date(), zona, 'yyyy-MM-dd');

  let ultimaReal = '';
  let ultimaPlanilla = '';

  datos.filas.forEach(function (fila) {
    if (!fila.fechaClave) return;
    if (fila.fuente === 'SAP' && fila.fechaClave > ultimaReal) {
      ultimaReal = fila.fechaClave;
    }
    if (fila.estado !== ESTADO.SOLO_SAP && fila.fechaClave > ultimaPlanilla) {
      ultimaPlanilla = fila.fechaClave;
    }
  });

  let referencia = ultimaPlanilla > ultimaReal ? ultimaPlanilla : ultimaReal;

  if (!referencia || referencia > hoy) referencia = hoy;
  if (referencia > mes.endKey) referencia = mes.endKey;
  if (referencia < mes.startKey) referencia = mes.startKey;

  const claves = diasHabilesEntre(historiaDesde + '-01', mes.endKey);
  const delMes = claves.filter(function (k) {
    return k >= mes.startKey && k <= mes.endKey;
  });
  const transcurridos = delMes.filter(function (k) { return k <= referencia; });

  return {
    hoy: hoy,
    referencia: referencia,
    total: delMes.length,
    transcurridos: transcurridos.length,
    restantes: Math.max(0, delMes.length - transcurridos.length),
    fraccion: delMes.length ? transcurridos.length / delMes.length : 0,
    claves: claves,
    ultimaReal: ultimaReal,
    ultimaPlanilla: ultimaPlanilla
  };
}

function listaPromedios_(promedios) {
  const salida = [];

  Object.keys(promedios.porProveedorMaterial).forEach(function (clave) {
    const registro = promedios.porProveedorMaterial[clave];

    salida.push({
      proveedor: registro.proveedor,
      material: registro.material,
      cargas: registro.camionesVentana || registro.camionesHistorico,
      promedio: redondear(registro.promedio, 3),
      base: registro.base,
      ultima: claveFecha(registro.ultimaFecha),
      fueraDeRango: promedioFueraDeRango(registro.promedio)
    });
  });

  return salida.sort(function (a, b) { return b.cargas - a.cargas; });
}

/** Estado de las fuentes: lo que el panel tiene que advertir sin que se pregunte. */
function resumenFuente_(datos, propiedades, importacion, historiaDesde, mes) {
  const sinHomologar = {};
  const revisarGuia = {};
  const sinPlan = {};
  // Productos escritos a mano que no encontraron par en SAP ni en el Plan: son
  // los que dejan camiones en cero sin que se vea el motivo.
  const productosSinHomologar = {};
  const duplicados = [];

  datos.filas.forEach(function (fila) {
    if (fila.mes !== mes.prefijo) return;

    if (fila.duplicado) {
      duplicados.push({
        proveedor: fila.proveedorPlanilla || fila.proveedor,
        guia: fila.guia,
        fecha: fila.fechaClave
      });
      return;
    }

    if (fila.estado === ESTADO.SIN_HOMOLOGAR) {
      sinHomologar[fila.proveedorPlanilla] =
        (sinHomologar[fila.proveedorPlanilla] || 0) + 1;
    }

    if (fila.revisarGuia) {
      const clave = fila.proveedorSap || fila.proveedor;
      revisarGuia[clave] = (revisarGuia[clave] || 0) + 1;
    }

    if (fila.sinPlan && !fila.sinHomologar && fila.ts > 0) {
      sinPlan[fila.proveedor] = (sinPlan[fila.proveedor] || 0) + fila.ts;
    }

    if (fila.productoSinHomologar && fila.producto) {
      const nombre = productoCorto(fila.producto);
      productosSinHomologar[nombre] = (productosSinHomologar[nombre] || 0) + 1;
    }
  });

  function aLista(mapa, campo) {
    return Object.keys(mapa).sort(function (a, b) {
      return mapa[b] - mapa[a];
    }).map(function (nombre) {
      const item = { proveedor: nombre };
      item[campo] = redondear(mapa[nombre], 3);
      return item;
    });
  }

  const cortes = [];

  Object.keys(datos.promedios.cortePorProveedor).forEach(function (clave) {
    const fecha = datos.promedios.cortePorProveedor[clave];
    const registro = datos.promedios.porProveedor[clave];

    cortes.push({
      proveedor: registro ? registro.proveedor : clave,
      corte: claveFecha(fecha)
    });
  });

  return {
    libro: SpreadsheetApp.getActiveSpreadsheet().getName(),
    url: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    nombreOrigen: propiedades.getProperty('nombreOrigen') || '',
    hojasOrigen: propiedades.getProperty('hojaOrigen') || '',
    camionesImportados: Number(propiedades.getProperty('filasImportadas') || 0),
    ultimaImportacion: importacion ? claveFecha(importacion) : '',
    ultimaActualizacion: propiedades.getProperty('ultimaActualizacion') || '',
    historiaDesde: historiaDesde,
    productosIncluidos: (CONFIG.PRODUCTOS_INCLUIDOS || []).slice(),
    productosSinHomologar: Object.keys(productosSinHomologar)
      .sort(function (a, b) { return productosSinHomologar[b] - productosSinHomologar[a]; })
      .map(function (nombre) {
        return { producto: nombre, camiones: productosSinHomologar[nombre] };
      }),
    descartadosProducto: datos.planilla.excluidosProducto,
    descartadosEstado: datos.planilla.excluidosEstado,
    camionesPlanilla: datos.planilla.filas.length,
    filasSap: datos.sap.filas.length,
    cargasSap: datos.promedios.cargas.length,
    corteGlobal: claveFecha(datos.promedios.corteGlobal),
    cortes: cortes.sort(function (a, b) {
      return String(b.corte).localeCompare(String(a.corte));
    }),
    ventanaPromedio: Number(CONFIG.PROMEDIO_VENTANA_DIAS) || 0,
    rangoCarga: [
      Number(CONFIG.TS_POR_CARGA_MINIMO) || 0,
      Number(CONFIG.TS_POR_CARGA_MAXIMO) || 0
    ],
    hayPlan: datos.plan.filas.length > 0,
    mesEnPlan: datos.plan.meses.indexOf(mes.prefijo) >= 0,
    mesesPlan: datos.plan.meses,
    proveedoresSap: datos.sap.proveedores,
    proveedoresPlan: datos.plan.proveedores,
    sinHomologar: aLista(sinHomologar, 'camiones'),
    revisarGuia: aLista(revisarGuia, 'camiones'),
    sinPlan: aLista(sinPlan, 'ts'),
    duplicados: duplicados,
    homologacion: {
      hoja: CONFIG.HOJA_HOMOLOGACION,
      existe: !datos.homologacion.missingSheet,
      pares: datos.homologacion.filas.length
    }
  };
}

/** Trae la hoja del mes y detecta proveedores nuevos; el panel recarga después. */
function traerPlanillaDesdePanel() {
  const resultado = importarPlanillaOrigen();

  sincronizarEquivalencias();

  return {
    archivo: resultado.archivo,
    hojas: resultado.hojas,
    filas: resultado.filas,
    aviso: resultado.aviso
  };
}
