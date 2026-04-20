import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import '../styles/ReservaForm.css';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import { AppScreenHeaderBack } from '../components/AppUnifiedHeader';

// Returns the correct price for a given sede + time slot.
// Falls back to precio_por_reserva / precio_turno if no differentiated prices are configured.
function getPrecio(sede, hora) {
  const base = Number(sede?.precio_por_reserva || sede?.precio_turno || 0);
  if (!hora || !sede) return base;
  const h = parseInt(hora.split(':')[0], 10);
  return h < 16
    ? Number(sede.precio_manana || base)
    : Number(sede.precio_tarde  || base);
}

function primerTelefonoCliente(c) {
  if (!c) return '';
  return String(c.whatsapp || c.telefono || '').trim();
}

function clienteTieneTelefonoGuardado(c) {
  return Boolean(primerTelefonoCliente(c));
}

/** Mínimo de dígitos (sin contar +) para considerar un teléfono válido al confirmar pago */
const MIN_DIGITOS_TELEFONO = 8;

/** Perfil con teléfono/WhatsApp con cantidad de dígitos suficiente (no se re-evalúa en cada tecla del resumen). */
function perfilTelefonoValido(c) {
  const raw = primerTelefonoCliente(c);
  if (!raw) return false;
  const digits = String(raw).replace(/\D/g, '');
  return digits.length >= MIN_DIGITOS_TELEFONO;
}

function telefonoPagoResuelto(currentCliente, formData) {
  const desdePerfil = primerTelefonoCliente(currentCliente).replace(/[\s\-().]/g, '');
  const ingresado = `${formData.codigoPais}${formData.numeroTel.replace(/[\s\-().]/g, '')}`;
  const whatsappCompleto = formData.numeroTel.trim() ? ingresado : desdePerfil;
  const digits = String(whatsappCompleto).replace(/\D/g, '');
  if (digits.length < MIN_DIGITOS_TELEFONO) {
    return { ok: false, whatsappCompleto: '', digits: 0 };
  }
  return { ok: true, whatsappCompleto, digits };
}

function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Pantalla 2 solo si ?sedeId= en la URL o ultima_sede en localStorage; sin ambos → pantalla 1 (país/ciudad se completan al cargar sedes). */
function readPrimedSedeReserva() {
  const emptyFiltros = { pais: '', ciudad: '', sede_id: '' };
  if (typeof window === 'undefined') return { pantalla: 1, filtros: emptyFiltros };
  try {
    const params = new URLSearchParams(window.location.search);
    const sedeIdFromUrl = params.get('sedeId')?.trim() || null;
    const sedeIdLS = localStorage.getItem('ultima_sede')?.trim() || null;
    const sedeId = sedeIdFromUrl;
    if (!sedeId && sedeIdLS) {
      const id = parseInt(String(sedeIdLS), 10);
      if (Number.isNaN(id)) return { pantalla: 1, filtros: emptyFiltros };
      return { pantalla: 2, filtros: { ...emptyFiltros, sede_id: id } };
    }
    if (sedeId) {
      const id = parseInt(String(sedeId), 10);
      if (Number.isNaN(id)) return { pantalla: 1, filtros: emptyFiltros };
      return { pantalla: 2, filtros: { ...emptyFiltros, sede_id: id } };
    }
    return { pantalla: 1, filtros: emptyFiltros };
  } catch {
    return { pantalla: 1, filtros: emptyFiltros };
  }
}

