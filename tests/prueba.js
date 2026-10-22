const { Hoja, Libro, builderRegla } = require('./stub.js');

// --- Datos de prueba calcados de las hojas reales --------------------------
const sap = [
  ['Documento MM','Nº Guia','Material','Des. Material','Fecha Contab.','Pedido','Posicion','Texto Posicion','Cantidad','Credito FSC(TS)','UM','Proveedor','Des. Proveedor','Destino','Rol','Comuna','Predio','FSC(S/N)','% de FSC','Codigo FSC','Direccion Planta','Usuario'],
  ['5022336511','53791','3000039','ASTILLA VERDE (TS)','01-10-2026','4800084620',20,'ASTILLA VERDE (TS) FSC-CW','12,777',0,'TS','6000034226','COMERCIAL GUIVAR LTDA.','','166-277','Treguaco','MAITECO','S',0,'PBN','MAITECO','MADERASMAPAL'],
  ['5022336512','53792','3000039','ASTILLA VERDE (TS)','02-10-2026','4800084620',20,'ASTILLA VERDE (TS) FSC-CW','13,223',0,'TS','6000034226','COMERCIAL GUIVAR LTDA.','','166-277','Treguaco','MAITECO','S',0,'PBN','MAITECO','MADERASMAPAL'],
  ['5022336513','53793','3000039','ASTILLA VERDE (TS)','03-10-2026','4800084620',20,'ASTILLA VERDE (TS) FSC-CW','13,000',0,'TS','6000034226','COMERCIAL GUIVAR LTDA.','','166-277','Treguaco','MAITECO','S',0,'PBN','MAITECO','MADERASMAPAL'],
  ['5022350777','72865','3000039','ASTILLA VERDE (TS)','05-10-2026','4800084631',10,'ASTILLA VERDE (TS) FSC-CW','11,841',0,'TS','6000035106','FORESTAL COLLICURA LTDA.','','1250-36','Santa Juana','CANCHA','S',0,'SGS','FUNDO','MADERASMAPAL'],
  ['5022350778','72866','3000039','ASTILLA VERDE (TS)','06-10-2026','4800084631',10,'ASTILLA VERDE (TS) FSC-CW','14,159',0,'TS','6000035106','FORESTAL COLLICURA LTDA.','','1250-36','Santa Juana','CANCHA','S',0,'SGS','FUNDO','MADERASMAPAL'],
  ['5022340673','1199','3000039','ASTILLA VERDE (TS)','07-10-2026','4800084654',20,'ASTILLA VERDE (TS)','11,395',0,'TS','6000093780','SERVICIOS DE TRANSPORTE VOLCÁN','','323-386','Quirihue','CON-CON','N','','','CON-CON','MADERASMAPAL'],
  ['5022340999','900','3000039','ASTILLA VERDE (TS)','20-09-2026','4800084654',20,'ASTILLA VERDE (TS)','12,500',0,'TS','6000093780','SERVICIOS DE TRANSPORTE VOLCÁN','','323-386','Quirihue','CON-CON','N','','','CON-CON','MADERASMAPAL']
];

const planilla = [
  ['N°','FECHA','PRODUCTO','PROVEEDOR','COMUNA','N° DE GUÍA','PATENTE','PESO BRUTO','N° TICKET','Columna 10','Observación'],
  [1,'01-10-2026','ASTILLA VERDE','COMERCIAL GUIVAR','Treguaco','53791','ABCD12','28,5','T-1','',''],      // ya en SAP
  [2,'02-10-2026','ASTILLA VERDE','COMERCIAL GUIVAR','Treguaco','053792','ABCD13','29,1','T-2','',''],     // en SAP con cero adelante
  [3,'10-10-2026','ASTILLA VERDE','COMERCIAL GUIVAR','Treguaco','53850','ABCD14','28,9','T-3','',''],      // pendiente -> promedio
  [4,'11-10-2026','ASTILLA VERDE','GUIVAR','Treguaco','53851','ABCD15','28,2','T-4','',''],                // nombre distinto, homologado
  [5,'05-10-2026','ASTILLA VERDE','FORESTAL COLLICURA LTDA.','Santa Juana','72865','EFGH20','30,0','T-5','',''], // en SAP
  [6,'12-10-2026','ASTILLA VERDE','FORESTAL COLLICURA LTDA.','Santa Juana','72900','EFGH21','30,2','T-6','',''], // pendiente
  [7,'13-10-2026','ASTILLA VERDE','TRANSPORTES DESCONOCIDOS','Quirihue','99999','IJKL30','27,0','T-7','',''],    // sin homologar
  [8,'30-09-2026','ASTILLA VERDE','COMERCIAL GUIVAR','Treguaco','53700','ABCD16','28,0','T-8','','']            // mes anterior
];

