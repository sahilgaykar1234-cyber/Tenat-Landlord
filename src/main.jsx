import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyTheme, getStoredTheme } from './utils/theme'
import './index.css'
import App from './App.jsx'

applyTheme(getStoredTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
