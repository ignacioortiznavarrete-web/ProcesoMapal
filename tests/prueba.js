/**
 * Prueba de la lógica fuera de Google: simula las APIs de Apps Script y
 * reproduce las dos planillas reales (la de ingresos con una hoja por mes y
 * la de control con Ingresos Sap / Plan / homologacion).
 *
 *   node tests/prueba.js
 */
const { Hoja, Libro, builderRegla } = require('./stub.js');

// --- Planilla de control ---------------------------------------------------
const sap = [
  ['Documento MM','Nº Guia','Material','Des. Material','Fecha Contab.','Pedido','Posicion','Texto Posicion','Cantidad','Credito FSC(TS)','UM','Proveedor','Des. Proveedor','Destino','Rol','Comuna','Predio','FSC(S/N)','% de FSC','Codigo FSC','Direccion Planta','Usuario'],
  ['5022336511','53791','3000039','ASTILLA VERDE (TS)','01-10-2026','4800084620',20,'ASTILLA VERDE (TS) FSC-CW','12,777',0,'TS','6000034226','COMERCIAL GUIVAR LTDA.','','166-277','Treguaco','MAITECO','S',0,'PBN','MAITECO','MADERASMAPAL'],
  ['5022336512','53792','3000039','ASTILLA VERDE (TS)','02-10-2026','4800084620',20,'ASTILLA VERDE (TS) FSC-CW','13,223',0,'TS','6000034226','COMERCIAL GUIVAR LTDA.','','166-277','Treguaco','MAITECO','S',0,'PBN','MAITECO','MADERASMAPAL'],
  ['5022336513','53793','3000039','ASTILLA VERDE (TS)','03-10-2026','4800084620',20,'ASTILLA VERDE (TS) FSC-CW','13,000',0,'TS','6000034226','COMERCIAL GUIVAR LTDA.','','166-277','Treguaco','MAITECO','S',0,'PBN','MAITECO','MADERASMAPAL'],
  ['5022350777','72865','3000039','ASTILLA VERDE (TS)','05-10-2026','4800084631',10,'ASTILLA VERDE (TS) FSC-CW','11,841',0,'TS','6000035106','FORESTAL COLLICURA LTDA.','','1250-36','Santa Juana','CANCHA','S',0,'SGS','FUNDO','MADERASMAPAL'],
  ['5022350778','72866','3000039','ASTILLA VERDE (TS)','06-10-2026','4800084631',10,'ASTILLA VERDE (TS) FSC-CW','14,159',0,'TS','6000035106','FORESTAL COLLICURA LTDA.','','1250-36','Santa Juana','CANCHA','S',0,'SGS','FUNDO','MADERASMAPAL'],
  ['5022340673','3285','3000039','ASTILLA VERDE (TS)','07-10-2026','4800084654',20,'ASTILLA VERDE (TS)','11,395',0,'TS','6000093780','SERVICIOS DE TRANSPORTE VOLCÁN','','323-386','Quirihue','CON-CON','N','','','CON-CON','MADERASMAPAL'],
  ['5022340999','900','3000039','ASTILLA VERDE (TS)','20-09-2026','4800084654',20,'ASTILLA VERDE (TS)','12,500',0,'TS','6000093780','SERVICIOS DE TRANSPORTE VOLCÁN','','323-386','Quirihue','CON-CON','N','','','CON-CON','MADERASMAPAL']
];

const plan = [
  ['Producto','Proveedor','Precio','oct-2026'],
  ['ASTILLA VERDE','FORESTAL LEON LTDA',93,506],
  ['','IND.MADERERA GEOMAR LTDA.',95,0],
  ['','FORESTAL Y ASERRADERO LEONERA LTDA.',90,0],
  ['','COMERCIAL GUIVAR LTDA.',93,'379,5'],
  ['','CSC LTDA.',90,506],
  ['','FORESTAL COLLICURA',"95,5",253],
  ['','SERVICIOS DE TRANSPORTE VOLCÁN SPA',95,253],
  ['','FORESTAL BIOCHIPER SPA.',92,0],
  ['','TAM',93,253]
];

