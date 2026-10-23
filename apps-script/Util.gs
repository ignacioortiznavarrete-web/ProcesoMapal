/**
 * Utilidades compartidas: normalización de texto, números con coma decimal,
 * fechas en formato chileno, claves de mes y comparación difusa de nombres.
 */

/** Mayúsculas, sin acentos, espacios colapsados. */
function normalizar(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Clave de encabezado: sólo letras y números, para comparar títulos. */
function claveEncabezado(valor) {
  return normalizar(valor).replace(/[^A-Z0-9]/g, '');
}

/** Sufijos de razón social que se ignoran al comparar nombres de proveedor. */
const SUFIJOS_RAZON_SOCIAL = [
  'LIMITADA', 'LTDA', 'SPA', 'S P A', 'EIRL', 'E I R L', 'SA', 'S A',
  'Y CIA', 'CIA', 'SOC', 'SOCIEDAD'
];

/** Nombre de proveedor reducido a lo comparable (sin puntos ni razón social). */
function normalizarProveedor(valor) {
  let txt = normalizar(valor).replace(/[.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
  SUFIJOS_RAZON_SOCIAL.forEach(function (sufijo) {
    txt = txt.replace(new RegExp('(^|\\s)' + sufijo + '(\\s|$)', 'g'), ' ');
  });
  return txt.replace(/\s+/g, ' ').trim();
}

/** Clave exacta de proveedor (se usa como llave de los mapas). */
function claveProveedor(valor) {
  return normalizar(valor).replace(/[^A-Z0-9]/g, '');
}

/** Clave de guía: sólo alfanumérico y sin ceros a la izquierda. */
function normalizarGuia(valor) {
  let txt = normalizar(valor).replace(/[^A-Z0-9]/g, '');
  txt = txt.replace(/^0+(?=.)/, '');
  return txt;
}

/**
 * Convierte a número aceptando coma decimal ("13,81") y miles con punto
 * ("1.234,5"). Devuelve null si no hay número.
 */
function aNumero(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return isNaN(valor) ? null : valor;
  if (valor instanceof Date) return null;
  let txt = String(valor).trim().replace(/\s/g, '').replace(/[^0-9,.\-]/g, '');
  if (!txt || txt === '-') return null;
  const comas = (txt.match(/,/g) || []).length;
  const puntos = (txt.match(/\./g) || []).length;
  if (comas && puntos) {
    // 1.234,56 -> 1234.56
    txt = txt.replace(/\./g, '').replace(',', '.');
  } else if (comas > 1) {
    // 1,234,567 -> separador de miles
    txt = txt.replace(/,/g, '');
  } else if (comas === 1) {
    txt = txt.replace(',', '.');
  }
  const numero = Number(txt);
  return isNaN(numero) ? null : numero;
}

/** Convierte a Date aceptando dd-mm-aaaa, dd/mm/aaaa, aaaa-mm-dd y seriales. */
function aFecha(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
  if (typeof valor === 'number') {
    // Serial de hoja de cálculo (días desde el 30-12-1899).
    const fecha = new Date(Math.round((valor - 25569) * 86400000));
    return isNaN(fecha.getTime()) ? null : fecha;
  }
  const txt = String(valor).trim();
  let m = txt.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
  if (m) {
    let anio = Number(m[3]);
    if (anio < 100) anio += 2000;
    return new Date(anio, Number(m[2]) - 1, Number(m[1]));
  }
  m = txt.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const fecha = new Date(txt);
  return isNaN(fecha.getTime()) ? null : fecha;
}

const MESES_ES = {
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6,
  JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12
};

const MESES_ES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                        'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function dosDigitos(n) {
  return (n < 10 ? '0' : '') + n;
}

/** Clave de mes 'AAAA-MM' a partir de Date, 'oct-2026', '2026-10', etc. */
function claveMes(valor) {
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return valor.getFullYear() + '-' + dosDigitos(valor.getMonth() + 1);
  }
  const txt = normalizar(valor);
  if (!txt) return '';
  let m = txt.match(/^(\d{4})[-\/ ]?(\d{1,2})$/);
  if (m) return m[1] + '-' + dosDigitos(Number(m[2]));
  m = txt.match(/^(\d{1,2})[-\/ ](\d{4})$/);
  if (m) return m[2] + '-' + dosDigitos(Number(m[1]));
  m = txt.match(/^([A-Z]{3,10})[-\/ .]*(\d{2,4})$/);
  if (m) {
    const mes = MESES_ES[m[1].substring(0, 3)];
    if (mes) {
      let anio = Number(m[2]);
      if (anio < 100) anio += 2000;
      return anio + '-' + dosDigitos(mes);
    }
  }
  const fecha = aFecha(valor);
  if (fecha) return fecha.getFullYear() + '-' + dosDigitos(fecha.getMonth() + 1);
  return '';
}

/** Etiqueta legible del mes: '2026-10' -> 'oct-2026'. */
function etiquetaMes(clave) {
  const m = String(clave || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return String(clave || '');
  return MESES_ES_CORTO[Number(m[2]) - 1] + '-' + m[1];
}

/** Clave del mes actual. */
function mesActual() {
  const hoy = new Date();
  return hoy.getFullYear() + '-' + dosDigitos(hoy.getMonth() + 1);
}

/**
 * Clave de mes a partir del nombre de una hoja mensual.
 * 'OCTUBRE 2026' -> '2026-10'; 'Sept 2024' -> '2024-09'; 'MAY0 2025' -> '2025-05'.
 * Devuelve '' si el nombre no es un mes ('Hoja 4').
 */
function claveMesDesdeNombreHoja(nombre) {
  const txt = normalizar(nombre);
  const anio = txt.match(/(20\d{2})/);
  if (!anio) return '';
  const palabras = txt.replace(/20\d{2}/g, ' ').replace(/[^A-Z ]/g, ' ').trim().split(/\s+/);
  for (let i = 0; i < palabras.length; i++) {
    const mes = MESES_ES[palabras[i].substring(0, 3)];
    if (mes) return anio[1] + '-' + dosDigitos(mes);
  }
  return '';
}

/** Mueve una clave de mes N meses ('2026-10', -12 -> '2025-10'). */
function mesClaveDesplazada(clave, meses) {
  const m = String(clave || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return clave;
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1 + Number(meses), 1);
  return fecha.getFullYear() + '-' + dosDigitos(fecha.getMonth() + 1);
}

/** Distancia de Levenshtein entre dos textos. */
function distanciaLevenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let fila = [];
  for (let j = 0; j <= b.length; j++) fila[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temporal = fila[j];
      const costo = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + costo);
      anterior = temporal;
    }
  }
  return fila[b.length];
}

