// Keep one durable browser reference per action: localStorage does not provide compare-and-swap.
export function suspensionStoragePrefix(partidoId) {
  return `padbol:scoreboard:suspension-uncertain:${partidoId}`;
}
export function listSuspensionPending(partidoId) {
  const prefix=suspensionStoragePrefix(partidoId), keys=[];
  for(let i=0;i<window.localStorage.length;i++){
    const key=window.localStorage.key(i);
    if(key===prefix || key?.startsWith(`${prefix}:action:`)) keys.push(key);
  }
  return keys.sort().map(key=>{
    try { return {key,operation:JSON.parse(window.localStorage.getItem(key))}; }
    catch { return {key,operation:null}; }
  });
}
