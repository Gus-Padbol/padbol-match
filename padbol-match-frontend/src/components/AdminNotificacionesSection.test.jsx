import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminNotificacionesSection from './AdminNotificacionesSection';
import { previewAdminPushSegment, sendAdminPushNotification } from '../utils/adminPushNotificationsApi';

jest.mock('../i18n/tSafe', () => {
  const t = (key, values) => key === 'admin.pushNotif.preview' ? `Destinatarios ${values.count}` : key;
  return { useSafeTranslation: () => ({ t, i18n: { language: 'es' } }) };
});
jest.mock('../utils/adminPushNotificationsApi', () => ({
  fetchAdminPushHistory: jest.fn().mockResolvedValue([]),
  fetchAdminPushQuota: jest.fn().mockResolvedValue({ unlimited: true }),
  formatAdminPushSegmentLabel: jest.fn(),
  previewAdminPushSegment: jest.fn(),
  searchAdminPushPlayers: jest.fn(),
  sendAdminPushNotification: jest.fn(),
}));

test('shows preview failures, prevents sending, and retries a genuine zero count', async () => {
  previewAdminPushSegment.mockRejectedValueOnce(Object.assign(new Error('Servicio no disponible'), { status: 503 })).mockResolvedValueOnce({ recipients: 0 });
  render(<AdminNotificacionesSection apiBaseUrl="https://example.test" accessToken="test" isSuperAdmin />);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('admin.pushNotif.notConfigured'));
  expect(screen.getByRole('button', { name: 'admin.pushNotif.send' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await screen.findByText('Destinatarios 0');
  expect(screen.getByText('admin.common.noPushRecipients')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'admin.pushNotif.send' })).toBeDisabled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(sendAdminPushNotification).not.toHaveBeenCalled();
});
