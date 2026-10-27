/**
 * Guías que SAP nunca trajo.
 *
 * El mismo trato que la homologación, pero para camiones en vez de nombres: el
 * script propone y la persona decide, y lo que se escribe a mano manda.
 *
 * El caso es este. Un camión que entró hoy todavía no puede estar en SAP,
 * porque la información pasa por cinco fases: ese se complementa con la
 * planilla, y para eso existe todo este control. Pero uno de hace días que
 * SIGUE sin aparecer ya no es desfase. O la guía está escrita distinta en cada
 * sistema, o la carga se anuló, o nunca va a llegar. Estimarlo mes a mes infla
 * el avance con volumen que no existe, y nadie se da cuenta porque el camión se
 * ve igual que los demás pendientes.
 *
 * Así que esos camiones se juntan en la hoja 'guias faltantes' con su fecha,
 * proveedor, producto, guía, patente y ticket, más los días que llevan sin
 * cruzar y —cuando hay una que calce— el Nº de guía que SAP tiene sin cruzar
 * del mismo proveedor y material. Con eso se puede ir a buscar el papel.
 *
 * Por defecto no se cuentan. La columna 'Acción' permite decidir caso a caso:
 *
 *   (vacía)     manda la regla de CONFIG.DIAS_GRACIA_SIN_CRUCE
 *   CONTAR      cuéntala igual, es desfase de verdad
 *   NO CONTAR   no la cuentes nunca, aunque la regla cambie
 */

const ENCABEZADOS_FALTANTES = [
  'Fecha', 'Proveedor planilla', 'Proveedor SAP', 'Producto', 'Nº guía',
  'Patente', 'Nº ticket', 'Días sin cruzar', 'Guía SAP sin cruzar',
  'TS que se dejan de contar', 'Acción', 'Estado'
];

/** La columna 'Estado' es la única que el script reescribe. */
const COL_FALTANTES_ESTADO = 12;

/**
 * Lee las decisiones tomadas a mano.
 * Devuelve un índice por proveedor + material + guía, la misma llave del cruce.
 */
function cargarGuiasFaltantes(libro) {
  const porCarga = {};
  const filas = [];
  const datos = leerHoja(libro, CONFIG.HOJA_GUIAS_FALTANTES);
  if (datos.length < 2) return { porCarga: porCarga, filas: filas };

  const col = ubicarColumnas(datos[0], COLUMNAS.GUIAS_FALTANTES);

  for (let i = 1; i < datos.length; i++) {
    const fila = datos[i];
    const proveedor = col.proveedor >= 0 ? comoTexto(fila[col.proveedor]) : '';
    const guia = col.guia >= 0 ? normalizarGuia(fila[col.guia]) : '';
    if (!guia) continue;

    const registro = {
      filaHoja: i + 1,
      fecha: col.fecha >= 0 ? aFecha(fila[col.fecha]) : null,
      proveedor: proveedor,
      proveedorSap: col.proveedorSap >= 0 ? comoTexto(fila[col.proveedorSap]) : '',
      producto: col.producto >= 0 ? comoTexto(fila[col.producto]) : '',
      guia: guia,
      accion: normalizarAccion(col.accion >= 0 ? fila[col.accion] : '')
    };

    filas.push(registro);
    porCarga[claveFaltante(
      registro.proveedorSap || registro.proveedor, registro.producto, guia
    )] = registro;
  }

  return { porCarga: porCarga, filas: filas };
}

/**
 * Llave de una fila de la hoja: proveedor + producto + guía.
 *
 * Usa el nombre de producto **de la hoja**, que es el homologado y legible, no
 * el de SAP. Tiene que ser la misma fórmula al leer y al escribir: si una
 * punta usara 'VIRUTA-ASERUTA (TS)' y la otra 'VIRUTA', la fila no se
 * reconocería y se volvería a agregar en cada pasada.
 */
function claveFaltante(proveedor, producto, guia) {
  return claveProveedor(proveedor) + '|' + claveProducto(producto) + '|' +
    normalizarGuia(guia);
}

/** 'no contar', 'No Contar', 'NO_CONTAR' -> ACCION_GUIA.NO_CONTAR. */
function normalizarAccion(valor) {
  const texto = normalizar(valor).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!texto) return '';
  if (texto === ACCION_GUIA.CONTAR || texto === 'SI' || texto === 'CONTABILIZAR') {
    return ACCION_GUIA.CONTAR;
  }
  if (texto === ACCION_GUIA.NO_CONTAR || texto === 'NO' || texto === 'DESCARTAR' ||
      texto === 'EXCLUIR') {
    return ACCION_GUIA.NO_CONTAR;
  }
  return '';
}

/**
 * ¿Un camión sin cruzar ya venció?
 *
 * Se mide contra el corte del export de SAP, no contra hoy. Si el export quedó
 * atrasado, medir contra hoy daría por vencido el mes entero y el control se
 * iría a cero justo cuando lo que falta es refrescar el export.
 */
function guiaVencida(fecha, corteSap) {
  const gracia = CONFIG.DIAS_GRACIA_SIN_CRUCE;
  if (gracia === null || gracia === undefined || gracia === '') return false;
  if (!fecha || !corteSap) return false;

  const limite = new Date(corteSap.getTime() - (Math.max(0, Number(gracia) || 0) * 86400000));
  return fecha < limite;
}

