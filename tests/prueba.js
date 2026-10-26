/**
 * Prueba de la lógica fuera de Google: simula las APIs de Apps Script y
 * reproduce las dos planillas reales (la de ingresos con una hoja por mes y
 * la de control con Ingresos Sap / Plan / homologacion).
 *
 *   node tests/prueba.js
 */
const { Hoja, Libro, builderRegla, propiedades, triggers } = require('./stub.js');

// --- Planilla de control ---------------------------------------------------
const sap = [
  ['Documento MM','Nº Guia','Material','Des. Material','Fecha Contab.','Pedido','Posicion','Texto Posicion','Cantidad','Credito FSC(TS)','UM','Proveedor','Des. Proveedor','Destino','Rol','Comuna','Predio','FSC(S/N)','% de FSC','Codigo FSC','Direccion Planta','Usuario'],
  ['5022336511','53791','3000039','ASTILLA VERDE (TS)','01-10-2026','4800084620',10,'ASTILLA VERDE (TS) FSC-CW','6,377',0,'TS','6000034226','COMERCIAL GUIVAR LTDA.','','166-277','Treguaco','MAITECO','S',0,'PBN','MAITECO','MADERASMAPAL'],
  ['5022336511','53791','3000039','ASTILLA VERDE (TS)','01-10-2026','4800084620',20,'ASTILLA VERDE (TS) FSC-CW','6,400',0,'TS','6000034226','COMERCIAL GUIVAR LTDA.','','166-277','Treguaco','MAITECO','S',0,'PBN','MAITECO','MADERASMAPAL'],
  ['5022336512','53792','3000039','ASTILLA VERDE (TS)','02-10-2026','4800084620',20,'ASTILLA VERDE (TS) FSC-CW','13,223',0,'TS','6000034226','COMERCIAL GUIVAR LTDA.','','166-277','Treguaco','MAITECO','S',0,'PBN','MAITECO','MADERASMAPAL'],
  ['5022336513','53793','3000039','ASTILLA VERDE (TS)','03-10-2026','4800084620',20,'ASTILLA VERDE (TS) FSC-CW','13,000',0,'TS','6000034226','COMERCIAL GUIVAR LTDA.','','166-277','Treguaco','MAITECO','S',0,'PBN','MAITECO','MADERASMAPAL'],
  ['5022350777','72865','3000039','ASTILLA VERDE (TS)','05-10-2026','4800084631',10,'ASTILLA VERDE (TS) FSC-CW','11,841',0,'TS','6000035106','FORESTAL COLLICURA LTDA.','','1250-36','Santa Juana','CANCHA','S',0,'SGS','FUNDO','MADERASMAPAL'],
  ['5022350778','72866','3000039','ASTILLA VERDE (TS)','06-10-2026','4800084631',10,'ASTILLA VERDE (TS) FSC-CW','14,159',0,'TS','6000035106','FORESTAL COLLICURA LTDA.','','1250-36','Santa Juana','CANCHA','S',0,'SGS','FUNDO','MADERASMAPAL'],
  ['5022340673','3285','3000039','ASTILLA VERDE (TS)','07-10-2026','4800084654',20,'ASTILLA VERDE (TS)','11,395',0,'TS','6000093780','SERVICIOS DE TRANSPORTE VOLCÁN','','323-386','Quirihue','CON-CON','N','','','CON-CON','MADERASMAPAL'],
  ['5022400001','60575','3000040','VIRUTA-ASERUTA (TS)','02-10-2026','4800084900',10,'VIRUTA-ASERUTA (TS)','7,500',0,'TS','6000034226','COMERCIAL GUIVAR LTDA.','','166-277','Treguaco','MAITECO','S',0,'PBN','MAITECO','MADERASMAPAL'],
  ['5022400002','60576','3000040','VIRUTA-ASERUTA (TS)','03-10-2026','4800084900',10,'VIRUTA-ASERUTA (TS)','8,100',0,'TS','6000034226','COMERCIAL GUIVAR LTDA.','','166-277','Treguaco','MAITECO','S',0,'PBN','MAITECO','MADERASMAPAL'],
  ['5022400020','70001','3000039','ASTILLA VERDE (TS)','06-10-2026','4800084620',10,'ASTILLA VERDE (TS)','12,800',0,'TS','6000035106','FORESTAL COLLICURA LTDA.','','1250-36','Santa Juana','CANCHA','S',0,'SGS','FUNDO','MADERASMAPAL'],
  ['5022400021','70001','3000043','ASERRIN (TS)','06-10-2026','4800086009',50,'ASERRIN (TS)','9,900',0,'TS','6000035106','FORESTAL COLLICURA LTDA.','','1250-36','Santa Juana','CANCHA','S',0,'SGS','FUNDO','MADERASMAPAL'],
  ['5022400010','31505','3000043','ASERRIN (TS)','02-10-2026','4800086009',50,'ASERRIN (TS) FSC-CW','11,000',0,'TS','6000034226','COMERCIAL GUIVAR LTDA.','','166-277','Treguaco','MAITECO','S',0,'PBN','MAITECO','MADERASMAPAL'],
  ['5022400011','31506','3000043','ASERRIN (TS)','03-10-2026','4800086009',50,'ASERRIN (TS) FSC-CW','11,400',0,'TS','6000034226','COMERCIAL GUIVAR LTDA.','','166-277','Treguaco','MAITECO','S',0,'PBN','MAITECO','MADERASMAPAL'],
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
  ['','TAM',93,253],
  ['ASERRIN','FORESTAL COLLICURA',52,25],
  ['VIRUTA','COMERCIAL GUIVAR LTDA.',40,60],
  ['','FORESTAL COLLICURA',42,30]
];

