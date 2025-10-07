import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router-dom'
import './index.css'
import Routing from './Pages/Routing/Routing'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <Routing />
    </Router>
  </StrictMode>,
)
