import React from 'react';
import LegalStaticPageLayout, {
  LegalSectionTitle,
  LegalP,
  LegalUl,
  LegalLi,
} from '../components/LegalStaticPageLayout';

const CONTACT = 'mailto:padbolinternacional@gmail.com';

export default function TerminosCondiciones() {
  return (
    <LegalStaticPageLayout
      title="Términos y Condiciones"
      lead="Última actualización: información general para usuarios de Padbol Match. Si tienes dudas, escríbenos."
    >
      <LegalSectionTitle>Titular del servicio</LegalSectionTitle>
      <LegalP>
        Padbol Match es operado por <strong style={{ color: '#e2e8f0' }}>Entertainment and Sports Services LLC</strong>,
        con domicilio en el Estado de Florida, Estados Unidos. Al usar la plataforma aceptas estos términos.
      </LegalP>

      <LegalSectionTitle>Qué es Padbol Match</LegalSectionTitle>
      <LegalP>
        Padbol Match es una <strong style={{ color: '#e2e8f0' }}>plataforma digital de reservas deportivas</strong> que
        conecta jugadores con clubes y sedes: reservas de canchas, torneos, rankings e información de sedes. El servicio
        puede ampliarse con nuevas funciones sin que ello implique renuncia a estas condiciones base.
      </LegalP>

      <LegalSectionTitle>Condiciones de uso de la plataforma</LegalSectionTitle>
      <LegalUl>
        <LegalLi>Debes proporcionar datos veraces y mantener tu cuenta segura (contraseña, dispositivo).</LegalLi>
        <LegalLi>Está prohibido usar la plataforma de forma fraudulenta, para perjudicar a terceros o vulnerar la ley.</LegalLi>
        <LegalLi>Podemos suspender o limitar cuentas ante incumplimientos graves o riesgo para la comunidad.</LegalLi>
      </LegalUl>

      <LegalSectionTitle>Reservas de canchas</LegalSectionTitle>
      <LegalUl>
        <LegalLi>
          <strong style={{ color: '#e2e8f0' }}>Medios de pago:</strong> el método de pago depende de cada sede. Algunas
          operan exclusivamente con pago online; otras pueden ofrecer pago presencial según su plan de suscripción.
        </LegalLi>
        <LegalLi>
          <strong style={{ color: '#e2e8f0' }}>Cancelación y reembolsos:</strong> las reglas de cancelación, cambios y
          penalidades dependen de la <strong style={{ color: '#e2e8f0' }}>política de cada sede</strong> publicada o
          comunicada por el club. Revisa siempre los detalles antes de confirmar.
        </LegalLi>
        <LegalLi>
          <strong style={{ color: '#e2e8f0' }}>Comisión de servicio:</strong> cuando el pago se procesa online a través
          de Padbol Match (por ejemplo Mercado Pago o Stripe), puede aplicarse un{' '}
          <strong style={{ color: '#e2e8f0' }}>fee de servicio del 3%</strong> sobre el precio de la reserva; el desglose
          se muestra antes de pagar. Las reservas con cobro en efectivo en la sede no incluyen ese cargo de la plataforma.
        </LegalLi>
      </LegalUl>

      <LegalSectionTitle>Torneos</LegalSectionTitle>
      <LegalUl>
        <LegalLi>
          La <strong style={{ color: '#e2e8f0' }}>inscripción</strong> a un torneo puede quedar{' '}
          <strong style={{ color: '#e2e8f0' }}>sujeta a aprobación del organizador</strong> del evento.
        </LegalLi>
        <LegalLi>
          Las <strong style={{ color: '#e2e8f0' }}>categorías de género y formato</strong> (incluidas divisiones
          masculinas, femeninas, mixtas u otras) las define el <strong style={{ color: '#e2e8f0' }}>organizador</strong>{' '}
          del torneo conforme a sus reglas internas y a la normativa aplicable.
        </LegalLi>
      </LegalUl>

      <LegalSectionTitle>Reportes operativos de las sedes</LegalSectionTitle>
      <LegalP>
        Los resúmenes, movimientos y archivos exportables que ofrece Padbol Match son herramientas de información
        operativa. Pueden ayudar a cada sede a ordenar y compartir sus datos de reservas, inscripciones y actividad,
        pero no constituyen asesoramiento contable, tributario, legal ni financiero, ni reemplazan los registros,
        controles, declaraciones o documentación que exija la normativa aplicable.
      </LegalP>
      <LegalP>
        Cada sede es responsable de revisar la información, definir cómo utilizarla y consultar a sus propios
        profesionales cuando corresponda, de acuerdo con su país, jurisdicción y obligaciones particulares.
      </LegalP>

      <LegalSectionTitle>Responsabilidad limitada</LegalSectionTitle>
      <LegalP>
        Padbol Match actúa como <strong style={{ color: '#e2e8f0' }}>intermediario tecnológico</strong> entre jugadores y
        sedes. No somos dueños ni operadores directos de las instalaciones físicas. Cualquier incidente en el predio
        (seguridad, estado de las canchas, conflictos entre usuarios, lesiones, etc.) debe dirimirse principalmente con la
        sede y las partes involucradas. En la medida permitida por la ley aplicable, limitamos nuestra responsabilidad por
        el uso de la plataforma a lo razonablemente previsible.
      </LegalP>

      <LegalSectionTitle>Propiedad intelectual</LegalSectionTitle>
      <LegalP>
        El nombre <strong style={{ color: '#e2e8f0' }}>PADBOL®</strong> es marca registrada de{' '}
        <strong style={{ color: '#e2e8f0' }}>FIPA</strong> (Federación Internacional de Padbol). Los contenidos de la
        app (diseño, textos, logos propios de Padbol Match y software) están protegidos; no puedes copiarlos ni
        redistribuirlos sin autorización.
      </LegalP>

      <LegalSectionTitle>Ley aplicable</LegalSectionTitle>
      <LegalP>
        Estos términos se rigen por las leyes del <strong style={{ color: '#e2e8f0' }}>Estado de Florida, Estados Unidos</strong>,
        sin perjuicio de derechos imperativos que correspondan a consumidores en otros países.
      </LegalP>

      <LegalSectionTitle>Contacto</LegalSectionTitle>
      <LegalP>
        Consultas sobre estos términos:{' '}
        <a href={CONTACT} style={{ color: '#a5b4fc', fontWeight: 700 }}>
          padbolinternacional@gmail.com
        </a>
        .
      </LegalP>
    </LegalStaticPageLayout>
  );
}