const libro = new Libro([
  new Hoja('Ingresos Sap', sap),
  new Hoja('Planilla Exportada', [['N°','FECHA','PRODUCTO','PROVEEDOR','COMUNA','N° DE GUÍA','PATENTE','PESO BRUTO','N° TICKET','Columna 10','Observación']]),
  new Hoja('Plan', plan),
  new Hoja('homologacion', [['Proveedor SAP','Proveedor Planilla','Proveedor Plan']]),
  new Hoja('homologacion productos', [
    ['Producto SAP','Producto Planilla','Producto Plan'],
    ['VIRUTA-ASERUTA (TS)','VIRUTILLA','VIRUTA']
  ])
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
  [11,'02-10-2026','ASTILLA VERDE','GUIVAR','TREHUACO','53999','BSZK17',43500,'467966','OK','guía que no cruza, día ya cubierto por SAP','','','',''],
  [12,'02-10-2026','VIRUTA','GUIVAR','TREHUACO','60575','BSZK30',31720,'467967','OK','viruta que sí cruza','','','',''],
  [13,'12-10-2026','VIRUTA','COLLICURA','SANTA JUANA','76950','FCPJ65',30100,'467968','OK','viruta sin histórico propio','','','',''],
  [14,'13-10-2026','VIRUTILLA','GUIVAR','TREHUACO','60590','BSZK30',30900,'467969','OK','nombre escrito distinto','','','',''],
  [15,'16-10-2026','ASERRIN HUMEDO','GUIVAR','TREHUACO','60600','BSZK30',28400,'467970','OK','variante sin traducir','','','',''],
  [16,'14-10-2026','ASERRIN','COLLICURA','SANTA JUANA','31999','FCPJ65',29800,'467971','OK','aserrín sin histórico propio','','','',''],
  [17,'14-10-2026','COMBUSTIBLE','RIO CRUCES','TALCAHUANO','24742','CPCH94',41860,'467972','OK','SAP no tiene este material','','','',''],
  [18,'06-10-2026','ASTILLA VERDE','COLLICURA','SANTA JUANA','70001','FCPJ65',44100,'467973','OK','misma guía que su aserrín','','','',''],
  [19,'06-10-2026','ASERRIN','COLLICURA','SANTA JUANA','70001','FCPJ65',29500,'467974','OK','misma guía que su astilla','','','',''],
  [20,'15-10-2026','ASERRIN','VOLCAN','QUIRIHUE','44001','HFVD15',28700,'467975','OK','aserrín sin histórico propio','','','',''],
  [21,'','','','','','','','','','','','','','']
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
    const a = fecha.getFullYear();
    const hh = String(fecha.getHours()).padStart(2, '0');
    const mm = String(fecha.getMinutes()).padStart(2, '0');
    const ss = String(fecha.getSeconds()).padStart(2, '0');

    if (formato === 'dd-MM-yyyy') return `${d}-${m}-${a}`;
    if (formato === 'yyyy-MM') return `${a}-${m}`;
    if (formato === 'yyyy-MM-dd') return `${a}-${m}-${d}`;
    if (formato === "yyyy-MM-dd'T'HH:mm:ss") return `${a}-${m}-${d}T${hh}:${mm}:${ss}`;

    return fecha.toISOString();
  }
};
global.HtmlService = {
  createTemplateFromFile: () => ({
    evaluate: () => ({
      setTitle: () => ({ setXFrameOptionsMode: () => ({}) }),
      setWidth: () => ({ setHeight: () => ({}) })
    })
  }),
  XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }
};

