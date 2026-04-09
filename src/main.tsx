import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './app/App.tsx'
import { KnowledgeStoreProvider } from './app/providers/knowledge-store.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <KnowledgeStoreProvider>
        <App />
      </KnowledgeStoreProvider>
    </BrowserRouter>
  </StrictMode>,
)