const libro = new Libro([
  new Hoja('Ingresos Sap', sap),
  new Hoja('Planilla Exportada', [['N°','FECHA','PRODUCTO','PROVEEDOR','COMUNA','N° DE GUÍA','PATENTE','PESO BRUTO','N° TICKET','Columna 10','Observación']]),
  new Hoja('Plan', plan),
  new Hoja('homologacion', [['Proveedor SAP','Proveedor Planilla','Proveedor Plan']])
]);

// --- Planilla origen: RECEPCION DIARIA MADERAS (una hoja por mes) ----------
// Encabezados tal como vienen: columna A con títulos basura y layouts distintos.
const encabezadoNuevo = ['{','FECHA','PRODUCTO','PROVEEDOR','COMUNA','N° DE GUÍA','PATENTE','PESO BRUTO','N° TICKET','Columna 10','Observación','','','',''];
const septiembre2026 = [
  encabezadoNuevo,
  [1,'01-09-2026','ASTILLA VERDE','VOLCAN','RANQUIL','3285','JJXJ34',44520,'466148','OK','','','','SAN DIEGO','SAN NICOLAS'],
  [2,'02-09-2026','ASTILLA VERDE','GUIVAR','TREHUACO','53700','BSZK17',43660,'466149','OK','','','','',''],
  [3,'',  '', '', '', '', '', '', '', '', '', '', '', '', '']  // relleno
];
const octubre2026 = [
  ['N°','FECHA','PRODUCTO','PROVEEDOR','COMUNA','N° DE GUÍA','PATENTE','PESO BRUTO','N° TICKET','Columna 10','Observación','','','',''],
  [1,'01-10-2026','ASTILLA VERDE','GUIVAR','TREHUACO','53791','BSZK17',43660,'467956','OK','','','','SAN DIEGO','SAN NICOLAS'],
  [2,'02-10-2026','ASTILLA VERDE','GUIVAR','TREHUACO','053792','BSZK17',43200,'467957','OK','','','','',''],
  [3,'10-10-2026','ASTILLA VERDE','GUIVAR','TREHUACO','53850','BSZK17',42900,'467958','OK','','','','',''],
  [4,'05-10-2026','ASTILLA VERDE','COLLICURA','SANTA JUANA','72865','FCPJ65',45970,'467959','OK','','','','',''],
  [5,'12-10-2026','ASTILLA VERDE','COLLICURA','SANTA JUANA','72900','FCPJ65',46100,'467960','OK','','','','',''],
  [6,'13-10-2026','ASTILLA VERDE','VOLCAN','QUIRIHUE','53791','HFVD15',41890,'467961','OK','guía repetida con GUIVAR','','','',''],
  [7,'14-10-2026','ASTILLA VERDE','CSC','TREHUACO','1500','GXVW37',40780,'467962','OK','sin historial SAP','','','',''],
  [8,'15-10-2026','VIRUTA','MASISA','CABRERO','2029324','GZYL97',25950,'467963','OK','otro producto','','','',''],
  [9,'16-10-2026','ASTILLA VERDE','GUIVAR','TREHUACO','53860','BSZK17',43000,'467964','ANULADO','','','','',''],
  [10,'17-10-2026','ASTILLA VERDE','ENESA','CORONEL','14819','FTYB43',34000,'467965','OK','sin homologar','','','',''],
  [11,'','','','','','','','','','','','','','']
];
const sept2024 = [  // layout viejo: FECHA en A con encabezado basura, sin N°
  ['fdd','PRODUCTO','PROVEEDOR','ORIGEN','N° DE GUÍA','PATENTE','PESO BRUTO','N° TICKET','ESTADO','N°'],
  ['02-09-2024','ASTILLA VERDE','CSC','TREHUACO','450','JKFH45','34.250','423944','OK',1]
];