// --- Carga del código del proyecto ----------------------------------------
const fs = require('fs');
const archivos = ['Config.gs','Util.gs','Feriados.gs','Datos.gs','Importar.gs','Promedios.gs','Homologacion.gs','Productos.gs','Motor.gs','Control.gs','Tablero.gs','Triggers.gs','Menu.gs'];
const codigo = archivos.map(f => fs.readFileSync(__dirname + '/../apps-script/' + f, 'utf8')).join('\n');
// Los 'const' del proyecto quedan dentro del ámbito del eval: se expone un
// ayudante para poder tocar la configuración desde la prueba.
eval(codigo + '\nglobal.ajustarConfig = function (clave, valor) { CONFIG[clave] = valor; };\nglobal.leerConfig = function (clave) { return CONFIG[clave]; };');

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
// Por defecto (MESES_A_IMPORTAR = 1) se trae sólo la hoja del mes en curso.
console.log('\n--- importación: sólo el mes en curso ---');
const soloMes = importarPlanillaOrigen();
console.log(JSON.stringify(soloMes));
assert(soloMes.hojas.length === 1, 'una sola hoja importada');
assert(soloMes.hojas[0].hoja === 'OCTUBRE 2026', 'es la hoja del mes en curso');
assert(soloMes.mes === mesActual(), 'el mes importado es el actual');
assert(soloMes.aviso === '', 'sin avisos: la hoja del mes existe');
assert(soloMes.filas === 20, '20 camiones (sin la fila de relleno)');
const primeraFila = libro.getSheetByName('Planilla Exportada').datos[1];
assert(primeraFila[1] instanceof Date && primeraFila[1].getDate() === 1,
  'queda en orden cronológico, igual que la planilla origen');

// El resto del flujo se prueba con dos meses, para cubrir la consolidación.
console.log('\n--- importación: mes en curso + anterior ---');
ajustarConfig('MESES_A_IMPORTAR', 2);
const importado = importarPlanillaOrigen();
console.log(JSON.stringify(importado));
assert(importado.hojas.length === 2, 'se suman septiembre y octubre 2026');
assert(importado.filas === 22, '22 camiones importados (sin filas de relleno)');

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
const encabezado = control[5];
function filaControl(proveedor, producto) {
  return control.slice(6).find(function (f) {
    return String(f[1]) === proveedor &&
      (!producto || String(f[0]) === producto);
  }) || [];
}
function valor(proveedor, columna, producto) {
  return filaControl(proveedor, producto || 'ASTILLA VERDE')[encabezado.indexOf(columna)];
}

assert(resumen.camionesPlanilla === 21,
  'entran astilla, viruta y la variante homologada; se descarta sólo ANULADO');
assert(valor('COMERCIAL GUIVAR LTDA.', 'Camiones en SAP') === 2, 'GUIVAR: 2 camiones ya en SAP');
assert(valor('COMERCIAL GUIVAR LTDA.', 'Camiones pendientes') === 2, 'GUIVAR: 2 camiones pendientes');
assert(valor('COMERCIAL GUIVAR LTDA.', 'TS proyectada') === 65,
  'GUIVAR: 39 TS reales + 26 estimadas. La guía que no cruza se complementa con ' +
  'la planilla; ya no se bota a cero por la fecha, porque SAP no carga en orden');
assert(valor('COMERCIAL GUIVAR LTDA.', 'Camiones a revisar') === 1,
  'queda marcado UN camión, el que calza con la carga de SAP sin cruzar');
assert(String(valor('COMERCIAL GUIVAR LTDA.', 'Alertas')).indexOf('revisar el Nº de guía') >= 0,
  'el control avisa de la guía a revisar sin recortar el mes');