/** ¿La lista corta aparece completa y seguida dentro de la larga? */
function secuenciaContenida(cortos, largos) {
  if (!cortos.length || cortos.length > largos.length) return false;
  for (let inicio = 0; inicio <= largos.length - cortos.length; inicio++) {
    let calza = true;
    for (let i = 0; i < cortos.length; i++) {
      if (largos[inicio + i] !== cortos[i]) { calza = false; break; }
    }
    if (calza) return true;
  }
  return false;
}

/**
 * Similitud 0..1 entre dos nombres de proveedor.
 *
 * La comparación es por palabras completas: la planilla manual usa nombres
 * cortos ('GUIVAR', 'COLLICURA', 'LEON') y hay que pegarlos a la razón social
 * de SAP sin confundir 'LEON' con 'LEONERA'.
 */
function similitud(a, b) {
  const x = normalizarProveedor(a);
  const y = normalizarProveedor(b);
  if (!x || !y) return 0;
  if (x === y) return 1;

  const tokensX = x.split(' ');
  const tokensY = y.split(' ');
  if (secuenciaContenida(tokensX, tokensY) || secuenciaContenida(tokensY, tokensX)) return 0.95;

  const significativosX = tokensX.filter(function (t) { return t.length >= 3; });
  const significativosY = tokensY.filter(function (t) { return t.length >= 3; });
  const contenidoEnY = significativosX.length && significativosX.every(function (t) {
    return significativosY.indexOf(t) >= 0;
  });
  const contenidoEnX = significativosY.length && significativosY.every(function (t) {
    return significativosX.indexOf(t) >= 0;
  });
  if (contenidoEnY || contenidoEnX) return 0.9;

  let comunes = 0;
  significativosX.forEach(function (t) { if (significativosY.indexOf(t) >= 0) comunes++; });
  const union = significativosX.length + significativosY.length - comunes;
  const jaccard = union > 0 ? comunes / union : 0;

  const largo = Math.max(x.length, y.length);
  const levenshtein = 1 - (distanciaLevenshtein(x, y) / largo);

  return Math.max(0, (jaccard * 0.5) + (levenshtein * 0.5));
}

