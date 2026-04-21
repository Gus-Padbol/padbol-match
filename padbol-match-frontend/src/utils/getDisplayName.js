export function getDisplayName(userProfile, session) {
  if (userProfile?.alias) return userProfile.alias;
  if (userProfile?.nombre) return userProfile.nombre.split(' ')[0];
  if (session?.user?.user_metadata?.nombre) return session.user.user_metadata.nombre.split(' ')[0];
  if (session?.user?.email) return session.user.email.split('@')[0];
  return 'Jugador';
}
