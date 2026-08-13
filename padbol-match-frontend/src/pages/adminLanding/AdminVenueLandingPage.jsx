import React, { useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicSiteLayout from '../publicSite/PublicSiteLayout';
import dataOwnershipVisual from '../../assets/data-ownership-visual.png';
import '../publicSite/publicSite.css';
import './adminVenueLanding.css';
import './adminVenueLandingOverrides.css';

// El Hub queda como área interna de la app. La captación de sedes entra al
// acceso autenticado y, tras validar la sesión, abre directamente el panel.
const ADMIN_PANEL_ACCESS_PATH = '/acceso?redirect=%2Fadmin';

const modules = [
  { number: '01', title: 'TORNEOS QUE SE ORDENAN', description: 'Definís formato, categorías, cupos y fechas. El fixture genera los cruces y deja la competencia lista para jugar.' },
  { number: '02', title: 'CADA PARTIDO YA TIENE MARCADOR', description: 'Cada cruce del fixture llega preparado para registrar puntos, sets y resultado durante el juego.' },
  { number: '03', title: 'RESULTADOS QUE SIGUEN TRABAJANDO', description: 'Al cerrar un partido, se actualizan tablas, llaves, historial y ranking: no hay planillas paralelas.' },
  { number: '04', title: 'MÁS REGRESO, NO SOLO MÁS TURNOS', description: 'Con PadCoins, beneficios, membresías y campañas temporales, la sede crea razones reales para volver.' },
  { number: '05', title: 'UNA COMUNIDAD QUE COMPLETA EQUIPOS', description: 'Jugadores vinculados, partidos abiertos, inscripciones y lista de espera convierten interés en actividad.' },
  { number: '06', title: 'TU SEDE GANA PRESENCIA', description: 'Torneos, campañas, sponsors y propuestas activas hacen visible lo que pasa en tu sede, dentro y fuera de la cancha.' },
];

function useDocumentMeta() {
  useLayoutEffect(() => {
    const previousTitle = document.title;
    const previousScrollRestoration = window.history.scrollRestoration;
    document.title = 'Administra tu sede | Padbol Match';
    // La landing de sedes es una sección de la web pública: comparte el mismo
    // documento, header, ancho y comportamiento responsive que /plataforma.
    document.documentElement.classList.add('public-site-active', 'admin-landing-active');
    // No reutilizar el desplazamiento (incluido X) de otra pantalla pública al
    // volver a esta ruta. La landing siempre empieza desde su composición.
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    // Esta ruta no tiene ningún contenido desplazable en X. Safari puede
    // conservar o recuperar una posición horizontal anterior al volver a la
    // página; la normalizamos de forma explícita para que nunca abra corrida.
    let frameId = null;
    const resetTimers = [];
    const resetHorizontalScroll = () => {
      if (window.scrollX === 0 && document.documentElement.scrollLeft === 0 && document.body.scrollLeft === 0) return;
      window.scrollTo({ left: 0, top: window.scrollY, behavior: 'auto' });
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
    };
    const handleScroll = () => {
      if (frameId != null) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        resetHorizontalScroll();
      });
    };
    const scheduleHorizontalReset = () => {
      // Safari puede restaurar la posición al terminar de pintar, después del
      // primer frame de React. Repetimos el mismo ajuste brevemente solo al
      // entrar para que jamás quede fija una vista corrida.
      [0, 80, 260, 700].forEach((delay) => {
        resetTimers.push(window.setTimeout(resetHorizontalScroll, delay));
      });
    };

    window.scrollTo({ left: 0, top: 0, behavior: 'auto' });
    scheduleHorizontalReset();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pageshow', scheduleHorizontalReset);
    window.visualViewport?.addEventListener('scroll', scheduleHorizontalReset, { passive: true });
    return () => {
      if (frameId != null) window.cancelAnimationFrame(frameId);
      resetTimers.forEach((timerId) => window.clearTimeout(timerId));
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pageshow', scheduleHorizontalReset);
      window.visualViewport?.removeEventListener('scroll', scheduleHorizontalReset);
      document.title = previousTitle;
      if ('scrollRestoration' in window.history) window.history.scrollRestoration = previousScrollRestoration;
      document.documentElement.classList.remove('public-site-active', 'admin-landing-active');
    };
  }, []);
}

