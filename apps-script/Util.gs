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

/** Similitud 0..1 entre dos nombres de proveedor. */
function similitud(a, b) {
  const x = normalizarProveedor(a);
  const y = normalizarProveedor(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.indexOf(y) >= 0 || y.indexOf(x) >= 0) return 0.95;

  const tokensX = x.split(' ').filter(function (t) { return t.length > 2; });
  const tokensY = y.split(' ').filter(function (t) { return t.length > 2; });
  let comunes = 0;
  tokensX.forEach(function (t) { if (tokensY.indexOf(t) >= 0) comunes++; });
  const union = tokensX.length + tokensY.length - comunes;
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
    if (indice < 0) {
      // Último recurso: encabezado que contenga el alias.
      alias[campo].some(function (nombre) {
        const buscado = claveEncabezado(nombre);
        if (!buscado) return false;
        indice = claves.findIndex(function (clave) {
          return clave && (clave.indexOf(buscado) === 0 || buscado.indexOf(clave) === 0);
        });
        return indice >= 0;
      });
    }
    indices[campo] = indice;
  });
  return indices;
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
