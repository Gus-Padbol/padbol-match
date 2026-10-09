/** The listing contains private player contact data and requires the existing session. */
export function fetchBuscaDuplaList(apiBaseUrl, torneoId, accessToken, fetchImpl = fetch) {
  if (!accessToken) return Promise.resolve(null);
  return fetchImpl(`${apiBaseUrl}/api/torneos/${torneoId}/busca-dupla`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
