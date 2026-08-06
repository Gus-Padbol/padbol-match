import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './adminVenueLanding.css';
import './adminVenueLandingOverrides.css';

// El Hub queda como área interna de la app. La captación de sedes entra al
// acceso autenticado y, tras validar la sesión, abre directamente el panel.
const ADMIN_PANEL_ACCESS_PATH = '/acceso?redirect=%2Fadmin';

const modules = [
  { number: '01', title: 'Configura tu sede', description: 'Datos públicos, deportes, canchas, horarios, precios y medios de cobro.', overview: 'Deja lista la base operativa de tu sede para que las personas puedan encontrarla, conocer sus canchas y reservar con información clara.', steps: ['Completa nombre, ubicación, contacto, moneda y deportes disponibles.', 'Carga cada cancha con su foto, tipo, duración de turno y condiciones de uso.', 'Define días, horarios, franjas de precio y reglas de cancelación.', 'Revisa el resumen y publica solamente cuando todos los datos estén correctos.'] },
  { number: '02', title: 'Opera reservas', description: 'Calendario, pagos, asistencia, reprogramaciones y reglas de cancelación.', overview: 'Controla la agenda diaria en un solo lugar: disponibilidad, cupos, confirmaciones y cambios de cada reserva.', steps: ['Revisa el calendario por cancha, día y franja horaria.', 'Confirma el grupo completo y habilita el cobro cuando corresponda.', 'Registra asistencia, reprogramaciones o cancelaciones con su motivo.', 'Consulta el estado final para que el historial de la sede quede actualizado.'] },
  { number: '03', title: 'Activa jugadores', description: 'Vinculaciones, solicitudes, comunidad y comunicación desde una misma base.', overview: 'Conecta a las personas que juegan en tu sede y usa la comunidad para que encuentren partidos, completen equipos y vuelvan a jugar.', steps: ['Revisa solicitudes de vinculación y aprueba únicamente las que correspondan.', 'Mantén actualizada la ficha deportiva de cada jugador.', 'Publica o acompaña partidos abiertos desde la comunidad.', 'Usa avisos y notificaciones para comunicar cambios importantes.'] },
  { number: '04', title: 'Crea competencia', description: 'Torneos, equipos, cupos, resultados y rankings de tu sede.', overview: 'Crea competencias con reglas visibles, cupos reales y resultados que alimentan la experiencia deportiva de cada participante.', steps: ['Elige deporte, formato, categoría, fechas, sede y cantidad de cupos.', 'Define equipos, precio, reglas de inscripción y condiciones de participación.', 'Publica el torneo y sigue las inscripciones desde el panel.', 'Usa el marcador para cerrar cada partido: el resultado se vincula automáticamente con el historial y el ranking.'] },
  { number: '05', title: 'Lleva el marcador', description: 'Inicia, sigue, corrige y cierra resultados para conectarlos con el historial.', overview: 'El marcador registra el partido mientras se juega y convierte el resultado final en información útil para jugadores, torneos y rankings.', steps: ['Selecciona el partido, los jugadores o equipos y abre el marcador.', 'Registra puntos, sets y parciales mientras el encuentro está en juego.', 'Corrige una acción si hace falta antes de cerrar el resultado.', 'Confirma el cierre para conectar el partido con historial, estadísticas y competencia.'] },
  { number: '06', title: 'Fideliza', description: 'PadCoins y membresías cuando estén habilitados para tu operación.', overview: 'Reconoce la participación y construye continuidad con beneficios, membresías y PadCoins configurados según las reglas de tu sede.', steps: ['Define qué beneficios quieres habilitar para tu comunidad.', 'Configura las reglas de membresía, vigencia y condiciones de uso.', 'Revisa movimientos y canjes antes de confirmarlos.', 'Comunica con claridad los beneficios disponibles para cada jugador.'] },
  { number: '07', title: 'Muestra y vende', description: 'Espacios de publicidad, sponsors y Padbol Match Shop cuando la sede los active.', overview: 'Gestiona oportunidades comerciales de la sede: espacios de marca y, cuando esté activado, productos locales de Padbol Match Shop.', steps: ['Define los espacios publicitarios o de sponsor disponibles en tu sede.', 'Carga las piezas, fechas y condiciones de cada campaña.', 'Activa productos, precios y stock local en Padbol Match Shop cuando corresponda.', 'Revisa resultados, pedidos y rendimiento sin afectar la operación deportiva.'] },
];

