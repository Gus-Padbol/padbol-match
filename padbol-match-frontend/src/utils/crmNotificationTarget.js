const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function crmNotificationConversation(value){return typeof value==='string'&&UUID.test(value)?value:null;}
export function crmNotificationFromSearch(search){return crmNotificationConversation(new URLSearchParams(search||'').get('conversationId'));}
