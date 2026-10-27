import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MsalProvider } from '@azure/msal-react'
import App from './App'
import { bootstrapMsal, msalInstance } from './config/msal'
import './styles/globals.css'

// MSAL tiene que inicializarse y procesar la vuelta del redirect de
// Microsoft (#code=... en la URL) ANTES de pintar: si el router monta
// primero, el catch-all redirige y se pierde la respuesta.
bootstrapMsal()
  .catch(() => {
    // Si MSAL falla al iniciar, la app sigue funcionando con credenciales.
  })
  .finally(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <MsalProvider instance={msalInstance}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </MsalProvider>
      </React.StrictMode>
    )
  })
