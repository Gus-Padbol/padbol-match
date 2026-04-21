import React from 'react';
import { useAuth } from '../context/AuthContext';
import { getDisplayName } from '../utils/getDisplayName';

const UserHome = () => {
  const { userProfile, session } = useAuth();
  const nombreMostrar = getDisplayName(userProfile, session);

  return (
    <div style={{ padding: '20px' }}>
      
      {/* 🔴 TÍTULO */}
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
        Tu espacio
      </h2>

      {/* 🔴 SALUDO */}
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '15px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h1 style={{ margin: 0 }}>
          Hola {nombreMostrar}
        </h1>
        <p style={{ marginTop: '10px' }}>
          ¿Qué querés hacer hoy?
        </p>
      </div>

      {/* 🔴 BLOQUE ACCESOS (como antes) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '15px',
        marginBottom: '20px'
      }}>
        <button style={{ padding: '20px' }}>Reservar</button>
        <button style={{ padding: '20px' }}>Torneos</button>
        <button style={{ padding: '20px' }}>Ranking</button>
        <button style={{ padding: '20px' }}>Perfil</button>
      </div>

      {/* 🔴 BOTÓN ABAJO */}
      <button style={{
        width: '100%',
        padding: '15px'
      }}>
        Explorar sedes
      </button>

    </div>
  );
};

export default UserHome;
