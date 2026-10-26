// Simulador mínimo de Apps Script para probar la lógica en Node.
class Rango {
  constructor(hoja, fila, col, nf, nc) { this.h = hoja; this.f = fila; this.c = col; this.nf = nf; this.nc = nc; }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nf; i++) {
      const fila = [];
      for (let j = 0; j < this.nc; j++) fila.push(this.h.celda(this.f + i, this.c + j));
      out.push(fila);
    }
    return out;
  }
  getValue() { return this.h.celda(this.f, this.c); }
  setValues(v) {
    v.forEach((fila, i) => fila.forEach((val, j) => this.h.set(this.f + i, this.c + j, val)));
    return this;
  }
  setValue(v) { this.h.set(this.f, this.c, v); return this; }
}
const metodosChain = ['setNote','setNumberFormat','setFontWeight','setBackground','setFontColor','setWrap','setFontSize','setRanges','build','whenNumberLessThan','whenNumberBetween','whenNumberGreaterThan'];
metodosChain.forEach(m => { if (!Rango.prototype[m]) Rango.prototype[m] = function () { return this; }; });

class Hoja {
  constructor(nombre, datos) { this.nombre = nombre; this.datos = datos || []; }
  getName() { return this.nombre; }
  celda(f, c) { const fila = this.datos[f - 1] || []; const v = fila[c - 1]; return v === undefined ? '' : v; }
  set(f, c, v) {
    while (this.datos.length < f) this.datos.push([]);
    const fila = this.datos[f - 1];
    while (fila.length < c) fila.push('');
    fila[c - 1] = v;
  }
  getLastRow() { let n = 0; this.datos.forEach((fila, i) => { if (fila.some(v => v !== '' && v !== null && v !== undefined)) n = i + 1; }); return n; }
  getLastColumn() { let n = 0; this.datos.forEach(fila => { for (let j = fila.length - 1; j >= 0; j--) { if (fila[j] !== '' && fila[j] !== null && fila[j] !== undefined) { n = Math.max(n, j + 1); break; } } }); return n; }
  getRange(f, c, nf, nc) { return new Rango(this, f, c, nf === undefined ? 1 : nf, nc === undefined ? 1 : nc); }
  clear() { this.datos = []; return this; }
  clearContents() { this.datos = []; return this; }
  setFrozenRows() { return this; }
  autoResizeColumns() { return this; }
  setColumnWidth() { return this; }
  setConditionalFormatRules() { return this; }
}

class Libro {
  constructor(hojas) { this.hojas = hojas; }
  getSheetByName(n) { return this.hojas.find(h => h.nombre === n) || null; }
  insertSheet(n) { const h = new Hoja(n, []); this.hojas.push(h); return h; }
  getSheets() { return this.hojas; }
  getSpreadsheetTimeZone() { return 'America/Santiago'; }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/prueba'; }
  getName() { return 'Ingreso astilla verde mapal'; }
}

function builderRegla() {
  const b = {};
  ['whenNumberLessThan','whenNumberBetween','whenNumberGreaterThan','setBackground','setRanges'].forEach(m => { b[m] = () => b; });
  b.build = () => ({});
  return b;
}

const propiedades = {};
global.PropertiesService = {
  getDocumentProperties: () => ({
    getProperty: k => (k in propiedades ? propiedades[k] : null),
    setProperty: (k, v) => { propiedades[k] = v; },
    setProperties: o => Object.assign(propiedades, o)
  })
};
global.HtmlService = { createHtmlOutputFromFile: () => ({ setWidth: () => ({ setHeight: () => ({}) }) }) };
global.ScriptApp = { getProjectTriggers: () => [] };
global.LockService = { getDocumentLock: () => ({ tryLock: () => true, releaseLock() {} }) };

module.exports = { Hoja, Libro, builderRegla, propiedades };
