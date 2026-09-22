// -----------------------------------------------------------------------------
// Inicio.jsx — La primera pantalla, con datos reales
// -----------------------------------------------------------------------------
// Es la pantalla que el dueno abre varias veces por dia, muchas veces sin
// buscar nada en particular: solo para ver como viene. Por eso todo lo de acá
// esta ordenado por URGENCIA, no por importancia ni por orden alfabetico.
//
//   1. La alerta roja de arcilla, si esta prendida. Va arriba de todo porque
//      cambia lo que hay que hacer HOY: si falta arcilla, hay que ir a la
//      cantera antes de seguir produciendo.
//   2. El balance del mes: la pregunta de siempre, "¿gane o perdi?".
//   3. Los ladrillos de la semana y el stock: como viene la produccion.
//   4. Lo que falta cobrar y entregar: la plata y los ladrillos que se deben.
//
// CADA TARJETA LLEVA A ALGUN LADO. Un numero que no se puede tocar obliga a ir
// a buscar la pantalla en el menu. Ver "debe Gs 4.500.000" y poder tocarlo para
// ver de quien es, es la diferencia entre un tablero y un adorno.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BotonGrande } from '../components/BotonGrande.jsx';
import { obtenerInicio } from '../api/dashboard.js';
import { useAuth } from '../context/useAuth.js';
import {
  formatearCantidad,
  formatearFecha,
  formatearGs,
  formatearMes,
  formatearNumero,
  hoyISO,
  nombreDelDia,
} from '../utils/format.js';

const NOMBRE_ARCILLA = {
  arcilla_pura: 'pura',
  arcilla_floja: 'floja',
};