const origen = new Libro([
  new Hoja('Hoja 4', []),
  new Hoja('Sept 2024', sept2024),
  new Hoja('SEPTIEMBRE 2026', septiembre2026),
  new Hoja('OCTUBRE 2026', octubre2026)
]);
origen.getName = () => 'RECEPCION DIARIA MADERAS';

global.SpreadsheetApp = {
  getActiveSpreadsheet: () => libro,
  openById: id => origen,
  newConditionalFormatRule: builderRegla,
  getUi: () => ({ alert: m => console.log('[alert]', m) })
};
global.Utilities = {
  formatDate: (fecha, tz, formato) => {
    const d = String(fecha.getDate()).padStart(2, '0');
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    return formato === 'dd-MM-yyyy' ? `${d}-${m}-${fecha.getFullYear()}` : fecha.toISOString();
  }
};

// --- Carga del código del proyecto ----------------------------------------
const fs = require('fs');
const archivos = ['Config.gs','Util.gs','Datos.gs','Importar.gs','Promedios.gs','Homologacion.gs','Control.gs'];
const codigo = archivos.map(f => fs.readFileSync(__dirname + '/../apps-script/' + f, 'utf8')).join('\n');
eval(codigo);

let fallas = 0;
function assert(cond, mensaje) {
  console.log((cond ? 'OK   ' : 'FALLA') + '  ' + mensaje);
  if (!cond) { fallas++; process.exitCode = 1; }
}

// --- Utilidades ------------------------------------------------------------
console.log('\n--- utilidades ---');
assert(aNumero('12,777') === 12.777, 'aNumero coma decimal');
assert(aNumero('1.234,5') === 1234.5, 'aNumero miles con punto');
assert(normalizarGuia('053792') === '53792', 'guía sin ceros a la izquierda');
assert(claveMes('oct-2026') === '2026-10', "claveMes 'oct-2026'");
assert(etiquetaMes('2026-10') === 'oct-2026', 'etiquetaMes');
assert(aFecha('01-10-2026').getMonth() === 9, 'aFecha dd-mm-aaaa');
assert(claveMesDesdeNombreHoja('OCTUBRE 2026') === '2026-10', "hoja 'OCTUBRE 2026'");
assert(claveMesDesdeNombreHoja('Sept 2024') === '2024-09', "hoja 'Sept 2024'");
assert(claveMesDesdeNombreHoja('MAY0 2025') === '2025-05', "hoja 'MAY0 2025' (con typo)");
assert(claveMesDesdeNombreHoja(' Nov 2024') === '2024-11', "hoja ' Nov 2024'");
assert(claveMesDesdeNombreHoja('Hoja 4') === '', "hoja 'Hoja 4' no es un mes");
assert(mesClaveDesplazada('2026-10', -12) === '2025-10', 'mesClaveDesplazada');

console.log('\n--- similitud de nombres cortos ---');
assert(similitud('GUIVAR', 'COMERCIAL GUIVAR LTDA.') > 0.9, 'GUIVAR -> COMERCIAL GUIVAR LTDA.');
assert(similitud('COLLICURA', 'FORESTAL COLLICURA') > 0.9, 'COLLICURA -> FORESTAL COLLICURA');
assert(similitud('LEON', 'FORESTAL LEON LTDA') > 0.85, 'LEON -> FORESTAL LEON LTDA');
assert(similitud('LEON', 'FORESTAL Y ASERRADERO LEONERA LTDA.') < 0.6, 'LEON no confunde con LEONERA');
assert(similitud('LEONERA', 'FORESTAL Y ASERRADERO LEONERA LTDA.') > 0.85, 'LEONERA -> LEONERA');
assert(similitud('CSC', 'CSC LTDA.') === 1, 'CSC -> CSC LTDA.');
assert(similitud('SERVICIOS DE TRANSPORTE VOLCÁN', 'SERVICIOS DE TRANSPORTE VOLCÁN SPA') === 1, 'VOLCÁN con y sin SPA');
assert(similitud('VOLCAN', 'SERVICIOS DE TRANSPORTE VOLCÁN SPA') > 0.9, 'VOLCAN -> VOLCÁN SPA');