// Estructura de la guía visual que acompaña a los administradores. Estas
// tarjetas vuelven a hacer visible el alcance completo del manual: no son
// tareas internas ni reemplazan los módulos operativos de arriba.
const guideSections = [
  ['01', 'Mi sede', 'Datos públicos, canchas, imágenes y medios de contacto.'],
  ['02', 'Precios y horarios', 'Franjas, duración de turnos y valores por cancha.'],
  ['03', 'Reservas', 'Calendario, estados, confirmaciones y cancelaciones.'],
  ['04', 'Jugadores', 'Vinculaciones, solicitudes y comunidad de la sede.'],
  ['05', 'Torneos', 'Cupos, formato, inscripción, resultados y detalle.'],
  ['06', 'Marcador', 'Partido en vivo, correcciones y cierre del resultado.'],
  ['07', 'Fidelización', 'PadCoins y membresías habilitados para la sede.'],
  ['08', 'Comercial', 'Publicidad, sponsors y Padbol Match Shop.'],
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
  const [activeModule, setActiveModule] = useState(null);

  useEffect(() => {
    if (!activeModule) return undefined;
    const handleKeyDown = (event) => { if (event.key === 'Escape') setActiveModule(null); };
    const previousOverflow = document.body.style.overflow;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeModule]);

  const openModule = (module) => {
    setActiveModule(module);
  };
  return (
    <div className="admin-landing">
      <header className="admin-landing__header">
        <div className="admin-landing__shell admin-landing__header-inner">
          <Link to="/plataforma" aria-label="Ir a Padbol Match" className="admin-landing__brand">
            <img
              src="/media/public-site/jero/padbol-match-logo-white.svg"
              className="admin-landing__brand-logo"
              alt="Padbol Match"
            />
          </Link>
          <nav className="admin-landing__site-nav" aria-label="Navegación principal de Padbol Match">
            <Link to="/plataforma">Inicio</Link>
            <Link to="/plataforma#jugadores">Para jugadores</Link>
            <a href="#inicio" aria-current="page">Para sedes</a>
            <Link to="/contacto">Contacto</Link>
          </nav>
          <div className="admin-landing__header-actions">
            <a href="#recorrido" className="admin-landing__text-link">Cómo funciona</a>
            <Link to={ADMIN_PANEL_ACCESS_PATH} className="admin-landing__login">Ingresar al panel</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="admin-landing__hero" id="inicio">
          <div className="admin-landing__shell admin-landing__hero-grid">
            <div>
              <p className="admin-landing__eyebrow">PADBOL MATCH / PARA SEDES</p>
              <h1>Tu sede, <span>en orden</span> desde el primer día.</h1>
              <p className="admin-landing__lead">Configura canchas, horarios y precios. Opera reservas, jugadores y torneos. Mide el juego y haz crecer la comunidad desde un solo panel.</p>
              <div className="admin-landing__hero-actions">
                <Link to="/unirse" className="admin-landing__primary">Ver planes <span>→</span></Link>
                <Link to="/contacto" className="admin-landing__secondary">Hablar con nosotros</Link>
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
              {modules.map((module) => (
                <button
                  key={module.number}
                  type="button"
                  className="admin-landing__module-card"
                  onClick={() => openModule(module)}
                >
                  <span>{module.number}</span><h3>{module.title}</h3><p>{module.description}</p><b>Ver explicación y opciones <i>→</i></b>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="admin-landing__guided" id="asistente">
          <div className="admin-landing__shell admin-landing__guided-grid">
            <div>
              <p className="admin-landing__eyebrow">CONFIGURACIÓN GUIADA CON CHIVI</p>
              <h2>Menos planillas. Más preguntas <span>claras.</span></h2>
              <p className="admin-landing__intro">Chivi acompaña la configuración desde el panel, por texto o por voz: pregunta una cosa por vez, valida lo que falta y muestra un resumen antes de guardar.</p>
              <div className="admin-landing__assistant-features" aria-label="Funciones de Chivi">
                <span>◉ Por voz o texto</span><span>✓ Valida datos</span><span>→ Abre el módulo correcto</span>
              </div>
              <ul className="admin-landing__check-list">
                <li>Nombre, país, moneda y deportes de la sede.</li>
                <li>Canchas, días, horarios y duración de cada turno.</li>
                <li>Precio por franja, cobro, señas y política de cancelación.</li>
                <li>Revisión final y publicación controlada.</li>
              </ul>
              <p className="admin-landing__note"><strong>Así funciona:</strong> dices o escribes lo que necesitas configurar; Chivi te lleva a la pantalla correcta, ordena las respuestas y solicita confirmación final. La sede conserva siempre la decisión y el guardado.</p>
            </div>
            <div className="admin-landing__conversation" aria-label="Ejemplo de asistente guiado">
              <p className="admin-landing__panel-label">CHIVI / ASISTENTE DE CONFIGURACIÓN</p>
              <div className="admin-landing__bubble admin-landing__bubble--bot">¿Qué valor tiene una hora de Cancha 1?</div>
              <div className="admin-landing__bubble admin-landing__bubble--user">ARS 28.000 de lunes a viernes.</div>
              <div className="admin-landing__bubble admin-landing__bubble--bot">Perfecto. ¿El precio cambia en horario pico o fines de semana?</div>
              <div className="admin-landing__confirmation">Antes de publicar: <strong>te mostramos el resumen y confirmás.</strong></div>
            </div>
          </div>
        </section>

        <section className="admin-landing__section admin-landing__section--guide">
          <div className="admin-landing__shell">
            <p className="admin-landing__eyebrow">GUÍA VISUAL PARA ADMINISTRADORES</p>
            <h2>Todo el panel, explicado de forma <span>simple.</span></h2>
            <p className="admin-landing__intro">Además de los recorridos paso a paso, la guía reúne ejemplos claros de cada pantalla para que puedas resolver la operación de tu sede con autonomía.</p>
            <div className="admin-landing__capture-grid">
              {guideSections.map(([number, title, detail]) => (
                <article key={number} className="admin-landing__capture">
                  <b>GUÍA {number}</b><strong>{title}</strong><span>{detail}</span>
                </article>
              ))}
            </div>
            <div className="admin-landing__guide-actions">
              <p>La configuración guiada está disponible al activar tu sede.</p>
              <a href="#recorrido" className="admin-landing__text-link">Volver a los módulos operativos ↑</a>
            </div>
          </div>
        </section>

        <section className="admin-landing__cta">
          <div className="admin-landing__shell">
            <p className="admin-landing__eyebrow">OPERACIÓN ACOMPAÑADA</p>
            <h2>Tu sede no tiene que aprender todo de una vez.</h2>
            <p>Empieza por datos, canchas, horarios y reservas. El resto se activa según la operación real.</p>
            <div className="admin-landing__hero-actions"><Link to="/unirse" className="admin-landing__primary">Elegir mi plan <span>→</span></Link><Link to="/contacto" className="admin-landing__secondary">Hablar con nosotros</Link></div>
          </div>
        </section>
      </main>

      {activeModule && (
        <div className="admin-landing__modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveModule(null); }}>
          <section className="admin-landing__modal" role="dialog" aria-modal="true" aria-labelledby={`admin-module-${activeModule.number}`}>
            <button type="button" className="admin-landing__modal-close" onClick={() => setActiveModule(null)} aria-label="Cerrar explicación">×</button>
            <p className="admin-landing__eyebrow">MÓDULO {activeModule.number} / PARA SEDES</p>
            <h2 id={`admin-module-${activeModule.number}`}>{activeModule.title}</h2>
            <p className="admin-landing__modal-copy">{activeModule.overview}</p>
            <div className="admin-landing__modal-steps">
              <p>ASÍ FUNCIONA</p>
              <ol className="admin-landing__steps">
                {activeModule.steps.map((step, index) => (
                  <li key={step}><span>{String(index + 1).padStart(2, '0')}</span>{step}</li>
                ))}
              </ol>
            </div>
          </section>
        </div>
      )}

      <footer className="admin-landing__footer">
        <div className="admin-landing__shell">
          <div className="admin-landing__footer-top">
            <div className="admin-landing__footer-brand">
              <img src="/media/public-site/jero/padbol-match-logo-white.svg" className="admin-landing__footer-logo" alt="Padbol Match" />
              <a href="https://padbol.com" className="admin-landing__footer-padbol-lockup" aria-label="Visitar Padbol">
                <span className="admin-landing__footer-padbol-mark" aria-hidden="true"><i /><i /><i /></span>
                <span>PADBOL</span>
              </a>
              <p className="admin-landing__footer-product-of">Un producto de Padbol.</p>
              <p className="admin-landing__footer-developed-by">Desarrollado por Padbol Internacional.</p>
              <Link to="/contacto" className="admin-landing__footer-contact">¿Necesitás ayuda? Contactanos <span>→</span></Link>
            </div>

            <nav className="admin-landing__footer-nav" aria-label="Navegación de Padbol Match">
              <div>
                <p>PLATAFORMA</p>
                <Link to="/plataforma">Conoce Padbol Match</Link>
                <a href="#recorrido">Administrá tu sede</a>
                <Link to={ADMIN_PANEL_ACCESS_PATH}>Ingresar al panel</Link>
              </div>
              <div>
                <p>RECURSOS</p>
                <a href="#asistente">Configuración guiada con Chivi</a>
                <a href="#recorrido">Módulos para tu sede</a>
                <Link to="/contacto">Soporte</Link>
              </div>
              <div>
                <p>INFORMACIÓN</p>
                <Link to="/terminos">Términos y condiciones</Link>
                <Link to="/privacidad">Política de privacidad</Link>
                <Link to="/eliminar-cuenta">Eliminar cuenta</Link>
              </div>
            </nav>
          </div>

          <div className="admin-landing__footer-bottom">
            <p>© 2026 Padbol. Operated by <a href="https://padbol.com/company">Entertainment and Sports Services LLC</a>.</p>
            <span>Padbol Match · Gestión deportiva conectada</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
