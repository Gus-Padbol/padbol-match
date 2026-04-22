import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          padding: '72px 16px',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.9)',
          fontWeight: 600,
          boxSizing: 'border-box',
        }}
      >
        Cargando…
      </div>
    );
  }

  if (!session?.user) {
    const next = `${location.pathname}${location.search || ''}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(next)}`} replace />;
  }

  return children;
}
