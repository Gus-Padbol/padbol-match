import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function Perfil() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [fotoUrl, setFotoUrl] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    const currentClienteStorage = localStorage.getItem('currentCliente');
    if (!currentClienteStorage) {
      navigate('/');
      return;
    }

    const usuarioData = JSON.parse(currentClienteStorage);
    setUsuario(usuarioData);

    if (usuarioData.foto_perfil) {
      setFotoUrl(usuarioData.foto_perfil);
    }

    setCargando(false);
  }, [navigate]);

  const handleFotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !usuario) return;

    setSubiendo(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result;
        
        const { error } = await supabase
          .from('users')
          .update({ foto_perfil: base64 })
          .eq('email', usuario.email);

        if (error) {
          alert('Error: ' + error.message);
          setSubiendo(false);
          return;
        }

        setFotoUrl(base64);
        const updated = { ...usuario, foto_perfil: base64 };
        localStorage.setItem('currentCliente', JSON.stringify(updated));
        setUsuario(updated);

        alert('Foto guardada');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert('Error: ' + err.message);
    }
    setSubiendo(false);
  };

  if (cargando) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>;
  }

  if (!usuario) return null;

  return (
    <div style={styles.container}>
      <button onClick={() => navigate('/')} style={styles.btnVolver}>
        ← Volver
      </button>

      <div style={styles.card}>
        <div style={styles.fotoContainer}>
          {fotoUrl ? (
            <img src={fotoUrl} alt="Foto" style={styles.foto} />
          ) : (
            <div style={styles.fotoPlaceholder}>Sin foto</div>
          )}
          <label style={styles.labelFile}>
            {subiendo ? 'Guardando...' : 'Cambiar foto'}
            <input
              type="file"
              accept="image/*"
              onChange={handleFotoChange}
              disabled={subiendo}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <div style={styles.datos}>
          <h2 style={styles.nombre}>{usuario.nombre}</h2>
          <p><strong>Email:</strong> {usuario.email}</p>
          <p><strong>WhatsApp:</strong> {usuario.whatsapp || 'N/A'}</p>
          <p><strong>Nivel:</strong> {usuario.nivel_juego || 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: '500px', margin: '0 auto', padding: '20px' },
  btnVolver: { padding: '10px 20px', marginBottom: '20px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  card: { backgroundColor: '#f5f5f5', padding: '30px', borderRadius: '8px', textAlign: 'center' },
  fotoContainer: { marginBottom: '20px' },
  foto: {
    width: '150px',
    height: '150px',
    borderRadius: '50%',
    objectFit: 'cover',
    objectPosition: 'center top',
    border: '3px solid #c41e3a',
    display: 'block',
    margin: '0 auto 10px',
  },
  fotoPlaceholder: { width: '150px', height: '150px', margin: '0 auto 10px', borderRadius: '50%', backgroundColor: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #c41e3a', color: '#999' },
  labelFile: { display: 'inline-block', padding: '8px 16px', backgroundColor: '#c41e3a', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  datos: { textAlign: 'left', marginTop: '20px' },
  nombre: { color: '#c41e3a', fontSize: '22px', marginBottom: '15px' },
};