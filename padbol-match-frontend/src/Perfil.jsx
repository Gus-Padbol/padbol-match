import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function Perfil() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [fotoUrl, setFotoUrl] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [mensajeFoto, setMensajeFoto] = useState('');

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
    const file = e.target.files?.[0];
    if (!file || !usuario) return;
    setSubiendo(true);
    setMensajeFoto('');
    try {
      if (!file.type.startsWith('image/')) throw new Error('El archivo tiene que ser una imagen.');
      if (file.size > 5 * 1024 * 1024) throw new Error('La imagen supera los 5 MB. Elegí una más liviana.');
      // FileReader sin await dejaba la pantalla en "Subiendo" para siempre.
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(file);
      });
      const { error } = await supabase
        .from('users')
        .update({ foto_perfil: base64 })
        .eq('email', usuario.email);
      if (error) throw new Error(error.message || 'No se pudo guardar la foto.');
      // Confirmar que quedó guardada releyendo del servidor.
      const { data: verificado } = await supabase
        .from('users').select('foto_perfil').eq('email', usuario.email).maybeSingle();
      if (verificado && verificado.foto_perfil !== base64) {
        throw new Error('El servidor no confirmó el guardado de la foto.');
      }
      setFotoUrl(base64);
      const updated = { ...usuario, foto_perfil: base64 };
      localStorage.setItem('currentCliente', JSON.stringify(updated));
      setUsuario(updated);
      setMensajeFoto('Foto guardada correctamente.');
    } catch (err) {
      setMensajeFoto(err?.message || 'No se pudo guardar la foto. Intentá de nuevo.');
    } finally {
      setSubiendo(false);
    }
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
          {mensajeFoto && (
            <p role="status" style={{ marginTop: 8, fontSize: 14, color: mensajeFoto.startsWith('Foto guardada') ? '#16a34a' : '#dc2626' }}>
              {mensajeFoto}
            </p>
          )}
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
  btnVolver: { padding: '10px 20px', marginBottom: '20px', backgroundcolor: 'var(--text-primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  card: { backgroundColor: '#f5f5f5', padding: '30px', borderRadius: '8px', textAlign: 'center' },
  fotoContainer: { marginBottom: '20px' },
  foto: {
    width: '150px',
    height: '150px',
    borderRadius: '50%',
    objectFit: 'cover',
    objectPosition: 'top center',
    transform: 'scale(0.85)',
    transformOrigin: 'top center',
    border: '3px solid #c41e3a',
    display: 'block',
    margin: '0 auto 10px',
  },
  fotoPlaceholder: { width: '150px', height: '150px', margin: '0 auto 10px', borderRadius: '50%', backgroundColor: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #c41e3a', color: '#999' },
  labelFile: { display: 'inline-block', padding: '8px 16px', backgroundColor: '#c41e3a', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  datos: { textAlign: 'left', marginTop: '20px' },
  nombre: { color: '#c41e3a', fontSize: '22px', marginBottom: '15px' },
};