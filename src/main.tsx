import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@maxhub/max-ui/dist/styles.css'
import 'react-toastify/dist/ReactToastify.css'
import './styles/global.scss'
import { App } from './App'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Root element #root not found')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