const plan = [
  ['Producto','Proveedor','Precio','oct-2026'],
  ['ASTILLA VERDE','FORESTAL LEON LTDA',93,506],
  ['','COMERCIAL GUIVAR LTDA.',93,'379,5'],
  ['','FORESTAL COLLICURA','95,5',253],
  ['','SERVICIOS DE TRANSPORTE VOLCÁN SPA',95,253],
  ['','TAM',93,253]
];

const homologacion = [
  ['Proveedor SAP','Proveedor Planilla','Proveedor Plan'],
  ['COMERCIAL GUIVAR LTDA.','COMERCIAL GUIVAR','COMERCIAL GUIVAR LTDA.'],
  ['COMERCIAL GUIVAR LTDA.','GUIVAR','COMERCIAL GUIVAR LTDA.'],
  ['FORESTAL COLLICURA LTDA.','FORESTAL COLLICURA LTDA.','FORESTAL COLLICURA']
];

const libro = new Libro([
  new Hoja('Ingresos Sap', sap),
  new Hoja('Planilla Exportada', planilla),
  new Hoja('Plan', plan),
  new Hoja('homologacion', homologacion)
]);

global.SpreadsheetApp = {
  getActiveSpreadsheet: () => libro,
  newConditionalFormatRule: builderRegla,
  getUi: () => ({ alert: m => console.log('[alert]', m) })
};

// --- Carga del código del proyecto ----------------------------------------
const fs = require('fs');
const archivos = ['Config.gs','Util.gs','Datos.gs','Importar.gs','Promedios.gs','Homologacion.gs','Control.gs'];
const codigo = archivos.map(f => fs.readFileSync(__dirname + '/../apps-script/' + f, 'utf8')).join('\n');
eval(codigo);

// --- Pruebas unitarias rápidas --------------------------------------------
function assert(cond, mensaje) { console.log((cond ? 'OK   ' : 'FALLA') + '  ' + mensaje); if (!cond) process.exitCode = 1; }
assert(aNumero('12,777') === 12.777, 'aNumero coma decimal');
assert(aNumero('1.234,5') === 1234.5, 'aNumero miles con punto');
assert(aNumero(13.81) === 13.81, 'aNumero numero');
assert(normalizarGuia('053792') === '53792', 'guia sin ceros a la izquierda');
assert(claveMes('oct-2026') === '2026-10', 'claveMes oct-2026');
assert(claveMes(new Date(2026, 9, 5)) === '2026-10', 'claveMes Date');
assert(claveMes('2026-10') === '2026-10', 'claveMes ISO');
assert(etiquetaMes('2026-10') === 'oct-2026', 'etiquetaMes');
assert(aFecha('01-10-2026').getMonth() === 9, 'aFecha dd-mm-aaaa');
assert(similitud('FORESTAL COLLICURA', 'FORESTAL COLLICURA LTDA.') > 0.9, 'similitud razon social');
assert(similitud('SERVICIOS DE TRANSPORTE VOLCÁN', 'SERVICIOS DE TRANSPORTE VOLCÁN SPA') > 0.9, 'similitud acentos/SPA');

// --- Control completo ------------------------------------------------------
const resumen = actualizarControl('oct-2026');
console.log('\nResumen:', JSON.stringify(resumen));

function imprimir(nombre, maxCol) {
  const hoja = libro.getSheetByName(nombre);
  console.log('\n=== ' + nombre + ' ===');
  hoja.datos.forEach(fila => {
    console.log(fila.slice(0, maxCol).map(v => (v instanceof Date ? v.toISOString().slice(0, 10) : v)).join(' | '));
  });
}
imprimir('Control Ingreso', 17);
imprimir('Detalle Camiones', 13);
imprimir('Promedios SAP', 9);

// --- Flujo completo: detectar proveedores nuevos y recalcular -------------
console.log('\n### sincronizarHomologacion()');
console.log(JSON.stringify(sincronizarHomologacion()));
imprimir('homologacion', 5);
actualizarControl('oct-2026');
imprimir('Control Ingreso', 14);
