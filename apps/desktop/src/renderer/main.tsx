import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { OctoApi } from '../shared/api.ts'
import { App } from './App.tsx'
import './styles.css'

declare global {
  interface Window {
    octo: OctoApi
  }
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App api={window.octo} />
    </StrictMode>,
  )
}
