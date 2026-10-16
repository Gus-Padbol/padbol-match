import { nombreListadoTorneoRanking } from './jugadorPerfil';

const copy = {
  es: ['Plaza pendiente', 'Participante sin cuenta'],
  en: ['Pending place', 'Participant without an account'],
  fr: ['Place en attente', 'Participant sans compte'],
  it: ['Posto in attesa', 'Partecipante senza account'],
  de: ['Ausstehender Platz', 'Teilnehmer ohne Konto'],
  pt: ['Vaga pendente', 'Participante sem conta'],
  ar: ['مكان شاغر', 'مشارك بدون حساب'],
  cs: ['Neobsazené místo', 'Účastník bez účtu'],
  ro: ['Loc în așteptare', 'Participant fără cont'],
};

/** A sporting participant UUID is not a registered profile or a public alias. */
export function tournamentRosterPresentation(player, language = 'es') {
  const labels = copy[String(language).split('-')[0]] || copy.en;
  const registry = Boolean(player?.participante_id);
  const pending = registry && player?.tipo_identidad === 'plaza_pendiente';
  const withoutAccount = registry && !player?.user_id;
  return {
    name: pending ? labels[0] : nombreListadoTorneoRanking(player),
    badge: !pending && withoutAccount ? labels[1] : '',
    canOpenProfile: !pending && !withoutAccount,
  };
}
