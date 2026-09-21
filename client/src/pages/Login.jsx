// -----------------------------------------------------------------------------
// Login.jsx — Pantalla de inicio de sesion
// -----------------------------------------------------------------------------
// Pautas del plan (seccion 7): mobile-first, botones de al menos 48 px, texto
// grande, alto contraste (se usa al sol), confirmaciones claras.
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function Login() {
  const { usuario, cargando, iniciarSesion } = useAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Si ya hay sesion, no tiene sentido mostrar el login.
  if (!cargando && usuario) {
    return <Navigate to="/" replace />;
  }

  async function manejarEnvio(evento) {
    // Sin esto el navegador recarga la pagina entera al enviar el formulario,
    // que es el comportamiento HTML de toda la vida. En una SPA no lo queremos.
    evento.preventDefault();

    setError('');
    setEnviando(true);

    try {
      await iniciarSesion(username, password);
      // Volvemos a donde queria ir antes de que lo mandaramos al login.
      navegar(ubicacion.state?.desde ?? '/', { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesion');
      setPassword('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pantalla-centrada">
      <form className="tarjeta" onSubmit={manejarEnvio}>
        <h1 className="titulo">Ladrillera</h1>
        <p className="texto-tenue">Ingresa para continuar</p>

        <label className="campo">
          <span className="campo-etiqueta">Usuario</span>
          <input
            className="campo-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            required
            autoFocus
          />
        </label>

        <label className="campo">
          <span className="campo-etiqueta">Contrasena</span>
          <div className="campo-con-boton">
            <input
              className="campo-input"
              type={verPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="boton-texto"
              onClick={() => setVerPassword((v) => !v)}
              aria-label={verPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
            >
              {verPassword ? 'Ocultar' : 'Ver'}
            </button>
          </div>
        </label>

        {/* role="alert" hace que los lectores de pantalla lo anuncien solos */}
        {error && (
          <p className="alerta" role="alert">
            {error}
          </p>
        )}

        <button className="boton-grande" type="submit" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

export default Login;
