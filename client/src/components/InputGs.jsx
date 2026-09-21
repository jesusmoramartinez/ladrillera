// -----------------------------------------------------------------------------
// InputGs.jsx — Campo para escribir plata
// -----------------------------------------------------------------------------
// Hace tres cosas que el plan pide (seccion 7) y que a mano se olvidan siempre:
//
//   1. Formatea mientras se escribe: tipeas 1500000 y ves "1.500.000".
//      Sin esto, en un celular es facilisimo poner un cero de mas y no notarlo.
//
//   2. Abre el teclado NUMERICO en el celular (inputMode="numeric"), no el de
//      letras.
//
//   3. Hacia afuera entrega siempre un NUMERO ENTERO, nunca el texto con
//      puntos. El resto de la app no se entera de que existe el formateo.
//
// Detalle de por que el tipo es "text" y no "number":
//   - <input type="number"> no deja formatear con puntos (el navegador lo
//     considera invalido y te borra el valor).
//   - Ademas muestra flechitas de subir/bajar que no sirven para nada en un
//     celular, y en algunos navegadores acepta "e" (de notacion cientifica).
//   El combo correcto para plata es type="text" + inputMode="numeric".
// -----------------------------------------------------------------------------

import { useId } from 'react';
import { formatearNumero, parsearNumero } from '../utils/format.js';

/**
 * @param {object} props
 * @param {string} props.etiqueta        texto del label
 * @param {number} props.value           el valor, SIEMPRE como numero entero
 * @param {(n: number) => void} props.onChange  recibe el numero ya parseado
 * @param {string} [props.error]         mensaje de error a mostrar debajo
 * @param {string} [props.ayuda]         aclaracion chica debajo del campo
 */
export function InputGs({ etiqueta, value, onChange, error, ayuda, id, ...resto }) {
  // useId genera un id unico y estable. Hace falta para conectar el <label>
  // con el <input>: asi, tocando la etiqueta se enfoca el campo (importante en
  // un celular, donde el campo es chico) y los lectores de pantalla lo leen bien.
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;

  function manejarCambio(evento) {
    onChange(parsearNumero(evento.target.value));
  }

  return (
    <div className="campo">
      <label className="campo-etiqueta" htmlFor={idCampo}>
        {etiqueta}
      </label>

      <div className="campo-con-prefijo">
        <span className="campo-prefijo" aria-hidden="true">
          Gs
        </span>
        <input
          id={idCampo}
          className={`campo-input campo-input--con-prefijo${error ? ' campo-input--error' : ''}`}
          type="text"
          inputMode="numeric"
          // Le dice al navegador que solo espere digitos y puntos. Ayuda al
          // autocompletado a no ofrecer cosas raras.
          pattern="[0-9.]*"
          autoComplete="off"
          // Mostramos vacio cuando el valor es 0, en vez de un "0" que hay que
          // borrar antes de escribir. Es un detalle chico que se nota mucho.
          value={value ? formatearNumero(value) : ''}
          onChange={manejarCambio}
          // aria-invalid le avisa a los lectores de pantalla que el campo tiene
          // un problema; aria-describedby les dice donde esta el mensaje.
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${idCampo}-error` : undefined}
          {...resto}
        />
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

export default InputGs;
