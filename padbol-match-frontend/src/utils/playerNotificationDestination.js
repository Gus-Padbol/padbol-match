/** Resolve persisted notification links without allowing executable URL schemes. */
export function resolvePlayerNotificationDestination(link, origin) {
  const value = String(link || '').trim();
  if (!value) return null;
  try {
    const target = new URL(value, origin);
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) return null;
    if (target.origin === new URL(origin).origin) {
      return { external: false, href: `${target.pathname}${target.search}${target.hash}` };
    }
    return { external: true, href: target.href };
  } catch {
    return null;
  }
}
