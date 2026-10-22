// Share only an in-flight GET. Each caller gets an independent response body;
// settlement removes the token and URL, so later reads always revalidate.
const inFlight = new Map();
export function coalesceAuthenticatedGet(url, token) {
  if (!token) return fetch(url);
  let requests = inFlight.get(token);
  if (!requests) { requests = new Map(); inFlight.set(token, requests); }
  let pending = requests.get(url);
  if (!pending) {
    pending = Promise.resolve().then(() => fetch(url, { headers: { Authorization: `Bearer ${token}` } }))
      .finally(() => {
        requests.delete(url);
        if (!requests.size && inFlight.get(token) === requests) inFlight.delete(token);
      });
    requests.set(url, pending);
  }
  return pending.then(response => response.clone());
}