export function Inicio() {
  const { usuario } = useAuth();

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recargas, setRecargas] = useState(0);

  function recargar() {
    setCargando(true);
    setError('');
    setRecargas((n) => n + 1);
  }

  useEffect(() => {
    let cancelado = false;

    obtenerInicio()
      .then((r) => {
        if (!cancelado) setDatos(r);
      })
      .catch((e) => {
        if (!cancelado) setError(e.message);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [recargas]);

  return (
    <div className="pantalla">
      <header>
        <p className="texto-tenue">Hola, {usuario?.username}</p>
        <h1 className="titulo">
          {nombreDelDia(hoyISO())} {formatearFecha(hoyISO())}
        </h1>
      </header>

      {cargando && <p className="texto-tenue">Cargando...</p>}

      {!cargando && error && (
        <div className="tarjeta">
          <p className="alerta" role="alert">
            {error}
          </p>
          <BotonGrande variante="secundario" onClick={recargar} ancho>
            Reintentar
          </BotonGrande>
        </div>
      )}

      {!cargando && !error && datos && (
        <>
          {/* 1. LA ALERTA ROJA. Arriba de todo, y solo si hay algo que decir.
                 Una alerta que esta siempre deja de ser una alerta. */}
          {datos.arcilla.alerta.alerta && <AlertaArcilla arcilla={datos.arcilla} />}

          {/* 2. El balance del mes */}
          <Link to="/caja" className="tarjeta tarjeta--enlace">
            <h2 className="subtitulo">{formatearMes(datos.mes)}</h2>
            <dl className="lista-datos">
              <div>
                <dt>Ingresos</dt>
                <dd className="monto-positivo">{formatearGs(datos.balance.ingresos)}</dd>
              </div>
              <div>
                <dt>Egresos</dt>
                <dd className="monto-negativo">{formatearGs(datos.balance.egresos)}</dd>
              </div>
              <div className="lista-datos-total">
                <dt>Resultado</dt>
                <dd
                  className={
                    datos.balance.resultado >= 0 ? 'monto-positivo' : 'monto-negativo'
                  }
                >
                  {formatearGs(datos.balance.resultado)}
                </dd>
              </div>
            </dl>
          </Link>

          {/* 3. Produccion de la semana */}
          <Link to="/produccion" className="tarjeta tarjeta--enlace">
            <h2 className="subtitulo">Esta semana</h2>
            <p className="dato-grande">
              {formatearNumero(datos.produccion.ladrillos)}
              <span className="dato-grande-unidad">ladrillos</span>
            </p>
            <p className="texto-tenue">
              {datos.produccion.dias === 0
                ? 'Todavia no se cargo ningun dia.'
                : `En ${datos.produccion.dias} ${
                    datos.produccion.dias === 1 ? 'dia' : 'dias'
                  }, desde el lunes ${formatearFecha(datos.produccion.desde).slice(0, 5)}.`}
            </p>
          </Link>

          {/* Los tres numeros del stock */}
          <Link to="/stock" className="tarjeta tarjeta--enlace">
            <h2 className="subtitulo">Ladrillos en el patio</h2>
            <dl className="lista-datos">
              <div>
                <dt>Fisico</dt>
                <dd>{formatearNumero(datos.ladrillos.fisico)}</dd>
              </div>
              <div>
                <dt>Comprometido</dt>
                <dd>{formatearNumero(datos.ladrillos.comprometido)}</dd>
              </div>
              <div className="lista-datos-total">
                <dt>Libre</dt>
                <dd className={datos.ladrillos.libre < 0 ? 'monto-negativo' : ''}>
                  {formatearNumero(datos.ladrillos.libre)}
                </dd>
              </div>
            </dl>
            {datos.ladrillos.libre < 0 && (
              <p className="campo-ayuda">
                Hay mas vendido que fabricado: faltan{' '}
                {formatearNumero(-datos.ladrillos.libre)} para cumplir las
                entregas.
              </p>
            )}
            {/* Con las etiquetas puestas. "Arcilla: 2,64 y 0,14 camiones" no
                dice cual es cual, y justo la que falta es la que importa. */}
            <p className="campo-ayuda">
              Arcilla pura {formatearCantidad(datos.arcilla.pura.camiones)} ·
              floja {formatearCantidad(datos.arcilla.floja.camiones)} camiones ·
              Lena {formatearCantidad(datos.lena.cantidad)} {datos.lena.unidad}
            </p>
          </Link>

          {/* 4. Lo que se debe y lo que hay que entregar */}
          <div className="fila-tarjetas">
            <Link to="/ventas?estado=por-cobrar" className="tarjeta tarjeta--enlace">
              <h2 className="subtitulo">Por cobrar</h2>
              <p
                className={`dato-grande${
                  datos.pendientes.porCobrar > 0 ? ' monto-negativo' : ''
                }`}
              >
                {formatearGs(datos.pendientes.porCobrar)}
              </p>
            </Link>

            <Link to="/ventas?estado=por-entregar" className="tarjeta tarjeta--enlace">
              <h2 className="subtitulo">Por entregar</h2>
              <p className="dato-grande">
                {formatearNumero(datos.pendientes.porEntregar)}
                <span className="dato-grande-unidad">ladrillos</span>
              </p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * La alerta roja de arcilla (plan, 5.5).
 *
 * Dice CUAL falta, no solo que falta: "comprar arcilla" sin aclarar cual no le
 * sirve de nada al dueno cuando esta yendo a la cantera.
 */
function AlertaArcilla({ arcilla }) {
  const cuales = arcilla.alerta.faltante.map((m) => NOMBRE_ARCILLA[m] ?? m);

  const texto =
    cuales.length === 2
      ? 'Faltan las dos arcillas'
      : `Falta arcilla ${cuales[0] ?? ''}`.trim();

  return (
    <Link to="/stock" className="alerta alerta--roja alerta--enlace" role="alert">
      <strong>Comprar arcilla.</strong> {texto}.{' '}
      {arcilla.alerta.disponible > 0
        ? `Alcanza para ${formatearNumero(arcilla.alerta.disponible)} ladrillos.`
        : 'No alcanza para producir.'}
    </Link>
  );
}

export default Inicio;