const corteGuivar = valor('COMERCIAL GUIVAR LTDA.', 'SAP hasta');
assert(corteGuivar instanceof Date && corteGuivar.getDate() === 3,
  'el control muestra hasta qué día SAP cubre a cada proveedor (GUIVAR: 03-10)');
assert(valor('SERVICIOS DE TRANSPORTE VOLCÁN SPA', 'Camiones pendientes') === 1,
  'la guía 53791 de VOLCAN no se cruza con la 53791 de GUIVAR');
assert(valor('CSC LTDA.', 'Camiones pendientes') === 1,
  'CSC homologado sólo contra el Plan igual se estima');
assert(String(valor('ENESA (sin homologar)', 'Alertas')).indexOf('sin homologar') >= 0,
  'ENESA queda marcado como sin homologar');

// Una guía repartida en dos posiciones del pedido es UNA carga: las
// cantidades se suman y el promedio por carga no se parte a la mitad.
const promediosHoja = libro.getSheetByName('Promedios SAP').datos;
const guivarPromedio = promediosHoja.find(f => String(f[0]) === 'COMERCIAL GUIVAR LTDA.' &&
  String(f[1]) === 'ASTILLA VERDE (TS)') || [];
assert(guivarPromedio[5] === 3, 'las 4 líneas de SAP de GUIVAR son 3 cargas');
assert(guivarPromedio[7] === 13, 'TS/carga de GUIVAR = 39/3 = 13 (no 39/4)');
assert(valor('COMERCIAL GUIVAR LTDA.', 'Cargas sólo SAP') === 1,
  'la carga partida se consume completa, no deja media carga suelta');

const detalle = libro.getSheetByName('Detalle Camiones').datos;
const guia53792 = detalle.find(f => String(f[6]) === '053792') || [];
assert(guia53792[10] === 'EN SAP', 'la guía 053792 cruza con la 53792 de SAP');
const guia53791 = detalle.find(f => String(f[6]) === '53791' && f[3] === 'GUIVAR') || [];
assert(guia53791[11] === 12.777, 'el camión de la guía partida recibe las dos posiciones sumadas');
assert(String(guia53791[12]).indexOf('2 líneas') > 0, 'el detalle avisa que la carga venía en 2 líneas');
// La guía manda, no la fecha: SAP no se carga en orden, así que un camión en
// un día "ya cubierto" igual puede faltar de verdad.
const noCruza = detalle.find(f => String(f[6]) === '53999') || [];
assert(noCruza[10] === 'PENDIENTE (estimado)' && noCruza[11] === 13,
  'la guía que no está en SAP se complementa con la planilla, no se bota a cero');
assert(String(noCruza[12]).indexOf('sin cruzar la guía 53793') >= 0,
  'y el detalle nombra la carga de SAP que podría ser ese mismo camión');

const pendiente = detalle.find(f => String(f[6]) === '53850') || [];
assert(pendiente[10] === 'PENDIENTE (estimado)' && pendiente[11] === 13,
  'el camión sin carga suelta que le calce se estima sin marca');
assert(String(pendiente[12]).indexOf('sin cruzar la guía') < 0,
  'una sola carga suelta marca un solo camión, no a todos los pendientes');

const septiembre = detalle.find(f => String(f[6]) === '3285') || [];
assert(String(septiembre[15]) === 'sep-2026', 'el camión de septiembre queda en su mes');
assert(septiembre[17] === 'SEPTIEMBRE 2026', 'queda registrada la hoja de origen');
const pesoOctubre = detalle.find(f => String(f[6]) === '53791' && f[3] === 'GUIVAR') || [];
assert(pesoOctubre[8] === 43.66, 'el peso bruto queda en toneladas (43660 kg -> 43,66 t)');

// El material manda: un camión de viruta no se valoriza con el promedio de
// la astilla, que pesa casi el doble.
console.log('\n--- el promedio es por material ---');
const promediosHoja2 = libro.getSheetByName('Promedios SAP').datos;
const guivarViruta = promediosHoja2.find(f =>
  String(f[0]) === 'COMERCIAL GUIVAR LTDA.' && String(f[1]) === 'VIRUTA-ASERUTA (TS)') || [];
assert(guivarViruta[7] === 7.8, 'GUIVAR tiene su propio TS/carga de viruta (7,8)');

