import {useEffect,useMemo,useState} from 'react';
import {useAuth} from '../../context/AuthContext';
import {createMetaResultsApi} from '../../utils/metaResultsApi';

export function useMetaResultsAccess({api:providedApi,enabled=true}={}){
 const {session}=useAuth();
 const api=useMemo(()=>providedApi||createMetaResultsApi(session?.access_token||''),[providedApi,session?.access_token]);
 const [status,setStatus]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{if(!enabled)return undefined;let active=true;setLoading(true);setStatus(null);setError('');api.status().then(data=>{if(active)setStatus(data);}).catch(err=>{if(active&&err.status!==403)setError(err.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[api,enabled]);
 return {api,status,loading,error,canRead:!!status?.canRead,setStatus};
}
