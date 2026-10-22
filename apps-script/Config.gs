/**
 * Control de ingreso de subproductos - configuración central.
 *
 * Todo lo que se ajusta a mano vive en este archivo. El resto del código
 * no debería necesitar cambios al agregar proveedores, meses o materiales.
 */
const CONFIG = {
  // --- Planilla origen (la planilla manual que NO se puede editar) ---------
  // ID que aparece en la URL: docs.google.com/spreadsheets/d/<ID>/edit
  ORIGEN_ID: 'PEGAR_AQUI_EL_ID_DE_LA_PLANILLA_ORIGEN',
  // Nombre de la hoja a traer. Vacío = primera hoja del archivo origen.
  ORIGEN_HOJA: '',
  // Fila de encabezados en la planilla origen.
  ORIGEN_FILA_ENCABEZADO: 1,

  // --- Hojas de este archivo ----------------------------------------------
  HOJA_SAP: 'Ingresos Sap',
  HOJA_PLANILLA: 'Planilla Exportada',
  HOJA_PLAN: 'Plan',
  HOJA_HOMOLOGACION: 'homologacion',
  HOJA_CONTROL: 'Control Ingreso',
  HOJA_DETALLE: 'Detalle Camiones',
  HOJA_PROMEDIOS: 'Promedios SAP',

  // --- Promedio de cantidad por camión ------------------------------------
  // Días hacia atrás para calcular el promedio (0 = todo el histórico).
  PROMEDIO_VENTANA_DIAS: 90,
  // Si el proveedor no alcanza este número de camiones en la ventana,
  // el promedio se recalcula con todo su histórico.
  PROMEDIO_MINIMO_CAMIONES: 5,

  // --- Criterio de período -------------------------------------------------
  // 'PLANILLA' = el camión cuenta en el mes de su fecha de ingreso físico
  //              (recomendado: SAP viene desfasado por las 5 fases).
  // 'SAP'      = cuenta en el mes de la fecha de contabilización SAP.
  FECHA_BASE: 'PLANILLA',

  // --- Actualización automática -------------------------------------------
  HORAS_ENTRE_ACTUALIZACIONES: 1,

  // --- Homologación --------------------------------------------------------
  // Puntaje mínimo (0 a 1) para proponer una homologación automática.
  UMBRAL_SUGERENCIA: 0.62
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
    comuna: ['COMUNA'],
    guia: ['N° DE GUÍA', 'N DE GUIA', 'Nº Guia', 'Guia', 'Numero de Guia'],
    patente: ['PATENTE'],
    pesoBruto: ['PESO BRUTO', 'Peso'],
    ticket: ['N° TICKET', 'N TICKET', 'Ticket'],
    observacion: ['Observación', 'Observacion', 'Obs']
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
  }
};

/** Estados posibles de un camión de la planilla manual. */
const ESTADO = {
  EN_SAP: 'EN SAP',
  PENDIENTE: 'PENDIENTE (estimado)',
  SIN_HOMOLOGAR: 'SIN HOMOLOGAR',
  SIN_PROMEDIO: 'PENDIENTE SIN PROMEDIO',
  SOLO_SAP: 'SOLO SAP',
  DUPLICADO: 'GUIA DUPLICADA'
};