const virutaGuivar = detalle.find(f => String(f[6]) === '60575') || [];
assert(virutaGuivar[10] === 'EN SAP' && virutaGuivar[11] === 7.5,
  'la viruta que cruza toma su cantidad real');

const virutaCollicura = detalle.find(f => String(f[6]) === '76950') || [];
assert(virutaCollicura[11] === 7.8,
  'la viruta de COLLICURA usa el promedio de VIRUTA, no el de su astilla (13)');
assert(String(virutaCollicura[12]).indexOf('promedio del material') >= 0,
  'el detalle dice que el promedio salió del material y no del proveedor');

const filaVirutaPlan = control.slice(6).find(f =>
  String(f[0]) === 'VIRUTA' && String(f[1]).indexOf('FORESTAL COLLICURA') === 0) || [];
assert(filaVirutaPlan.length > 0,
  'el control abre una fila aparte por producto: la viruta no se suma a la astilla');

// SAP escribe 'VIRUTA-ASERUTA (TS)', la planilla 'VIRUTA' y el Plan 'VIRUTA':
// los tres nombres tienen que caer en la misma fila.
console.log('\n--- homologación de productos ---');

const virutaGuivarControl = control.slice(6).filter(f =>
  String(f[0]) === 'VIRUTA' && String(f[1]) === 'COMERCIAL GUIVAR LTDA.');
assert(virutaGuivarControl.length === 1,
  'el nombre de SAP y el de la planilla caen en UNA fila, no en tres');

const vg = virutaGuivarControl[0] || [];
assert(vg[3] === 2 && vg[4] === 1 && vg[5] === 1 && vg[7] === 1,
  'la fila junta los 2 camiones de la planilla, el que cruza, el pendiente y la carga sólo SAP');
assert(vg[8] === 15.6 && vg[12] === 60,
  'la viruta se compara contra el plan de viruta (60 TS), no contra el de astilla');

const variante = detalle.find(f => String(f[6]) === '60590') || [];
assert(variante.length > 0,
  'un producto escrito distinto no se descarta si la tabla lo traduce');
assert(variante[11] === 7.8,
  'la variante homologada toma el promedio del material de SAP');

const sinTraducir = detalle.find(f => String(f[6]) === '60600') || [];
assert(String(sinTraducir[10]) === 'PENDIENTE SIN PROMEDIO' && sinTraducir[11] === 0,
  'un producto que no se pudo traducir queda en cero, no con el promedio de otro material');
assert(String(sinTraducir[12]).indexOf('sin histórico SAP de ASERRIN HUMEDO') >= 0,
  'y el detalle dice exactamente por qué');

// El cruce es proveedor + material + guía. La misma guía de un proveedor
// puede ser un camión de astilla y otro de aserrín: con la guía sola, cada uno
// se llevaría la cantidad del otro.
console.log('\n--- la guía sola no identifica al camión ---');

const parGuia = detalle.filter(f => String(f[6]) === '70001' && f[3] === 'COLLICURA');
assert(parGuia.length === 2, 'los dos camiones de la guía 70001 están en el detalle');

const astillaPar = parGuia.find(f => String(f[2]) === 'ASTILLA VERDE') || [];
const aserrinPar = parGuia.find(f => String(f[2]) === 'ASERRIN') || [];
assert(astillaPar[10] === 'EN SAP' && astillaPar[11] === 12.8,
  'la astilla de la guía 70001 toma sus 12,8 TS');
assert(aserrinPar[10] === 'EN SAP' && aserrinPar[11] === 9.9,
  'el aserrín de la MISMA guía toma sus 9,9 TS, no las de la astilla');
assert(String(astillaPar[10]).indexOf('DUPLICADA') < 0 &&
  String(aserrinPar[10]).indexOf('DUPLICADA') < 0,
  'la guía repetida entre materiales distintos no es un duplicado');

// Los tres materiales de SAP tienen factores muy distintos (astilla 13,
// aserrín 11,2, viruta 7,8). Ninguno puede contagiar al otro.
// Jerarquía del promedio: proveedor+material primero, material después.
const aserrinCollicura = detalle.find(f => String(f[6]) === '31999') || [];
assert(aserrinCollicura[11] === 9.9,
  'COLLICURA tiene aserrín propio en SAP: se usa ese, no el promedio del material');
assert(String(aserrinCollicura[12]).indexOf('proveedor + material') >= 0,
  'y el detalle dice que salió de su propio histórico del material');

