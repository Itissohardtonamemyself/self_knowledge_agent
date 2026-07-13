import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Chat from '@/pages/Chat';
import Documents from '@/pages/Documents';
import Memory from '@/pages/Memory';
import Processing from '@/pages/Processing';
import Maintenance from '@/pages/Maintenance';
import Privacy from '@/pages/Privacy';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:conversationId" element={<Chat />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/documents/:docId" element={<Documents />} />
          <Route path="/memory" element={<Memory />} />
          <Route path="/processing" element={<Processing />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
