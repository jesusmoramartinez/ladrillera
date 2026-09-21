// -----------------------------------------------------------------------------
// contextoAuth.js — El objeto Context, solo
// -----------------------------------------------------------------------------
// Tres archivos para una cosa puede parecer exagerado, pero cada uno tiene su
// motivo:
//
//   contextoAuth.js   el canal vacio (este archivo)
//   AuthContext.jsx   quien lo llena: el <AuthProvider>
//   useAuth.js        quien lo lee: el hook
//
// Estan separados porque Vite recarga en caliente (hot reload) solo los
// archivos que exportan UNICAMENTE componentes. Si el provider exportara
// tambien el context y el hook, cada cambio ahi recargaria la pagina entera y
// perderias el estado (por ejemplo, un formulario a medio llenar).
// -----------------------------------------------------------------------------

import { createContext } from 'react';

export const AuthContext = createContext(null);