const aserrinVolcan = detalle.find(f => String(f[6]) === '44001') || [];
assert(String(aserrinVolcan[12]).indexOf('promedio del material') >= 0,
  'VOLCAN no tiene aserrín propio: cae al promedio del material');
assert(aserrinVolcan[11] > 9.9 && aserrinVolcan[11] < 11.4,
  'y ese promedio es el del ASERRIN, no el de la astilla de VOLCAN (11,4) ni el de la viruta');

const factores = {};
libro.getSheetByName('Promedios SAP').datos.slice(1)
  .filter(f => String(f[0]) === 'COMERCIAL GUIVAR LTDA.')
  .forEach(f => { factores[String(f[1])] = f[7]; });
assert(factores['ASTILLA VERDE (TS)'] === 13 &&
  factores['ASERRIN (TS)'] === 11.2 &&
  factores['VIRUTA-ASERUTA (TS)'] === 7.8,
  'GUIVAR tiene un factor propio por cada material, no uno solo');

// COMBUSTIBLE está declarado en la tabla pero SAP no tiene ese material:
// se cuenta, queda en cero y NO se reporta como producto sin homologar.
const combustible = detalle.find(f => String(f[6]) === '24742') || [];
assert(combustible.length > 0 && combustible[11] === 0,
  'el combustible entra al control aunque SAP no lo tenga, en cero');

const soloSapViruta = detalle.find(f => String(f[6]) === '60576') || [];
assert(String(soloSapViruta[10]) === 'SOLO SAP' && String(soloSapViruta[2]) === 'VIRUTA-ASERUTA (TS)',
  'el detalle conserva el nombre original de cada fuente para poder rastrearlo');


function imprimir(nombre, maxCol) {
  const hoja = libro.getSheetByName(nombre);
  console.log('\n=== ' + nombre + ' ===');
  hoja.datos.forEach(fila => {
    console.log(fila.slice(0, maxCol).map(v => (v instanceof Date ? v.toISOString().slice(0, 10) : v)).join(' | '));
  });
}

// --- Feriados calculados ---------------------------------------------------
console.log('\n--- feriados ---');
assert(pascuaDe_(2026).toISOString().slice(0, 10) === '2026-04-05',
  'Pascua 2026 cae el 5 de abril');
assert(feriadosDe_(2024).indexOf('2024-03-29') >= 0,
  'el Viernes Santo de 2024 es el 29-03 (la lista a mano decía 19-04)');
assert(feriadosDe_(2026).indexOf('2026-09-18') >= 0, '18 de septiembre');
assert(feriadosDe_(2026).indexOf('2026-09-21') === -1,
  'el lunes 21-09-2026 NO es feriado: el 18 cae viernes');
assert(esDiaHabil('2026-10-01') === true, '1 de octubre de 2026 es hábil');
assert(esDiaHabil('2026-10-04') === false, 'el domingo no es hábil');
assert(esDiaHabil('2026-09-18') === false, 'el 18 de septiembre no es hábil');
assert(diasHabilesEntre('2026-10-01', '2026-10-31').length === 21,
  'octubre de 2026 tiene 21 días hábiles (22 de lunes a viernes menos el 12)');

// --- Panel -----------------------------------------------------------------
console.log('\n--- panel ---');
const panel = getDashboardData();

assert(panel.mes.prefijo === '2026-10', 'el panel abre en el mes en curso');
assert(panel.habiles.total === 21, 'el panel cuenta los días hábiles del mes');
assert(panel.habiles.ultimaPlanilla === '2026-10-17',
  'la referencia del mes llega hasta el último camión de la planilla');
assert(panel.filas.length > 0, 'el panel recibe las filas del cruce');
assert(panel.filas.every(f => typeof f.fecha === 'string'),
  'las fechas viajan como clave, no como objeto Date');

const panelGuivar = panel.filas.filter(f =>
  f.proveedor === 'COMERCIAL GUIVAR LTDA.' && f.mes === '2026-10');
assert(panelGuivar.some(f => f.precio === 93),
  'cada fila trae el precio que le fija el Plan');
assert(panel.fuente.sinHomologar.length === 3 &&
  ['ENESA', 'MASISA', 'RIO CRUCES'].every(nombre =>
    panel.fuente.sinHomologar.some(x => x.proveedor === nombre)),
  'el panel avisa de los nombres sin par, en cualquier producto');
