import React from 'react';
import {useAuth} from '../context/AuthContext';
import {useMetaResultsAccess} from './meta/MetaResultsPanel';

function AuthorizedEntry() {
  const access = useMetaResultsAccess();
  if (access.loading || access.error || !access.canRead) return null;
  return <a href="/contenido-campanas?view=meta" style={{color:'inherit',alignSelf:'center'}}>Resultados de Meta</a>;
}

export default function CrmMetaResultsEntry() {
  const {session} = useAuth();
  const token = session?.access_token || '';
  // Remount the capability check on session changes; never retain old access.
  return token ? <AuthorizedEntry key={token} /> : null;
}
