/**
 * Control de ingreso de subproductos - configuración central.
 *
 * Todo lo que se ajusta a mano vive en este archivo. El resto del código
 * no debería necesitar cambios al agregar proveedores, meses o materiales.
 */
// Versión del código, para confirmar qué está pegado en el proyecto.
const VERSION = '2026-10-26';

const CONFIG = {
  // --- Planilla origen (la planilla manual que NO se puede editar) ---------
  // 'RECEPCION DIARIA MADERAS': una hoja por mes ('OCTUBRE 2026', 'Sept 2024'...).
  ORIGEN_ID: '1jtF5B1DUQdx6eCWuFIp7k86suCY8XeBJ6_RoNJ3Bg-A',
  // Vacío = se busca sola la hoja del mes. Con un nombre fijo, se importa esa.
  ORIGEN_HOJA: '',
  // Fila de encabezados en la planilla origen.
  ORIGEN_FILA_ENCABEZADO: 1,
  // Cuántas hojas mensuales traer, contando desde el mes en curso hacia atrás.
  // 1 = sólo el mes actual (lo normal). 2 = mes actual + anterior. 0 = todas.
  MESES_A_IMPORTAR: 1,

  // --- Filtros de la planilla manual --------------------------------------
  // Productos a controlar, tal como se escriben en la columna PRODUCTO.
  // Lista vacía = todos. Un nombre terminado en '*' funciona como prefijo,
  // así 'ASERRIN*' toma también 'ASERRIN viruta'.
  //
  // Quedan fuera a propósito 'COMBUSTIBLE' (no existe como material en SAP ni
  // como línea del Plan, así que sólo aportaba camiones en cero), 'ASTILLA
  // SECA' y 'ASTILLA VERDE C/CORTEZA'. Agrégalos acá cuando haya que
  // controlarlos; sus camiones aparecen contados en 'Filas descartadas'.
  PRODUCTOS_INCLUIDOS: ['ASTILLA VERDE', 'ASERRIN*', 'VIRUTA'],
  // Filas con estos valores en la columna ESTADO se descartan.
  ESTADOS_EXCLUIDOS: ['ANULADO', 'ANULADA', 'NULO', 'NULA', 'RECHAZADO', 'RECHAZADA'],

  // --- Hojas de este archivo ----------------------------------------------
  HOJA_SAP: 'Ingresos Sap',
  HOJA_PLANILLA: 'Planilla Exportada',
  HOJA_PLAN: 'Plan',
  HOJA_HOMOLOGACION: 'homologacion',
  HOJA_HOMOLOGACION_PRODUCTOS: 'homologacion productos',
  HOJA_GUIAS_FALTANTES: 'guias faltantes',
  HOJA_CONTROL: 'Control Ingreso',
  HOJA_DETALLE: 'Detalle Camiones',
  HOJA_PROMEDIOS: 'Promedios SAP',

  // --- Promedio de cantidad por camión ------------------------------------
  // Días hacia atrás para calcular el promedio (0 = todo el histórico).
  PROMEDIO_VENTANA_DIAS: 90,
  // Si el proveedor no alcanza este número de camiones en la ventana,
  // el promedio se recalcula con todo su histórico.
  PROMEDIO_MINIMO_CAMIONES: 5,

  // Rango esperado de TS por carga. Sólo se usa para avisar cuando un promedio
  // queda fuera (por ejemplo si el export SAP viene con cantidades partidas).
  TS_POR_CARGA_MINIMO: 8,
  TS_POR_CARGA_MAXIMO: 18,

  // --- Criterio de período -------------------------------------------------
  // 'PLANILLA' = el camión cuenta en el mes de su fecha de ingreso físico
  //              (recomendado: SAP viene desfasado por las 5 fases).
  // 'SAP'      = cuenta en el mes de la fecha de contabilización SAP.
  FECHA_BASE: 'PLANILLA',

  // --- Panel web -----------------------------------------------------------
  // Meses de historia que viajan al navegador. Las filas van enteras, así que
  // conviene el mínimo que permita comparar: seis meses de estadística.
  PANEL_MESES_HISTORIA: 6,

  // --- Actualización automática -------------------------------------------
  HORAS_ENTRE_ACTUALIZACIONES: 1,

  // Al editar a mano 'Planilla Exportada', las homologaciones o 'Plan', el control
  // se recalcula solo. No al instante: escribir veinte filas dispararía veinte
  // recálculos. Se espera a que la mano pare.
  //
  // Google redondea los disparadores de una vez a la baja hasta un minuto, así
  // que menos de 60 no acelera nada.
  SEGUNDOS_ESPERA_EDICION: 60,

  // Cuando un camión de la planilla no cruza y del mismo proveedor y material
  // quedó una carga de SAP que nadie reclamó, lo más probable es que sean el
  // mismo camión con la guía escrita distinta. Se avisa sólo si las fechas no
  // están más separadas que esto: el desfase entre el ingreso físico y la
  // contabilización SAP es de días, no de semanas.
  DIAS_SOSPECHA_GUIA: 15,

  // --- Guías que SAP nunca trajo ---------------------------------------------
  // Un camión cuya guía no está en SAP se complementa con la planilla: se
  // valoriza con el promedio TS/carga de las cargas que SÍ están en SAP de ese
  // proveedor y material. Eso es el corazón del control y pasa SIEMPRE, sin
  // importar la fecha: SAP no se carga en orden, así que una guía que falta
  // hoy puede aparecer la semana que viene.
  //
  // Igual queda listada en la hoja 'guias faltantes', con lo que está
  // aportando, para poder revisarla y sacarla a mano si no corresponde.
  //
  // Este parámetro permite además dejar de contar las muy atrasadas, medidas
  // contra la última 'Fecha Contab.' del export de SAP (no contra hoy: con un
  // export atrasado, medir contra hoy daría por vencido el mes entero):
  //
  //   null = de fábrica. No vence nunca; se complementan todas.
  //   N    = dejan de contarse las anteriores a N días del corte del export.
  //   0    = se complementan sólo las que SAP todavía no alcanzó.
  //
  // Antes de bajarlo de null, mirá la hoja: un proveedor sin ninguna carga en
  // el export se quedaría en cero completo. Lo que se escriba a mano en la
  // columna 'Acción' manda sobre este número.
  DIAS_GRACIA_SIN_CRUCE: null,

  // --- Homologación --------------------------------------------------------
  // Puntaje mínimo (0 a 1) para proponer una homologación automática.
  UMBRAL_SUGERENCIA: 0.62,

  // Equivalencias de producto que vienen de fábrica, para que el cruce funcione
  // antes de que alguien llene la hoja 'homologacion productos'. Lo que se
  // escriba en esa hoja manda sobre esta lista.
  //
  // El mismo material se escribe distinto en cada fuente: SAP le pone la unidad
  // y su propia nomenclatura ('VIRUTA-ASERUTA (TS)'), la planilla manual se
  // escribe a mano ('viruta') y el Plan usa el nombre comercial. Sin esta tabla
  // los tres nombres caen en filas distintas del control y el promedio TS/carga
  // del material no se encuentra.
  // Verificado contra el export de SAP de octubre 2026 (779 líneas, 5 materiales)
  // y contra los productos del Plan (ASTILLA VERDE, ASERRIN, VIRUTA).
  PRODUCTOS_EQUIVALENTES: [
    { planilla: 'ASTILLA VERDE', sap: 'ASTILLA VERDE (TS)', plan: 'ASTILLA VERDE' },
    { planilla: 'ASERRIN', sap: 'ASERRIN (TS)', plan: 'ASERRIN' },
    { planilla: 'VIRUTA', sap: 'VIRUTA-ASERUTA (TS)', plan: 'VIRUTA' },

    // Materiales que SAP sí separa y la planilla no: ahí todo se escribe
    // 'ASTILLA VERDE'. Se dejan en su propia fila a propósito, porque su
    // TS/carga no se parece al de la astilla verde (9,4 y 15,8 contra 11,3):
    // mezclarlos correría el avance sin que nadie lo note. Si el negocio
    // decide que van contra el plan de ASTILLA VERDE, basta escribir ese
    // nombre en la columna 'Producto Plan' de la hoja de homologación.
    { planilla: '', sap: 'ASTILLA VERDE CON CORTEZA (TS)', plan: '' },
    { planilla: '', sap: 'ASTILLA VERDE OTRA ESPECIE MAD', plan: '' }
  ]
};

