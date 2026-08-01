import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PadbolBrandLogo from '../../components/PadbolBrandLogo';
import './adminVenueLanding.css';
import './adminVenueLandingOverrides.css';

const modules = [
  ['01', 'Configurá tu sede', 'Datos públicos, deportes, canchas, horarios, precios y medios de cobro.'],
  ['02', 'Operá reservas', 'Calendario, pagos, asistencia, reprogramaciones y reglas de cancelación.'],
  ['03', 'Activá jugadores', 'Vinculaciones, solicitudes, comunidad y comunicación desde una misma base.'],
  ['04', 'Creá competencia', 'Torneos, equipos, cupos, resultados y rankings de tu sede.'],
  ['05', 'Llevá el marcador', 'Iniciá, seguí, corregí y cerrá resultados para conectarlos con el historial.'],
  ['06', 'Fidelizá', 'PadCoins y membresías cuando estén habilitados para tu operación.'],
  ['07', 'Mostrá y vendé', 'Espacios de publicidad, sponsors y Paddle Match Shop cuando la sede los active.'],
];

const capturePlan = [
  ['CAP-01', 'Mi Sede', 'Información, canchas y fotos.'],
  ['CAP-02', 'Precios y horarios', 'Franja, duración y valor.'],
  ['CAP-03', 'Reservas', 'Calendario y estados.'],
  ['CAP-04', 'Jugadores', 'Vinculación y solicitudes.'],
  ['CAP-05', 'Torneos', 'Cupos, formato y detalle.'],
  ['CAP-06', 'Marcador', 'Partido en vivo y cierre.'],
  ['CAP-07', 'Fidelización', 'PadCoins y membresías.'],
  ['CAP-08', 'Comercial', 'Publicidad, sponsor y tienda.'],
];

function useDocumentMeta() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Administrá tu sede | Padbol Match';
    document.documentElement.classList.add('admin-landing-active');
    window.scrollTo(0, 0);
    return () => {
      document.title = previousTitle;
      document.documentElement.classList.remove('admin-landing-active');
    };
  }, []);
}

