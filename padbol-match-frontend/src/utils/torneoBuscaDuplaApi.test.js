import { fetchBuscaDuplaList } from './torneoBuscaDuplaApi';
test('tournament admin and player views forward the existing session to the protected partner listing', async () => {
  const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
  await fetchBuscaDuplaList('https://backend.test', 23, 'existing-session', fetchImpl);
  expect(fetchImpl).toHaveBeenCalledWith('https://backend.test/api/torneos/23/busca-dupla', { headers: { Authorization: 'Bearer existing-session' } });
});
test('anonymous views do not request the private listing or manufacture credentials', async () => {
  const fetchImpl = jest.fn();
  expect(await fetchBuscaDuplaList('https://backend.test', 23, null, fetchImpl)).toBeNull();
  expect(fetchImpl).not.toHaveBeenCalled();
});
