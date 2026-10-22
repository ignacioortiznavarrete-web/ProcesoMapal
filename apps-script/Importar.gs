/**
 * Trae la hoja del mes en curso de la planilla manual de ingresos
 * ('RECEPCION DIARIA MADERAS', archivo externo de sólo lectura) hacia la hoja
 * 'Planilla Exportada'.
 *
 * Esa planilla tiene una hoja por mes y los encabezados cambian de hoja en
 * hoja (la columna A a veces es FECHA y a veces el correlativo N°, con títulos
 * como 'fdd', 'Columna 1' o '{'). Por eso:
 *   - se detectan las hojas cuyo nombre es un mes ('OCTUBRE 2026', 'Sept 2024');
 *   - dentro de cada hoja las columnas se ubican por nombre y, si el nombre no
 *     sirve, la fecha se detecta por contenido;
 *   - todo se consolida en un formato único, dejando registrada la hoja y la
 *     fila de origen de cada camión.
 */
const ENCABEZADOS_PLANILLA = [
  'N°', 'FECHA', 'PRODUCTO', 'PROVEEDOR', 'COMUNA', 'N° DE GUÍA', 'PATENTE',
  'PESO BRUTO (t)', 'N° TICKET', 'ESTADO', 'Observación', 'Hoja origen', 'Fila origen'
];

function importarPlanillaOrigen() {
  if (!CONFIG.ORIGEN_ID || CONFIG.ORIGEN_ID.indexOf('PEGAR_AQUI') === 0) {
    throw new Error(
      'Falta configurar CONFIG.ORIGEN_ID en Config.gs con el ID de la planilla de ingresos.'
    );
  }

  const origen = SpreadsheetApp.openById(CONFIG.ORIGEN_ID);
  const seleccion = hojasAImportar(origen);
  const hojas = seleccion.hojas;
  if (!hojas.length) {
    throw new Error('No se encontraron hojas mensuales en "' + origen.getName() + '".');
  }

  const filas = [];
  const detalleHojas = [];

  hojas.forEach(function (info) {
    const leidas = leerHojaMensual(info.hoja, info.mes);
    filas.push.apply(filas, leidas);
    detalleHojas.push({ hoja: info.hoja.getName(), mes: info.mes, filas: leidas.length });
  });

  // Mismo orden cronológico que la planilla origen.
  filas.sort(function (a, b) {
    const fa = a[1] instanceof Date ? a[1].getTime() : 0;
    const fb = b[1] instanceof Date ? b[1].getTime() : 0;
    return fa - fb;
  });

  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const destino = obtenerHoja(libro, CONFIG.HOJA_PLANILLA, true);
  destino.clear();
  destino.getRange(1, 1, 1, ENCABEZADOS_PLANILLA.length).setValues([ENCABEZADOS_PLANILLA])
    .setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');
  if (filas.length) {
    destino.getRange(2, 1, filas.length, ENCABEZADOS_PLANILLA.length).setValues(filas);
    destino.getRange(2, 2, filas.length, 1).setNumberFormat('dd-mm-yyyy');
  }
  destino.setFrozenRows(1);

  PropertiesService.getDocumentProperties().setProperties({
    ultimaImportacion: new Date().toISOString(),
    filasImportadas: String(filas.length),
    hojaOrigen: detalleHojas.map(function (d) { return d.hoja; }).join(', '),
    nombreOrigen: origen.getName()
  });

  return {
    archivo: origen.getName(),
    hojas: detalleHojas,
    filas: filas.length,
    mes: seleccion.mes,
    aviso: seleccion.aviso
  };
}

/**
 * Qué hojas traer.
 *
 * Normalmente la del mes en curso. Si todavía no existe (a principios de mes,
 * o porque el mes se abre con otro nombre), se trae la más reciente que haya y
 * se avisa. CONFIG.MESES_A_IMPORTAR permite sumar meses anteriores.
 */
function hojasAImportar(origen) {
  if (CONFIG.ORIGEN_HOJA) {
    const hoja = origen.getSheetByName(CONFIG.ORIGEN_HOJA);
    if (!hoja) {
      throw new Error('No se encontró la hoja "' + CONFIG.ORIGEN_HOJA + '" en la planilla origen.');
    }
    return { hojas: [{ hoja: hoja, mes: claveMesDesdeNombreHoja(hoja.getName()) }], mes: '', aviso: '' };
  }

  const mensuales = origen.getSheets()
    .map(function (hoja) {
      return { hoja: hoja, mes: claveMesDesdeNombreHoja(hoja.getName()) };
    })
    .filter(function (info) { return !!info.mes; })
    .sort(function (a, b) { return a.mes < b.mes ? -1 : 1; });

  if (!mensuales.length) return { hojas: [], mes: '', aviso: '' };

  const cuantos = Number(CONFIG.MESES_A_IMPORTAR) || 0;
  if (cuantos <= 0) {
    return { hojas: mensuales, mes: mensuales[mensuales.length - 1].mes, aviso: '' };
  }

  // Mes objetivo: el actual si existe su hoja; si no, la hoja más reciente.
  const actual = mesActual();
  const existeActual = mensuales.some(function (info) { return info.mes === actual; });
  const ultimo = mensuales[mensuales.length - 1].mes;
  const objetivo = existeActual ? actual : ultimo;
  const aviso = existeActual
    ? ''
    : 'No existe la hoja de ' + etiquetaMes(actual) + ' en la planilla origen; se trajo ' +
      etiquetaMes(objetivo) + '.';

  const desde = mesClaveDesplazada(objetivo, -(cuantos - 1));
  const hojas = mensuales.filter(function (info) {
    return info.mes >= desde && info.mes <= objetivo;
  });

  return { hojas: hojas, mes: objetivo, aviso: aviso };
}

