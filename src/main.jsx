import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
// Fuentes propias (licencia OFL), sin pedidos a Google: Bricolage con tamaño óptico y Geist variable.
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import '@fontsource-variable/geist/wght.css'
import './styles/index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
