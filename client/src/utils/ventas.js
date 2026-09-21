// -----------------------------------------------------------------------------
// ventas.js — La cuenta del total, del lado de la pantalla
// -----------------------------------------------------------------------------
// Son las MISMAS cuentas que hace el servidor en server/src/logic/sales.js.
// Estan duplicadas a proposito, igual que las de la semana en format.js.
//
// POR QUE DUPLICAR ALGO A PROPOSITO
//
// El dueno escribe "5000", elige "Mayorista" y tiene que ver el total ahi
// mismo, mientras escribe. Preguntarle al servidor por cada tecla seria lento
// y no funcionaria sin senal.
//
// Y POR QUE ESO NO ES PELIGROSO
//
// Porque esta copia NO decide nada. Cuando se toca Guardar, la pantalla manda
// la cantidad, la lista y el descuento; el total lo vuelve a calcular el
// servidor con el precio que tiene guardado, y ESE es el que se graba. Si
// alguna vez las dos cuentas no coincidieran, la que manda es la del servidor.
//
// La copia es para MOSTRAR. La original es para DECIDIR. Mientras esa
// separacion se mantenga, la duplicacion es segura.
// -----------------------------------------------------------------------------

/** Redondea al guarani mas cercano: el guarani no tiene centavos. */
function redondearGs(valor) {
  return Math.round(valor);
}

/**
 * Cuanto sale una cantidad, dado un precio "por cada 1.000".
 * Multiplica ANTES de dividir, igual que el servidor: al reves se arrastra el
 * error de coma flotante de JavaScript y el resultado puede diferir en 1 Gs.
 */
export function montoPorMil(cantidad, precioPorMil) {
  if (!cantidad || !precioPorMil) return 0;
  return redondearGs((cantidad * precioPorMil) / 1000);
}

/**
 * subtotal, descuento en guaranies y total.
 *
 * @param {{cantidad: number, precioPorMil: number, descuento: {tipo: string, valor: number}|null}} p
 */
export function calcularTotales({ cantidad, precioPorMil, descuento = null }) {
  const subtotal = montoPorMil(cantidad, precioPorMil);

  let descuentoGs = 0;
  if (descuento?.tipo === 'porcentaje') {
    // Se acota entre 0 y 100 acá tambien: mientras se escribe puede aparecer
    // un 1000 a medio tipear, y el total no tiene que irse a negativo de golpe.
    const porcentaje = Math.min(Math.max(descuento.valor ?? 0, 0), 100);
    descuentoGs = redondearGs((subtotal * porcentaje) / 100);
  } else if (descuento?.tipo === 'monto') {
    descuentoGs = Math.min(Math.max(descuento.valor ?? 0, 0), subtotal);
  }

  return { subtotal, descuentoGs, montoTotal: subtotal - descuentoGs };
}
