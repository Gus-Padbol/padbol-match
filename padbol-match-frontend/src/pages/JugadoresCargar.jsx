import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import '../styles/JugadoresCargar.css';

const PAISES_PRIORITARIOS = [
  { nombre: 'Argentina',      bandera: '🇦🇷' },
  { nombre: 'España',         bandera: '🇪🇸' },
  { nombre: 'Italia',         bandera: '🇮🇹' },
  { nombre: 'Francia',        bandera: '🇫🇷' },
  { nombre: 'Alemania',       bandera: '🇩🇪' },
  { nombre: 'Rumania',        bandera: '🇷🇴' },
  { nombre: 'Austria',        bandera: '🇦🇹' },
  { nombre: 'Estados Unidos', bandera: '🇺🇸' },
  { nombre: 'Brasil',         bandera: '🇧🇷' },
  { nombre: 'Uruguay',        bandera: '🇺🇾' },
  { nombre: 'Chile',          bandera: '🇨🇱' },
  { nombre: 'Colombia',       bandera: '🇨🇴' },
  { nombre: 'México',         bandera: '🇲🇽' },
];

const OTROS_PAISES = [
  { nombre: 'Australia',               bandera: '🇦🇺' },
  { nombre: 'Bélgica',                 bandera: '🇧🇪' },
  { nombre: 'Bolivia',                 bandera: '🇧🇴' },
  { nombre: 'Canadá',                  bandera: '🇨🇦' },
  { nombre: 'China',                   bandera: '🇨🇳' },
  { nombre: 'Croacia',                 bandera: '🇭🇷' },
  { nombre: 'Dinamarca',               bandera: '🇩🇰' },
  { nombre: 'Ecuador',                 bandera: '🇪🇨' },
  { nombre: 'Emiratos Árabes Unidos',  bandera: '🇦🇪' },
  { nombre: 'Eslovaquia',              bandera: '🇸🇰' },
  { nombre: 'Eslovenia',               bandera: '🇸🇮' },
  { nombre: 'Finlandia',               bandera: '🇫🇮' },
  { nombre: 'Grecia',                  bandera: '🇬🇷' },
  { nombre: 'Guatemala',               bandera: '🇬🇹' },
  { nombre: 'Honduras',                bandera: '🇭🇳' },
  { nombre: 'Hungría',                 bandera: '🇭🇺' },
  { nombre: 'India',                   bandera: '🇮🇳' },
  { nombre: 'Irlanda',                 bandera: '🇮🇪' },
  { nombre: 'Israel',                  bandera: '🇮🇱' },
  { nombre: 'Japón',                   bandera: '🇯🇵' },
  { nombre: 'Kazajistán',              bandera: '🇰🇿' },
  { nombre: 'Marruecos',               bandera: '🇲🇦' },
  { nombre: 'Noruega',                 bandera: '🇳🇴' },
  { nombre: 'Nueva Zelanda',           bandera: '🇳🇿' },
  { nombre: 'países Bajos',            bandera: '🇳🇱' },
  { nombre: 'Panamá',                  bandera: '🇵🇦' },
  { nombre: 'Paraguay',                bandera: '🇵🇾' },
  { nombre: 'Perú',                    bandera: '🇵🇪' },
  { nombre: 'Polonia',                 bandera: '🇵🇱' },
  { nombre: 'Portugal',                bandera: '🇵🇹' },
  { nombre: 'Reino Unido',             bandera: '🇬🇧' },
  { nombre: 'República Checa',         bandera: '🇨🇿' },
  { nombre: 'Rusia',                   bandera: '🇷🇺' },
  { nombre: 'Serbia',                  bandera: '🇷🇸' },
  { nombre: 'Sudáfrica',               bandera: '🇿🇦' },
  { nombre: 'Suecia',                  bandera: '🇸🇪' },
  { nombre: 'Suiza',                   bandera: '🇨🇭' },
  { nombre: 'Turquía',                 bandera: '🇹🇷' },
  { nombre: 'Ucrania',                 bandera: '🇺🇦' },
  { nombre: 'Venezuela',               bandera: '🇻🇪' },
];

const ADMIN_EMAILS = new Set([
  'padbolinternacional@gmail.com',
  'admin@padbol.com',
  'sm@padbol.com',
  'juanpablo@padbol.com',
]);

