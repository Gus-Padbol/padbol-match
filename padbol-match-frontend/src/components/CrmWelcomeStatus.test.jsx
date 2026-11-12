import React from 'react';
import {render, screen} from '@testing-library/react';
import CrmWelcomeStatus from './CrmWelcomeStatus';

test.each([undefined, null, {}, {status: 'unknown'}, {status: 'toString'}])('does not infer an email from missing or unsupported data: %j', welcome => {
  const {container} = render(<CrmWelcomeStatus welcome={welcome} />);
  expect(container).toBeEmptyDOMElement();
});

test.each([
  ['not_recorded', 'Bienvenida sin envío registrado'],
  ['processing', 'Enviando bienvenida'],
  ['needs_review', 'Revisar envío de bienvenida'],
  ['unavailable', 'Estado de envío no disponible'],
])('%s cannot claim an email was sent or that a response is awaited', (status, label) => {
  const {container} = render(<CrmWelcomeStatus welcome={{status, sent_at:'2026-11-12T16:24:48Z', response_state:'no_reply_registered'}} />);
  expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.queryByText('Bienvenida enviada')).not.toBeInTheDocument();
  expect(screen.queryByText('Esperando respuesta')).not.toBeInTheDocument();
  expect(container.querySelector('time')).toBeNull();
});

test('accepted send shows its authoritative time and waiting state without claiming delivery', () => {
  const {container} = render(<CrmWelcomeStatus compact welcome={{status:'sent', sent_at:'2026-11-12T16:24:48Z', response_state:'no_reply_registered', provider_message_id:'private-provider', provider_key:'private-key'}} />);
  expect(screen.getByText('Bienvenida enviada')).toBeInTheDocument();
  expect(screen.getByText('Esperando respuesta')).toBeInTheDocument();
  expect(container.querySelector('time')).toHaveAttribute('datetime', '2026-11-12T16:24:48.000Z');
  expect(container.textContent).not.toMatch(/entregada|private-provider|private-key/i);
  expect(container.firstChild).toHaveClass('crm-welcome-status--sent', 'crm-welcome-status--compact');
});

test('a later verified reply replaces the waiting label; invalid dates are never printed', () => {
  const {container, rerender} = render(<CrmWelcomeStatus welcome={{status:'sent', sent_at:'invalid', response_state:'no_reply_registered'}} />);
  expect(container.querySelector('time')).toBeNull();
  expect(container.textContent).not.toContain('Invalid Date');
  rerender(<CrmWelcomeStatus welcome={{status:'sent', response_state:'reply_received', response_at:'2026-11-12T17:00:00Z'}} />);
  expect(screen.getByText('Respuesta recibida')).toBeInTheDocument();
  expect(screen.queryByText('Esperando respuesta')).not.toBeInTheDocument();
});

test('unknown response state cannot be presented as waiting or answered', () => {
  render(<CrmWelcomeStatus welcome={{status:'sent', response_state:'unknown'}} />);
  expect(screen.getByText('Bienvenida enviada')).toBeInTheDocument();
  expect(screen.queryByText(/Esperando respuesta|Respuesta recibida/)).not.toBeInTheDocument();
});
