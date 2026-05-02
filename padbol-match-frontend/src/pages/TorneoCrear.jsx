import React, { useState, useEffect } from 'react';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import {
  HUB_CONTENT_PADDING_BOTTOM_PX,
  hubContentPaddingTopCss,
} from '../constants/hubLayout';
import '../styles/TorneoCrear.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authUrlWithRedirect } from '../utils/authLoginRedirect';
import { CATEGORIA_TORNEO_DEFAULT, TORNEO_CATEGORIA_OPTIONS } from '../constants/torneoCategoria';

export default function TorneoCrear({ apiBaseUrl = 'https://padbol-backend.onrender.com', rol = null }) {
  const [sedes, setSedes] = useState([]);
  const [tiposCustom, setTiposCustom] = useState([]);
  const [formData, setFormData] = useState({
    nombre: '',
    sede_id: '',
    nivel_torneo: 'club',
    categoria: CATEGORIA_TORNEO_DEFAULT,
    tipo_torneo: 'round_robin',
    fecha_inicio: '',
    fecha_fin: '',
    cantidad_equipos: '',
    es_multisede: false,
  });

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('https://padbol-backend.onrender.com/api/sedes')
      .then(res => res.json())
      .then(data => setSedes(data || []))
      .catch(err => setError('Error al cargar sedes'));

    try {
      const cfg = JSON.parse(localStorage.getItem('config_puntos') || '{}');
      setTiposCustom(cfg.tipos_custom || []);
    } catch { /* ignore */ }
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session?.user) {
      navigate(authUrlWithRedirect('/torneo/crear'));
      return;
    }
    setLoading(true);
    setMensaje('');
    setError('');

    if (!formData.nombre || !formData.tipo_torneo || !formData.fecha_inicio || !formData.fecha_fin) {
      setError('Completa los campos obligatorios');
      setLoading(false);
      return;
    }
    if (!String(formData.categoria || '').trim()) {
      setError('Seleccioná la categoría del torneo');
      setLoading(false);
      return;
    }

    if (!formData.es_multisede && !formData.sede_id) {
      setError('Selecciona una sede (o marca multisede)'); 
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('https://padbol-backend.onrender.com/api/torneos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formData.nombre,
          sede_id: formData.es_multisede ? null : parseInt(formData.sede_id),
          nivel_torneo: formData.nivel_torneo,
          categoria: String(formData.categoria || '').trim() || CATEGORIA_TORNEO_DEFAULT,
          tipo_torneo: formData.tipo_torneo,
          fecha_inicio: formData.fecha_inicio,
          fecha_fin: formData.fecha_fin,
          cantidad_equipos: formData.cantidad_equipos ? parseInt(formData.cantidad_equipos) : null,
          es_multisede: formData.es_multisede,
          created_by: null,
        }),
      });

      const result = await response.json();
      console.log('Result recibido:', result);

      if (response.ok) {
        setMensaje('✅ Torneo creado correctamente');
        setTimeout(() => {
          navigate(`/torneo/${result[0].id}`);
        }, 1500);
      } else {
        setError(result.error || 'Error al crear torneo');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="torneo-crear-container" style={{ paddingTop: hubContentPaddingTopCss(location.pathname), paddingBottom: `${HUB_CONTENT_PADDING_BOTTOM_PX}px` }}>
      <AppHeader title="Crear torneo" />
      <div className="torneo-crear-card">
        <h1>🏆 Crear Nuevo Torneo</h1>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre del Torneo *</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Ej: Torneo La Meca 2026"
              required
            />
          </div>

          <div className="form-group">
            <label>Nivel *</label>
            <select name="nivel_torneo" value={formData.nivel_torneo} onChange={handleChange}>
              <option value="club">Club</option>
              <option value="club_no_oficial">Club No Oficial</option>
              {rol !== 'admin_club' && <option value="club_oficial">Club Oficial</option>}
              {rol !== 'admin_club' && <option value="nacional">Nacional</option>}
              {rol !== 'admin_club' && <option value="internacional">Internacional</option>}
              {rol !== 'admin_club' && <option value="mundial">Mundial</option>}
              {tiposCustom.length > 0 && <option disabled>──────────</option>}
              {tiposCustom.map(t => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
            {rol === 'admin_club' && (
              <small style={{ color: '#888', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                Los niveles Oficial, Nacional, Internacional y Mundial requieren permisos de Admin Nacional o Super Admin.
              </small>
            )}
          </div>

          <div className="form-group checkbox">
            <input
              type="checkbox"
              name="es_multisede"
              checked={formData.es_multisede}
              onChange={handleChange}
              id="multisede"
            />
            <label htmlFor="multisede">Multisede (varios países)</label>
          </div>

          {!formData.es_multisede && (
            <div className="form-group">
              <label>Sede *</label>
              <select name="sede_id" value={formData.sede_id} onChange={handleChange} required>
                <option value="">-- Selecciona Sede --</option>
                {sedes.map(sede => (
                  <option key={sede.id} value={sede.id}>
                    {sede.nombre} - {sede.ciudad}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Categoría *</label>
            <select name="categoria" value={formData.categoria} onChange={handleChange} required>
              {TORNEO_CATEGORIA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Formato *</label>
            <select name="tipo_torneo" value={formData.tipo_torneo} onChange={handleChange}>
              <option value="round_robin">Round Robin (todos vs todos)</option>
              <option value="knockout">Knockout (eliminación directa)</option>
              <option value="grupos_knockout">Grupos + Knockout</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Fecha Inicio *</label>
              <input
                type="date"
                name="fecha_inicio"
                value={formData.fecha_inicio}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Fecha Fin *</label>
              <input
                type="date"
                name="fecha_fin"
                value={formData.fecha_fin}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Cantidad de Equipos (opcional)</label>
            <input
              type="number"
              name="cantidad_equipos"
              value={formData.cantidad_equipos}
              onChange={handleChange}
              placeholder="Ej: 8"
              min="2"
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {mensaje && <div className="success-message">{mensaje}</div>}

          <button type="submit" disabled={loading} className="btn-submit">
            {loading ? 'Creando...' : '✅ Crear Torneo'}
          </button>
        </form>
      </div>
      <BottomNav />
    </div>
  );
}