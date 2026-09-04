import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LegalStaticPageLayout, {
  LegalSectionTitle,
  LegalP,
  LegalUl,
  LegalLi,
} from '../components/LegalStaticPageLayout';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { requestAccountDeletion } from '../utils/accountDeletionApi';

const EMAIL = 'padbolinternacional@gmail.com';
const EMAIL_HREF =
  'mailto:padbolinternacional@gmail.com?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20cuenta%20Padbol%20Match';
const linkStyle = { color: '#a5b4fc', fontWeight: 700 };

export default function EliminarCuenta() {
  const navigate = useNavigate();
  const { session, signOutAndClear } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleRequestDeletion = async () => {
    if (busy) return;
    setBusy(true);
    setErrorMessage('');
    try {
      await requestAccountDeletion({
        accessToken: session?.access_token,
        source: 'web',
      });
      setConfirmOpen(false);
      signOutAndClear();
      navigate('/', {
        replace: true,
        state: { accountDeletionRequested: true },
      });
    } catch (error) {
      setErrorMessage(error?.message || 'No pudimos registrar la solicitud de eliminación.');
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <LegalStaticPageLayout
      title="Eliminar tu cuenta"
      lead="Puedes solicitar la eliminación de tu cuenta de Padbol Match y de los datos personales asociados."
    >
      <LegalSectionTitle>Desde tu cuenta</LegalSectionTitle>
      <LegalP>
        {session?.user ? (
          <>Por seguridad, esta opción está separada del cierre de sesión y requiere una confirmación adicional.</>
        ) : (
          <>
            <Link to="/acceso?redirect=%2Feliminar-cuenta" style={linkStyle}>
              Inicia sesión
            </Link>{' '}
            para solicitar la eliminación desde esta página. Si no puedes ingresar, usa la alternativa por correo
            indicada abajo.
          </>
        )}
      </LegalP>

      {session?.user ? (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmOpen(true)}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px 16px',
              margin: '0 0 24px',
              borderRadius: '10px',
              border: '1px solid rgba(248, 113, 113, 0.5)',
              background: 'transparent',
              color: '#fca5a5',
              font: 'inherit',
              fontWeight: 700,
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.65 : 1,
            }}
          >
            Solicitar eliminación de cuenta
          </button>
          {errorMessage ? (
            <p role="alert" style={{ color: '#fca5a5', fontWeight: 700, margin: '0 0 24px' }}>
              {errorMessage}
            </p>
          ) : null}
        </>
      ) : null}

      <LegalSectionTitle>Si no puedes ingresar</LegalSectionTitle>
      <LegalP>
        Escribinos desde el correo asociado a tu cuenta a{' '}
        <a href={EMAIL_HREF} style={linkStyle}>
          {EMAIL}
        </a>
        . En el mensaje indica que solicitas la eliminación de tu cuenta. Podemos pedirte información adicional para
        verificar que la cuenta te pertenece.
      </LegalP>

      <LegalSectionTitle>Qué ocurre con tus datos</LegalSectionTitle>
      <LegalUl>
        <LegalLi>La cuenta deja de estar disponible una vez procesada la solicitud.</LegalLi>
        <LegalLi>Los datos personales se eliminan o anonimizan de los sistemas activos vinculados a la cuenta.</LegalLi>
        <LegalLi>
          Algunos registros pueden conservarse durante el plazo exigido por obligaciones legales, contables, de seguridad
          o prevención de fraude.
        </LegalLi>
      </LegalUl>

      <LegalP>
        La solicitud se procesa tan pronto como sea razonablemente posible. Si necesitás consultar su estado, respondé al
        mismo correo con el que la iniciaste.
      </LegalP>

      <ConfirmModal
        open={confirmOpen}
        title="¿Solicitar la eliminación de tu cuenta?"
        message="Esta acción cierra tu sesión e inicia la eliminación o anonimización permanente de tus datos. Algunos registros pueden conservarse cuando exista una obligación legal."
        confirmLabel={busy ? 'Enviando solicitud…' : 'Sí, eliminar mi cuenta'}
        dismissLabel="Cancelar"
        busy={busy}
        confirmDanger
        onDismiss={() => setConfirmOpen(false)}
        onConfirm={() => void handleRequestDeletion()}
        titleId="eliminar-cuenta-titulo"
      />
    </LegalStaticPageLayout>
  );
}