assert(panel.fuente.corteGlobal === '2026-10-07',
  'el panel informa hasta dónde cubre SAP');
assert(panel.promedios.some(x => x.proveedor === 'COMERCIAL GUIVAR LTDA.' &&
  x.promedio === 13), 'el panel entrega el factor TS/carga por proveedor');
assert(panel.plan.filas.length === 12, 'el panel entrega el Plan completo');
assert(panel.fuente.productosSinHomologar.length === 1 &&
  panel.fuente.productosSinHomologar[0].producto === 'ASERRIN HUMEDO',
  'el panel avisa sólo del producto que no se pudo traducir, no del combustible declarado');

// --- Mes sin hoja en la planilla origen ------------------------------------
console.log('\n--- la hoja del mes todavía no existe ---');
ajustarConfig('MESES_A_IMPORTAR', 1);
const hojaOctubre = origen.hojas.find(h => h.nombre === 'OCTUBRE 2026');
hojaOctubre.nombre = 'Hoja 9';  // deja de reconocerse como mes
const sinHoja = importarPlanillaOrigen();
assert(sinHoja.hojas[0].hoja === 'SEPTIEMBRE 2026', 'se trae la hoja más reciente que exista');
assert(sinHoja.aviso.indexOf('oct-2026') >= 0, 'avisa que falta la hoja del mes en curso');
console.log('aviso: ' + sinHoja.aviso);
hojaOctubre.nombre = 'OCTUBRE 2026';

// --- Recálculo al editar ---------------------------------------------------
console.log('\n--- actualización al editar una fila ---');

function edicion(nombreHoja) {
  return { range: { getSheet: () => ({ getName: () => nombreHoja }) } };
}

triggers.length = 0;
delete propiedades.edicionPendiente;
delete propiedades.edicionMarca;

alEditar(edicion('Control Ingreso'));
assert(triggers.length === 0 && !propiedades.edicionPendiente,
  'editar una hoja de resultado no programa nada');

alEditar(edicion('Planilla Exportada'));
assert(propiedades.edicionPendiente === 'si',
  'completar una fila de la planilla importada deja el recálculo pendiente');
assert(triggers.length === 1 && triggers[0].funcion === 'recalcularPendiente' &&
  triggers[0].detalle === leerConfig('SEGUNDOS_ESPERA_EDICION') * 1000,
  'se programa un solo recálculo, para después de la espera');

const marcaPrimera = propiedades.edicionMarca;
alEditar(edicion('Planilla Exportada'));
alEditar(edicion('homologacion'));
alEditar(edicion('Plan'));
assert(triggers.length === 1,
  'escribir varias celdas seguidas no acumula triggers');
assert(propiedades.edicionMarca >= marcaPrimera,
  'cada edición corre la marca: se recalcula tras la última, no tras la primera');

// Un pendiente colgado (el trigger se perdió) se vuelve a programar.
triggers.length = 0;
propiedades.edicionMarca = new Date(Date.now() - 30 * 60000).toISOString();
alEditar(edicion('Planilla Exportada'));
assert(triggers.length === 1, 'un recálculo que quedó colgado se reprograma');

const resumenEdicion = recalcularPendiente();
assert(resumenEdicion && resumenEdicion.proveedores > 0,
  'el recálculo diferido actualiza el control');
assert(!propiedades.edicionPendiente && triggers.length === 0,
  'después de recalcular no queda pendiente ni trigger suelto');
assert(recalcularPendiente() === null,
  'sin ediciones pendientes el recálculo no vuelve a correr');

triggers.length = 0;
instalarTrigger();
assert(triggers.some(t => t.funcion === 'actualizarTodo' && t.tipo === 'horas'),
  'queda el trigger horario que trae la planilla externa');
assert(triggers.some(t => t.funcion === 'alEditar' && t.tipo === 'edicion'),
  'queda el onEdit instalable que recalcula al completar una fila');
instalarTrigger();
assert(triggers.filter(t => t.funcion === 'alEditar').length === 1,
  'reinstalar no duplica el onEdit');
quitarTrigger();
assert(triggers.length === 0, 'desactivar deja el archivo sin triggers');

console.log(fallas ? '\n' + fallas + ' prueba(s) con falla' : '\nTodas las pruebas pasaron');
