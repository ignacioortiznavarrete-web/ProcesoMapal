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
  ['5022336511','53791','3000039','ASTILLA VERDE (TS)','01-10-2026','4800084620',10,'ASTILLA VERDE (TS) FSC-CW','6,377',0,'TS','6000034226','COMERCIAL GUIVAR LTDA.','','166-277','Treguaco','MAITECO','S',0,'PBN','MAITECO','MADERASMAPAL'],
  ['5022336511','53791','3000039','ASTILLA VERDE (TS)','01-10-2026','4800084620',20,'ASTILLA VERDE (TS) FSC-CW','6,400',0,'TS','6000034226','COMERCIAL GUIVAR LTDA.','','166-277','Treguaco','MAITECO','S',0,'PBN','MAITECO','MADERASMAPAL'],
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
  [11,'02-10-2026','ASTILLA VERDE','GUIVAR','TREHUACO','53999','BSZK17',43500,'467966','OK','guía que no cruza, día ya cubierto por SAP','','','',''],
  [12,'','','','','','','','','','','','','','']
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
const archivos = ['Config.gs','Util.gs','Feriados.gs','Datos.gs','Importar.gs','Promedios.gs','Homologacion.gs','Motor.gs','Control.gs','Tablero.gs'];
const codigo = archivos.map(f => fs.readFileSync(__dirname + '/../apps-script/' + f, 'utf8')).join('\n');
// Los 'const' del proyecto quedan dentro del ámbito del eval: se expone un
// ayudante para poder tocar la configuración desde la prueba.
eval(codigo + '\nglobal.ajustarConfig = function (clave, valor) { CONFIG[clave] = valor; };');

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
assert(soloMes.filas === 11, '11 camiones (sin la fila de relleno)');
const primeraFila = libro.getSheetByName('Planilla Exportada').datos[1];
assert(primeraFila[1] instanceof Date && primeraFila[1].getDate() === 1,
  'queda en orden cronológico, igual que la planilla origen');

// El resto del flujo se prueba con dos meses, para cubrir la consolidación.
console.log('\n--- importación: mes en curso + anterior ---');
ajustarConfig('MESES_A_IMPORTAR', 2);
const importado = importarPlanillaOrigen();
console.log(JSON.stringify(importado));
assert(importado.hojas.length === 2, 'se suman septiembre y octubre 2026');
assert(importado.filas === 13, '13 camiones importados (sin filas de relleno)');

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
function filaControl(proveedor) {
  return control.slice(6).find(f => String(f[1]) === proveedor) || [];
}
function valor(proveedor, columna) {
  return filaControl(proveedor)[encabezado.indexOf(columna)];
}

assert(resumen.camionesPlanilla === 11, 'se descartan VIRUTA y la fila ANULADO');
assert(valor('COMERCIAL GUIVAR LTDA.', 'Camiones en SAP') === 2, 'GUIVAR: 2 camiones ya en SAP');
assert(valor('COMERCIAL GUIVAR LTDA.', 'Camiones pendientes') === 1, 'GUIVAR: 1 camión pendiente');
assert(valor('COMERCIAL GUIVAR LTDA.', 'TS proyectada') === 52, 'GUIVAR: 39 TS reales + 13 TS estimadas');
assert(valor('COMERCIAL GUIVAR LTDA.', 'Camiones sin cruce') === 1,
  'el camión del 02-10 sin cruce NO se estima: SAP ya cubre ese día');
assert(String(valor('COMERCIAL GUIVAR LTDA.', 'Alertas')).indexOf('sin cruce') >= 0,
  'el control avisa del camión sin cruce');
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
const sinCruce = detalle.find(f => String(f[6]) === '53999') || [];
assert(sinCruce[10] === 'SIN CRUCE (día ya cubierto por SAP)', 'queda marcado SIN CRUCE');
assert(sinCruce[11] === 0, 'el camión sin cruce no suma TS estimadas');
const pendiente = detalle.find(f => String(f[6]) === '53850') || [];
assert(pendiente[10] === 'PENDIENTE (estimado)',
  'el camión posterior al corte de SAP sí se estima');

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
assert(panel.fuente.sinHomologar.length === 1 &&
  panel.fuente.sinHomologar[0].proveedor === 'ENESA',
  'el panel avisa de los nombres sin par');
assert(panel.fuente.corteGlobal === '2026-10-07',
  'el panel informa hasta dónde cubre SAP');
assert(panel.promedios.some(x => x.proveedor === 'COMERCIAL GUIVAR LTDA.' &&
  x.promedio === 13), 'el panel entrega el factor TS/carga por proveedor');
assert(panel.plan.filas.length === 9, 'el panel entrega el Plan completo');

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

console.log(fallas ? '\n' + fallas + ' prueba(s) con falla' : '\nTodas las pruebas pasaron');
