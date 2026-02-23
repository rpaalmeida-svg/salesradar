import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Clientes from './pages/Clientes';
import Marcas from './pages/Marcas';
import Categorias from './pages/Categorias';
import Insights from './pages/Insights';
import Estrategia from './pages/Estrategia';
import Objectivos from './pages/Objectivos';
import Comissoes from './pages/Comissoes';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#fafafa', color: '#6b7280', fontSize: '14px'
      }}>
        A carregar...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  if (user.temp_password) return <ChangePassword />;
  return children;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/dashboard" />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#fafafa', color: '#6b7280', fontSize: '14px'
      }}>
        A carregar...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/marcas" element={<Marcas />} />
        <Route path="/categorias" element={<Categorias />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/estrategia" element={<Estrategia />} />
        <Route path="/objectivos" element={<Objectivos />} />
        <Route path="/comissoes" element={<Comissoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}