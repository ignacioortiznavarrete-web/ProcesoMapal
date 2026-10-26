/**
 * Feriados de Chile, calculados.
 *
 * Una lista escrita a mano no se acaba con un aviso: se acaba en silencio,
 * y a partir de ahí el 18 de septiembre cuenta como día hábil, el plan a la
 * fecha queda inflado y nadie se entera.
 *
 * Lo único a mano es FERIADOS_EXTRA: el feriado que declara una ley puntual
 * para un año concreto y que ninguna regla predice.
 */
const FERIADOS_EXTRA = Object.freeze([
  // Vacío, y así debe quedarse mientras ninguna ley puntual diga otra cosa.
  // Acá NO va un día en que la planta no trabaja: para eso está DIAS_HABILES.
]);

/** 1 = lunes … 6 = sábado, 0 = domingo. Agregar 6 si se trabaja sábado. */
const DIAS_HABILES = Object.freeze([1, 2, 3, 4, 5]);

/** Domingo de Pascua (algoritmo gregoriano anónimo). */
function pascuaDe_(anio) {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(anio, mes - 1, dia));
}

/**
 * Solsticio de junio en hora de Chile: el Día Nacional de los Pueblos
 * Indígenas (Ley 21.357) cae ahí, y no es un 20 ni un 21 fijo.
 * Fórmula de Meeus; junio siempre es invierno acá, así que el huso es UTC-4.
 */
function solsticioJunio_(anio) {
  const Y = (anio - 2000) / 1000;

  let JDE = 2451716.56767 + 365241.62603 * Y + 0.00325 * Y * Y +
    0.00888 * Math.pow(Y, 3) - 0.00030 * Math.pow(Y, 4);

  const T = (JDE - 2451545.0) / 36525;
  const W = 35999.373 * T - 2.47;
  const rad = Math.PI / 180;
  const lambda = 1 + 0.0334 * Math.cos(W * rad) + 0.0007 * Math.cos(2 * W * rad);

  const TERMINOS = [
    [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186],
    [182, 27.85, 445267.112], [156, 73.14, 45036.886], [136, 171.52, 22518.443],
    [77, 222.54, 65928.934], [74, 296.72, 3034.906], [70, 243.58, 9037.513],
    [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
    [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417],
    [18, 155.12, 67555.328], [17, 288.79, 4562.452], [16, 198.04, 62894.029],
    [14, 199.76, 31436.921], [12, 95.39, 14577.848], [12, 287.11, 31931.756],
    [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074]
  ];

  let S = 0;

  TERMINOS.forEach(function (t) {
    S += t[0] * Math.cos((t[1] + t[2] * T) * rad);
  });

  JDE += (0.00001 * S) / lambda;

  return new Date((JDE - 2440587.5) * 86400000 - 4 * 3600000);
}

function masDias_(fecha, n) {
  return new Date(fecha.getTime() + n * 86400000);
}

function claveUtc_(fecha) {
  return fecha.getUTCFullYear() + '-' +
    dosDigitos(fecha.getUTCMonth() + 1) + '-' +
    dosDigitos(fecha.getUTCDate());
}

/**
 * Ley 19.973: el 29 de junio y el 12 de octubre se corren al lunes de su
 * misma semana si caen martes, miércoles o jueves, y al lunes siguiente si
 * caen viernes.
 */
function aLunes_(fecha) {
  const dow = fecha.getUTCDay();

  if (dow >= 2 && dow <= 4) return masDias_(fecha, -(dow - 1));
  if (dow === 5) return masDias_(fecha, 3);

  return fecha;
}

/**
 * Ley 20.299: el Día de las Iglesias Evangélicas se corre al viernes anterior
 * si el 31 de octubre cae martes, y al siguiente si cae miércoles.
 */
function aViernes_(fecha) {
  const dow = fecha.getUTCDay();

  if (dow === 2) return masDias_(fecha, -4);
  if (dow === 3) return masDias_(fecha, 2);

  return fecha;
}

/** Los feriados nacionales de un año, como claves 'AAAA-MM-DD'. */
function feriadosDe_(anio) {
  const pascua = pascuaDe_(anio);

  return [
    anio + '-01-01',                                    // Año Nuevo
    claveUtc_(masDias_(pascua, -2)),                    // Viernes Santo
    claveUtc_(masDias_(pascua, -1)),                    // Sábado Santo
    anio + '-05-01',                                    // Día del Trabajo
    anio + '-05-21',                                    // Glorias Navales
    claveUtc_(solsticioJunio_(anio)),                   // Pueblos Indígenas
    claveUtc_(aLunes_(new Date(Date.UTC(anio, 5, 29)))), // San Pedro y San Pablo
    anio + '-07-16',                                    // Virgen del Carmen
    anio + '-08-15',                                    // Asunción
    anio + '-09-18',                                    // Independencia
    anio + '-09-19',                                    // Glorias del Ejército
    claveUtc_(aLunes_(new Date(Date.UTC(anio, 9, 12)))), // Encuentro de Dos Mundos
    claveUtc_(aViernes_(new Date(Date.UTC(anio, 9, 31)))), // Iglesias Evangélicas
    anio + '-11-01',                                    // Todos los Santos
    anio + '-12-08',                                    // Inmaculada Concepción
    anio + '-12-25'                                     // Navidad
  ];
}

let FERIADOS_CACHE = null;

/**
 * Los feriados de la ventana que el panel puede necesitar: el año en curso y
 * dos a cada lado. Se calcula la primera vez que alguien pregunta, no al
 * cargar el archivo, porque Apps Script evalúa los .gs en el orden del
 * proyecto y quien los pide puede correr antes que este.
 */
function feriados() {
  if (FERIADOS_CACHE) return FERIADOS_CACHE;

  const anio = new Date().getFullYear();
  const vistos = {};

  for (let a = anio - 2; a <= anio + 2; a++) {
    feriadosDe_(a).forEach(function (f) { vistos[f] = true; });
  }

  FERIADOS_EXTRA.forEach(function (f) { vistos[f] = true; });

  FERIADOS_CACHE = Object.keys(vistos).sort();
  return FERIADOS_CACHE;
}

/** ¿Es día hábil? (no fin de semana según DIAS_HABILES y no feriado). */
function esDiaHabil(clave) {
  const m = String(clave || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!m) return false;

  const fecha = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));

  if (DIAS_HABILES.indexOf(fecha.getUTCDay()) === -1) return false;

  return feriados().indexOf(clave) === -1;
}

/** Suma días a una clave 'AAAA-MM-DD'. */
function sumarDiasClave(clave, dias) {
  const m = String(clave || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!m) return clave;

  const fecha = new Date(Date.UTC(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]) + Number(dias)
  ));

  return claveUtc_(fecha);
}

/** Los días hábiles entre dos claves, inclusive. */
function diasHabilesEntre(desde, hasta) {
  const salida = [];
  let cursor = desde;
  let tope = 0;

  while (cursor && cursor <= hasta && tope < 2000) {
    if (esDiaHabil(cursor)) salida.push(cursor);
    cursor = sumarDiasClave(cursor, 1);
    tope++;
  }

  return salida;
}
