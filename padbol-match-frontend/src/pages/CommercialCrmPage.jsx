import React from 'react';
import { useAuth } from '../context/AuthContext';
import WhatsappCrmDemo from './WhatsappCrmDemo';

export default function CommercialCrmPage() {
  const { signOutAndClear } = useAuth();
  return <>
    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 20px', background: '#0b1324', color: '#fff' }}>
      <button type="button" onClick={signOutAndClear}>Cerrar sesión</button>
    </div>
    <WhatsappCrmDemo requiredScope="commercial" />
  </>;
}