// --- Importación -----------------------------------------------------------
console.log('\n--- importación ---');
const importado = importarPlanillaOrigen();
console.log(JSON.stringify(importado));
assert(importado.hojas.length === 2, 'sólo las hojas dentro de los 12 meses (sept y oct 2026)');
assert(importado.filas === 12, '12 camiones importados (sin filas de relleno)');

// --- Homologación automática ----------------------------------------------
console.log('\n--- homologación ---');
console.log(JSON.stringify(sincronizarHomologacion()));
imprimir('homologacion', 5);

// Confirmación manual de lo que el automático no puede resolver.
guardarHomologacion([{ planilla: 'CSC', sap: '', plan: 'CSC LTDA.' }]);

// --- Control ---------------------------------------------------------------
const resumen = actualizarControl('oct-2026');
console.log('\nResumen: ' + JSON.stringify(resumen));
imprimir('Control Ingreso', 17);
imprimir('Detalle Camiones', 13);

// --- Verificaciones sobre el resultado del control ------------------------
console.log('\n--- control ---');
const control = libro.getSheetByName('Control Ingreso').datos;
const encabezado = control[4];
function filaControl(proveedor) {
  return control.slice(5).find(f => String(f[1]) === proveedor) || [];
}
function valor(proveedor, columna) {
  return filaControl(proveedor)[encabezado.indexOf(columna)];
}

assert(resumen.camionesPlanilla === 10, 'se descartan VIRUTA y la fila ANULADO');
assert(valor('COMERCIAL GUIVAR LTDA.', 'Camiones en SAP') === 2, 'GUIVAR: 2 camiones ya en SAP');
assert(valor('COMERCIAL GUIVAR LTDA.', 'Camiones pendientes') === 1, 'GUIVAR: 1 camión pendiente');
assert(valor('COMERCIAL GUIVAR LTDA.', 'Camiones sólo SAP') === 1, 'GUIVAR: 1 guía sólo en SAP');
assert(valor('COMERCIAL GUIVAR LTDA.', 'TS proyectada') === 52, 'GUIVAR: 39 TS reales + 13 TS estimadas');
assert(valor('SERVICIOS DE TRANSPORTE VOLCÁN SPA', 'Camiones pendientes') === 1,
  'la guía 53791 de VOLCAN no se cruza con la 53791 de GUIVAR');
assert(valor('CSC LTDA.', 'Camiones pendientes') === 1,
  'CSC homologado sólo contra el Plan igual se estima');
assert(String(valor('ENESA (sin homologar)', 'Alertas')).indexOf('sin homologar') >= 0,
  'ENESA queda marcado como sin homologar');

const detalle = libro.getSheetByName('Detalle Camiones').datos;
const guia53792 = detalle.find(f => String(f[6]) === '053792') || [];
assert(guia53792[10] === 'EN SAP', 'la guía 053792 cruza con la 53792 de SAP');
const septiembre = detalle.find(f => String(f[6]) === '3285') || [];
assert(String(septiembre[15]) === 'sep-2026', 'el camión de septiembre queda en su mes');
assert(septiembre[17] === 'SEPTIEMBRE 2026', 'queda registrada la hoja de origen');
const pesoOctubre = detalle.find(f => String(f[6]) === '53791' && f[3] === 'GUIVAR') || [];
assert(pesoOctubre[8] === 43.66, 'el peso bruto queda en toneladas (43660 kg -> 43,66 t)');

function imprimir(nombre, maxCol) {
  const hoja = libro.getSheetByName(nombre);
  console.log('\n=== ' + nombre + ' ===');
  hoja.datos.forEach(fila => {
    console.log(fila.slice(0, maxCol).map(v => (v instanceof Date ? v.toISOString().slice(0, 10) : v)).join(' | '));
  });
}

console.log(fallas ? '\n' + fallas + ' prueba(s) con falla' : '\nTodas las pruebas pasaron');
