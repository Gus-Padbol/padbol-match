export async function readLegacyTournamentDrawTeams(torneo,readTeams,language='es') {
  if(torneo?.plan_nations!=null)throw new Error(String(language).startsWith('en')?'This tournament uses the Nations Cup panel. Save its draw there to preserve groups, rules and its event record.':'Este torneo utiliza el panel Nations Cup. Su sorteo debe guardarse desde ese panel para conservar grupos, reglamento y expediente.');
  const teams=await readTeams();
  return Array.isArray(teams)?teams:[];
}