export default function AdminVenueLandingPage() {
  useDocumentMeta();
  return (
    <PublicSiteLayout>
    <div className="admin-landing">
      <main>
        <section className="admin-landing__hero" id="inicio">
          <div className="admin-landing__shell admin-landing__hero-grid">
            <div>
              <p className="admin-landing__eyebrow">NO ES UNA AGENDA. ES UNA SEDE ACTIVA.</p>
              <h1>Todo lo que soñaste para <span>administrar tu sede está acá.</span></h1>
              <p className="admin-landing__lead">Padbol Match une competencia, marcador, ranking y beneficios para que la actividad no termine al salir de la cancha: genera comunidad, retorno y valor para tu sede. Con una operación que sigue siendo tuya.</p>
              <div className="admin-landing__hero-actions">
                <Link to="/unirse" className="admin-landing__primary">Quiero sumar mi sede <span>→</span></Link>
              </div>
            </div>
            <div className="admin-landing__hero-panel admin-landing__pulse" aria-label="Pulso de tu sede: reservas, partido en vivo, resultado, ranking y PadCoins conectados">
              <header className="admin-landing__pulse-header"><p>PULSO DE TU SEDE</p><span><i aria-hidden="true" />LIVE</span></header>
              <div className="admin-landing__pulse-topline"><span>HOY</span><b>•</b><span>CANCHA 1</span><b>•</b><em><i aria-hidden="true" />EN JUEGO</em></div>
              <section className="admin-landing__pulse-match"><p>PARTIDO EN VIVO</p><div className="admin-landing__pulse-score"><div className="admin-landing__pulse-team admin-landing__pulse-team--serving"><strong>LUNA <span className="admin-landing__serve-status"><i aria-hidden="true" />SACA</span><br />ROJAS</strong></div><b>4 <i>−</i> 3</b><div className="admin-landing__pulse-team admin-landing__pulse-team--right"><strong>PÉREZ /<br />DÍAZ</strong></div></div><span>SET 2&nbsp; · &nbsp;18:42</span></section>
              <ol className="admin-landing__pulse-outcomes"><li><i>✓</i><div><strong>RESULTADO REGISTRADO</strong><span>El partido se cierra y queda guardado.</span></div></li><li><i>▮▮▮</i><div><strong>RANKING ACTUALIZADO</strong><span>Se recalculan posiciones al instante.</span></div></li><li><i>P</i><div><strong>PADCOINS ACREDITADOS</strong><span>La competencia genera retorno real.</span></div></li></ol>
              <div className="admin-landing__pulse-return"><span>◉</span><b>+32</b><p>JUGADORES VUELVEN<br /><em>ESTA SEMANA</em></p></div>
            </div>
          </div>
        </section>

        <section className="admin-landing__reports" aria-labelledby="reportes-title">
          <div className="admin-landing__shell">
            <p className="admin-landing__eyebrow">OPERACIÓN QUE TAMBIÉN SE PUEDE EXPLICAR EN NÚMEROS</p>
            <div className="admin-landing__reports-heading">
              <h2 id="reportes-title">Tu sede no solo se mueve. También <span>se entiende.</span></h2>
              <p>Consultá ingresos y actividad por período, sin perseguir planillas ni reconstruir lo que pasó durante el mes.</p>
            </div>
            <div className="admin-landing__reports-grid">
              <article><span>01</span><h3>Resumen de ingresos</h3><p>Reservas e inscripciones a torneos, transacciones y ticket promedio en un mismo panel.</p></article>
              <article><span>02</span><h3>Detalle para trabajar</h3><p>Fecha, hora, cancha, jugador, monto, moneda y estado de cada movimiento operativo.</p></article>
              <article><span>03</span><h3>Excel exportable</h3><p>Un reporte con resumen, reservas y torneos para compartir con tu administración o contador.</p></article>
            </div>
          </div>
        </section>

        <section className="admin-landing__section" id="recorrido">
          <div className="admin-landing__shell">
            <p className="admin-landing__eyebrow">LO QUE UNA AGENDA SOLA NO HACE</p>
            <h2>De una cancha ocupada a una sede que <span>genera movimiento.</span></h2>
            <p className="admin-landing__intro">No se trata de sumar funciones. Se trata de conectar lo que pasa antes, durante y después de cada partido para que tu sede tenga más actividad y jugadores con motivos para regresar.</p>
            <div className="admin-landing__module-grid">
              {modules.map((module) => (
                <article
                  key={module.number}
                  className="admin-landing__module-card"
                >
                  <span>{module.number}</span><h3>{module.title}</h3><p>{module.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="admin-landing__data-ownership" aria-labelledby="datos-propios-title">
          <div className="admin-landing__shell admin-landing__data-ownership-grid">
            <div className="admin-landing__data-ownership-visual">
              <p className="admin-landing__data-ownership-kicker">TU SEDE. TU INFORMACIÓN. TU DECISIÓN.</p>
              <img src={dataOwnershipVisual} alt="Información de la sede conectada y disponible" />
            </div>
            <div className="admin-landing__data-ownership-copy">
              <h2 id="datos-propios-title">Tus datos no quedan <span>cautivos.</span></h2>
              <p className="admin-landing__data-ownership-lead">La comunidad, la operación y el trabajo que construiste son tuyos. Siempre.</p>
              <p>Podés traer la información de la herramienta que usás hoy para empezar con ventaja. Y si alguna vez decidís irte, te llevás tus datos: no te retenemos ni te obligamos a empezar de cero.</p>
              <div className="admin-landing__data-ownership-points" aria-label="Principios de portabilidad de datos">
                <span>Traés tu información</span><span>Construís con libertad</span><span>Te llevás lo que es tuyo</span>
              </div>
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
              <p className="admin-landing__human-support"><strong>Soporte humano cuando lo necesitás.</strong> Si una consulta requiere seguimiento, el equipo toma el caso y te acompaña hasta resolverlo.</p>
              <ul className="admin-landing__check-list">
                <li>Nombre, país, moneda y deportes de la sede.</li>
                <li>Canchas, días, horarios y duración de cada turno.</li>
                <li>Precio por franja, cobro, señas y política de cancelación.</li>
                <li>Revisión final y publicación controlada.</li>
              </ul>
              <p className="admin-landing__note"><strong>Así funciona:</strong> dices o escribes lo que necesitas configurar; Chivi te lleva a la pantalla correcta, ordena las respuestas y solicita confirmación final. La sede conserva siempre la decisión y el guardado.</p>
            </div>
            <div className="admin-landing__conversation admin-landing__conversation--listening" aria-label="Chivi, asistente de configuración, está escuchando">
              <p className="admin-landing__panel-label">CHIVI / ASISTENTE DE CONFIGURACIÓN</p>
              <div className="admin-landing__chivi-pulse" aria-hidden="true">
                <i /><i /><i /><i /><i /><i /><i />
              </div>
              <strong className="admin-landing__chivi-title">Chivi está escuchando</strong>
              <p className="admin-landing__chivi-copy">Te guía con una pregunta por vez y confirma todo antes de guardar.</p>
            </div>
          </div>
        </section>

        <section className="admin-landing__cta">
          <div className="admin-landing__shell">
            <p className="admin-landing__eyebrow">UNA SEDE QUE SIGUE ACTIVA</p>
            <h2>El resultado no es el <span>final.</span> Es el comienzo de la próxima actividad.</h2>
            <p>Configurá la operación esencial y activá competencia, marcador, ranking y beneficios a medida que tu comunidad crece. Sin entregar el control de tu información ni de tu trabajo.</p>
            <div className="admin-landing__hero-actions"><Link to="/unirse" className="admin-landing__primary">Ver planes para mi sede <span>→</span></Link></div>
          </div>
        </section>
      </main>

    </div>
    </PublicSiteLayout>
  );
}