/** Días que lleva un camión sin aparecer en SAP, según el corte del export. */
function diasSinCruzar(fecha, corteSap) {
  if (!fecha || !corteSap) return '';
  const dias = Math.round((corteSap.getTime() - fecha.getTime()) / 86400000);
  // Vacío, no cero: un camión posterior al corte no lleva días esperando, SAP
  // todavía no llegó a su fecha. Poner 0 lo haría ver como atrasado de hoy.
  return dias > 0 ? dias : '';
}

/**
 * Deja la hoja al día: agrega una fila por cada guía que SAP nunca trajo y
 * refresca la columna 'Estado' de las que ya estaban.
 *
 * Nunca toca lo que la persona escribió. Tampoco borra filas: una guía que
 * después sí cruzó queda marcada 'ya cruzó en SAP', que es justo lo que se
 * quiere ver al revisar.
 */
function sincronizarGuiasFaltantes(libro, datos) {
  const hoja = obtenerHoja(libro, CONFIG.HOJA_GUIAS_FALTANTES, true);
  asegurarEncabezadosFaltantes(hoja);

  const tabla = cargarGuiasFaltantes(libro);
  const corte = datos.promedios.corteGlobal;
  const nuevas = [];
  const vistas = {};

  datos.filas.forEach(function (fila) {
    if (!fila.sinCruzar) return;

    const clave = claveFaltante(
      fila.proveedorSap || fila.proveedorPlanilla, fila.productoCorto, fila.guia
    );
    vistas[clave] = fila;
    if (tabla.porCarga[clave]) return;

    nuevas.push([
      fila.fecha || '',
      fila.proveedorPlanilla,
      fila.proveedorSap,
      fila.productoCorto,
      fila.guia,
      fila.patente,
      fila.ticket,
      diasSinCruzar(fila.fecha, corte),
      fila.guiaSospechosa || '',
      redondear(fila.tsSinContar, 3),
      '',
      fila.contada ? 'Se está contando (regla)' : 'No se está contando (regla)'
    ]);
  });

  if (nuevas.length) {
    hoja.getRange(hoja.getLastRow() + 1, 1, nuevas.length, ENCABEZADOS_FALTANTES.length)
      .setValues(nuevas);
  }

  // Estado de las filas que ya estaban. Se escribe la columna completa desde
  // la fila 2, indexando por su número de fila real: una fila sin guía se
  // saltea al leer, y escribir en bloque "en orden" desalinearía todo lo de
  // abajo.
  if (tabla.filas.length) {
    const alto = hoja.getLastRow() - 1;

    if (alto > 0) {
      const estados = hoja.getRange(2, COL_FALTANTES_ESTADO, alto, 1).getValues();

      tabla.filas.forEach(function (registro) {
        const clave = claveFaltante(
          registro.proveedorSap || registro.proveedor, registro.producto, registro.guia
        );
        const fila = vistas[clave];
        let texto;

        if (registro.accion === ACCION_GUIA.CONTAR) texto = 'Se cuenta (decidido a mano)';
        else if (registro.accion === ACCION_GUIA.NO_CONTAR) texto = 'No se cuenta (decidido a mano)';
        else if (!fila) texto = estadoDeGuiaResuelta(datos, registro);
        else texto = fila.contada ? 'Se está contando (regla)' : 'No se está contando (regla)';

        estados[registro.filaHoja - 2] = [texto];
      });

      hoja.getRange(2, COL_FALTANTES_ESTADO, alto, 1).setValues(estados);
    }
  }

  hoja.autoResizeColumns(1, ENCABEZADOS_FALTANTES.length);

  return {
    agregadas: nuevas.length,
    total: tabla.filas.length + nuevas.length,
    sinCruzar: Object.keys(vistas).length
  };
}

/**
 * Por qué una fila de la hoja ya no aparece entre las guías sin cruzar: o la
 * guía se corrigió y cruzó, o el camión ya no está en el mes importado.
 */
function estadoDeGuiaResuelta(datos, registro) {
  const cruzo = datos.filas.some(function (fila) {
    return fila.estado === ESTADO.EN_SAP &&
      normalizarGuia(fila.guia) === registro.guia &&
      claveProveedor(fila.proveedorSap || fila.proveedorPlanilla) ===
        claveProveedor(registro.proveedorSap || registro.proveedor);
  });
  return cruzo ? 'Ya cruzó en SAP' : 'Fuera del mes importado';
}

function asegurarEncabezadosFaltantes(hoja) {
  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, ENCABEZADOS_FALTANTES.length).setValues([ENCABEZADOS_FALTANTES]);
    hoja.getRange(2, 1, Math.max(1, hoja.getMaxRows() - 1), 1).setNumberFormat('dd-mm-yyyy');
  }
  hoja.getRange(1, 1, 1, ENCABEZADOS_FALTANTES.length)
    .setFontWeight('bold').setBackground('#7f1d1d').setFontColor('#ffffff');
  hoja.setFrozenRows(1);
}
