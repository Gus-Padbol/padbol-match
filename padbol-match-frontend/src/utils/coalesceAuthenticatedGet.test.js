import { coalesceAuthenticatedGet } from './coalesceAuthenticatedGet';
const response = () => ({ clone: jest.fn(() => ({ json: async () => ({ok:true}) })) });
afterEach(() => jest.restoreAllMocks());
test('shares concurrent GET but clones bodies and revalidates after settlement', async () => {
  let finish;
  global.fetch = jest.fn(() => new Promise(resolve => { finish=resolve; }));
  const first=coalesceAuthenticatedGet('/qa', 'token-a');
  const second=coalesceAuthenticatedGet('/qa', 'token-a');
  await Promise.resolve();
  expect(fetch).toHaveBeenCalledTimes(1);
  finish(response());
  const [a,b]=await Promise.all([first,second]);
  expect(a).not.toBe(b);
  expect(await a.json()).toEqual({ok:true}); expect(await b.json()).toEqual({ok:true});
  fetch.mockResolvedValue(response());
  await coalesceAuthenticatedGet('/qa','token-a');
  expect(fetch).toHaveBeenCalledTimes(2);
});
test('never shares across tokens or URLs and removes failed requests', async () => {
  global.fetch=jest.fn().mockResolvedValue(response());
  await Promise.all([coalesceAuthenticatedGet('/qa','a'),coalesceAuthenticatedGet('/qa','b'),coalesceAuthenticatedGet('/other','a')]);
  expect(fetch).toHaveBeenCalledTimes(3);
  fetch.mockRejectedValueOnce(new Error('offline'));
  await expect(coalesceAuthenticatedGet('/failure','a')).rejects.toThrow('offline');
  await coalesceAuthenticatedGet('/failure','a');
  expect(fetch).toHaveBeenCalledTimes(5);
});
