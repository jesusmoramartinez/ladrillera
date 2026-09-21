// -----------------------------------------------------------------------------
// InputCantidad.jsx — Campo para cantidades de material
// -----------------------------------------------------------------------------
// El hermano de InputGs, con una diferencia clave: ACA SI se aceptan decimales.
//
// Por que: el dinero en guaranies es siempre entero (no hay centavos), pero se
// compra "1,5 camiones" de arcilla. Son dos tipos de numero distintos y por eso
// son dos componentes distintos: si fuera uno solo con una bandera
// `permitirDecimales`, tarde o temprano alguien la pone donde no va y aparecen
// guaranies con coma.
//
// `inputMode="decimal"` abre el teclado numerico CON la coma. `inputMode
// ="numeric"` (el de InputGs) la esconde, que es lo correcto para plata.
// -----------------------------------------------------------------------------

import { useId, useState } from 'react';
import { formatearCantidad, parsearCantidad } from '../utils/format.js';

/**
 * @param {object} props
 * @param {string} props.etiqueta
 * @param {string} [props.unidad]   se muestra a la derecha: "camiones", "carga"
 * @param {number} props.value
 * @param {(n: number) => void} props.onChange
 * @param {string} [props.error]
 * @param {string} [props.ayuda]
 */
export function InputCantidad({ etiqueta, unidad, value, onChange, error, ayuda, id, ...resto }) {
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;

  // Guardamos aparte lo que se esta TIPEANDO, sin formatear.
  //
  // Por que hace falta: si formatearamos en cada tecla, al escribir "1," el
  // formateador devolveria "1" y la coma desapareceria apenas se tipea. Con un
  // texto en crudo mientras el campo tiene el foco, se puede escribir tranquilo;
  // al salir, se formatea. Ese problema no existe en InputGs porque ahi no hay
  // decimales que escribir.
  const [textoCrudo, setTextoCrudo] = useState(null);

  const mostrado = textoCrudo ?? (value ? formatearCantidad(value) : '');

  function manejarCambio(evento) {
    const texto = evento.target.value;
    setTextoCrudo(texto);
    onChange(parsearCantidad(texto));
  }

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
          inputMode="decimal"
          autoComplete="off"
          value={mostrado}
          onChange={manejarCambio}
          // Al salir del campo soltamos el texto crudo y pasa a mandar el
          // formateado, ya prolijo.
          onBlur={() => setTextoCrudo(null)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${idCampo}-error` : undefined}
          {...resto}
        />
        {unidad && (
          <span className="campo-sufijo" aria-hidden="true">
            {unidad}
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

export default InputCantidad;
