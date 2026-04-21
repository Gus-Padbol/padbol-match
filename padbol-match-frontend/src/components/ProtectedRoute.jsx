import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Única fuente: useAuth() (session + loading).
 */
export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const { session, loading } = useAuth();

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (!session?.user) {
    // redirect solo pathname (sin search); codificado para que el valor no se parta en la query.
    return <Navigate to={`/auth?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return children;
}