/**
 * Mejor candidato para un texto dentro de una lista.
 * Devuelve { valor, puntaje }.
 */
function mejorCoincidencia(texto, candidatos) {
  let mejor = { valor: '', puntaje: 0 };
  (candidatos || []).forEach(function (candidato) {
    const puntaje = similitud(texto, candidato);
    if (puntaje > mejor.puntaje) mejor = { valor: candidato, puntaje: puntaje };
  });
  return mejor;
}

/**
 * Ubica columnas por nombre de encabezado.
 * Devuelve { clave: indice base 0 } y -1 cuando la columna no existe.
 *
 * La coincidencia es exacta a propósito: un calce aproximado puede apuntar un
 * campo a una columna ajena y escribir datos equivocados sin avisar. Cuando el
 * encabezado no sirve (la planilla origen tiene varios así), la columna se
 * detecta por contenido en Importar.gs.
 */
function ubicarColumnas(encabezados, alias) {
  const indices = {};
  const claves = encabezados.map(claveEncabezado);
  Object.keys(alias).forEach(function (campo) {
    let indice = -1;
    alias[campo].some(function (nombre) {
      indice = claves.indexOf(claveEncabezado(nombre));
      return indice >= 0;
    });
    indices[campo] = indice;
  });
  return indices;
}

/**
 * Valor de celda como texto. Una fecha se formatea dd-mm-aaaa en vez de quedar
 * como 'Thu Oct 01 2026 00:00:00 GMT-0300', que es lo que da String(fecha).
 */
function comoTexto(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) {
    return dosDigitos(valor.getDate()) + '-' + dosDigitos(valor.getMonth() + 1) +
      '-' + valor.getFullYear();
  }
  return String(valor).trim();
}

/** Obtiene (o crea) una hoja por nombre. */
function obtenerHoja(libro, nombre, crear) {
  let hoja = libro.getSheetByName(nombre);
  if (!hoja && crear) hoja = libro.insertSheet(nombre);
  return hoja;
}

/** Lee una hoja completa como matriz, o [] si no existe o está vacía. */
function leerHoja(libro, nombre) {
  const hoja = libro.getSheetByName(nombre);
  if (!hoja) return [];
  const ultimaFila = hoja.getLastRow();
  const ultimaColumna = hoja.getLastColumn();
  if (ultimaFila < 1 || ultimaColumna < 1) return [];
  return hoja.getRange(1, 1, ultimaFila, ultimaColumna).getValues();
}

/** Redondea a n decimales devolviendo número. */
function redondear(valor, decimales) {
  if (valor === null || valor === undefined || isNaN(valor)) return 0;
  const factor = Math.pow(10, decimales === undefined ? 3 : decimales);
  return Math.round(valor * factor) / factor;
}
