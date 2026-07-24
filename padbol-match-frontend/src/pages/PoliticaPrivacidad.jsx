import React from 'react';
import { Link } from 'react-router-dom';
import LegalStaticPageLayout, {
  LegalSectionTitle,
  LegalP,
  LegalUl,
  LegalLi,
  LegalA,
} from '../components/LegalStaticPageLayout';

const CONTACT = 'mailto:padbolinternacional@gmail.com';

export default function PoliticaPrivacidad() {
  return (
    <LegalStaticPageLayout
      title="Política de Privacidad"
      lead="Te explicamos de forma clara qué datos usamos en Padbol Match y con qué fines. Puedes contactarnos cuando quieras."
    >
      <LegalSectionTitle>Qué datos recolectamos</LegalSectionTitle>
      <LegalP>Según cómo uses la cuenta y el perfil, podemos tratar, entre otros:</LegalP>
      <LegalUl>
        <LegalLi>Nombre y apellido</LegalLi>
        <LegalLi>Correo electrónico</LegalLi>
        <LegalLi>Teléfono y número de WhatsApp</LegalLi>
        <LegalLi>Género u otra información de perfil deportivo que indiques</LegalLi>
        <LegalLi>Foto de perfil (si la subes)</LegalLi>
        <LegalLi>Historial de reservas y participación en torneos dentro de la plataforma</LegalLi>
        <LegalLi>Datos técnicos mínimos (por ejemplo tipo de dispositivo o logs de seguridad) necesarios para el servicio</LegalLi>
      </LegalUl>

      <LegalSectionTitle>Para qué usamos tus datos</LegalSectionTitle>
      <LegalUl>
        <LegalLi>Gestionar reservas de canchas y pagos asociados</LegalLi>
        <LegalLi>Organizar e inscribir participantes en torneos</LegalLi>
        <LegalLi>Enviarte notificaciones relacionadas con el servicio (confirmaciones, cambios, recordatorios)</LegalLi>
        <LegalLi>Funciones de comunidad y matchmaking deportivo cuando estén habilitadas en la app</LegalLi>
        <LegalLi>Mejorar la seguridad, prevenir fraude y cumplir obligaciones legales</LegalLi>
      </LegalUl>

      <LegalSectionTitle>No vendemos tus datos</LegalSectionTitle>
      <LegalP>
        <strong style={{ color: '#e2e8f0' }}>No vendemos</strong> tu información personal a terceros para que te hagan
        marketing ajeno a Padbol Match. Solo compartimos datos cuando es necesario para prestar el servicio (por ejemplo
        con la sede donde reservaste) o cuando la ley lo exija.
      </LegalP>

      <LegalSectionTitle>Pagos: Mercado Pago y Stripe</LegalSectionTitle>
      <LegalP>
        Los cobros pueden procesarse a través de <strong style={{ color: '#e2e8f0' }}>Mercado Pago</strong> y/o{' '}
        <strong style={{ color: '#e2e8f0' }}>Stripe</strong>. Esos proveedores reciben solo los datos necesarios para la
        transacción y aplican sus propias políticas de privacidad y seguridad:
      </LegalP>
      <LegalUl>
        <LegalLi>
          Mercado Pago: <LegalA href="https://www.mercadopago.com.ar/privacidad">política de privacidad</LegalA>
        </LegalLi>
        <LegalLi>
          Stripe: <LegalA href="https://stripe.com/privacy">centro de privacidad</LegalA>
        </LegalLi>
      </LegalUl>

      <LegalSectionTitle>Derecho a eliminar tu cuenta y tus datos</LegalSectionTitle>
      <LegalP>
        Podés iniciar la solicitud desde Mi perfil o consultar el proceso completo en{' '}
        <Link to="/eliminar-cuenta" style={{ color: '#a5b4fc', fontWeight: 700 }}>
          Eliminar tu cuenta
        </Link>
        . Si no podés ingresar, también podés escribir desde el correo asociado a tu cuenta a{' '}
        <a href={CONTACT} style={{ color: '#a5b4fc', fontWeight: 700 }}>padbolinternacional@gmail.com</a>. Algunos datos
        pueden conservarse durante el plazo que exija la ley, por ejemplo registros contables o reclamos.
      </LegalP>

      <LegalSectionTitle>Cookies y tecnologías similares</LegalSectionTitle>
      <LegalP>
        Usamos <strong style={{ color: '#e2e8f0' }}>solo las cookies y almacenamiento local necesarios</strong> para que la
        sesión funcione, recordar preferencias básicas y mantener la app segura. No usamos cookies publicitarias de
        terceros con fines de perfilado comercial.
      </LegalP>

      <LegalSectionTitle>Usuarios en Europa (GDPR)</LegalSectionTitle>
      <LegalP>
        Si resides en el Espacio Económico Europeo o en el Reino Unido, tienes derechos reconocidos por el RGPD (GDPR) de
        forma general: acceder a tus datos, rectificarlos, limitar u oponerte a ciertos tratamientos, solicitar portabilidad
        cuando corresponda y presentar una reclamación ante la autoridad de protección de datos de tu país. Para ejercer
        estos derechos, escríbenos al correo de contacto indicado abajo.
      </LegalP>

      <LegalSectionTitle>Contacto por privacidad</LegalSectionTitle>
      <LegalP>
        Para consultas sobre esta política o sobre tus datos:{' '}
        <a href={CONTACT} style={{ color: '#a5b4fc', fontWeight: 700 }}>
          padbolinternacional@gmail.com
        </a>
        .
      </LegalP>
    </LegalStaticPageLayout>
  );
}
