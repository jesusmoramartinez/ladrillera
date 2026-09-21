// -----------------------------------------------------------------------------
// InputEntero.jsx — Campo para cantidades enteras (ladrillos)
// -----------------------------------------------------------------------------
// El tercero de la familia. Comparemos los tres para que quede claro por que
// son distintos:
//
//   InputGs        plata      enteros   separador de miles   prefijo "Gs"
//   InputEntero    unidades   enteros   separador de miles   sufijo libre
//   InputCantidad  material   DECIMALES sin separador        sufijo libre
//
// Por que InputCantidad no sirve acá, aunque parezca lo mismo: acepta coma y
// punto como separador DECIMAL. Si alguien escribe "5.000" ladrillos, lo lee
// como 5 (cinco coma cero cero cero). Para camiones nunca pasa, porque nadie
// compra mil camiones; para ladrillos seria un error grave y silencioso.
//
// Este campo, como InputGs, borra todo lo que no sea digito. "5.000" son 5000
// y punto.
// -----------------------------------------------------------------------------

import { useId } from 'react';
import { formatearNumero, parsearNumero } from '../utils/format.js';

/**
 * @param {object} props
 * @param {string} props.etiqueta
 * @param {string} [props.sufijo]   texto a la derecha: "ladrillos"
 * @param {number} props.value
 * @param {(n: number) => void} props.onChange
 */
export function InputEntero({ etiqueta, sufijo, value, onChange, error, ayuda, id, ...resto }) {
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;

  return (
    <div className="campo">
      <label className="campo-etiqueta" htmlFor={idCampo}>
        {etiqueta}
      </label>

      <div className="campo-con-sufijo">
        <input
          id={idCampo}
          className={`campo-input${error ? ' campo-input--error' : ''}`}
          type="text"
          // numeric (y no decimal) esconde la coma del teclado: no hay medio
          // ladrillo.
          inputMode="numeric"
          pattern="[0-9.]*"
          autoComplete="off"
          // Vacio en vez de "0", asi no hay que borrarlo antes de escribir.
          value={value ? formatearNumero(value) : ''}
          onChange={(evento) => onChange(parsearNumero(evento.target.value))}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${idCampo}-error` : undefined}
          {...resto}
        />
        {sufijo && (
          <span className="campo-sufijo" aria-hidden="true">
            {sufijo}
          </span>
        )}
      </div>

      {ayuda && !error && <p className="campo-ayuda">{ayuda}</p>}
      {error && (
        <p className="campo-error" id={`${idCampo}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export default InputEntero;
