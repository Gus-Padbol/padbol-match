import { normalizePlayerNotifications, normalizeNotificationIds, markPlayerNotificationsRead } from './playerNotificationsApi';
const originalFetch=global.fetch;
afterEach(()=>{global.fetch=originalFetch;});
const base='https://api.qa.example';
const headers={Authorization:'Bearer fixture'};
test('reads the actual backend object and preserves UUID and virtual notification ids',()=>{
 const rows=[{id:'ab6d7b67-0de6-4761-a402-1ef8082d26ec',leida:false},{id:'solicitud-qa',leida:false}];
 expect(normalizePlayerNotifications({notificaciones:rows,unread_count:2})).toEqual(rows);
 expect(normalizePlayerNotifications(rows)).toEqual(rows);
 expect(normalizePlayerNotifications({})).toEqual([]);
 expect(normalizeNotificationIds([12,'12','solicitud-qa',null,''])).toEqual(['12','solicitud-qa']);
});
test('marks a UUID through the mounted route with the current bearer',async()=>{
 global.fetch=jest.fn(async()=>({ok:true,json:async()=>({ok:true})}));
 const id='ab6d7b67-0de6-4761-a402-1ef8082d26ec';
 expect(await markPlayerNotificationsRead([id],{headers,apiBaseUrl:base})).toEqual([id]);
 expect(global.fetch).toHaveBeenCalledWith(`${base}/api/notificaciones/${id}/leer`,{method:'PATCH',headers});
});
test('marks all through leer-todas rather than issuing a nonexistent batch route',async()=>{
 global.fetch=jest.fn(async()=>({ok:true,json:async()=>({ok:true})}));
 expect(await markPlayerNotificationsRead([1,2,'solicitud-qa'],{all:true,headers,apiBaseUrl:base})).toEqual(['1','2','solicitud-qa']);
 expect(global.fetch).toHaveBeenCalledTimes(1);
 expect(global.fetch).toHaveBeenCalledWith(`${base}/api/notificaciones/leer-todas`,{method:'PATCH',headers});
});
test('HTTP errors do not report ids as confirmed and retain the error for visible retry',async()=>{
 global.fetch=jest.fn(async()=>({ok:false,status:503,json:async()=>({error:'Service unavailable'})}));
 await expect(markPlayerNotificationsRead(['uuid-fixture'],{headers,apiBaseUrl:base})).rejects.toMatchObject({message:'Service unavailable',status:503});
});
test('network errors and malformed success payloads cannot mark a notification as read',async()=>{
 global.fetch=jest.fn(async()=>{throw new Error('offline');});
 await expect(markPlayerNotificationsRead([1],{headers,apiBaseUrl:base})).rejects.toThrow('offline');
 global.fetch=jest.fn(async()=>({ok:true,json:async()=>({})}));
 await expect(markPlayerNotificationsRead([1],{headers,apiBaseUrl:base})).rejects.toThrow('notification_read_failed');
});
test('empty ids make no HTTP request',async()=>{
 global.fetch=jest.fn();expect(await markPlayerNotificationsRead([],{apiBaseUrl:base})).toEqual([]);expect(global.fetch).not.toHaveBeenCalled();
});