function getRoleData() {
  try {
    const raw = localStorage.getItem('user_role_data');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function JugadoresCargar() {
  const { id } = useParams();
const torneoId = id;
  const navigate = useNavigate();
  const [torneo, setTorneo] = useState(null);
  const [jugadores, setJugadores] = useState([]);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    pais: '',
  });
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const currentEmail = (JSON.parse(localStorage.getItem('currentCliente') || '{}')?.email || '')
    .trim()
    .toLowerCase();
  const rol = getRoleData()?.rol;
  const isAdmin =
    ADMIN_EMAILS.has(currentEmail) ||
    ['super_admin', 'admin_nacional', 'admin_club'].includes(rol);

  useEffect(() => {
    if (torneoId) {
      fetch(`https://padbol-backend.onrender.com/api/torneos/${torneoId}`)
        .then(res => res.json())
        .then(data => setTorneo(data))
        .catch(err => setError('Error al cargar torneo'));
    }
  }, [torneoId]);

  useEffect(() => {
    if (torneoId) {
      fetch(`https://padbol-backend.onrender.com/api/torneos/${torneoId}/jugadores`)
        .then(res => res.json())
        .then(data => setJugadores(data || []))
        .catch(err => console.error('Error:', err));
    }
  }, [torneoId]);

  if (!isAdmin) {
    return <Navigate to={`/torneo/${torneoId}/equipos`} replace />;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAgregarJugador = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMensaje('');

    if (!formData.nombre || !formData.email) {
      setError('Nombre y email son obligatorios');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `https://padbol-backend.onrender.com/api/torneos/${torneoId}/jugadores`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: formData.nombre,
            email: formData.email,
            pais: formData.pais || null,
            user_id: null,
            numero_camiseta: null,
            es_capitan: false,
          }),
        }
      );

      const result = await response.json();

      if (response.ok) {
        setJugadores([...jugadores, result[0]]);
        setFormData({ nombre: '', email: '', pais: '' });
        setMensaje('✅ Jugador agregado');
        setTimeout(() => setMensaje(''), 3000);
      } else {
        setError(result.error || 'Error al agregar jugador');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarJugador = async (jugadorId) => {
    if (window.confirm('¿Eliminar este jugador?')) {
      try {
        await fetch(`https://padbol-backend.onrender.com/api/jugadores_torneo/${jugadorId}`, {
          method: 'DELETE',
        });
        setJugadores(jugadores.filter(j => j.id !== jugadorId));
      } catch (err) {
        setError('Error al eliminar');
      }
    }
  };

  const handleSiguiente = () => {
    if (jugadores.length === 0) {
      setError('Debe haber al menos 1 jugador');
      return;
    }
    navigate(`/torneo/${torneoId}/equipos`);
  };

  if (!torneo) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        Cargando torneo...
      </div>
    );
  }

  return (
    <div className="jugadores-cargar-container">
      <div className="jugadores-cargar-card">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}>
          <h1>👥 Cargar Jugadores</h1>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '8px 15px',
              background: '#999',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            ← Volver
          </button>
        </div>

        <p style={{ color: '#666', marginBottom: '20px', textAlign: 'center' }}>
          <strong>{torneo.nombre}</strong> • {jugadores.length} jugador
          {jugadores.length !== 1 ? 'es' : ''}
        </p>

        <form onSubmit={handleAgregarJugador} style={{ marginBottom: '30px' }}>
          <div className="form-group">
            <label>Nombre *</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Ej: Juan Pérez"
              required
            />
          </div>

          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="juan@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label>País</label>
            <select name="pais" value={formData.pais} onChange={handleChange}>
              <option value="">— Seleccionar país —</option>
              <optgroup label="Principales">
                {PAISES_PRIORITARIOS.map(p => (
                  <option key={p.nombre} value={`${p.bandera} ${p.nombre}`}>
                    {p.bandera} {p.nombre}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Otros países">
                {OTROS_PAISES.map(p => (
                  <option key={p.nombre} value={`${p.bandera} ${p.nombre}`}>
                    {p.bandera} {p.nombre}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {error && <div className="error-message">{error}</div>}
          {mensaje && <div className="success-message">{mensaje}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: '#d32f2f',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Agregando...' : '✅ Agregar Jugador'}
          </button>
        </form>

        <div style={{ marginBottom: '20px' }}>
          <h3>Jugadores ({jugadores.length}):</h3>
          {jugadores.length === 0 ? (
            <p style={{ color: '#999', textAlign: 'center' }}>Sin jugadores</p>
          ) : (
            <div style={{ display: 'grid', gap: '10px' }}>
              {jugadores.map((j, idx) => (
                <div
                  key={j.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px',
                    background: '#f9f9f9',
                    border: '1px solid #eee',
                    borderRadius: '5px',
                  }}
                >
                  <div>
                    <strong>
                      {idx + 1}. {j.nombre}
                    </strong>
                    <p style={{ margin: '2px 0', color: '#666', fontSize: '12px' }}>
                      {j.email}
                    </p>
                    {j.pais && (
                      <p style={{ margin: '2px 0', color: '#999', fontSize: '12px' }}>
                        {j.pais}
                      </p>
                    )}
                  </div>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => handleEliminarJugador(j.id)}
                      style={{
                        padding: '5px 10px',
                        background: '#f44',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      Eliminar
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {jugadores.length > 0 && (
          <button
            onClick={handleSiguiente}
            style={{
              width: '100%',
              padding: '12px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            ➜ Siguiente: Formar Equipos
          </button>
        )}
      </div>
    </div>
  );
}