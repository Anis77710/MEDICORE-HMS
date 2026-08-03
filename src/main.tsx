import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './portal/portal.css'
import App from './App.tsx'

if (import.meta.env.DEV) import('./reticle-dev')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