/**
 * Alias de encabezados. Se comparan sin acentos, mayúsculas ni puntuación,
 * así que basta con que el nombre real de la columna aparezca en la lista.
 */
const COLUMNAS = {
  SAP: {
    documento: ['Documento MM', 'Documento'],
    guia: ['Nº Guia', 'N Guia', 'Guia', 'Nº Guía'],
    material: ['Material'],
    desMaterial: ['Des. Material', 'Descripcion Material'],
    fecha: ['Fecha Contab.', 'Fecha Contab', 'Fecha Contabilizacion', 'Fecha'],
    cantidad: ['Cantidad'],
    um: ['UM'],
    proveedor: ['Proveedor'],
    desProveedor: ['Des. Proveedor', 'Descripcion Proveedor'],
    comuna: ['Comuna'],
    predio: ['Predio']
  },
  PLANILLA: {
    numero: ['N°', 'N', 'Nro', 'Numero'],
    fecha: ['FECHA', 'Fecha Ingreso'],
    producto: ['PRODUCTO', 'Material'],
    proveedor: ['PROVEEDOR'],
    comuna: ['COMUNA', 'ORIGEN'],
    guia: ['N° DE GUÍA', 'N DE GUIA', 'Nº Guia', 'Guia', 'Numero de Guia'],
    patente: ['PATENTE'],
    pesoBruto: ['PESO BRUTO (t)', 'PESO BRUTO', 'Peso'],
    ticket: ['N° TICKET', 'N TICKET', 'Ticket'],
    estado: ['ESTADO'],
    observacion: ['Observación', 'Observacion', 'Obs'],
    hojaOrigen: ['Hoja origen'],
    filaOrigen: ['Fila origen']
  },
  PLAN: {
    producto: ['Producto'],
    proveedor: ['Proveedor'],
    precio: ['Precio']
  },
  HOMOLOGACION: {
    sap: ['Proveedor SAP'],
    planilla: ['Proveedor Planilla'],
    plan: ['Proveedor Plan']
  },
  HOMOLOGACION_PRODUCTOS: {
    sap: ['Producto SAP', 'Material SAP'],
    planilla: ['Producto Planilla'],
    plan: ['Producto Plan']
  },
  GUIAS_FALTANTES: {
    fecha: ['Fecha'],
    proveedor: ['Proveedor planilla'],
    proveedorSap: ['Proveedor SAP'],
    producto: ['Producto'],
    guia: ['Nº guía', 'N guia', 'Guia'],
    accion: ['Acción', 'Accion', 'Decisión', 'Decision']
  }
};

/**
 * Lo que se puede escribir en la columna 'Acción' de 'guias faltantes'.
 * Vacío = manda la regla de CONFIG.DIAS_GRACIA_SIN_CRUCE.
 */
const ACCION_GUIA = {
  CONTAR: 'CONTAR',
  NO_CONTAR: 'NO CONTAR'
};

/** Estados posibles de un camión de la planilla manual. */
const ESTADO = {
  EN_SAP: 'EN SAP',
  PENDIENTE: 'PENDIENTE (estimado)',
  SIN_HOMOLOGAR: 'SIN HOMOLOGAR',
  SIN_PROMEDIO: 'PENDIENTE SIN PROMEDIO',
  PRODUCTO_SIN_HOMOLOGAR: 'PRODUCTO SIN HOMOLOGAR',
  SIN_SAP: 'PENDIENTE (proveedor sin historial SAP)',
  SOLO_SAP: 'SOLO SAP',
  EN_SAP_OTRA_GUIA: 'EN SAP CON OTRA GUÍA (no se estima)',
  NO_CONTADA: 'NO CONTADA (guía que SAP nunca trajo)',
  DUPLICADO: 'GUIA DUPLICADA'
};
