// -----------------------------------------------------------------------------
// Stock.jsx — Arcilla, lena y ladrillos
// -----------------------------------------------------------------------------
// Muestra los cuatro materiales y deja hacer las tres operaciones de la fase:
// registrar una compra, anotar uso de lena y corregir el stock con un ajuste.
//
// La alerta roja de arcilla va arriba de todo, porque es el dato que cambia lo
// que el dueno hace hoy: si falta arcilla, hay que ir a la cantera.
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { BotonGrande } from '../components/BotonGrande.jsx';
import { CampoSelect } from '../components/CampoSelect.jsx';
import { CampoTexto } from '../components/CampoTexto.jsx';
import { InputCantidad } from '../components/InputCantidad.jsx';
import { InputGs } from '../components/InputGs.jsx';
import {
  listarMovimientos,
  obtenerStock,
  registrarAjuste,
  registrarCompra,
  registrarUsoLena,
} from '../api/inventory.js';
import {
  formatearCantidad,
  formatearFecha,
  formatearNumero,
  hoyISO,
} from '../utils/format.js';

const NOMBRES = {
  arcilla_pura: 'Arcilla pura',
  arcilla_floja: 'Arcilla floja',
  lena: 'Lena',
  ladrillos: 'Ladrillos',
};

const MOTIVOS = {
  compra: 'Compra',
  produccion: 'Produccion',
  entrega: 'Entrega',
  uso_lena: 'Uso de lena',
  ajuste: 'Ajuste',
  stock_inicial: 'Stock inicial',
  anulacion: 'Anulacion',
};

const FORM_COMPRA = { material: 'arcilla_pura', cantidad: 0, monto: 0, descripcion: '' };
const FORM_LENA = { cantidad: 0, descripcion: '' };
const FORM_AJUSTE = { material: 'arcilla_pura', cantidadReal: 0, descripcion: '' };

