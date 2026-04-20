import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Navigate, useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import { AppScreenHeaderBar } from '../components/AppUnifiedHeader';
import { readJugadorPerfil, persistJugadorPerfil, refreshJugadorPerfilFromSupabase } from '../utils/jugadorPerfil';

const API_BASE_URL = 'https://padbol-backend.onrender.com';

const CATEGORIAS = ['Principiante', '5ta', '4ta', '3ra', '2da', '1ra', 'Elite'];

const CATEGORIA_COLOR = {
  Principiante: '#78909c',
  '5ta':        '#43a047',
  '4ta':        '#039be5',
  '3ra':        '#8e24aa',
  '2da':        '#e53935',
  '1ra':        '#f57c00',
  Elite:        '#212121',
};

export default function MiPerfil({ currentCliente, onLogout, onClienteActualizado }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const fromTorneo = searchParams.get('from') === 'torneo';
  const torneoIdPerfil = searchParams.get('id');
  const fromEquipo = searchParams.get('from') === 'equipo';
  const equipoIdPerfil = searchParams.get('equipoId');
  const [perfil, setPerfil] = useState(null);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reservas, setReservas] = useState([]);
  const [editando, setEditando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [fotoPreview, setFotoPreview] = useState(null);
  const [fotoUploading, setFotoUploading] = useState(false);
  const fotoInputRef = useRef(null);
  const [cancelando, setCancelando] = useState(null); // reservaId being cancelled
  const [creditTotal, setCreditTotal] = useState(0);
  const [creditItems, setCreditItems] = useState([]);
  const [basicoNombre, setBasicoNombre] = useState('');
  const [basicoWhatsapp, setBasicoWhatsapp] = useState('');
  const [basicoEmail, setBasicoEmail] = useState('');
  const [savingBasicoTorneo, setSavingBasicoTorneo] = useState(false);
  const [errorMsgBasicoTorneo, setErrorMsgBasicoTorneo] = useState('');
  const [basicoCiudad, setBasicoCiudad] = useState('');
  const [basicoApellido, setBasicoApellido] = useState('');
  const [basicoCategoria, setBasicoCategoria] = useState('5ta');
  const [equipoTorneoIdResuelto, setEquipoTorneoIdResuelto] = useState(undefined);
  const [guestNombre, setGuestNombre] = useState('');
  const [guestApellido, setGuestApellido] = useState('');
  const [guestWhatsapp, setGuestWhatsapp] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestCategoria, setGuestCategoria] = useState('5ta');
  const [guestSaving, setGuestSaving] = useState(false);
  const [guestError, setGuestError] = useState('');

  const avisoPerfilTorneoMsg = useMemo(
    () =>
      (location.state && location.state.avisoPerfilTorneo) ||
      (fromTorneo ? 'Completa tu perfil para participar en torneos' : ''),
    [location.state, fromTorneo]
  );

  const [formData, setFormData] = useState({
    lateralidad: 'Diestro',
    nivel: '5ta',
    pais: '',
    ciudad: '',

    fecha_nacimiento: '',
    sede_id: '',
    numero_fipa: '',
    es_federado: false,
  });

  useEffect(() => {
    if (currentCliente) {
      setBasicoNombre(String(currentCliente.nombre || '').trim());
      setBasicoWhatsapp(String(currentCliente.whatsapp || '').trim());
      setBasicoEmail(String(currentCliente.email || '').trim());
    }
  }, [currentCliente]);

  useEffect(() => {
    if (!fromEquipo || !equipoIdPerfil || !/^\d+$/.test(String(equipoIdPerfil))) {
      setEquipoTorneoIdResuelto(undefined);
      return;
    }
    let cancelled = false;
    setEquipoTorneoIdResuelto(null);
    (async () => {
      const { data, error } = await supabase
        .from('equipos')
        .select('torneo_id')
        .eq('id', Number(equipoIdPerfil))
        .maybeSingle();
      if (cancelled) return;
      if (error || data?.torneo_id == null) setEquipoTorneoIdResuelto(false);
      else setEquipoTorneoIdResuelto(Number(data.torneo_id));
    })();
    return () => {
      cancelled = true;
    };
  }, [fromEquipo, equipoIdPerfil]);

  useEffect(() => {
    if (currentCliente) return;
    const p = readJugadorPerfil();
    if (!p) return;
    setGuestNombre(String(p.nombre || ''));
    setGuestApellido(String(p.apellido || ''));
    setGuestWhatsapp(String(p.whatsapp || ''));
    setGuestEmail(String(p.email || ''));
    setGuestCategoria(String(p.categoria || p.nivel || '5ta') || '5ta');
  }, [currentCliente, torneoIdPerfil, equipoIdPerfil]);

  useEffect(() => {
    if (!fromEquipo || !equipoIdPerfil) return;
    const p = readJugadorPerfil();
    if (!p) return;
    setBasicoApellido(String(p.apellido || ''));
    setBasicoCategoria(String(p.categoria || p.nivel || '5ta') || '5ta');
  }, [fromEquipo, equipoIdPerfil, currentCliente?.email]);

  useEffect(() => {
    if (!currentCliente?.email) {
      setLoading(false);
      return;
    }
    const saltoEquipoFicha =
      searchParams.get('from') === 'equipo' && searchParams.get('equipoId');
    if (saltoEquipoFicha) {
      setLoading(false);
      return;
    }
    fetchPerfil();
    fetchSedes();
    fetchReservas();
    fetchCreditos();
  }, [currentCliente?.email, location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPerfil = async () => {
    setLoading(true);
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout loading profile')), 8000)
      );
      const { data, error } = await Promise.race([
        supabase
          .from('jugadores_perfil')
          .select('*')
          .eq('email', currentCliente.email)
          .single(),
        timeoutPromise
      ]);

      if (!error && data) {
        setPerfil(data);
        setFormData({
          lateralidad: data.lateralidad || 'Diestro',
          nivel: data.nivel || '5ta',
          pais: data.pais || '',
          ciudad: data.ciudad || '',
          fecha_nacimiento: data.fecha_nacimiento || '',
          sede_id: data.sede_id ? String(data.sede_id) : '',
          numero_fipa: data.numero_fipa || '',
          es_federado: data.es_federado || false,
        });
        {
          const rawNom = String(data.nombre || '').trim();
          const parts = rawNom.split(/\s+/).filter(Boolean);
          persistJugadorPerfil({
            nombre: parts[0] || rawNom,
            apellido: parts.length > 1 ? parts.slice(1).join(' ') : '',
            categoria: String(data.nivel || '').trim(),
            whatsapp: String(currentCliente?.whatsapp || '').trim() || undefined,
            email: String(currentCliente?.email || '').trim() || undefined,
          });
        }
      }
    } catch (err) {
      // Profile is optional; silently fail if not found or network error
      console.log('[MiPerfil] fetchPerfil error (expected if no profile yet):', err.message);
    }
    setLoading(false);
  };

  const fetchSedes = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sedes`);
      if (res.ok) setSedes(await res.json() || []);
    } catch {
      // sedes optional — fail silently
    }
  };

  const fetchReservas = async () => {
    try {
      const { data } = await supabase
        .from('reservas')
        .select('id, sede, fecha, hora, cancha, estado, precio, moneda')
        .eq('email', currentCliente.email)
        .order('fecha', { ascending: false })
        .limit(20);
      setReservas(data || []);
    } catch {
      // fail silently
    }
  };

  const fetchCreditos = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/creditos/${encodeURIComponent(currentCliente.email)}`);
      if (!res.ok) return;
      const data = await res.json();
      setCreditTotal(data.total || 0);
      setCreditItems(data.creditos || []);
    } catch {
      // fail silently — credits are informational
    }
  };

  const handleFotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show local preview immediately
    setFotoPreview(URL.createObjectURL(file));
    setFotoUploading(true);
    setErrorMsg('');

    try {
      const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const fotoUrl = `https://vpldffhsxhgnmitiikof.supabase.co/storage/v1/object/public/avatars/${fileName}`;

      // Save URL to jugadores_perfil (upsert so it works even before full profile is saved)
      const { error: dbError } = perfil
        ? await supabase.from('jugadores_perfil').update({ foto_url: fotoUrl }).eq('email', currentCliente.email)
        : await supabase.from('jugadores_perfil').insert([{
            email: currentCliente.email,
            nombre: currentCliente.nombre,
            foto_url: fotoUrl,
          }]);

      if (dbError) throw dbError;

      await fetchPerfil();
    } catch (err) {
      setErrorMsg('Error al subir foto: ' + err.message);
      setFotoPreview(null);
    } finally {
      setFotoUploading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleGuardarBasicoTorneo = async (e) => {
    e.preventDefault();
    setErrorMsgBasicoTorneo('');
    const n = basicoNombre.trim();
    const w = basicoWhatsapp.trim();
    const em = (basicoEmail || currentCliente?.email || '').trim();
    if (!n) {
      setErrorMsgBasicoTorneo('El nombre es obligatorio');
      return;
    }
    if (!em && !w) {
      setErrorMsgBasicoTorneo('Indicá al menos email o WhatsApp');
      return;
    }
    const authEmail = String(currentCliente?.email || '').trim();
    if (!authEmail) {
      setErrorMsgBasicoTorneo('Iniciá sesión con un email para guardar tu perfil');
      return;
    }
    setSavingBasicoTorneo(true);
    const { error } = await supabase
      .from('clientes')
      .update({ nombre: n, whatsapp: w || null })
      .eq('email', authEmail);
    setSavingBasicoTorneo(false);
    if (error) {
      setErrorMsgBasicoTorneo('No se pudo guardar: ' + error.message);
      return;
    }
    const nextUser = {
      ...currentCliente,
      nombre: n,
      whatsapp: w || '',
      email: em || currentCliente.email,
    };
    onClienteActualizado?.(nextUser);
    await refreshJugadorPerfilFromSupabase(authEmail);
    const tid = String(torneoIdPerfil || '').trim();
    if (tid && /^\d+$/.test(tid)) {
      navigate(`/torneo/${tid}/equipos`, { replace: true });
    } else {
      navigate('/torneos', { replace: true });
    }
  };

  const handleGuardarEquipoFicha = async (e) => {
    e.preventDefault();
    setErrorMsgBasicoTorneo('');
    const n = basicoNombre.trim();
    const ape = basicoApellido.trim();
    const w = basicoWhatsapp.trim();
    const em = (basicoEmail || currentCliente?.email || '').trim();
    const ciudad = basicoCiudad.trim();
    const cat = String(basicoCategoria || '').trim();
    if (!n) {
      setErrorMsgBasicoTorneo('El nombre es obligatorio');
      return;
    }
    if (!ape) {
      setErrorMsgBasicoTorneo('El apellido es obligatorio');
      return;
    }
    if (!cat) {
      setErrorMsgBasicoTorneo('Seleccioná una categoría');
      return;
    }
    if (!em && !w) {
      setErrorMsgBasicoTorneo('Indicá al menos email o WhatsApp');
      return;
    }
    if (typeof equipoTorneoIdResuelto !== 'number') {
      setErrorMsgBasicoTorneo('No se pudo obtener el torneo');
      return;
    }
    const authEmail = String(currentCliente?.email || '').trim();
    if (!authEmail) {
      persistJugadorPerfil({
        nombre: n,
        apellido: ape,
        whatsapp: w || null,
        email: em || null,
        categoria: cat,
      });
      navigate(`/torneo/${equipoTorneoIdResuelto}/equipos`, { replace: true });
      return;
    }
    setSavingBasicoTorneo(true);
    const { error: errCliente } = await supabase
      .from('clientes')
      .update({ nombre: `${n} ${ape}`.trim(), whatsapp: w || null })
      .eq('email', authEmail);
    if (errCliente) {
      setSavingBasicoTorneo(false);
      setErrorMsgBasicoTorneo('No se pudo guardar: ' + errCliente.message);
      return;
    }
    const { data: filaPerfil } = await supabase
      .from('jugadores_perfil')
      .select('email')
      .eq('email', authEmail)
      .maybeSingle();
    const nombreDb = `${n} ${ape}`.trim();
    const payloadFicha = {
      nombre: nombreDb,
      whatsapp: w || null,
      ciudad: ciudad || null,
      nivel: cat,
    };
    let errPerfil = null;
    if (filaPerfil) {
      const { error } = await supabase.from('jugadores_perfil').update(payloadFicha).eq('email', authEmail);
      errPerfil = error;
    } else {
      const { error } = await supabase.from('jugadores_perfil').insert([
        {
          email: authEmail,
          nombre: nombreDb,
          whatsapp: w || null,
          ciudad: ciudad || null,
          lateralidad: 'Diestro',
          nivel: cat,
          pais: '🇦🇷 Argentina',
          pendiente_validacion: true,
        },
      ]);
      errPerfil = error;
    }
    setSavingBasicoTorneo(false);
    if (errPerfil) {
      setErrorMsgBasicoTorneo('No se pudo guardar la ficha: ' + errPerfil.message);
      return;
    }
    const nextUser = {
      ...currentCliente,
      nombre: nombreDb,
      whatsapp: w || '',
      email: em || currentCliente.email,
    };
    onClienteActualizado?.(nextUser);
    persistJugadorPerfil({
      nombre: n,
      apellido: ape,
      whatsapp: w || null,
      email: em || authEmail,
      categoria: cat,
    });
    navigate(`/torneo/${equipoTorneoIdResuelto}/equipos`, { replace: true });
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!formData.pais) { setErrorMsg('Seleccioná tu país'); return; }
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    const payload = {
      lateralidad: formData.lateralidad,
      nivel: formData.nivel,
      pendiente_validacion: true,
      pais: formData.pais,
      ciudad: formData.ciudad || null,

      fecha_nacimiento: formData.fecha_nacimiento || null,
      sede_id: formData.sede_id ? parseInt(formData.sede_id) : null,
      numero_fipa: formData.numero_fipa || null,
      es_federado: formData.es_federado,
    };

    const { error } = perfil
      ? await supabase.from('jugadores_perfil').update(payload).eq('email', currentCliente.email)
      : await supabase.from('jugadores_perfil').insert([{
          email: currentCliente.email,
          nombre: currentCliente.nombre,
          whatsapp: currentCliente.whatsapp || null,
          ...payload,
        }]);

    if (error) {
      setErrorMsg('Error al guardar: ' + error.message);
      setSaving(false);
      return;
    }

    await fetchPerfil();
    {
      const raw = String((currentCliente.nombre || perfil?.nombre || '')).trim();
      const parts = raw.split(/\s+/).filter(Boolean);
      persistJugadorPerfil({
        nombre: parts[0] || raw,
        apellido: parts.length > 1 ? parts.slice(1).join(' ') : '',
        categoria: String(formData.nivel || '').trim(),
        whatsapp: String(currentCliente.whatsapp || '').trim() || undefined,
        email: String(currentCliente.email || '').trim() || undefined,
      });
    }
    setSaving(false);
    setSuccessMsg('✅ Perfil guardado');
    setEditando(false);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleCancelar = async (r) => {
    if (!window.confirm('¿Cancelar reserva? Si faltan más de 24hs recibirás un crédito.')) return;
    setCancelando(r.id);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/cancelar-reserva`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservaId: r.id, email: currentCliente.email }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error al cancelar');
      if (data.credito) {
        alert(`✅ Reserva cancelada. Se acreditaron $${Number(data.credito.monto).toLocaleString('es-AR')} en tu cuenta (válido 30 días).`);
      } else {
        alert('✅ Reserva cancelada. La cancelación fue realizada con menos de 24hs de anticipación — no genera crédito.');
      }
      await fetchReservas();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setCancelando(null);
    }
  };

  const sedeNombre = (id) => {
    const sede = sedes.find(s => String(s.id) === String(id));
    return sede ? sede.nombre : '—';
  };

  const handleGuestRegistro = (e) => {
    e.preventDefault();
    setGuestError('');
    const n = guestNombre.trim();
    const a = guestApellido.trim();
    const w = guestWhatsapp.trim();
    const em = guestEmail.trim();
    const cat = String(guestCategoria || '').trim();
    if (!n || !a) {
      setGuestError('Nombre y apellido son obligatorios');
      return;
    }
    if (!cat) {
      setGuestError('Seleccioná una categoría');
      return;
    }
    if (!w && !em) {
      setGuestError('Indicá al menos WhatsApp o email');
      return;
    }
    setGuestSaving(true);
    persistJugadorPerfil({
      nombre: n,
      apellido: a,
      whatsapp: w || null,
      email: em || null,
      categoria: cat,
    });
    setGuestSaving(false);
    if (fromEquipo && typeof equipoTorneoIdResuelto === 'number') {
      navigate(`/torneo/${equipoTorneoIdResuelto}/equipos`, { replace: true });
    } else if (fromTorneo && torneoIdPerfil && /^\d+$/.test(String(torneoIdPerfil))) {
      navigate(`/torneo/${torneoIdPerfil}/equipos`, { replace: true });
    } else {
      navigate('/torneos', { replace: true });
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px', marginBottom: '6px',
    border: '1px solid #ddd', borderRadius: '5px',
    boxSizing: 'border-box', fontSize: '14px', background: 'white',
  };
  const labelStyle = {
    display: 'block', fontWeight: 'bold',
    marginBottom: '5px', color: '#333', fontSize: '13px',
  };

  if (!currentCliente && fromEquipo && equipoIdPerfil && /^\d+$/.test(String(equipoIdPerfil))) {
    if (equipoTorneoIdResuelto === null) {
      return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: 'Arial' }}>
          <AppScreenHeaderBar backTo="/torneos" title="Registro" />
          <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.92)' }}>Cargando…</div>
        </div>
      );
    }
    if (equipoTorneoIdResuelto === false) {
      return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: 'Arial' }}>
          <AppScreenHeaderBar backTo="/torneos" title="Registro" />
          <div style={{ maxWidth: '520px', margin: '0 auto', padding: '20px', color: 'white', textAlign: 'center' }}>
            No se encontró el equipo.
          </div>
        </div>
      );
    }
  }

  if (!currentCliente && (fromTorneo || fromEquipo)) {
    const backTo =
      fromEquipo && typeof equipoTorneoIdResuelto === 'number'
        ? `/torneo/${equipoTorneoIdResuelto}/equipos`
        : fromTorneo && torneoIdPerfil && /^\d+$/.test(String(torneoIdPerfil))
          ? `/torneo/${torneoIdPerfil}/equipos`
          : '/torneos';
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: 'Arial' }}>
        <AppScreenHeaderBar backTo={backTo} title="Mi perfil" />
        <div style={{ maxWidth: '520px', margin: '0 auto', padding: '20px' }}>
          {avisoPerfilTorneoMsg ? (
            <div
              style={{
                marginBottom: '14px',
                padding: '12px 14px',
                background: '#fef9c3',
                border: '1px solid #fde047',
                borderRadius: '10px',
                color: '#854d0e',
                fontSize: '14px',
                fontWeight: 600,
                lineHeight: 1.45,
              }}
            >
              {avisoPerfilTorneoMsg}
            </div>
          ) : null}
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '22px 20px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
            }}
          >
            <h4 style={{ margin: '0 0 14px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>
              Registro de jugador
            </h4>
            <form onSubmit={handleGuestRegistro}>
              <label style={labelStyle}>Nombre *</label>
              <input
                value={guestNombre}
                onChange={(e) => setGuestNombre(e.target.value)}
                style={{ ...inputStyle, marginBottom: '14px' }}
                autoComplete="given-name"
              />
              <label style={labelStyle}>Apellido *</label>
              <input
                value={guestApellido}
                onChange={(e) => setGuestApellido(e.target.value)}
                style={{ ...inputStyle, marginBottom: '14px' }}
                autoComplete="family-name"
              />
              <label style={labelStyle}>Categoría *</label>
              <select
                value={guestCategoria}
                onChange={(e) => setGuestCategoria(e.target.value)}
                style={{ ...inputStyle, marginBottom: '14px' }}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <label style={labelStyle}>WhatsApp</label>
              <input
                value={guestWhatsapp}
                onChange={(e) => setGuestWhatsapp(e.target.value)}
                style={{ ...inputStyle, marginBottom: '14px' }}
                autoComplete="tel"
              />
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                style={{ ...inputStyle, marginBottom: '14px' }}
                autoComplete="email"
              />
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: 0, marginBottom: '12px' }}>
                Indicá al menos WhatsApp o email.
              </p>
              {guestError ? <p style={{ color: '#b91c1c', marginBottom: '12px', fontSize: '14px' }}>{guestError}</p> : null}
              <button
                type="submit"
                disabled={guestSaving}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#d32f2f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  opacity: guestSaving ? 0.65 : 1,
                }}
              >
                {guestSaving ? 'Guardando…' : 'Guardar y continuar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (!currentCliente) {
    return (
      <Navigate to={`/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`} replace />
    );
  }

  if (!currentCliente?.email) {
    return <Navigate to={`/login?redirect=${encodeURIComponent('/perfil')}`} replace />;
  }

if (loading) {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: 'Arial' }}>
      <AppScreenHeaderBar backTo="/" title="Perfil" onLogout={onLogout} />
      <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.8)' }}>
        Cargando perfil...
      </div>
    </div>
  );
}

  const equipoEquipoIdOk =
    fromEquipo &&
    equipoIdPerfil &&
    /^\d+$/.test(String(equipoIdPerfil));

  if (currentCliente && equipoEquipoIdOk) {
    if (equipoTorneoIdResuelto === null) {
      return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: 'Arial' }}>
          <AppScreenHeaderBar backTo="/torneos" title="Completa tus datos para participar" onLogout={onLogout} />
          <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.92)' }}>Cargando…</div>
        </div>
      );
    }
    if (equipoTorneoIdResuelto === false) {
      return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: 'Arial' }}>
          <AppScreenHeaderBar backTo="/" title="Completa tus datos para participar" onLogout={onLogout} />
          <div style={{ maxWidth: '520px', margin: '0 auto', padding: '20px', color: 'white', textAlign: 'center' }}>
            No se encontró el equipo.
          </div>
        </div>
      );
    }
    const tidEq = equipoTorneoIdResuelto;
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: 'Arial' }}>
        <AppScreenHeaderBar
          backTo={`/torneo/${tidEq}/equipos`}
          title="Completa tus datos para participar"
          onLogout={onLogout}
        />
        <div style={{ maxWidth: '520px', margin: '0 auto', padding: '20px' }}>
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '22px 20px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
            }}
          >
            <h4 style={{ margin: '0 0 14px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>
              Ficha de jugador para torneo
            </h4>
            <form onSubmit={handleGuardarEquipoFicha}>
              <label style={labelStyle}>Nombre *</label>
              <input
                value={basicoNombre}
                onChange={(e) => setBasicoNombre(e.target.value)}
                style={{ ...inputStyle, marginBottom: '14px' }}
                placeholder="Tu nombre"
                autoComplete="name"
              />
              <label style={labelStyle}>Apellido *</label>
              <input
                value={basicoApellido}
                onChange={(e) => setBasicoApellido(e.target.value)}
                style={{ ...inputStyle, marginBottom: '14px' }}
                placeholder="Tu apellido"
                autoComplete="family-name"
              />
              <label style={labelStyle}>Categoría *</label>
              <select
                value={basicoCategoria}
                onChange={(e) => setBasicoCategoria(e.target.value)}
                style={{ ...inputStyle, marginBottom: '14px' }}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={basicoEmail}
                onChange={(e) => setBasicoEmail(e.target.value)}
                style={{ ...inputStyle, marginBottom: '14px' }}
                placeholder="tu@email.com"
                autoComplete="email"
              />
              <label style={labelStyle}>WhatsApp</label>
              <input
                value={basicoWhatsapp}
                onChange={(e) => setBasicoWhatsapp(e.target.value)}
                style={{ ...inputStyle, marginBottom: '14px' }}
                placeholder="Ej: +54 9 11 1234-5678"
                autoComplete="tel"
              />
              <label style={labelStyle}>Ciudad (opcional)</label>
              <input
                value={basicoCiudad}
                onChange={(e) => setBasicoCiudad(e.target.value)}
                style={{ ...inputStyle, marginBottom: '14px' }}
                placeholder="Ej: Buenos Aires"
              />
              {errorMsgBasicoTorneo ? (
                <p style={{ color: '#b91c1c', marginBottom: '12px', fontSize: '14px' }}>{errorMsgBasicoTorneo}</p>
              ) : null}
              <button
                type="submit"
                disabled={savingBasicoTorneo}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#d32f2f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  opacity: savingBasicoTorneo ? 0.65 : 1,
                }}
              >
                {savingBasicoTorneo ? 'Guardando…' : 'Guardar y volver al torneo'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

const paisParts = (perfil?.pais || '').split(' ');
const paisFlag = paisParts[0];
const paisNombre = paisParts.slice(1).join(' ');
const categoriaColor = CATEGORIA_COLOR[perfil?.nivel] || '#999';

return (
  <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', fontFamily: 'Arial' }}>

    <AppScreenHeaderBar
      backTo={fromTorneo && torneoIdPerfil && /^\d+$/.test(String(torneoIdPerfil)) ? `/torneo/${torneoIdPerfil}/equipos` : '/'}
      title="Perfil"
      onLogout={onLogout}
    />

    <div style={{ maxWidth: '520px', margin: '0 auto', padding: '20px' }}>
      {!fromEquipo && avisoPerfilTorneoMsg ? (
        <div
          style={{
            marginBottom: '14px',
            padding: '12px 14px',
            background: '#fef9c3',
            border: '1px solid #fde047',
            borderRadius: '10px',
            color: '#854d0e',
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: 1.45,
          }}
        >
          {avisoPerfilTorneoMsg}
        </div>
      ) : null}

      {fromTorneo && torneoIdPerfil && /^\d+$/.test(String(torneoIdPerfil)) ? (
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: '22px 20px',
            marginBottom: '16px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          }}
        >
          <h4 style={{ margin: '0 0 14px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>
            Datos para crear tu equipo
          </h4>
          <form onSubmit={handleGuardarBasicoTorneo}>
            <label style={labelStyle}>Nombre *</label>
            <input
              value={basicoNombre}
              onChange={(e) => setBasicoNombre(e.target.value)}
              style={{ ...inputStyle, marginBottom: '14px' }}
              placeholder="Tu nombre"
              autoComplete="name"
            />

            <label style={labelStyle}>WhatsApp (opcional)</label>
            <input
              value={basicoWhatsapp}
              onChange={(e) => setBasicoWhatsapp(e.target.value)}
              style={{ ...inputStyle, marginBottom: '14px' }}
              placeholder="Ej: +54 9 11 1234-5678"
              autoComplete="tel"
            />

            {!String(currentCliente.email || '').trim() ? (
              <>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={basicoEmail}
                  onChange={(e) => setBasicoEmail(e.target.value)}
                  style={{ ...inputStyle, marginBottom: '14px' }}
                  placeholder="tu@email.com"
                  autoComplete="email"
                />
              </>
            ) : null}

            {errorMsgBasicoTorneo ? (
              <p style={{ color: '#b91c1c', marginBottom: '12px', fontSize: '14px' }}>{errorMsgBasicoTorneo}</p>
            ) : null}

            <button
              type="submit"
              disabled={savingBasicoTorneo}
              style={{
                width: '100%',
                padding: '12px',
                background: '#d32f2f',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                opacity: savingBasicoTorneo ? 0.65 : 1,
              }}
            >
              {savingBasicoTorneo ? 'Guardando…' : 'Guardar y volver al torneo'}
            </button>
          </form>
        </div>
      ) : null}

      <div style={{ background: 'white', borderRadius: '12px', padding: '30px 24px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', marginBottom: '16px', textAlign: 'center' }}>
        {/* Photo */}
        {(() => {
          const src = fotoPreview || perfil?.foto_url || currentCliente.foto;
          const circle = (
            <div style={{ position: 'relative', width: '150px', margin: '0 auto 14px', display: 'inline-block' }}>
              {src ? (
                <img
                  src={src}
                  alt="Foto"
                  style={{ width: '150px', height: '150px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #d32f2f', display: 'block' }}
                />
              ) : (
                <div style={{ width: '150px', height: '150px', borderRadius: '50%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px', border: '3px solid #d32f2f' }}>
                  👤
                </div>
              )}              {editando && (
                <div
                  onClick={() => !fotoUploading && fotoInputRef.current?.click()}
                  style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: fotoUploading ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.35)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: fotoUploading ? 'default' : 'pointer',
                    color: 'white', fontSize: '12px', fontWeight: 'bold', gap: '4px',
                  }}
                >
                  {fotoUploading ? (
                    <span>Subiendo...</span>
                  ) : (
                    <>
                      <span style={{ fontSize: '24px' }}>📷</span>
                      <span>Cambiar foto</span>
                    </>
                  )}
                </div>
              )}
            </div>
          );
          return circle;
        })()}
        <input
          ref={fotoInputRef}
          type="file"
          accept="image/*"
          onChange={handleFotoChange}
          style={{ display: 'none' }}
        />

        <h3 style={{ margin: '0 0 6px', fontSize: '22px', color: '#222' }}>{currentCliente.nombre}</h3>

        {perfil?.pais && (
          <p style={{ margin: '0 0 4px', fontSize: '16px' }}>
            {paisFlag} <span style={{ color: '#555', fontSize: '14px' }}>{paisNombre}</span>
          </p>
        )}
        {perfil?.ciudad && (
          <p style={{ margin: '0 0 3px', color: '#777', fontSize: '13px' }}>📍 {perfil.ciudad}</p>
        )}
        {perfil?.sede_id && (
          <p style={{ margin: '0', color: '#777', fontSize: '13px' }}>🏟️ {sedeNombre(perfil.sede_id)}</p>
        )}

        {/* Badges */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          {perfil?.nivel && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', color: 'white', background: categoriaColor }}>
              {perfil.nivel}
              {perfil.pendiente_validacion && (
                <span title="Pendiente de validación por administrador" style={{ fontSize: '11px', background: 'rgba(255,255,255,0.25)', borderRadius: '10px', padding: '1px 6px' }}>
                  ⏳ pendiente
                </span>
              )}
            </span>
          )}
          {perfil?.lateralidad && <Badge text={perfil.lateralidad} color="#555" />}
          {perfil?.es_federado && <Badge text="Federado" color="#388e3c" />}
          {perfil?.numero_fipa && <Badge text={`FIPA ${perfil.numero_fipa}`} color="#7b1fa2" />}
        </div>

        {successMsg && <p style={{ color: '#4caf50', fontWeight: 'bold', marginTop: '14px', marginBottom: 0 }}>{successMsg}</p>}
      </div>

      {/* Ficha detail card */}
      <div style={{ background: '#f9f9f9', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '16px' }}>

        {!perfil && !editando ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <p style={{ color: '#666', marginBottom: '16px' }}>Aún no tienes ficha de jugador creada.</p>
            <button
              onClick={() => setEditando(true)}
              style={{ padding: '12px 24px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              🏆 Crear ficha de jugador
            </button>
          </div>

        ) : !editando ? (
          <>
            <h4 style={{ margin: '0 0 14px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>Datos del jugador</h4>
            <div style={{ display: 'grid', gap: '2px', marginBottom: '18px' }}>
              <Row label="Categoría" value={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 'bold', color: categoriaColor }}>{perfil.nivel}</span>
                  {perfil.pendiente_validacion && (
                    <span title="Pendiente de validación" style={{ fontSize: '11px', background: '#fff3cd', color: '#856404', border: '1px solid #ffc107', borderRadius: '10px', padding: '1px 7px' }}>
                      ⏳ pendiente
                    </span>
                  )}
                </span>
              } />
              <Row label="Lateralidad" value={perfil.lateralidad} />
              {perfil.fecha_nacimiento && <Row label="Fecha de nacimiento" value={perfil.fecha_nacimiento} />}
              {perfil.sede_id && <Row label="Club al que representa" value={sedeNombre(perfil.sede_id)} />}
              {perfil.numero_fipa && <Row label="N° FIPA" value={perfil.numero_fipa} />}
              <Row label="Federado" value={perfil.es_federado ? '✅ Sí' : '❌ No'} />
            </div>
            <button
              onClick={() => setEditando(true)}
              style={{ width: '100%', padding: '11px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✏️ Editar perfil
            </button>
          </>

        ) : (
          <form onSubmit={handleGuardar}>
            <h4 style={{ margin: '0 0 16px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>Editar datos</h4>

            <label style={labelStyle}>Lateralidad</label>
            <select name="lateralidad" value={formData.lateralidad} onChange={handleChange} style={{ ...inputStyle, marginBottom: '14px' }}>
              <option value="Diestro">🤜 Diestro</option>
              <option value="Zurdo">🤛 Zurdo</option>
            </select>

            <label style={labelStyle}>Categoría</label>
            <select name="nivel" value={formData.nivel} onChange={handleChange} style={inputStyle}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <p style={{ color: '#f59e0b', fontSize: '12px', marginTop: '2px', marginBottom: '14px' }}>
              ⏳ La categoría será validada por un administrador
            </p>

            <label style={labelStyle}>País *</label>
            <select name="pais" value={formData.pais} onChange={handleChange} style={{ ...inputStyle, marginBottom: '14px' }} required>
              <option value="">— Seleccionar país —</option>
              <optgroup label="Principales">
                {PAISES_TELEFONO_PRINCIPALES.map(p => (
                  <option key={p.nombre} value={`${p.bandera} ${p.nombre}`}>{p.bandera} {p.nombre}</option>
                ))}
              </optgroup>
              <optgroup label="Otros países">
                {PAISES_TELEFONO_OTROS.map(p => (
                  <option key={p.nombre} value={`${p.bandera} ${p.nombre}`}>{p.bandera} {p.nombre}</option>
                ))}
              </optgroup>
            </select>

            <label style={labelStyle}>Ciudad</label>
            <input type="text" name="ciudad" placeholder="Ej: Buenos Aires" value={formData.ciudad} onChange={handleChange} style={{ ...inputStyle, marginBottom: '14px' }} />

            <label style={labelStyle}>Fecha de nacimiento</label>
            <input type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleChange} style={{ ...inputStyle, marginBottom: '14px' }} />

            <label style={labelStyle}>Club al que representa</label>
            <select name="sede_id" value={formData.sede_id} onChange={handleChange} style={{ ...inputStyle, marginBottom: '14px' }}>
              <option value="">— Seleccionar club —</option>
              {sedes.map(s => <option key={s.id} value={String(s.id)}>{s.nombre}</option>)}
            </select>

            <label style={labelStyle}>N° FIPA (número de federación)</label>
            <input type="text" name="numero_fipa" placeholder="Ej: 12345" value={formData.numero_fipa} onChange={handleChange} style={{ ...inputStyle, marginBottom: '14px' }} />

            <label style={{ ...labelStyle, marginBottom: '8px' }}>¿Sos federado?</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
              <button type="button" onClick={() => setFormData(prev => ({ ...prev, es_federado: true }))}
                style={{ flex: 1, padding: '10px', border: '2px solid', borderColor: formData.es_federado ? '#388e3c' : '#ddd', background: formData.es_federado ? '#e8f5e9' : 'white', color: formData.es_federado ? '#388e3c' : '#666', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                ✅ Sí
              </button>
              <button type="button" onClick={() => setFormData(prev => ({ ...prev, es_federado: false }))}
                style={{ flex: 1, padding: '10px', border: '2px solid', borderColor: !formData.es_federado ? '#d32f2f' : '#ddd', background: !formData.es_federado ? '#fff3f3' : 'white', color: !formData.es_federado ? '#d32f2f' : '#666', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                ❌ No
              </button>
            </div>

            {errorMsg && <p style={{ color: 'red', marginBottom: '10px' }}>{errorMsg}</p>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={saving}
                style={{ flex: 1, padding: '11px', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Guardando...' : '✅ Guardar'}
              </button>
              <button type="button" onClick={() => { setEditando(false); setErrorMsg(''); setFotoPreview(null); }}
                style={{ flex: 1, padding: '11px', background: 'transparent', color: '#666', border: '1px solid #ccc', borderRadius: '5px', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Credit balance */}
      {creditTotal > 0 && (
        <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 14px', color: '#15803d', borderBottom: '1px solid #bbf7d0', paddingBottom: '8px' }}>💰 Créditos disponibles</h4>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#16a34a', marginBottom: creditItems.length ? '14px' : 0 }}>
            ${creditTotal.toLocaleString('es-AR')} <span style={{ fontSize: '14px', fontWeight: 600, color: '#4ade80' }}>ARS</span>
          </div>
          {creditItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {creditItems.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#166534', background: 'white', borderRadius: '6px', padding: '6px 10px' }}>
                  <span>📅 {new Date(c.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  <span style={{ fontWeight: 700 }}>+${Number(c.monto).toLocaleString('es-AR')}</span>
                  <span style={{ color: '#86efac' }}>vence {new Date(c.vence_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {reservas.length > 0 && (() => {
        const sedeFav = (() => {
          const counts = {};
          reservas.forEach(r => { counts[r.sede] = (counts[r.sede] || 0) + 1; });
          return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
        })();
        return (
          <div style={{ background: '#f9f9f9', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 14px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>📊 Estadísticas</h4>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '120px', background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#d32f2f' }}>{reservas.length}</div>
                <div style={{ fontSize: '12px', color: '#777', marginTop: '2px' }}>Reservas totales</div>
              </div>
              {sedeFav && (
                <div style={{ flex: 2, minWidth: '160px', background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e1b4b', lineHeight: 1.3 }}>{sedeFav}</div>
                  <div style={{ fontSize: '12px', color: '#777', marginTop: '2px' }}>Sede favorita</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Historial de Reservas */}
      <div style={{ background: '#f9f9f9', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 14px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>🗓️ Mis Reservas</h4>
        {reservas.length === 0 ? (
          <p style={{ color: '#aaa', textAlign: 'center', margin: '20px 0', fontSize: '14px' }}>Aún no tienes reservas registradas.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reservas.map(r => {
              const horasHasta = (new Date(`${r.fecha}T${r.hora}:00-03:00`) - Date.now()) / (1000 * 60 * 60);
              const canCancel = horasHasta > 2 && r.estado !== 'cancelada';
              return (
                <div key={r.id} style={{ background: 'white', borderRadius: '8px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e1b4b' }}>{r.sede}</div>
                    <div style={{ fontSize: '12px', color: '#777', marginTop: '2px' }}>📅 {r.fecha} &nbsp;⏰ {r.hora} &nbsp;🎾 Cancha {r.cancha}</div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    {r.precio > 0 && (
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#d32f2f' }}>
                        {Number(r.precio).toLocaleString('es-AR')} {r.moneda || 'ARS'}
                      </div>
                    )}
                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                      background: r.estado === 'confirmada' ? '#dcfce7' : r.estado === 'cancelada' ? '#fee2e2' : r.estado === 'test' ? '#f3f4f6' : '#fef9c3',
                      color: r.estado === 'confirmada' ? '#16a34a' : r.estado === 'cancelada' ? '#dc2626' : r.estado === 'test' ? '#6b7280' : '#854d0e',
                    }}>{r.estado || 'reservada'}</span>
                    {canCancel && (
                      <button
                        onClick={() => handleCancelar(r)}
                        disabled={cancelando === r.id}
                        style={{ fontSize: '11px', padding: '3px 8px', border: '1px solid #fca5a5', borderRadius: '6px', background: '#fff', color: '#dc2626', cursor: 'pointer', fontWeight: 600, opacity: cancelando === r.id ? 0.6 : 1 }}
                      >
                        {cancelando === r.id ? 'Cancelando...' : 'Cancelar'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historial de Torneos */}
      <div style={{ background: '#f9f9f9', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
        <h4 style={{ margin: '0 0 14px', color: '#333', borderBottom: '1px solid #e0e0e0', paddingBottom: '8px' }}>
          🏆 Historial de Torneos
        </h4>
        <p style={{ color: '#aaa', textAlign: 'center', margin: '20px 0', fontSize: '14px' }}>
          Aún no participaste en ningún torneo registrado.
        </p>
      </div>

      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #eee' }}>
      <span style={{ color: '#777', fontSize: '13px' }}>{label}</span>
      <span style={{ fontSize: '14px', color: '#333' }}>{value}</span>
    </div>
  );
}

function Badge({ text, color }) {
  return (
    <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', color: 'white', background: color }}>
      {text}
    </span>
  );
}
