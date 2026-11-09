import { fireEvent, render, screen } from '@testing-library/react';
import PendingValidationBulkActions from './PendingValidationBulkActions';
const t = (key, options = {}) => options.defaultValue || key;
const bulk = () => ({ selected: ['1'], busy: false, blocked: false, toggleAll: jest.fn(), run: jest.fn() });
test('only super admin sees bulk rejection', () => {
  const state = bulk();
  const { rerender } = render(<PendingValidationBulkActions bulk={state} visibleCount={2} t={t} />);
  expect(screen.queryByRole('button', { name: 'Reject selected' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Approve selected' }));
  expect(state.run).toHaveBeenCalledWith('aprobar');
  rerender(<PendingValidationBulkActions bulk={state} visibleCount={2} t={t} isSuperAdmin />);
  fireEvent.click(screen.getByRole('button', { name: 'Reject selected' }));
  expect(state.run).toHaveBeenCalledWith('rechazar');
});
test('disabled state prevents actions and selection', () => {
  render(<PendingValidationBulkActions bulk={bulk()} visibleCount={2} t={t} isSuperAdmin disabled />);
  screen.getAllByRole('button').forEach(button => expect(button).toBeDisabled());
  expect(screen.getByRole('checkbox')).toBeDisabled();
});
test('uncertain response requires refresh and displays accurate partial outcome', () => {
  const refresh = jest.fn();
  render(<PendingValidationBulkActions bulk={{ ...bulk(), blocked: true, outcome: { completed: 1, total: 3, error: 'network' } }} visibleCount={2} t={t} isSuperAdmin onRefresh={refresh} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Refresh the list');
  expect(screen.getByRole('button', { name: 'Approve selected' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh list' }));
  expect(refresh).toHaveBeenCalledTimes(1);
});