export function Stock() {
  const [stock, setStock] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [recargas, setRecargas] = useState(0);

  // Cual de los tres formularios esta abierto: 'compra' | 'lena' | 'ajuste' | null
  const [abierto, setAbierto] = useState(null);
  const [formulario, setFormulario] = useState(null);
  const [erroresCampo, setErroresCampo] = useState({});
  const [errorFormulario, setErrorFormulario] = useState('');
  const [guardando, setGuardando] = useState(false);

  function recargar() {
    setCargando(true);
    setErrorCarga('');
    setRecargas((n) => n + 1);
  }

  useEffect(() => {
    let cancelado = false;

    // Promise.all pide las dos cosas EN PARALELO. Encadenadas tardarian el
    // doble, y no hay motivo: ninguna depende de la otra.
    Promise.all([obtenerStock(), listarMovimientos({ limite: 30 })])
      .then(([s, m]) => {
        if (cancelado) return;
        setStock(s);
        setMovimientos(m);
      })
      .catch((error) => {
        if (!cancelado) setErrorCarga(error.message);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [recargas]);

  function abrir(cual) {
    setAbierto(cual);
    setErroresCampo({});
    setErrorFormulario('');
    if (cual === 'compra') setFormulario({ ...FORM_COMPRA });
    if (cual === 'lena') setFormulario({ ...FORM_LENA });
    if (cual === 'ajuste') setFormulario({ ...FORM_AJUSTE });
  }

  function cerrar() {
    setAbierto(null);
    setFormulario(null);
  }

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErroresCampo({});
    setErrorFormulario('');

    const fecha = hoyISO();

    try {
      if (abierto === 'compra') await registrarCompra({ ...formulario, fecha });
      if (abierto === 'lena') await registrarUsoLena({ ...formulario, fecha });
      if (abierto === 'ajuste') await registrarAjuste({ ...formulario, fecha });
      cerrar();
      recargar();
    } catch (error) {
      if (error.detalles?.length) {
        const porCampo = {};
        for (const d of error.detalles) porCampo[d.campo] = d.mensaje;
        setErroresCampo(porCampo);
      } else {
        setErrorFormulario(error.message);
      }
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="pantalla">
        <h1 className="titulo">Stock</h1>
        <p className="texto-tenue">Cargando...</p>
      </div>
    );
  }

  if (errorCarga) {
    return (
      <div className="pantalla">
        <h1 className="titulo">Stock</h1>
        <div className="tarjeta">
          <p className="alerta" role="alert">
            {errorCarga}
          </p>
          <BotonGrande variante="secundario" onClick={recargar} ancho>
            Reintentar
          </BotonGrande>
        </div>
      </div>
    );
  }

  const unidadLena = stock.lena.unidad;

  return (
    <div className="pantalla">
      <h1 className="titulo">Stock</h1>

      {stock.alertaArcilla.alerta && (
        <div className="alerta alerta--roja" role="alert">
          <strong>Comprar arcilla.</strong>{' '}
          {stock.alertaArcilla.faltante.length === 2
            ? 'Faltan las dos arcillas.'
            : `Falta ${NOMBRES[stock.alertaArcilla.faltante[0]]?.toLowerCase()}.`}{' '}
          Alcanza para {formatearNumero(stock.alertaArcilla.disponible)} ladrillos.
        </div>
      )}

      <section className="tarjeta">
        <h2 className="subtitulo">Arcilla</h2>
        <dl className="lista-datos">
          <div>
            <dt>Pura</dt>
            <dd>{formatearCantidad(stock.arcilla_pura.camiones)} camiones</dd>
          </div>
          <div>
            <dt>Floja</dt>
            <dd>{formatearCantidad(stock.arcilla_floja.camiones)} camiones</dd>
          </div>
        </dl>
        <p className="campo-ayuda">
          Se necesitan las dos a la vez: cada 1.000 ladrillos se gasta lo mismo de
          cada una.
        </p>
      </section>

      <section className="tarjeta">
        <h2 className="subtitulo">Lena</h2>
        <dl className="lista-datos">
          <div>
            <dt>Aproximado</dt>
            <dd>
              {formatearCantidad(stock.lena.cantidad)} {unidadLena}
            </dd>
          </div>
        </dl>
        <p className="campo-ayuda">
          Es aproximado: el consumo cambia segun la calidad, asi que se anota a ojo.
        </p>
      </section>

      <section className="tarjeta">
        <h2 className="subtitulo">Ladrillos</h2>
        <dl className="lista-datos">
          <div>
            <dt>En el patio</dt>
            <dd>{formatearNumero(stock.ladrillos.fisico)}</dd>
          </div>
          <div>
            <dt>Comprometido</dt>
            <dd>{formatearNumero(stock.ladrillos.comprometido)}</dd>
          </div>
          <div>
            <dt>Libre</dt>
            <dd>{formatearNumero(stock.ladrillos.libre)}</dd>
          </div>
        </dl>
        <p className="campo-ayuda">
          "Comprometido" son los ladrillos ya vendidos que faltan entregar. Empieza
          a moverse con las ventas, en la fase 6.
        </p>
      </section>

      <div className="fila-botones fila-botones--envuelve">
        <BotonGrande onClick={() => abrir('compra')}>Registrar compra</BotonGrande>
        <BotonGrande variante="secundario" onClick={() => abrir('lena')}>
          Uso de lena
        </BotonGrande>
        <BotonGrande variante="secundario" onClick={() => abrir('ajuste')}>
          Ajuste
        </BotonGrande>
      </div>

      <section>
        <h2 className="subtitulo">Historial</h2>
        {movimientos.length === 0 ? (
          <p className="texto-tenue">Todavia no hay movimientos.</p>
        ) : (
          <ul className="lista">
            {movimientos.map((m) => (
              <li key={m.id} className="lista-fila">
                <div className="lista-fila-datos">
                  <p className="lista-fila-titulo">
                    <span className={m.cantidad > 0 ? 'monto-positivo' : 'monto-negativo'}>
                      {m.cantidad > 0 ? '+' : ''}
                      {formatearNumero(m.cantidad)}
                    </span>
                    <span className="etiqueta">{MOTIVOS[m.motivo] ?? m.motivo}</span>
                  </p>
                  <p className="texto-tenue">
                    {NOMBRES[m.material]} · {formatearFecha(m.fecha)}
                  </p>
                  {m.descripcion && <p className="texto-tenue">{m.descripcion}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {abierto && (
        <div className="overlay" onClick={cerrar}>
          <form
            className="tarjeta overlay-panel"
            onClick={(e) => e.stopPropagation()}
            onSubmit={guardar}
          >
            {abierto === 'compra' && (
              <>
                <h2 className="subtitulo">Registrar compra</h2>
                <CampoSelect
                  etiqueta="Material"
                  value={formulario.material}
                  onChange={(e) => setFormulario({ ...formulario, material: e.target.value })}
                  opciones={[
                    { valor: 'arcilla_pura', texto: 'Arcilla pura' },
                    { valor: 'arcilla_floja', texto: 'Arcilla floja' },
                    { valor: 'lena', texto: 'Lena' },
                  ]}
                  error={erroresCampo.material}
                />
                <InputCantidad
                  etiqueta="Cantidad"
                  unidad={formulario.material === 'lena' ? unidadLena : 'camiones'}
                  value={formulario.cantidad}
                  onChange={(n) => setFormulario({ ...formulario, cantidad: n })}
                  error={erroresCampo.cantidad}
                  ayuda={
                    formulario.material === 'lena'
                      ? undefined
                      : 'Se puede poner medio camion: 1,5'
                  }
                  autoFocus
                />
                <InputGs
                  etiqueta="Cuanto pagaste"
                  value={formulario.monto}
                  onChange={(n) => setFormulario({ ...formulario, monto: n })}
                  error={erroresCampo.monto}
                  ayuda="Se registra solo como egreso en la caja."
                />
                <CampoTexto
                  etiqueta="Nota (opcional)"
                  value={formulario.descripcion}
                  onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })}
                  error={erroresCampo.descripcion}
                  placeholder="De que cantera, quien trajo..."
                />
              </>
            )}

            {abierto === 'lena' && (
              <>
                <h2 className="subtitulo">Uso de lena</h2>
                <p className="texto-tenue">
                  Cuanta lena se quemo. A ojo esta bien: el stock de lena es
                  aproximado por naturaleza.
                </p>
                <InputCantidad
                  etiqueta="Cantidad usada"
                  unidad={unidadLena}
                  value={formulario.cantidad}
                  onChange={(n) => setFormulario({ ...formulario, cantidad: n })}
                  error={erroresCampo.cantidad}
                  autoFocus
                />
                <CampoTexto
                  etiqueta="Nota (opcional)"
                  value={formulario.descripcion}
                  onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })}
                  error={erroresCampo.descripcion}
                />
              </>
            )}

            {abierto === 'ajuste' && (
              <>
                <h2 className="subtitulo">Ajustar stock</h2>
                <p className="texto-tenue">
                  Para cuando el numero del sistema no coincide con lo que hay en
                  el patio. Escribi <strong>cuanto hay</strong>, no la diferencia.
                </p>
                <CampoSelect
                  etiqueta="Material"
                  value={formulario.material}
                  onChange={(e) => setFormulario({ ...formulario, material: e.target.value })}
                  opciones={[
                    { valor: 'arcilla_pura', texto: 'Arcilla pura' },
                    { valor: 'arcilla_floja', texto: 'Arcilla floja' },
                    { valor: 'lena', texto: 'Lena' },
                    { valor: 'ladrillos', texto: 'Ladrillos' },
                  ]}
                  error={erroresCampo.material}
                />
                <InputCantidad
                  etiqueta="Cuanto hay realmente"
                  unidad={
                    formulario.material === 'lena'
                      ? unidadLena
                      : formulario.material === 'ladrillos'
                        ? 'ladrillos'
                        : 'camiones'
                  }
                  value={formulario.cantidadReal}
                  onChange={(n) => setFormulario({ ...formulario, cantidadReal: n })}
                  error={erroresCampo.cantidadReal}
                  autoFocus
                />
                <CampoTexto
                  etiqueta="Motivo (opcional)"
                  value={formulario.descripcion}
                  onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })}
                  error={erroresCampo.descripcion}
                  placeholder="Se conto el patio, se mojo material..."
                />
              </>
            )}

            {errorFormulario && (
              <p className="alerta" role="alert">
                {errorFormulario}
              </p>
            )}

            <div className="fila-botones">
              <BotonGrande variante="secundario" onClick={cerrar} ancho>
                Cancelar
              </BotonGrande>
              <BotonGrande type="submit" cargando={guardando} ancho>
                Guardar
              </BotonGrande>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Stock;
