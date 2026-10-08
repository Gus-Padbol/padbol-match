import React from 'react';
import WhatsappCrmDemo from '../pages/WhatsappCrmDemo';

// Restore the integrated CRM workspace from e04c7e1e.
export default function AdminWhatsappSection({ accessToken, onBack }) {
  return <WhatsappCrmDemo accessToken={accessToken} onBack={onBack} />;
}
