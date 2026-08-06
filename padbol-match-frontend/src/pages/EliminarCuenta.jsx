import React from 'react';
import { Link } from 'react-router-dom';
import LegalStaticPageLayout, {
  LegalSectionTitle,
  LegalP,
  LegalUl,
  LegalLi,
} from '../components/LegalStaticPageLayout';
import { useAuth } from '../context/AuthContext';

const EMAIL = 'padbolinternacional@gmail.com';
const EMAIL_HREF =
  'mailto:padbolinternacional@gmail.com?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20cuenta%20Padbol%20Match';
const linkStyle = { color: '#a5b4fc', fontWeight: 700 };

export default function EliminarCuenta() {
  const { session } = useAuth();

  return (
    <LegalStaticPageLayout
      title="Eliminar tu cuenta"
      lead="Puedes solicitar la eliminación de tu cuenta de Padbol Match y de los datos personales asociados."
    >
      <LegalSectionTitle>Desde tu cuenta</LegalSectionTitle>
      <LegalP>
        {session?.user ? (
          <>
            La forma más rápida es ingresar a{' '}
            <Link to="/mi-perfil" style={linkStyle}>
              Mi perfil
            </Link>
            , tocar “Eliminar mi cuenta” y confirmar la solicitud.
          </>
        ) : (
          <>
            Inicia sesión, abre “Mi perfil” y toca “Eliminar mi cuenta”. Si no puedes ingresar, usa la alternativa por
            correo indicada abajo.
          </>
        )}
      </LegalP>

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
    </LegalStaticPageLayout>
  );
}
