import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PendingValidationActions from './PendingValidationActions';

test.each([['super_admin', true], ['admin_club', false]])('%s ve acciones acordes al rol', (_role, isSuperAdmin) => {
  const approve=jest.fn(), reject=jest.fn(), category=jest.fn();
  render(<PendingValidationActions isSuperAdmin={isSuperAdmin} saving={false} onApprove={approve} onReject={reject} onCategory={category} approveLabel="Aprobar" rejectLabel="Rechazar" categoryLabel="Categoría" />);
  fireEvent.click(screen.getByRole('button', {name:'Aprobar'}));
  fireEvent.click(screen.getByRole('button', {name:'Categoría'}));
  expect(approve).toHaveBeenCalledTimes(1); expect(category).toHaveBeenCalledTimes(1);
  const rejectButton=screen.queryByRole('button', {name:'Rechazar'});
  if (isSuperAdmin) { fireEvent.click(rejectButton); expect(reject).toHaveBeenCalledTimes(1); }
  else { expect(rejectButton).not.toBeInTheDocument(); expect(reject).not.toHaveBeenCalled(); }
});

test('mientras se guarda no permite acciones', () => {
  render(<PendingValidationActions isSuperAdmin saving approveLabel="Aprobar" rejectLabel="Rechazar" categoryLabel="Categoría" />);
  screen.getAllByRole('button').forEach(button=>expect(button).toBeDisabled());
});
