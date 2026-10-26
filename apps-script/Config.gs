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
  // Quedan fuera a propósito 'ASTILLA SECA' y 'ASTILLA VERDE C/CORTEZA':
  // agrégalos acá cuando haya que controlarlos.
  PRODUCTOS_INCLUIDOS: ['ASTILLA VERDE', 'ASERRIN*', 'COMBUSTIBLE', 'VIRUTA'],
  // Filas con estos valores en la columna ESTADO se descartan.
  ESTADOS_EXCLUIDOS: ['ANULADO', 'ANULADA', 'NULO', 'NULA', 'RECHAZADO', 'RECHAZADA'],

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

  // Al editar a mano 'Planilla Exportada', 'homologacion' o 'Plan', el control
  // se recalcula solo. No al instante: escribir veinte filas dispararía veinte
  // recálculos. Se espera a que la mano pare.
  //
  // Google redondea los disparadores de una vez a la baja hasta un minuto, así
  // que menos de 60 no acelera nada.
  SEGUNDOS_ESPERA_EDICION: 60,

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
  }
};

/** Estados posibles de un camión de la planilla manual. */
const ESTADO = {
  EN_SAP: 'EN SAP',
  PENDIENTE: 'PENDIENTE (estimado)',
  SIN_HOMOLOGAR: 'SIN HOMOLOGAR',
  SIN_PROMEDIO: 'PENDIENTE SIN PROMEDIO',
  SIN_SAP: 'PENDIENTE (proveedor sin historial SAP)',
  SIN_CRUCE: 'SIN CRUCE (día ya cubierto por SAP)',
  SOLO_SAP: 'SOLO SAP',
  DUPLICADO: 'GUIA DUPLICADA'
};