export default function ReservaForm({ currentCliente, apiBaseUrl = 'https://padbol-backend.onrender.com' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const requireAuth = () => {
    if ((currentCliente?.email || '').trim()) return true;
    const redirect = `${location.pathname}${location.search}`;
    navigate(`/login?redirect=${encodeURIComponent(redirect)}`);
    return false;
  };

  const initialSedeId = searchParams.get('sedeId');

  const [sedes, setSedes] = useState([]);
  const [paises, setPaises] = useState([]);
  const [ciudades, setCiudades] = useState([]);
  const [sedesFiltradasPorCiudad, setSedesFiltradasPorCiudad] = useState([]);

  const [filtros, setFiltros] = useState(() => readPrimedSedeReserva().filtros);
  const [pantalla, setPantalla] = useState(() => readPrimedSedeReserva().pantalla);

  const [formData, setFormData] = useState(() => {
    const p = readPrimedSedeReserva();
    return {
      fecha: p.pantalla === 2 ? todayLocalISO() : '',
      hora: '',
      cancha: '',
      codigoPais: '+54',
      numeroTel: '',
    };
  });

  const fechaInputRef = useRef(null);

  // Pre-fill phone from profile (whatsapp o teléfono) — split código país + local
  useEffect(() => {
    const raw = primerTelefonoCliente(currentCliente);
    if (!raw) return;
    const allPaises = [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS];
    const sorted = [...allPaises].sort((a, b) => b.codigo.length - a.codigo.length);
    const match = sorted.find(p => raw.startsWith(p.codigo));
    if (match) {
      setFormData(prev => ({ ...prev, codigoPais: match.codigo, numeroTel: raw.slice(match.codigo.length) }));
    } else {
      setFormData(prev => ({ ...prev, numeroTel: raw }));
    }
  }, [currentCliente]); // eslint-disable-line react-hooks/exhaustive-deps

  const [horariosDisponibles, setHorariosDisponibles] = useState([]);
  const [canchasDisponibles, setCanchasDisponibles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [mpLoading, setMpLoading] = useState(false);
  /** Número local en pantalla resumen — controlado aparte de formData para no re-disparar efectos al escribir */
  const [whatsapp, setWhatsapp] = useState('');

  useEffect(() => {
    if (pantalla < 2) return;
    if ((currentCliente?.email || '').trim()) return;
    const redirect = `${location.pathname}${location.search}`;
    navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
  }, [pantalla, currentCliente?.email, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (pantalla !== 4) return;
    setWhatsapp(formData.numeroTel || '');
  }, [pantalla]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select + auto-advance when only one court is free
  useEffect(() => {
    if (!canchasDisponibles.length || pantalla !== 2) return;
    const libres = canchasDisponibles.filter(c => c.libre);
    if (libres.length === 1) {
      setFormData(prev => ({ ...prev, cancha: String(libres[0].num) }));
      setPantalla(4);
      setError('');
    }
  }, [canchasDisponibles]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/sedes`)
      .then(res => res.json())
      .then(data => {
        setSedes(data || []);
        const paisesUnicos = [...new Set(data.map(s => s.pais))].sort();
        setPaises(paisesUnicos);
      })
      .catch(err => setError('Error al cargar sedes'));
  }, [apiBaseUrl]);

  // Completar país/ciudad y fijar pantalla 2 cuando hay ?sedeId= o ultima_sede (misma prioridad que el arranque sincrónico).
  useEffect(() => {
    if (sedes.length === 0) return;

    const sedeIdFromUrl =
      initialSedeId && String(initialSedeId).trim() ? String(initialSedeId).trim() : null;
    const sedeIdLS =
      typeof localStorage !== 'undefined' ? localStorage.getItem('ultima_sede')?.trim() || null : null;
    const sedeId = sedeIdFromUrl;

    let targetRaw = null;
    if (sedeId) {
      targetRaw = sedeId;
    } else if (!sedeId && sedeIdLS) {
      targetRaw = sedeIdLS;
    }
    if (!targetRaw) return;

    const id = parseInt(String(targetRaw), 10);
    if (Number.isNaN(id)) return;

    const sede = sedes.find((s) => Number(s.id) === id);
    if (!sede) {
      if (!sedeIdFromUrl && sedeIdLS) {
        try {
          localStorage.removeItem('ultima_sede');
          localStorage.removeItem('ultima_sede_nombre');
        } catch (_) { /* ignore */ }
      }
      setFiltros({ pais: '', ciudad: '', sede_id: '' });
      setPantalla(1);
      return;
    }

    const ciudadesDelPais = [...new Set(sedes.filter(s => s.pais === sede.pais).map(s => s.ciudad))].sort();
    const sedesDeLaCiudad = sedes.filter(s => s.pais === sede.pais && s.ciudad === sede.ciudad);
    setCiudades(ciudadesDelPais);
    setSedesFiltradasPorCiudad(sedesDeLaCiudad);
    setFiltros({ pais: sede.pais, ciudad: sede.ciudad, sede_id: Number(sede.id) });
    if (!(currentCliente?.email || '').trim()) {
      const redirect = `${location.pathname}${location.search}`;
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    setPantalla(2);
    setFormData((prev) =>
      prev.fecha
        ? prev
        : { ...prev, fecha: todayLocalISO(), hora: '', cancha: '' }
    );
  }, [sedes, initialSedeId, currentCliente?.email, location.pathname, location.search, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load time slots when date is selected
  useEffect(() => {
    console.log('[ReservaForm] Date change effect - pantalla:', pantalla, 'fecha:', formData.fecha, 'sedeId:', filtros.sede_id, 'sedeSeleccionada:', sedeSeleccionada?.nombre);
    if (pantalla !== 2 || !formData.fecha) return;
    if (!sedeSeleccionada) return;
    console.log('[ReservaForm] Triggering buscarHorariosDisponibles for fecha:', formData.fecha);
    buscarHorariosDisponibles(formData.fecha);
  }, [formData.fecha, pantalla, filtros.sede_id, sedes]); // eslint-disable-line react-hooks/exhaustive-deps


  const handleChangePais = (e) => {
    const pais = e.target.value;
    setFiltros({ pais, ciudad: '', sede_id: '' });
    setCiudades([]);
    setSedesFiltradasPorCiudad([]);

    if (pais) {
      const ciudadesDelPais = [...new Set(
        sedes.filter(s => s.pais === pais).map(s => s.ciudad)
      )].sort();
      setCiudades(ciudadesDelPais);
    }
  };

  const handleChangeCiudad = (e) => {
    const ciudad = e.target.value;
    setFiltros(prev => ({ ...prev, ciudad, sede_id: '' }));

    if (ciudad) {
      const sedesDeLaCiudad = sedes.filter(
        s => s.pais === filtros.pais && s.ciudad === ciudad
      );
      setSedesFiltradasPorCiudad(sedesDeLaCiudad);
    } else {
      setSedesFiltradasPorCiudad([]);
    }
  };

  const handleChangeSede = (e) => {
    const sede_id = parseInt(e.target.value);
    setFiltros(prev => ({ ...prev, sede_id }));
    if (sede_id) {
      if (!requireAuth()) return;
      setPantalla(2);
      setError('');
    }
  };

  const siguientePantalla2 = () => {
    if (!filtros.sede_id) {
      setError('Selecciona una sede');
      return;
    }
    if (!requireAuth()) return;
    setPantalla(2);
    setError('');
  };

  const buscarHorariosDisponibles = async (fecha) => {
    if (!fecha || !sedeSeleccionada) {
      console.log('[ReservaForm] buscarHorariosDisponibles early return - fecha:', fecha, 'sedeSeleccionada:', sedeSeleccionada?.nombre);
      return;
    }

    console.log('[ReservaForm] buscarHorariosDisponibles fetching for sede:', sedeSeleccionada.nombre, 'fecha:', fecha);
    setLoading(true);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/disponibilidad/${sedeSeleccionada.nombre}/${fecha}`
      );
      const reservadas = await response.json();
      console.log('[ReservaForm] buscarHorariosDisponibles got response:', reservadas);

      const sedeData = sedeSeleccionada;

      // Parse opening/closing times with defensive checks
      let horaApertura = 10; // default: 10 AM
      let horaCierre = 23;   // default: 11 PM

      try {
        if (sedeData.horario_apertura) {
          const apertura = parseInt(sedeData.horario_apertura.split(':')[0], 10);
          if (!isNaN(apertura)) horaApertura = apertura;
        }
      } catch (e) {
        console.log('[ReservaForm] Could not parse horario_apertura, using default:', horaApertura);
      }

      try {
        if (sedeData.horario_cierre) {
          const cierre = parseInt(sedeData.horario_cierre.split(':')[0], 10);
          if (!isNaN(cierre)) horaCierre = cierre;
        }
      } catch (e) {
        console.log('[ReservaForm] Could not parse horario_cierre, using default:', horaCierre);
      }

      const duracion = sedeData.duracion_reserva_minutos || 90;
      const cantidadCanchas = sedeData.cantidad_canchas || 2;

      console.log('[ReservaForm] Schedule config - opening:', horaApertura, 'closing:', horaCierre, 'duration:', duracion, 'courts:', cantidadCanchas);

      const todosLosHorarios = [];

      // Generate all possible time slots based on club schedule
      for (let h = horaApertura; h < horaCierre; h++) {
        for (let m = 0; m < 60; m += duracion) {
          // Check if slot fits within business hours
          const slotEndMinutes = m + duracion;
          const slotEndHours = h + Math.floor(slotEndMinutes / 60);
          const slotEndMins = slotEndMinutes % 60;

          // Only add if slot ends by closing time
          if (slotEndHours < horaCierre || (slotEndHours === horaCierre && slotEndMins === 0)) {
            const horaInicio = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
            const hFin = slotEndHours;
            const mFin = slotEndMins;
            const horaFin = String(hFin).padStart(2, '0') + ':' + String(mFin).padStart(2, '0');

            // Count reservations for this time slot
            const ocupadas = Array.isArray(reservadas) ? reservadas.filter(
              r => r.hora === horaInicio
            ).length : 0;
            const libres = cantidadCanchas - ocupadas;

            // Add slot only if at least one court is available
            if (libres > 0) {
              todosLosHorarios.push({
                horario: `${horaInicio} - ${horaFin}`,
                hora: horaInicio,
                libres,
                ocupadas,
              });
            }
          }
        }
      }

      console.log('[ReservaForm] Generated', todosLosHorarios.length, 'available time slots');
      setHorariosDisponibles(todosLosHorarios);

      // If no slots found, log full diagnostics
      if (todosLosHorarios.length === 0) {
        console.log('[ReservaForm] WARNING: No time slots generated. Debug info:', {
          horaApertura, horaCierre, duracion, cantidadCanchas,
          reservadasCount: Array.isArray(reservadas) ? reservadas.length : 'NaN',
          fechaSelected: fecha
        });
      }
    } catch (err) {
      console.error('[ReservaForm] Error in buscarHorariosDisponibles:', err);
      setError('Error al buscar disponibilidad');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeFecha = (e) => {
    const fecha = e.target.value;
    console.log('[ReservaForm] handleChangeFecha called with fecha:', fecha);
    console.log('[ReservaForm]  Current state - pantalla:', pantalla, 'filtros.sede_id:', filtros.sede_id, 'sedes.length:', sedes.length);
    console.log('[ReservaForm]  sedeSeleccionada at call time:', sedeSeleccionada?.nombre || sedeSeleccionada);
    setFormData(prev => ({
      ...prev,
      fecha,
      hora: '',
      cancha: '',
    }));
    setHorariosDisponibles([]);
    setCanchasDisponibles([]);
    // Note: buscarHorariosDisponibles will be triggered automatically by the useEffect
    // that watches formData.fecha; no need to call it directly here to avoid race conditions
  };

  const handleChangeHora = (e) => {
    const hora = e.target.value;
    setFormData(prev => ({
      ...prev,
      hora,
      cancha: '',
    }));
    buscarCanchasDisponibles(hora);
  };

  const buscarCanchasDisponibles = async (hora) => {
    if (!hora || !formData.fecha) return;

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/disponibilidad/${sedeSeleccionada.nombre}/${formData.fecha}`
      );
      const reservadas = await response.json();

      const ocupadas = Array.isArray(reservadas) ? reservadas.filter(r => r.hora === hora).map(r => r.cancha) : [];
      const total = sedeSeleccionada.cantidad_canchas || 2;

      setCanchasDisponibles(
        Array.from({ length: total }, (_, i) => ({ num: i + 1, libre: !ocupadas.includes(i + 1) }))
      );
    } catch (err) {
      setError('Error al buscar canchas disponibles');
    }
  };

  const siguientePantalla3 = () => {
    if (!requireAuth()) return;
    if (!formData.fecha || !formData.hora) {
      setError('Selecciona Fecha y Horario');
      return;
    }
    setPantalla(3);
    setError('');
  };

  const siguientePantalla4 = () => {
    if (!requireAuth()) return;
    if (!formData.cancha) {
      setError('Selecciona una cancha');
      return;
    }
    setPantalla(4);
    setError('');
  };

  const sedeSeleccionada =
    Array.isArray(sedes) && sedes.length > 0 && filtros.sede_id !== '' && filtros.sede_id != null
      ? sedes.find((s) => Number(s.id) === Number(filtros.sede_id))
      : null;

  useEffect(() => {
    if (pantalla !== 2 || !sedeSeleccionada) return;
    const t = window.setTimeout(() => {
      const el = fechaInputRef.current;
      if (!el) return;
      try {
        el.focus({ preventScroll: true });
      } catch {
        el.focus();
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [pantalla, sedeSeleccionada?.id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePagarConMP = async () => {
    if (!requireAuth()) return;
    const usaWhatsappResumen = !perfilTelefonoValido(currentCliente);
    const formParaTel = usaWhatsappResumen ? { ...formData, numeroTel: whatsapp } : formData;
    const { ok, whatsappCompleto } = telefonoPagoResuelto(currentCliente, formParaTel);
    if (!ok) {
      setError(
        clienteTieneTelefonoGuardado(currentCliente)
          ? 'El teléfono del perfil no es válido. Completá un número de contacto válido.'
          : `Ingresá un número de WhatsApp válido (al menos ${MIN_DIGITOS_TELEFONO} dígitos).`
      );
      return;
    }

    setMpLoading(true);
    setError('');

    const precio = getPrecio(sedeSeleccionada, formData.hora);
    const creditoAplicado = 0;
    const precioFinal = Math.max(0, precio - creditoAplicado);
    const reservaData = {
      sede: sedeSeleccionada.nombre,
      fecha: formData.fecha,
      hora: formData.hora,
      cancha: parseInt(formData.cancha),
      nombre: currentCliente.nombre,
      email: currentCliente.email,
      whatsapp: whatsappCompleto,
      nivel: 'Principiante',
      precio,
      moneda: sedeSeleccionada.moneda || 'ARS',
      creditUsed: creditoAplicado,
    };

    try {
      const res = await fetch(`${apiBaseUrl}/api/crear-preferencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: `Cancha ${formData.cancha} — ${sedeSeleccionada.nombre}`,
          precio: precioFinal,
          moneda: sedeSeleccionada.moneda || 'ARS',
          sedeNombre: sedeSeleccionada.nombre,
          sedeId: sedeSeleccionada.id,
          reservaData,
        }),
      });
      const data = await res.json();
      console.log('[MP preferencia / pago]', {
        merchant_name: data.merchant_name ?? data.merchantName ?? data.merchant?.name,
        description: data.description ?? data.body?.description,
        response: data,
      });
      if (res.ok && data.init_point) {
        localStorage.setItem('ultima_sede', String(filtros.sede_id));
        window.location.href = data.init_point;
      } else {
        setError(data.error || 'No se pudo iniciar el pago');
        setMpLoading(false);
      }
    } catch (err) {
      setError('Error al conectar con Mercado Pago: ' + err.message);
      setMpLoading(false);
    }
  };

  // PANTALLA 1: País, Ciudad, Sede
  if (pantalla === 1) {
    return (
      <div className="reserva-container">
        <AppScreenHeaderBack to="/home" title="Reservar cancha" />
        <div className="reserva-card">
          <h1 style={{ margin: 0, marginBottom: '20px' }}>🎾 Reserva tu Cancha de PADBOL</h1>

          <form>
            <div className="form-group">
              <label>País:</label>
              <select
                value={filtros.pais}
                onChange={handleChangePais}
                required
              >
                <option value="">-- Selecciona País --</option>
                {paises.map(pais => (
                  <option key={pais} value={pais}>{pais}</option>
                ))}
              </select>
            </div>

            {filtros.pais && (
              <div className="form-group">
                <label>Ciudad:</label>
                <select
                  value={filtros.ciudad}
                  onChange={handleChangeCiudad}
                  required
                >
                  <option value="">-- Selecciona Ciudad --</option>
                  {ciudades.map(ciudad => (
                    <option key={ciudad} value={ciudad}>{ciudad}</option>
                  ))}
                </select>
              </div>
            )}

            {filtros.ciudad && (
              <div className="form-group">
                <label>Sede:</label>
                <select
                  value={filtros.sede_id}
                  onChange={handleChangeSede}
                  required
                >
                  <option value="">-- Selecciona Sede --</option>
                  {sedesFiltradasPorCiudad.map(sede => (
                    <option key={sede.id} value={sede.id}>{sede.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {error && <div className="error-message">{error}</div>}

            {filtros.sede_id && (
              <button type="button" onClick={() => navigate(`/sede/${filtros.sede_id}`)} style={{
                width: '100%',
                padding: '12px',
                background: '#d32f2f',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginTop: '20px',
              }}>
                Ver sede →
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  // PANTALLA 2: Fecha y Horario
  if (pantalla === 2) {
    return (
      <div className="reserva-container">
        <AppScreenHeaderBack to="/home" title="Reservar cancha" />
        <div className="reserva-card">
          <h1 style={{ margin: 0, marginBottom: '20px' }}>
            📅 {sedeSeleccionada?.nombre || 'Cargando sede…'}
          </h1>

          {sedeSeleccionada && (
          <p style={{ color: '#666', marginBottom: '30px', textAlign: 'center' }}>
            {sedeSeleccionada.ciudad}, {sedeSeleccionada.pais}
            {sedeSeleccionada.precio_manana && sedeSeleccionada.precio_tarde
              ? ` • 🌅 $${Number(sedeSeleccionada.precio_manana).toLocaleString('es-AR')} / 🌆 $${Number(sedeSeleccionada.precio_tarde).toLocaleString('es-AR')} ${sedeSeleccionada.moneda || 'ARS'}`
              : ` • $${Number(sedeSeleccionada.precio_por_reserva || sedeSeleccionada.precio_turno || 0).toLocaleString('es-AR')} ${sedeSeleccionada.moneda || 'ARS'}`
            }
          </p>
          )}

          <form>
            <div className="form-group">
              <label>Fecha:</label>
              <input
                ref={fechaInputRef}
                type="date"
                name="fecha"
                value={formData.fecha}
                onChange={handleChangeFecha}
                disabled={!sedeSeleccionada}
                required
              />
            </div>

            {horariosDisponibles.length > 0 && (
              <div className="form-group reserva-horario-bloque">
                <label>Horario (con canchas libres):</label>
                <select
                  name="hora"
                  value={formData.hora}
                  onChange={handleChangeHora}
                  required
                  className="reserva-select-horario"
                >
                  <option value="">-- Selecciona Horario --</option>
                  {horariosDisponibles.map((h, idx) => (
                    <option key={idx} value={h.hora}>
                      {h.horario}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.fecha && horariosDisponibles.length === 0 && loading === false && (
              <div className="error-message">No hay horarios disponibles para esta fecha</div>
            )}

            {/* Price badge — shown as soon as a time is selected */}
            {formData.hora && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '12px 0', padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#0369a1' }}>
                  💰 {Number(getPrecio(sedeSeleccionada, formData.hora)).toLocaleString('es-AR')} {sedeSeleccionada?.moneda || 'ARS'}
                </span>
                {sedeSeleccionada?.precio_manana && sedeSeleccionada?.precio_tarde && (
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    {parseInt(formData.hora.split(':')[0], 10) < 16 ? '🌅 Tarifa mañana' : '🌆 Tarifa tarde/noche'}
                  </span>
                )}
              </div>
            )}

            {/* Court availability buttons — shown after hora is selected */}
            {formData.hora && canchasDisponibles.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', fontWeight: 600, color: '#333', marginBottom: '10px' }}>Elige tu cancha:</label>
                <div className="reserva-canchas-botones">
                  {canchasDisponibles.map(c => (
                    <button
                      key={c.num}
                      type="button"
                      disabled={!c.libre}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, cancha: String(c.num) }));
                        setPantalla(4);
                        setError('');
                      }}
                      style={{
                        padding: '14px 18px', textAlign: 'left', fontWeight: 700, fontSize: '14px',
                        borderRadius: '10px', cursor: c.libre ? 'pointer' : 'not-allowed',
                        border: `2px solid ${c.libre ? '#16a34a' : '#dc2626'}`,
                        background: c.libre ? '#f0fdf4' : '#fef2f2',
                        color: c.libre ? '#15803d' : '#dc2626',
                        opacity: c.libre ? 1 : 0.65,
                        marginBottom: '2px',
                      }}
                    >
                      Cancha {c.num} {c.libre ? '✅ Disponible' : '🔴 Reservada'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <div className="error-message">{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  // PANTALLA 4: Resumen + pago
  if (pantalla === 4) {
    const precio = getPrecio(sedeSeleccionada, formData.hora);
    const moneda = sedeSeleccionada?.moneda || 'ARS';
    const muestraInputWhatsappResumen = !perfilTelefonoValido(currentCliente);

    return (
      <div className="reserva-container">
        <AppScreenHeaderBack to="/home" title="Reservar cancha" />
        <div className="reserva-card">
          <h1 style={{ margin: 0, marginBottom: '20px' }}>🎾 Resumen de reserva</h1>

          <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <p style={{ margin: '0 0 8px' }}><strong>📍 Sede:</strong> {sedeSeleccionada?.nombre}</p>
            <p style={{ margin: '0 0 8px' }}><strong>📅 Fecha:</strong> {formData.fecha}</p>
            <p style={{ margin: '0 0 8px' }}><strong>🕐 Hora:</strong> {formData.hora}</p>
            <p style={{ margin: '0 0 8px' }}><strong>🏟️ Cancha:</strong> {formData.cancha}</p>
            <p style={{ margin: '0 0 8px' }}><strong>👤 Jugador:</strong> {currentCliente?.nombre}</p>
            <p style={{ margin: '0 0 8px' }}><strong>📧 Email:</strong> {currentCliente?.email}</p>
            {precio ? (
              <p style={{ margin: '12px 0 0', fontSize: '18px', fontWeight: 800, color: '#d32f2f' }}>
                💰 {Number(precio).toLocaleString('es-AR')} {moneda}
              </p>
            ) : null}
          </div>

          {muestraInputWhatsappResumen && (
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label>💬 WhatsApp para confirmación *</label>
              <div className="phone-field">
                <select
                  value={formData.codigoPais}
                  onChange={(e) => setFormData((prev) => ({ ...prev, codigoPais: e.target.value }))}
                >
                  <optgroup label="Principales">
                    {PAISES_TELEFONO_PRINCIPALES.map(p => (
                      <option key={p.nombre} value={p.codigo}>{p.bandera} {p.codigo}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Otros">
                    {PAISES_TELEFONO_OTROS.map(p => (
                      <option key={p.nombre} value={p.codigo}>{p.bandera} {p.codigo} {p.nombre}</option>
                    ))}
                  </optgroup>
                </select>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="9 11 2345 6789"
                />
              </div>
              {whatsapp ? (
                <small className="phone-preview">
                  Número completo: {formData.codigoPais}{whatsapp.replace(/[\s\-().]/g, '')}
                </small>
              ) : null}
            </div>
          )}

          <div style={{
            margin: '0 0 16px',
            padding: '12px 14px',
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#78350f',
            lineHeight: 1.6,
          }}
          >
            <strong>📋 Política de cancelación</strong><br />
            ✅ Más de 24hs de anticipación: crédito total<br />
            ❌ Menos de 24hs de anticipación: sin devolución
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="button"
            onClick={handlePagarConMP}
            disabled={mpLoading}
            style={{
              width: '100%',
              padding: '14px',
              background: mpLoading ? '#aaa' : 'linear-gradient(135deg, #009ee3 0%, #0077c8 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: mpLoading ? 'not-allowed' : 'pointer',
              boxShadow: '0 3px 12px rgba(0,158,227,0.4)',
              marginBottom: '12px',
            }}
          >
            {mpLoading ? 'Procesando...' : 'Pagar con Mercado Pago'}
          </button>
        </div>
      </div>
    );
  }
}
