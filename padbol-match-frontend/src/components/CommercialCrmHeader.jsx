import React, {useState} from 'react';
import {PADBOL_INTERNACIONAL_LOGO_ON_DARK} from '../constants/padbolInstitutionalBrand';
import CommercialAgendaAlerts from './CommercialAgendaAlerts';
import PushActivation from './PushActivation';

const initials = user => String(user?.user_metadata?.full_name || user?.email || '?').trim().slice(0, 2).toUpperCase();

export default function CommercialCrmHeader({view,role,user,token,api,onView,onNewLead,onSearch,onSignOut,adminReturn}) {
  const [query,setQuery]=useState('');
  const [canalesOpen,setCanalesOpen]=useState(false);
  const submitSearch = event => {
    event.preventDefault();
    onSearch?.(query.trim());
  };
  const agendaOpen = item => onView?.('team', item.conversationId || (item.channel==='form' ? item.id : null));
  return <header className="crm-header" aria-label="Cabecera del CRM comercial">
    <div className="crm-header-main">
      <div className="crm-header-brand">
        <img src={PADBOL_INTERNACIONAL_LOGO_ON_DARK} alt="Padbol Internacional" />
        <div><h1>Consultas comerciales</h1><p>Padbol Internacional · CRM comercial</p></div>
      </div>
      <nav className="crm-header-nav" aria-label="Navegación comercial">
        {adminReturn}
        {role==='manager'&&<button type="button" className={view==='inbox'?'is-active':''} aria-current={view==='inbox'?'page':undefined} onClick={()=>onView?.('inbox')}>Bandeja</button>}
        {role==='manager'&&<button type="button" className={view==='team'?'is-active':''} aria-current={view==='team'?'page':undefined} onClick={()=>onView?.('team')}>Equipo comercial</button>}
        <button type="button" className={view==='prospect'?'is-active':''} aria-current={view==='prospect'?'page':undefined} onClick={()=>onView?.('prospect')}>PADBOL PROSPECT</button>
        <button type="button" className="crm-header-add" onClick={onNewLead}>Agregar contacto</button>
        <CommercialAgendaAlerts api={api} onOpen={agendaOpen}/>
      </nav>
      <div className="crm-header-account">
        <PushActivation token={token}/>
        <span className="crm-header-avatar" aria-hidden="true">{initials(user)}</span>
        <div className="crm-header-user"><strong>{role==='manager'?'Dirección comercial':'Asesor comercial'}</strong><span>{user?.email || ''}</span></div>
        <button type="button" className="crm-header-signout" onClick={onSignOut}>Cerrar sesión</button>
      </div>
    </div>
    <div className="crm-header-sub">
      <form className="crm-header-search" role="search" onSubmit={submitSearch}>
        <label htmlFor="crm-header-search-input">Buscar consulta</label>
        <input id="crm-header-search-input" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar por ticket PB-…" maxLength={35}/>
        <button type="submit">Buscar</button>
      </form>
      <div className="crm-header-channels">
        <button type="button" aria-expanded={canalesOpen} onClick={()=>setCanalesOpen(value=>!value)}>Canales</button>
        {canalesOpen&&<div className="crm-header-channels-panel" role="status"><strong>Canales conectados</strong><span>Formularios web · entrada habilitada</span><span>Email · respuesta según permisos</span><span>WhatsApp · según configuración</span></div>}
      </div>
      <span className="crm-header-context">Plataforma Padbol Match <b>·</b> Entorno comercial</span>
    </div>
  </header>;
}
