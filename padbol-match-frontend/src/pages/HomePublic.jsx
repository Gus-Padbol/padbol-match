import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppButton from '../components/AppButton';
import { pageBackgroundStyle } from '../theme/uiStyles';
import { useAuth } from '../context/AuthContext';

export default function HomePublic() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const blockGap = 'clamp(18px, 2.2vw, 22px)';
  const headlineBand = 'min(100%, 128px)';

  return (
    <div
      style={{
        ...pageBackgroundStyle,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        boxSizing: 'border-box',
        paddingTop: 'clamp(92px, 12vh, 108px)',
        paddingLeft: '20px',
        paddingRight: '20px',
        paddingBottom: 'clamp(20px, 4vh, 32px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '360px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: blockGap,
        }}
      >
        <img
          src="/logo-padbol-match.png"
          alt="Padbol Match"
          style={{
            width: headlineBand,
            maxWidth: '128px',
            height: 'auto',
            display: 'block',
            objectFit: 'contain',
            filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.28))',
          }}
        />

        <p
          style={{
            margin: 0,
            width: headlineBand,
            maxWidth: '128px',
            color: 'white',
            fontSize: 'clamp(1.28rem, 5vw, 1.62rem)',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            textShadow: '0 2px 24px rgba(0,0,0,0.25)',
          }}
        >
          Vive el juego
        </p>

        <p
          style={{
            margin: 0,
            color: 'rgba(255,255,255,0.92)',
            fontSize: 'clamp(1.05rem, 3.8vw, 1.2rem)',
            fontWeight: 600,
            lineHeight: 1.4,
            maxWidth: '280px',
          }}
        >
          Elige qué quieres hacer
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            gap: '12px',
          }}
        >
          <AppButton variant="primary" onClick={() => navigate('/sedes?from=reserva')}>
            ⚽ Reservar cancha
          </AppButton>
          <AppButton variant="secondary" onClick={() => navigate('/torneos?context=near')}>
            Ver torneos
          </AppButton>
          <AppButton variant="accent" onClick={() => navigate('/sedes?from=explorar')}>
            Explorar sedes
          </AppButton>
        </div>

        {session?.user ? (
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              marginTop: '8px',
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.35)',
              color: 'white',
              fontWeight: 700,
              fontSize: '14px',
              padding: '10px 18px',
              borderRadius: '999px',
              cursor: 'pointer',
            }}
          >
            Mi panel
          </button>
        ) : null}
      </div>
    </div>
  );
}
