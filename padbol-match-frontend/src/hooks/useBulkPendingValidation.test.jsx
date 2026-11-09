import { act, renderHook } from '@testing-library/react';
import useBulkPendingValidation from './useBulkPendingValidation';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function setup(extra = {}) {
  const props = { rows: [{ id: 1 }, { id: 2 }], context: 'a', ready: true, isSuperAdmin: true, update: jest.fn().mockResolvedValue(), onSuccess: jest.fn(), confirm: jest.fn(() => true), actionLabel: action => action, ...extra };
  const hook = renderHook(input => useBulkPendingValidation(input), { initialProps: props });
  return { ...hook, props };
}
test('select one or all visible; confirm exact action/count; clear successful records', async () => {
  const { result, props } = setup();
  act(() => result.current.toggle(1));
  expect(result.current.selected).toEqual(['1']);
  act(() => result.current.toggleAll());
  expect(result.current.selected).toEqual(['1', '2']);
  await act(() => result.current.run('aprobar'));
  expect(props.confirm).toHaveBeenCalledWith('aprobar', 2);
  expect(props.update.mock.calls).toEqual([['1', 'aprobar'], ['2', 'aprobar']]);
  expect(props.onSuccess.mock.calls).toEqual([['1'], ['2']]);
  expect(result.current.selected).toEqual([]);
  expect(result.current.outcome).toMatchObject({ completed: 2, total: 2, failed: false });
});
test('cancel confirmation does not mutate', async () => {
  const { result, props } = setup({ confirm: jest.fn(() => false) });
  act(() => result.current.toggleAll());
  await act(() => result.current.run('rechazar'));
  expect(props.update).not.toHaveBeenCalled();
  expect(result.current.selected).toHaveLength(2);
});
test('reject cannot be called for non-super admin; empty and not-ready are inert', async () => {
  const { result, props, rerender } = setup({ isSuperAdmin: false });
  await act(() => result.current.run('aprobar'));
  act(() => result.current.toggleAll());
  await act(() => result.current.run('rechazar'));
  rerender({ ...props, ready: false });
  await act(() => result.current.run('aprobar'));
  expect(props.update).not.toHaveBeenCalled();
});
test('partial uncertain failure stops; completed clears; cannot blindly retry until refresh', async () => {
  const update = jest.fn().mockResolvedValueOnce().mockRejectedValueOnce(new Error('network'));
  const { result, props, rerender } = setup({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }], update });
  act(() => result.current.toggleAll());
  await act(() => result.current.run('rechazar'));
  expect(update).toHaveBeenCalledTimes(2);
  expect(result.current.outcome).toMatchObject({ completed: 1, total: 3, failed: true });
  expect(result.current.selected).toEqual(['2', '3']);
  await act(() => result.current.run('rechazar'));
  expect(update).toHaveBeenCalledTimes(2);
  rerender({ ...props, context: 'refresh', rows: [{ id: 3 }] });
  expect(result.current.blocked).toBe(false);
  expect(result.current.selected).toEqual([]);
});
test('synchronous repeated clicks are deduplicated, even before React rerenders', async () => {
  const pending = deferred();
  const { result, props } = setup({ update: jest.fn(() => pending.promise) });
  act(() => result.current.toggle(1));
  let run;
  act(() => { run = result.current.run('aprobar'); void result.current.run('aprobar'); });
  expect(props.update).toHaveBeenCalledTimes(1);
  expect(result.current.busy).toBe(true);
  await act(async () => { pending.resolve(); await run; });
  expect(result.current.busy).toBe(false);
});
test.each(['filter', 'account', 'tab'])('%s context change cancels unsent operations and stale callbacks', async context => {
  const pending = deferred();
  const { result, props, rerender } = setup({ update: jest.fn(() => pending.promise) });
  act(() => result.current.toggleAll());
  let run;
  act(() => { run = result.current.run('aprobar'); });
  rerender({ ...props, context });
  expect(result.current.selected).toEqual([]);
  // Returning to the former context must not revive a request from before navigation.
  rerender(props);
  await act(async () => { pending.resolve(); await run; });
  expect(props.update).toHaveBeenCalledTimes(1);
  expect(props.onSuccess).not.toHaveBeenCalled();
  expect(result.current.outcome).toBeNull();
});
test('unmount cancels queued operations', async () => {
  const pending = deferred();
  const { result, props, unmount } = setup({ update: jest.fn(() => pending.promise) });
  act(() => result.current.toggleAll());
  let run;
  act(() => { run = result.current.run('aprobar'); });
  unmount();
  await act(async () => { pending.resolve(); await run; });
  expect(props.update).toHaveBeenCalledTimes(1);
  expect(props.onSuccess).not.toHaveBeenCalled();
});
test('changing filter and returning never restores old selection', () => {
  const { result, props, rerender } = setup();
  act(() => result.current.toggleAll());
  rerender({ ...props, context: 'filter' });
  rerender(props);
  expect(result.current.selected).toEqual([]);
});
test('uncertainty persists across filters until a refresh, not just navigation', async () => {
  const { result, props, rerender } = setup({ recoveryContext: 'same-fetch', update: jest.fn().mockRejectedValue(new Error('unknown')) });
  act(() => result.current.toggleAll());
  await act(() => result.current.run('aprobar'));
  rerender({ ...props, context: 'new-filter' });
  expect(result.current.blocked).toBe(true);
  act(() => result.current.toggleAll());
  await act(() => result.current.run('aprobar'));
  expect(props.update).toHaveBeenCalledTimes(1);
  rerender({ ...props, recoveryContext: 'refetched' });
  expect(result.current.blocked).toBe(false);
});
