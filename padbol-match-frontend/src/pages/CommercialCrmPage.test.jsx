import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CommercialCrmPage from './CommercialCrmPage';
const mockSignOut = jest.fn();
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ signOutAndClear: () => mockSignOut() }) }));
jest.mock('./WhatsappCrmDemo', () => ({ __esModule: true, default: ({requiredScope}) => <div data-testid="crm">{requiredScope}</div> }));
test('dedicated entry requires commercial capability and lets the operator leave their own session', () => {
  render(<CommercialCrmPage />);
  expect(screen.getByTestId('crm')).toHaveTextContent('commercial');
  fireEvent.click(screen.getByRole('button', {name: 'Cerrar sesión'}));
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});
