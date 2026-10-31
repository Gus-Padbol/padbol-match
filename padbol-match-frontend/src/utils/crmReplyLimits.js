// Same application contract as the CRM API/database; no slicing of drafts.
export const crmReplyLimit = channel => channel === 'email' || channel === 'form' ? 16384 : channel === 'whatsapp' ? 4096 : 0;
export const crmReplyLength = (text,channel = 'email') => channel === 'whatsapp' ? text.trim().length : Array.from(text.trim()).length;