/** Lee una hoja mensual y la devuelve en el formato consolidado. */
function leerHojaMensual(hoja, mesHoja) {
  const filaEncabezado = Math.max(1, CONFIG.ORIGEN_FILA_ENCABEZADO);
  const ultimaFila = hoja.getLastRow();
  const ultimaColumna = hoja.getLastColumn();
  if (ultimaFila <= filaEncabezado || ultimaColumna < 1) return [];

  const datos = hoja
    .getRange(filaEncabezado, 1, ultimaFila - filaEncabezado + 1, ultimaColumna)
    .getValues();

  const col = ubicarColumnas(datos[0], COLUMNAS.PLANILLA);
  col.fecha = detectarColumnaFecha(datos, col.fecha);
  col.estado = detectarColumnaEstado(datos, col.estado);

  const salida = [];
  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    const proveedor = texto(fila[col.proveedor]);
    const guia = texto(fila[col.guia]);
    const fecha = col.fecha >= 0 ? aFecha(fila[col.fecha]) : null;
    const fechaValida = esFechaRazonable(fecha) ? fecha : null;
    if (!proveedor && !guia) continue;

    salida.push([
      col.numero >= 0 ? fila[col.numero] : '',
      fechaValida || '',
      texto(fila[col.producto]),
      proveedor,
      texto(fila[col.comuna]),
      guia,
      texto(fila[col.patente]),
      pesoEnToneladas(col.pesoBruto >= 0 ? aNumero(fila[col.pesoBruto]) : null),
      texto(fila[col.ticket]),
      texto(fila[col.estado]),
      texto(fila[col.observacion]),
      hoja.getName(),
      filaEncabezado + i
    ]);
  }
  return salida;
}

/**
 * Peso bruto en toneladas. En las hojas viejas viene en toneladas ('33.190')
 * y en las nuevas en kilos (43660); ningún camión pesa más de 1.000 t ni menos
 * de 1.000 kg, así que el corte es seguro.
 */
function pesoEnToneladas(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  return valor > 1000 ? redondear(valor / 1000, 3) : redondear(valor, 3);
}

function texto(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return Utilities.formatDate(valor, 'America/Santiago', 'dd-MM-yyyy');
  return String(valor).trim();
}

/** ¿La fecha cae en un rango creíble para un ingreso? */
function esFechaRazonable(fecha) {
  if (!fecha) return false;
  const anio = fecha.getFullYear();
  return anio >= 2015 && anio <= 2100;
}

/**
 * La columna de fecha según el encabezado y, si no sirve, la que de verdad
 * contiene fechas entre las primeras columnas.
 */
function detectarColumnaFecha(datos, indicePorNombre) {
  if (indicePorNombre >= 0 && contarFechas(datos, indicePorNombre) > 0) return indicePorNombre;
  let mejor = -1;
  let mejorConteo = 0;
  const hasta = Math.min(4, datos[0].length);
  for (let columna = 0; columna < hasta; columna++) {
    const conteo = contarFechas(datos, columna);
    if (conteo > mejorConteo) {
      mejorConteo = conteo;
      mejor = columna;
    }
  }
  return mejorConteo > 0 ? mejor : indicePorNombre;
}

/**
 * La columna ESTADO. En las hojas nuevas su encabezado quedó como
 * 'Columna 10', así que si el nombre no sirve se busca la columna cuyos
 * valores sean estados ('OK', 'ANULADO', ...).
 */
function detectarColumnaEstado(datos, indicePorNombre) {
  if (indicePorNombre >= 0) return indicePorNombre;
  const estados = ['OK'].concat(CONFIG.ESTADOS_EXCLUIDOS || []).map(normalizar);
  let mejor = -1;
  let mejorConteo = 0;
  for (let columna = 0; columna < datos[0].length; columna++) {
    let conEstado = 0;
    let conDato = 0;
    const hasta = Math.min(datos.length, 40);
    for (let i = 1; i < hasta; i++) {
      const valor = normalizar(datos[i][columna]);
      if (!valor) continue;
      conDato++;
      if (estados.indexOf(valor) >= 0) conEstado++;
    }
    if (conDato && conEstado / conDato > 0.5 && conEstado > mejorConteo) {
      mejorConteo = conEstado;
      mejor = columna;
    }
  }
  return mejor >= 0 ? mejor : indicePorNombre;
}

function contarFechas(datos, columna) {
  let conteo = 0;
  const hasta = Math.min(datos.length, 40);
  for (let i = 1; i < hasta; i++) {
    if (esFechaRazonable(aFecha(datos[i][columna]))) conteo++;
  }
  return conteo;
}

/** Fecha/hora de la última importación, o null. */
function ultimaImportacion() {
  const valor = PropertiesService.getDocumentProperties().getProperty('ultimaImportacion');
  return valor ? new Date(valor) : null;
}
