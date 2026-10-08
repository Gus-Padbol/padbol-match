import { render, screen, fireEvent } from '@testing-library/react';
import AdminWhatsappSection from './AdminWhatsappSection';

jest.mock('../pages/WhatsappCrmDemo', () => ({ accessToken, onBack }) => (
  <div><span>{accessToken}</span><button onClick={onBack}>Volver</button></div>
));

test('el panel integra el espacio CRM completo con la sesión y el regreso al panel', () => {
  const back = jest.fn();
  render(<AdminWhatsappSection accessToken="session-token" onBack={back} />);
  expect(screen.getByText('session-token')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
  expect(back).toHaveBeenCalledTimes(1);
});
