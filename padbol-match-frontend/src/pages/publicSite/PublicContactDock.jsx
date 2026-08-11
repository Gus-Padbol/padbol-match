import React from 'react';
import { Link } from 'react-router-dom';
import { usePublicSiteText } from './publicSiteI18n';

const WHATSAPP_URL = 'https://wa.me/17864588533?text=Hola%2C%20quiero%20recibir%20informaci%C3%B3n%20sobre%20Padbol%20Match.';
const EMAIL_URL = 'mailto:padbolinternacional@gmail.com?subject=Consulta%20comercial%20sobre%20Padbol%20Match';

function ContactIcon({ type }) {
  if (type === 'whatsapp') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.5 3.5A11.8 11.8 0 0 0 12.1 0C5.6 0 .3 5.3.3 11.8c0 2.1.5 4.1 1.6 5.9L0 24l6.5-1.7c1.7.9 3.6 1.4 5.6 1.4h.1C18.7 23.7 24 18.4 24 11.9c0-3.2-1.2-6.1-3.5-8.4Zm-8.4 18.2c-1.8 0-3.6-.5-5.1-1.4l-.4-.2-3.8 1 1-3.7-.2-.4a9.7 9.7 0 0 1-1.5-5.2c0-5.4 4.4-9.8 9.9-9.8 2.6 0 5.1 1 7 2.9a9.8 9.8 0 0 1-6.9 16.8Zm5.4-7.3c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-1.7-.8-2.8-1.5-3.9-3.4-.3-.5.3-.5.8-1.6.1-.2.1-.4 0-.6l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9s1.2 3.4 1.4 3.6c.2.2 2.4 3.7 5.9 5.2 2.2 1 3.1 1 4.2.8.7-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4Z" />
      </svg>
    );
  }
  if (type === 'email') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 4h17A3.5 3.5 0 0 1 24 7.5v9a3.5 3.5 0 0 1-3.5 3.5h-17A3.5 3.5 0 0 1 0 16.5v-9A3.5 3.5 0 0 1 3.5 4Zm17.2 2H3.3L12 12.4 20.7 6ZM2 7.4v9.1c0 .8.7 1.5 1.5 1.5h17c.8 0 1.5-.7 1.5-1.5V7.4l-9.4 6.9a1 1 0 0 1-1.2 0L2 7.4Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2C5.4 2 0 6.5 0 12s5.4 10 12 10c1.2 0 2.4-.2 3.5-.5l5.3 2.2-1.4-4.3C22.2 17.6 24 15 24 12 24 6.5 18.6 2 12 2Zm-5 11.5A1.5 1.5 0 1 1 7 10a1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3.5 1.5 1.5 0 0 1 0 3.5Zm5 0a1.5 1.5 0 1 1 0-3.5 1.5 1.5 0 0 1 0 3.5Z" />
    </svg>
  );
}

export default function PublicContactDock() {
  const text = usePublicSiteText();

  return (
    <nav className="public-contact-dock" aria-label={text('publicSite.contactDock.aria')}>
      <a
        className="public-contact-dock__item"
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={text('publicSite.contactDock.whatsappAria')}
        title={text('publicSite.contactDock.whatsapp')}
      >
        <span className="public-contact-dock__icon"><ContactIcon type="whatsapp" /></span>
        <span className="public-contact-dock__copy">
          <strong>{text('publicSite.contactDock.whatsapp')}</strong>
          <small>{text('publicSite.contactDock.whatsappHint')}</small>
        </span>
      </a>
      <a
        className="public-contact-dock__item"
        href={EMAIL_URL}
        aria-label={text('publicSite.contactDock.emailAria')}
        title={text('publicSite.contactDock.email')}
      >
        <span className="public-contact-dock__icon"><ContactIcon type="email" /></span>
        <span className="public-contact-dock__copy">
          <strong>{text('publicSite.contactDock.email')}</strong>
          <small>{text('publicSite.contactDock.emailHint')}</small>
        </span>
      </a>
      <Link
        className="public-contact-dock__item"
        to="/contacto"
        aria-label={text('publicSite.contactDock.talkAria')}
        title={text('publicSite.contactDock.talk')}
      >
        <span className="public-contact-dock__icon"><ContactIcon type="talk" /></span>
        <span className="public-contact-dock__copy">
          <strong>{text('publicSite.contactDock.talk')}</strong>
          <small>{text('publicSite.contactDock.talkHint')}</small>
        </span>
      </Link>
    </nav>
  );
}
