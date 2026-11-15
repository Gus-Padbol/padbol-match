import { uploadSponsorMedia } from './uploadSponsorMedia';
jest.mock('./apiPublicBaseUrl', () => ({ getApiBaseUrl: () => 'https://api.example' }));
beforeEach(() => { global.fetch = jest.fn(); });
test('missing session never sends a file', async () => {
  await expect(uploadSponsorMedia(new File(['x'], 'ad.png'), null)).rejects.toThrow('sesión');
  expect(fetch).not.toHaveBeenCalled();
});
test('uses authenticated editorial upload without setting a multipart boundary', async () => {
  fetch.mockResolvedValue({ ok: true, json: async () => ({ url: 'https://media.example/ad.png' }) });
  const file = new File(['x'], 'ad.png', { type: 'image/png' });
  await expect(uploadSponsorMedia(file, 'existing-session')).resolves.toBe('https://media.example/ad.png');
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe('https://api.example/api/admin/content/media');
  expect(options.headers).toEqual({ Authorization: 'Bearer existing-session' });
  expect(options.body.get('file')).toEqual(file);
});
test('permission rejection is surfaced and no direct Storage fallback is attempted', async () => {
  fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'No autorizado' }) });
  await expect(uploadSponsorMedia(new File(['x'], 'ad.png'), 'session')).rejects.toThrow('No autorizado');
  expect(fetch).toHaveBeenCalledTimes(1);
});