export default function AdminVenueLandingPage() {
  useDocumentMeta();
  return (
    <div className="admin-landing">
      <header className="admin-landing__header">
        <div className="admin-landing__shell admin-landing__header-inner">
          <Link to="/plataforma" aria-label="Ir a Padbol Match" className="admin-landing__brand">
            <PadbolBrandLogo variant="on-dark-tight" className="admin-landing__brand-logo" alt="Padbol Match" />
          </Link>
          <div className="admin-landing__header-actions">
            <a href="#recorrido" className="admin-landing__text-link">Cómo funciona</a>
            <Link to="/admin" className="admin-landing__login">Ingresar al panel</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="admin-landing__hero">
          <div className="admin-landing__shell admin-landing__hero-grid">
            <div>
              <p className="admin-landing__eyebrow">PADBOL MATCH / ADMINISTRADORES DE SEDE</p>
              <h1>Tu sede, <span>en orden</span> desde el primer día.</h1>
              <p className="admin-landing__lead">Configurá canchas, horarios y precios. Operá reservas, jugadores y torneos. Medí el juego y hacé crecer la comunidad desde un solo panel.</p>
              <div className="admin-landing__hero-actions">
                <a href="#recorrido" className="admin-landing__primary">Ver recorrido <span>↓</span></a>
                <a href="#asistente" className="admin-landing__secondary">Conocé la configuración guiada</a>
              </div>
            </div>
            <div className="admin-landing__hero-panel" aria-label="Ejemplo de tablero administrativo">
              <p className="admin-landing__panel-label">EJEMPLO VISUAL / REEMPLAZAR POR CAPTURA REAL</p>
              <div className="admin-landing__panel-title">Mi Sede <span>● En línea</span></div>
              <div className="admin-landing__metric-grid">
                <div><small>RESERVAS HOY</small><strong>12</strong></div>
                <div><small>CANCHAS ACTIVAS</small><strong>04</strong></div>
                <div><small>JUGADORES</small><strong>348</strong></div>
              </div>
              <div className="admin-landing__timeline"><i /><i /><i /><i /><i /></div>
              <p>Precios, disponibilidad, solicitudes y operación diaria conectados.</p>
            </div>
          </div>
        </section>

        <section className="admin-landing__section" id="recorrido">
          <div className="admin-landing__shell">
            <p className="admin-landing__eyebrow">RECORRIDO OPERATIVO</p>
            <h2>Todo lo que necesitás para <span>gestionar</span> una sede.</h2>
            <p className="admin-landing__intro">La guía está pensada para que una sede pueda arrancar simple, probar su circuito y activar cada módulo cuando le haga falta.</p>
            <div className="admin-landing__module-grid">
              {modules.map(([number, title, description]) => (
                <article key={number} className="admin-landing__module-card">
                  <span>{number}</span><h3>{title}</h3><p>{description}</p><b>Ver en el manual →</b>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="admin-landing__guided" id="asistente">
          <div className="admin-landing__shell admin-landing__guided-grid">
            <div>
              <p className="admin-landing__eyebrow">PRÓXIMO PASO / CONFIGURACIÓN GUIADA</p>
              <h2>Menos planillas. Más preguntas <span>claras.</span></h2>
              <p className="admin-landing__intro">La mejora recomendada es un asistente dentro del panel: pregunta una cosa por vez, valida lo que falta y muestra un resumen antes de guardar.</p>
              <ul className="admin-landing__check-list">
                <li>Nombre, país, moneda y deportes de la sede.</li>
                <li>Canchas, días, horarios y duración de cada turno.</li>
                <li>Precio por franja, cobro, señas y política de cancelación.</li>
                <li>Revisión final y publicación controlada.</li>
              </ul>
              <p className="admin-landing__note">Chivi puede asistir y abrir cada pantalla correcta; la sede conserva siempre la decisión y la confirmación final.</p>
            </div>
            <div className="admin-landing__conversation" aria-label="Ejemplo de asistente guiado">
              <p className="admin-landing__panel-label">ASISTENTE DE CONFIGURACIÓN</p>
              <div className="admin-landing__bubble admin-landing__bubble--bot">¿Qué valor tiene una hora de Cancha 1?</div>
              <div className="admin-landing__bubble admin-landing__bubble--user">ARS 28.000 de lunes a viernes.</div>
              <div className="admin-landing__bubble admin-landing__bubble--bot">Perfecto. ¿El precio cambia en horario pico o fines de semana?</div>
              <div className="admin-landing__confirmation">Antes de publicar: <strong>te mostramos el resumen y confirmás.</strong></div>
            </div>
          </div>
        </section>

        <section className="admin-landing__section admin-landing__section--captures">
          <div className="admin-landing__shell">
            <p className="admin-landing__eyebrow">MATERIAL PARA EL MANUAL</p>
            <h2>Capturas reales que hacen la guía <span>simple.</span></h2>
            <p className="admin-landing__intro">Estas piezas visuales reemplazan los ejemplos al tenerlas listas. No deben exponer teléfonos, mails, pagos ni datos personales de jugadores.</p>
            <div className="admin-landing__capture-grid">
              {capturePlan.map(([code, title, detail]) => <div key={code} className="admin-landing__capture"><b>{code}</b><strong>{title}</strong><span>{detail}</span></div>)}
            </div>
          </div>
        </section>

        <section className="admin-landing__cta">
          <div className="admin-landing__shell">
            <p className="admin-landing__eyebrow">OPERACIÓN ACOMPAÑADA</p>
            <h2>Tu sede no tiene que aprender todo de una vez.</h2>
            <p>Empezá por datos, canchas, horarios y reservas. El resto se activa según la operación real.</p>
            <div className="admin-landing__hero-actions"><Link to="/admin" className="admin-landing__primary">Ingresar al panel <span>→</span></Link><a href="/manual-administradores.pdf" className="admin-landing__secondary">Descargar manual PDF</a></div>
          </div>
        </section>
      </main>

      <footer className="admin-landing__footer"><div className="admin-landing__shell">© 2026 Padbol. Operated by <a href="https://padbol.com/company">Entertainment and Sports Services LLC</a>.</div></footer>
    </div>
  );
}
