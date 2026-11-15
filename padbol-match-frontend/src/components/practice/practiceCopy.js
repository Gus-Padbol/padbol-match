const es = {
  title: 'Práctica Nations', note: 'Práctica aislada · Sin ranking ni resultados oficiales',
  choose: 'Elegí una cancha', viewerLogin: 'Para el visor del teléfono, ingresá con tu cuenta actual. La pantalla TV es pública.', view: 'Ver partido', tv: 'Abrir pantalla', court: 'Cancha', back: 'Volver a las canchas',
  spectator: 'Vista de espectador', referee: 'Control privado del árbitro', live: 'En vivo', paused: 'Pausado', pending: 'Preparado', finished: 'Finalizado',
  offline: 'Sin conexión · Último estado recibido', loading: 'Cargando partido…', expired: 'Esta práctica ya no está disponible.', forbidden: 'El enlace privado no es válido o ya venció.', error: 'No pudimos cargar la práctica. Volvé a intentar.', retry: 'Reintentar',
  account: 'Tu cuenta está conectada · Solo lectura', guest: 'Podés mirar sin controlar el partido.', login: 'Ingresar con tu cuenta',
  onCourt: 'En cancha', bench: 'Banco de suplentes', teamA: 'Equipo A', teamB: 'Equipo B', set: 'Set', sets: 'Sets', games: 'Games', points: 'Puntos', time: 'Tiempo de juego',
  start: 'Iniciar partido', pause: 'Pausar', resume: 'Reanudar', undo: 'Deshacer último punto', addA: 'Punto para A', addB: 'Punto para B',
  changes: 'Cambio de jugadores', changeHint: 'Solo al terminar un game impar, durante el cambio de lado.', team: 'Equipo', out: 'Sale', in: 'Entra', two: 'Cambiar dos jugadores', apply: 'Confirmar cambio', select: 'Elegir jugador',
  reset: 'Reiniciar esta práctica', resetConfirm: '¿Reiniciar únicamente este partido de práctica?', cancel: 'Cancelar', resetNow: 'Sí, reiniciar', format: 'Formato', groups: 'Grupos · STB a 10 sin diferencia', knockout: 'Eliminatorias · 3 sets completos',
  missingControl: 'Abrí el enlace privado de esta cancha que te compartió el organizador. El enlace de espectador no permite controlar.',
  conflict: 'Otro control actualizó el partido. Cargamos el estado nuevo; el punto no se repitió.',
  uncertain: 'No pudimos confirmar la respuesta. No marques otro punto todavía.', retrySame: 'Comprobar la misma acción', commandError: 'No se pudo aplicar la acción. Actualizá el partido y comprobá el estado.', refreshing: 'Actualizando…',
};
const en = {
  title: 'Nations practice', note: 'Isolated practice · No ranking or official results',
  choose: 'Choose a court', viewerLogin: 'Sign in with your existing account for the phone viewer. The TV display is public.', view: 'Watch match', tv: 'Open display', court: 'Court', back: 'Back to courts',
  spectator: 'Spectator view', referee: 'Private referee control', live: 'Live', paused: 'Paused', pending: 'Ready', finished: 'Finished',
  offline: 'Offline · Last received state', loading: 'Loading match…', expired: 'This practice is no longer available.', forbidden: 'The private link is invalid or has expired.', error: 'We could not load the practice. Please try again.', retry: 'Try again',
  account: 'Your account is connected · Read only', guest: 'You can watch without controlling the match.', login: 'Sign in to your account',
  onCourt: 'On court', bench: 'Substitutes', teamA: 'Team A', teamB: 'Team B', set: 'Set', sets: 'Sets', games: 'Games', points: 'Points', time: 'Playing time',
  start: 'Start match', pause: 'Pause', resume: 'Resume', undo: 'Undo last point', addA: 'Point for A', addB: 'Point for B',
  changes: 'Player substitution', changeHint: 'Only after an odd game, while changing ends.', team: 'Team', out: 'Out', in: 'In', two: 'Substitute two players', apply: 'Confirm substitution', select: 'Choose player',
  reset: 'Reset this practice match', resetConfirm: 'Reset only this practice match?', cancel: 'Cancel', resetNow: 'Yes, reset', format: 'Format', groups: 'Groups · First to 10 STB, no margin', knockout: 'Knockout · 3 full sets',
  missingControl: 'Open the private link for this court shared by the organiser. The spectator link does not allow control.',
  conflict: 'Another control updated the match. We loaded the new state; the point was not repeated.',
  uncertain: 'We could not confirm the response. Do not add another point yet.', retrySame: 'Check the same action', commandError: 'The action could not be applied. Refresh the match and check its state.', refreshing: 'Refreshing…',
};
export function practiceCopy(language = 'es') { return String(language).toLowerCase().startsWith('es') ? es : en; }
