import { Navigate, Route, Routes } from 'react-router-dom'
import { GraphScreen } from './routes/graph-screen.tsx'
import { NodeDetailPage } from './routes/node-detail-page.tsx'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<GraphScreen />} />
      <Route
        path="/constellation/:constellationId/node/:nodeId"
        element={<NodeDetailPage />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
